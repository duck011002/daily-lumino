import json
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.actions import ActionRequest, InterpretActionResponse
from app.services import action_executor
from app.services.llm import get_llm_client_and_model, get_system_config


CONTEXT_TOOLS = {
    "ledger": {
        "create_ledger_entry",
        "update_ledger_entry",
        "delete_ledger_entry",
    },
    "todos": {"create_todo", "update_todo", "delete_todo"},
    "blog": {"create_blog_post", "update_blog_post", "publish_blog_post"},
    "library": {"update_library_profile", "upsert_library_media_card"},
    "general": {
        "create_ledger_entry",
        "update_ledger_entry",
        "delete_ledger_entry",
        "create_todo",
        "update_todo",
        "delete_todo",
        "create_blog_post",
        "update_blog_post",
        "publish_blog_post",
        "update_library_profile",
        "upsert_library_media_card",
    },
}

BLOG_TOOLS = {"create_blog_post", "update_blog_post", "publish_blog_post"}
LIBRARY_TOOLS = {"update_library_profile", "upsert_library_media_card"}

TOOL_DESCRIPTIONS = {
    "create_ledger_entry": "记录一笔收入或支出。category_name 可使用已有分类，也可在用户明确要求时创建新分类。",
    "update_ledger_entry": "按 entry_id 修改当前用户的一笔账目。",
    "delete_ledger_entry": "按 entry_id 删除当前用户的一笔账目。",
    "create_todo": "创建当前用户的待办事项。",
    "update_todo": "按 todo_id 修改当前用户的待办事项。",
    "delete_todo": "按 todo_id 删除当前用户的待办事项。",
    "create_blog_post": "创建当前用户的私密博客草稿；此工具永远不会公开发布。",
    "update_blog_post": "修改当前用户的博客标题或正文；此工具永远不改变公开和发布状态。",
    "publish_blog_post": "仅在用户明确要求公开发布时，发布指定 post_id 的博客草稿。",
    "update_library_profile": "修改超级管理员的全局 Library 资料。",
    "upsert_library_media_card": "在超级管理员的全局 Library 新增或更新收藏卡片。",
}

SYSTEM_PROMPT = """你是 Lumino 的行动规划器。只在用户意图清楚、执行所需字段完整时调用工具。
金额、目标对象或关键内容不明确时，直接用简短中文追问，不得猜测或执行。
记账金额必须是正数；根据语义判断收入或支出。优先匹配常见分类，用户明确提出新分类时可通过 category_name 创建。
博客创建默认只能生成私密草稿。只有用户明确说“公开发布”并指定目标时，才可调用 publish_blog_post；update_blog_post 不得替代发布。
只能使用本次提供的工具，不能输出 SQL、代码或不存在的工具。"""


def _tool_specs(names: set[str]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": TOOL_DESCRIPTIONS[name],
                "parameters": action_executor.TOOLS[name].argument_model.model_json_schema(),
            },
        }
        for name in sorted(names)
    ]


def _default_model_id(db: Session) -> str:
    raw = get_system_config(db, "ai_providers")
    if raw:
        try:
            providers = json.loads(raw)
            for provider in providers:
                if provider.get("is_reachable") is False or not provider.get("api_key"):
                    continue
                model = provider.get("model")
                if not model:
                    models = provider.get("models") or []
                    model = models[0] if models else None
                if provider.get("id") and model:
                    return f"{provider['id']}:{model}"
        except (TypeError, ValueError, json.JSONDecodeError):
            pass
    return "qwen"


def _parse_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0].strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("模型返回的行动计划不是 JSON 对象。")
    return value


def _tools_unsupported(exc: Exception) -> bool:
    message = str(exc).lower()
    return ("tool" in message or "function" in message) and any(
        marker in message
        for marker in ("unsupported", "not support", "unknown", "invalid parameter")
    )


