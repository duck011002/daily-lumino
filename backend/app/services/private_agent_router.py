import json
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from sqlalchemy.orm import Session

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
            "只返回 JSON 对象，route 只能是 chat、execute、clarify。\n"
            "普通问答和闲聊选择 chat；需要实际创建或修改数据选择 execute，并从允许的 context 中选择。\n"
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
) -> PrivateAgentDecision:
    contexts = allowed_agent_contexts(user)
    router_model = model or OpenAIPrivateAgentModel.from_db(db)
    raw = router_model.route(
        message=message,
        history=_recent_text_history(history),
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
