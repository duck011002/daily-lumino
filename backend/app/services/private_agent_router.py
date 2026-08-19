import json
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_action_proposal import AIActionProposal
from app.models.user import User
from app.schemas.private_agent import PrivateAgentDecision
from app.services.ai_action_planner import _default_model_id, _parse_json_object
from app.services.llm import get_llm_client_and_model


SHANGHAI_TIMEZONE = timezone(timedelta(hours=8))
RECENT_HISTORY_LIMIT = 8


def allowed_agent_contexts(user: User) -> set[str]:
    contexts = {"ledger", "todos"}
    if user.is_root or user.can_write_blog:
        contexts.add("blog")
    if user.is_root:
        contexts.add("library")
    return contexts


def _recent_text_history(history: list[dict[str, Any]]) -> list[dict[str, str]]:
    messages = []
    for item in history:
        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant", "system"}:
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        messages.append({"role": role, "content": content.strip()})
    return messages[-RECENT_HISTORY_LIMIT:]


class AgentRouterModel(Protocol):
    def route(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        allowed_contexts: set[str],
        now: datetime,
    ) -> dict[str, Any]: ...


class OpenAIPrivateAgentModel:
    def __init__(self, client, model_name: str):
        self.client = client
        self.model_name = model_name

    @classmethod
    def from_db(cls, db: Session):
        client, model_name = get_llm_client_and_model(db, _default_model_id(db))
        return cls(client, model_name)

    def route(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        allowed_contexts: set[str],
        now: datetime,
    ) -> dict[str, Any]:
        allowed = sorted(allowed_contexts)
        system_prompt = (
            "你是 Lumino AI 私人助手的意图路由器。每条消息都必须先由你判断。\n"
            "只返回 JSON 对象，route 只能是 chat、execute、clarify、propose_blog、confirm_proposal、cancel_proposal。\n"
            "普通问答和闲聊选择 chat；需要实际创建或修改数据选择 execute，并从允许的 context 中选择。\n"
            "网页用户要求写新博客时选择 propose_blog，context 为 blog，并在 proposal 中生成可预览的完整 title 和 content；此时绝不直接保存。\n"
            "如果历史中列出了待确认提案，用户明确同意保存时选择 confirm_proposal，用户取消时选择 cancel_proposal，并原样返回 proposal_id。\n"
            "仅当关键事实无法安全推断时才选择 clarify，并在 question 中给出一句简短追问。\n"
            f"允许的 context：{json.dumps(allowed, ensure_ascii=False)}。\n"
            "不能选择未授权 context，也不能声称已经执行任何操作。\n"
            f"当前上海时间：{now.isoformat()}。"
        )
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                *history,
                {"role": "user", "content": message},
            ],
            temperature=0,
        )
        return _parse_json_object(response.choices[0].message.content or "{}")


def route_private_agent(
    db: Session,
    user: User,
    message: str,
    *,
    history: list[dict[str, Any]],
    model: AgentRouterModel | None = None,
    session_id: int | None = None,
) -> PrivateAgentDecision:
    contexts = allowed_agent_contexts(user)
    router_model = model or OpenAIPrivateAgentModel.from_db(db)
    recent_history = _recent_text_history(history)
    proposal_query = select(AIActionProposal).where(
        AIActionProposal.user_id == user.id,
        AIActionProposal.status == "pending",
        AIActionProposal.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
    )
    if session_id is not None:
        proposal_query = proposal_query.where(AIActionProposal.session_id == session_id)
    pending = list(
        db.scalars(proposal_query.order_by(AIActionProposal.created_at.desc()).limit(3))
    )
    if pending:
        recent_history.append(
            {
                "role": "system",
                "content": "当前待确认博客提案："
                + json.dumps(
                    [
                        {
                            "proposal_id": item.id,
                            "title": item.arguments_json.get("title"),
                        }
                        for item in pending
                    ],
                    ensure_ascii=False,
                ),
            }
        )
    raw = router_model.route(
        message=message,
        history=recent_history,
        allowed_contexts=contexts,
        now=datetime.now(SHANGHAI_TIMEZONE),
    )
    decision = PrivateAgentDecision.model_validate(raw)
    if decision.context is not None and decision.context not in contexts:
        return PrivateAgentDecision(
            route="clarify",
            question="当前账号没有执行这项操作的权限，请改用已授权的功能。",
        )
    return decision