class OpenAIActionModel:
    def __init__(self, client, model_name: str):
        self.client = client
        self.model_name = model_name

    @classmethod
    def from_db(cls, db: Session, model_id: str | None = None):
        client, model_name = get_llm_client_and_model(
            db, model_id or _default_model_id(db)
        )
        return cls(client, model_name)

    def plan(
        self, *, message: str, context: str, tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"当前入口：{context}\n用户：{message}"},
        ]
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0,
            )
        except Exception as exc:
            if not _tools_unsupported(exc):
                raise
            return self._json_fallback(messages, tools)

        model_message = response.choices[0].message
        calls = getattr(model_message, "tool_calls", None) or []
        if calls:
            actions = []
            for call in calls:
                actions.append(
                    {
                        "tool": call.function.name,
                        "arguments": json.loads(call.function.arguments or "{}"),
                    }
                )
            return {"text": model_message.content or "", "actions": actions}
        return {"text": model_message.content or ""}

    def _json_fallback(
        self, messages: list[dict[str, str]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        schema_hint = [
            {
                "tool": item["function"]["name"],
                "arguments_schema": item["function"]["parameters"],
            }
            for item in tools
        ]
        fallback_messages = [
            {
                "role": "system",
                "content": (
                    SYSTEM_PROMPT
                    + "\n仅返回 JSON 对象："
                    + '{"text":"给用户的回复","actions":[{"tool":"工具名","arguments":{}}]}。'
                    + "\n工具定义："
                    + json.dumps(schema_hint, ensure_ascii=False)
                ),
            },
            messages[-1],
        ]
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=fallback_messages,
            temperature=0,
        )
        return _parse_json_object(response.choices[0].message.content or "{}")


def _normalize_plan(raw: Any) -> tuple[str, list[dict[str, Any]]]:
    if not isinstance(raw, dict):
        return "我没能可靠理解这条指令，请换一种更明确的说法。", []
    text = raw.get("text") if isinstance(raw.get("text"), str) else ""
    if isinstance(raw.get("tool"), str):
        actions = [
            {
                "tool": raw["tool"],
                "arguments": raw.get("arguments") or {},
            }
        ]
    else:
        actions = raw.get("actions") or []
    if not isinstance(actions, list):
        return text or "行动计划格式无效，请重新描述。", []
    valid = []
    for item in actions:
        if not isinstance(item, dict) or not isinstance(item.get("tool"), str):
            continue
        arguments = item.get("arguments")
        if not isinstance(arguments, dict):
            continue
        valid.append({"tool": item["tool"], "arguments": arguments})
    return text, valid


def interpret_and_execute(
    db: Session,
    user: User,
    message: str,
    *,
    context: str = "general",
    model=None,
    model_id: str | None = None,
    idempotency_key: str | None = None,
) -> InterpretActionResponse:
    allowed_tools = set(CONTEXT_TOOLS.get(context, set()))
    if not user.is_root and not user.can_write_blog:
        allowed_tools -= BLOG_TOOLS
    if not user.is_root:
        allowed_tools -= LIBRARY_TOOLS
    planner_model = model or OpenAIActionModel.from_db(db, model_id)
    try:
        raw_plan = planner_model.plan(
            message=message,
            context=context,
            tools=_tool_specs(allowed_tools),
        )
    except (TypeError, ValueError, json.JSONDecodeError):
        return InterpretActionResponse(
            text="我没能可靠解析这条指令，因此没有修改任何内容。请换一种更明确的说法。",
            actions=[],
        )
    text, planned_actions = _normalize_plan(raw_plan)
    if any(item["tool"] not in allowed_tools for item in planned_actions):
        return InterpretActionResponse(
            text="当前入口不允许执行模型提出的操作，我没有进行任何修改。",
            actions=[],
        )

    try:
        for planned in planned_actions:
            action_executor.TOOLS[planned["tool"]].argument_model.model_validate(
                planned["arguments"]
            )
    except (KeyError, ValueError):
        return InterpretActionResponse(
            text="这条指令仍缺少执行所需的信息，因此没有修改任何内容。请补充后再试。",
            actions=[],
        )

    receipts = []
    base_key = idempotency_key or uuid4().hex
    for index, planned in enumerate(planned_actions):
        receipt = action_executor.execute_action(
            db,
            user,
            ActionRequest(
                tool=planned["tool"],
                arguments=planned["arguments"],
                idempotency_key=f"{base_key}:{index}",
            ),
            source="web_ai",
        )
        receipts.append(receipt)

    if receipts and not text:
        text = f"已完成 {len(receipts)} 项操作。"
    if not receipts and not text:
        text = "请再提供更明确的信息，我暂时没有修改任何内容。"
    return InterpretActionResponse(text=text, actions=receipts)
