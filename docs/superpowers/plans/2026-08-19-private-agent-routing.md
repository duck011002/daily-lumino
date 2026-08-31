---
id: plan/private-agent-routing-20260819
type: historical-implementation-plan
status: superseded
source_of_truth: docs/features/chat-ai/current.md
last_reviewed_at: 2026-08-28
---

# Lumino Private Agent Routing Implementation Plan

> **历史计划：** 下方复选框是原实施过程记录，不是当前任务队列。修改 AI 路由或 MCP 前，先阅读 `docs/features/chat-ai/current.md`、`walkthrough.md` 与 `docs/integrations/mcp/current.md`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Lumino 主对话升级为先由大模型自动选择聊天、记账、待办、博客或 Library 的私人 Agent，并让模块入口默认调用对应工具，同时交付网页博客确认、Library 查询去重和 MCP 默认发布规则。

**Architecture:** 新增 `PrivateAgentRouter` 作为模型决策层，使用控制工具区分普通聊天、澄清、博客提案和真实动作；所有写入仍进入现有 `ActionExecutor`。网页博客通过持久化提案确认后保存草稿；Library 写入在领域服务中强制去重；统一 MCP 与兼容 Blog MCP 共享发布权限语义。

**Tech Stack:** FastAPI、SQLAlchemy、Alembic、Pydantic、FastMCP、OpenAI-compatible SDK、Next.js 14、React、TypeScript、pytest。

---

## File map

- Create `backend/app/schemas/private_agent.py`: Agent 路由、控制动作和博客提案输入输出。
- Create `backend/app/services/private_agent_router.py`: 模型路由、控制工具和最近会话上下文构建。
- Create `backend/app/models/ai_action_proposal.py`: 待确认博客动作。
- Create `backend/app/services/action_proposals.py`: 提案创建、确认、取消、过期与权限校验。
- Create `backend/alembic/versions/c8d7f1a2b304_add_ai_action_proposals.py`: 提案表迁移。
- Create `backend/tests/test_private_agent.py`: 路由、上下文、澄清和四类能力测试。
- Modify `backend/app/routers/chat.py`: 移除关键词正则，让每条消息先进入 Agent。
- Modify `backend/app/services/ai_action_planner.py`: 上下文推断提示、批量动作和模块工具限制。
- Modify `backend/app/schemas/actions.py`: 返回提案与路由类型。
- Modify `backend/app/routers/actions.py`: 模块入口解释、提案确认与取消 API。
- Modify `backend/app/services/library_actions.py`: Library 归一化查询与强制去重。
- Modify `backend/app/services/action_executor.py`: Library 预检与既有工具复用。
- Modify `backend/app/mcp_lumino.py`: Library 查询工具与博客默认发布。
- Modify `backend/app/mcp_blog.py`: 兼容 Blog MCP 默认请求发布。
- Modify `backend/app/mcp_library.py`: 复用 Library 去重服务。
- Create `frontend/src/components/ai/ActionProposal.tsx`: 博客预览、保存草稿和取消卡片。
- Modify `frontend/src/components/chat/ChatWindow.tsx`: 接收提案 SSE 与确认结果。
- Modify `frontend/src/components/ai/AIQuickAction.tsx`: 模块入口展示提案。
- Modify `frontend/src/app/blog/manage/page.tsx`: 博客提案确认后刷新列表。
- Modify `docs/lumino-mcp-chatgpt.md`: MCP 默认发布与权限说明。
- Modify `docs/operations/2026-08-19-unified-ai-ledger-mcp-release.md`: 私人 Agent 上线检查。

### Task 1: 建立私人 Agent 路由契约

**Files:**
- Create: `backend/app/schemas/private_agent.py`
- Create: `backend/app/services/private_agent_router.py`
- Create: `backend/tests/test_private_agent.py`

- [ ] **Step 1: 写路由模型失败测试**

```python
def test_router_exposes_only_permitted_contexts(db, user_factory):
    user = user_factory("agent-router")
    model = FakeRouterModel({"route": "execute", "context": "ledger"})

    decision = route_private_agent(
        db,
        user,
        "记录，20号吃饭50",
        history=[],
        model=model,
    )

    assert decision.route == "execute"
    assert decision.context == "ledger"
    assert "library" not in model.allowed_contexts


def test_root_router_can_choose_library(db, user_factory):
    root = user_factory("agent-router-root", is_root=True)
    model = FakeRouterModel({"route": "execute", "context": "library"})

    decision = route_private_agent(db, root, "添加到 Library", history=[], model=model)

    assert decision.context == "library"
    assert "library" in model.allowed_contexts
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_private_agent.py`

Expected: FAIL，提示 `app.services.private_agent_router` 不存在。

- [ ] **Step 3: 定义结构化路由类型**

```python
from typing import Literal

from pydantic import BaseModel, Field, model_validator


AgentRoute = Literal["chat", "execute", "clarify", "propose_blog"]
AgentContext = Literal["ledger", "todos", "blog", "library"]


class PrivateAgentDecision(BaseModel):
    route: AgentRoute
    context: AgentContext | None = None
    question: str | None = Field(None, max_length=500)
    proposal: dict | None = None

    @model_validator(mode="after")
    def validate_route_payload(self):
        if self.route == "execute" and self.context is None:
            raise ValueError("execute 路由必须指定 context")
        if self.route == "clarify" and not self.question:
            raise ValueError("clarify 路由必须提供 question")
        return self
```

- [ ] **Step 4: 实现模型路由与权限裁剪**

```python
ROUTER_PROMPT = """你是 Lumino AI 私人 Agent 的第一层路由模型。
每条消息只能选择 chat、execute、clarify 或 propose_blog。
能根据常识和上下文可靠推断时不得追问；没有真实执行意图时选择 chat。
只有网页用户要求生成博客时选择 propose_blog，并给出完整标题和正文。
"""


def allowed_contexts(user: User) -> set[str]:
    result = {"ledger", "todos"}
    if user.is_root or user.can_write_blog:
        result.add("blog")
    if user.is_root:
        result.add("library")
    return result


def route_private_agent(db, user, message, *, history, model=None):
    contexts = allowed_contexts(user)
    router_model = model or OpenAIPrivateAgentModel.from_db(db)
    raw = router_model.route(
        message=message,
        history=history[-8:],
        allowed_contexts=contexts,
        now=datetime.now(SHANGHAI),
    )
    decision = PrivateAgentDecision.model_validate(raw)
    if decision.context and decision.context not in contexts:
        return PrivateAgentDecision(
            route="clarify", question="当前账号没有执行该操作的权限。"
        )
    return decision
```

- [ ] **Step 5: 运行路由测试**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_private_agent.py`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/app/schemas/private_agent.py backend/app/services/private_agent_router.py backend/tests/test_private_agent.py
git commit -m "feat: route every private agent message with an LLM"
```

### Task 2: 主聊天取消关键词门禁

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/tests/test_chat.py`

- [ ] **Step 1: 写截图场景和普通聊天失败测试**

```python
def test_chat_routes_record_without_keyword_regex(client, auth_headers, monkeypatch):
    session_id = create_chat_session(client, auth_headers)
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(route="execute", context="ledger"),
    )
    monkeypatch.setattr(
        "app.routers.chat.interpret_and_execute",
        lambda *_, **__: one_ledger_receipt("50.00"),
    )

    response = client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "记录，20号吃饭50"},
        cookies=auth_headers,
    )

    assert '"type": "action_succeeded"' in response.text


def test_chat_route_chat_uses_original_stream(client, auth_headers, monkeypatch):
    session_id = create_chat_session(client, auth_headers)
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(route="chat"),
    )
    monkeypatch.setattr(
        "app.routers.chat.stream_chat_completion",
        lambda *_, **__: iter(["普通回答"]),
    )

    response = send_chat(client, auth_headers, session_id, "解释 Harness")

    assert "普通回答" in response.text
    assert "action_succeeded" not in response.text
```

- [ ] **Step 2: 运行测试并确认旧正则导致失败**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_chat.py::test_chat_routes_record_without_keyword_regex tests/test_chat.py::test_chat_route_chat_uses_original_stream`

Expected: FAIL，第一条没有行动回执或 `route_private_agent` 未被调用。

- [ ] **Step 3: 移除正则并接入四路决策**

```python
def sse(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


def save_assistant_message(db, session, content: str) -> ChatMessage:
    message = ChatMessage(
        session_id=session.id,
        role=ChatRoleType.ASSISTANT,
        content=content,
        attachments=None,
        tokens_used=estimate_tokens(content),
    )
    db.add(message)
    session.updated_at = datetime.now()
    db.commit()
    db.refresh(message)
    return message


decision = route_private_agent(
    local_db,
    local_user,
    message_in.content,
    history=[{"role": item.role.value, "content": item.content} for item in history],
)
if decision.route == "chat":
    accumulated_text = ""
    for chunk in stream_chat_completion(
        local_db,
        local_session,
        history,
        message_in.content,
        message_in.attachments,
    ):
        accumulated_text += chunk
        yield sse("chunk", {"content": chunk})
    assistant_msg = save_assistant_message(
        local_db, local_session, accumulated_text
    )
    yield sse("done", {"message_id": assistant_msg.id})
    return
if decision.route == "clarify":
    accumulated_text = decision.question or "请补充必要信息。"
    yield sse("chunk", {"content": accumulated_text})
    assistant_msg = save_assistant_message(
        local_db, local_session, accumulated_text
    )
    yield sse("done", {"message_id": assistant_msg.id})
    return
if decision.route == "execute":
    interpretation = interpret_and_execute(
        local_db,
        local_user,
        message_in.content,
        context=decision.context,
        idempotency_key=f"chat:{user_message_id}",
    )
    for receipt in interpretation.actions:
        yield sse("action_succeeded", receipt.model_dump(mode="json"))
    yield sse("chunk", {"content": interpretation.text})
    assistant_msg = save_assistant_message(
        local_db, local_session, interpretation.text
    )
    yield sse("done", {"message_id": assistant_msg.id})
    return
```

删除 `ACTION_INTENT_PATTERN` 和 `looks_like_action_request`。普通聊天仍调用 `stream_chat_completion`，行动模型使用系统 Agent API。

- [ ] **Step 4: 确保成功文案必须有回执**

当 `execute` 路由返回零行动时，只能显示澄清或“没有修改任何内容”，不能保存“已记录”类文案。

- [ ] **Step 5: 运行聊天回归**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_chat.py`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/app/routers/chat.py backend/tests/test_chat.py
git commit -m "fix: route private assistant messages before chatting"
```

### Task 3: 放宽账本和待办的可推断字段

**Files:**
- Modify: `backend/app/services/ai_action_planner.py`
- Modify: `backend/tests/test_actions.py`

- [ ] **Step 1: 写提示构建与批量执行失败测试**

```python
def test_action_prompt_contains_context_inference_rules():
    prompt = build_action_system_prompt(
        context="ledger", now=datetime(2026, 8, 19, 13, 0)
    )
    assert "午饭" in prompt and "餐饮" in prompt
    assert "烟酒" in prompt
    assert "当前年份" in prompt
    assert "拆成多笔" in prompt


def test_planner_executes_batch_ledger_actions(db, user_factory):
    model = FakeToolModel()
    model.reply_with_actions(
        ledger_batch_for_august_17_and_18()
    )

    result = interpret_and_execute(
        db,
        user_factory("batch-ledger"),
        "8.17 午饭16.79，烟36，8.18 午饭21，烟20",
        context="ledger",
        model=model,
    )

    assert len(result.actions) == 4
```

- [ ] **Step 2: 运行并确认失败**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_actions.py::test_action_prompt_contains_context_inference_rules tests/test_actions.py::test_planner_executes_batch_ledger_actions`

Expected: FAIL，提示函数或批量 Fake 接口不存在。

- [ ] **Step 3: 按上下文构建明确提示词**

```python
def build_action_system_prompt(context: str, now: datetime) -> str:
    shared = f"当前上海时间：{now:%Y-%m-%d %H:%M}。能可靠推断时直接执行，不得追问。"
    if context == "ledger":
        return shared + """
午饭、晚饭、早餐、吃饭和外卖归入餐饮；烟和酒归入烟酒，分类不存在时允许创建。
部分日期补当前年份，未给日期使用当前时间。一句话多组日期、事项和金额必须拆成多笔。
只有金额缺失或无法判断收支时才追问。
"""
    if context == "todos":
        return shared + """
未给截止时间时直接创建无时间待办；未给优先级使用 medium。
只有用户明确要求某个提醒时段但仍无法得到具体时刻时才追问。
"""
    return shared + SYSTEM_PROMPT
```

- [ ] **Step 4: 创建待办无时间回归测试**

```python
def test_planner_creates_todo_without_due_time(db, user_factory):
    model = FakeToolModel()
    model.reply_with("create_todo", {"title": "学习 Harness"})

    result = interpret_and_execute(
        db, user_factory("todo-no-time"), "提醒学 Harness", context="todos", model=model
    )

    assert result.actions[0].status == "succeeded"
    assert result.actions[0].result["due_at"] is None
```

- [ ] **Step 5: 运行行动测试**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_actions.py tests/test_ledger.py tests/test_todos.py`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/ai_action_planner.py backend/tests/test_actions.py
git commit -m "fix: infer common ledger and todo fields"
```

### Task 4: 持久化网页博客待确认提案

**Files:**
- Create: `backend/app/models/ai_action_proposal.py`
- Create: `backend/app/services/action_proposals.py`
- Create: `backend/alembic/versions/c8d7f1a2b304_add_ai_action_proposals.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/actions.py`
- Modify: `backend/app/routers/actions.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_action_proposals.py`

- [ ] **Step 1: 写确认前不创建博客的失败测试**

```python
def test_blog_proposal_creates_draft_only_after_confirmation(db, user_factory):
    author = user_factory("proposal-author")
    author.can_write_blog = True
    proposal = create_proposal(
        db,
        author,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "私人 Agent", "content": "正文"},
    )

    assert db.scalar(select(func.count(BlogPost.id))) == 0
    receipt = confirm_proposal(db, author, proposal.id)
    post = db.get(BlogPost, receipt.target_id)
    assert post is not None
    assert post.is_public is False
    assert post.is_published is False
```

- [ ] **Step 2: 运行并确认模型不存在**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_action_proposals.py`

Expected: FAIL，提示 `AIActionProposal` 不存在。

- [ ] **Step 3: 创建模型和迁移**

```python
class AIActionProposal(Base):
    __tablename__ = "ai_action_proposals"
    id: Mapped[int] = mapped_column(BIGINT_PK, primary_key=True)
    user_id: Mapped[int] = mapped_column(BIGINT_FK, ForeignKey("users.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(BIGINT_FK, ForeignKey("chat_sessions.id"), nullable=True)
    tool: Mapped[str] = mapped_column(String(100), nullable=False)
    arguments_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    action_run_id: Mapped[int | None] = mapped_column(BIGINT_FK, ForeignKey("ai_action_runs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

迁移从 `b4a1f6c8d209` 创建上述表和用户/状态/过期索引。

- [ ] **Step 4: 实现提案服务**

```python
def confirm_proposal(db: Session, user: User, proposal_id: int) -> ActionReceipt:
    proposal = get_owned_pending_proposal(db, user, proposal_id, for_update=True)
    if proposal.expires_at <= datetime.utcnow():
        proposal.status = "expired"
        db.commit()
        raise ProposalExpiredError("该博客提案已过期。")
    receipt = execute_action(
        db,
        user,
        ActionRequest(
            tool=proposal.tool,
            arguments=proposal.arguments_json,
            idempotency_key=f"proposal:{proposal.id}",
        ),
        source="web_ai_confirmation",
    )
    proposal.status = "confirmed"
    proposal.action_run_id = receipt.action_id
    proposal.resolved_at = datetime.utcnow()
    db.commit()
    return receipt
```

确认前使用 `action_executor.TOOLS[tool].argument_model` 校验参数；只允许 `create_blog_post` 提案。重复确认返回同一回执，不重复创建。

- [ ] **Step 5: 增加越权、取消、过期和重复确认测试**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_action_proposals.py`

Expected: PASS，且覆盖 owner 隔离、一次确认和 24 小时过期。

- [ ] **Step 6: 提交**

```bash
git add backend/app/models backend/app/services/action_proposals.py backend/app/schemas/actions.py backend/app/routers/actions.py backend/app/main.py backend/alembic/versions/c8d7f1a2b304_add_ai_action_proposals.py backend/tests/test_action_proposals.py
git commit -m "feat: add confirmable blog action proposals"
```

### Task 5: 将博客生成接入私人 Agent 和模块入口

**Files:**
- Modify: `backend/app/services/private_agent_router.py`
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/app/routers/actions.py`
- Modify: `backend/tests/test_private_agent.py`
- Modify: `backend/tests/test_chat.py`
- Modify: `backend/tests/test_action_proposals.py`

- [ ] **Step 1: 写网页博客提案 SSE 失败测试**

```python
def test_chat_blog_generation_emits_proposal_not_action(client, writer_cookies, monkeypatch):
    session_id = create_chat_session(client, writer_cookies)
    monkeypatch.setattr(
        "app.routers.chat.route_private_agent",
        lambda *_, **__: PrivateAgentDecision(
            route="propose_blog",
            context="blog",
            proposal={"title": "Agent", "content": "完整正文"},
        ),
    )

    response = send_chat(client, writer_cookies, session_id, "写一篇关于 Agent 的博客")

    assert '"type": "action_proposed"' in response.text
    assert db.scalar(select(func.count(BlogPost.id))) == 0
```

- [ ] **Step 2: 运行并确认当前会直接创建或无提案事件**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_chat.py::test_chat_blog_generation_emits_proposal_not_action`

Expected: FAIL。

- [ ] **Step 3: 路由创建提案并发送事件**

```python
if decision.route == "propose_blog":
    proposal = create_proposal(
        local_db,
        local_user,
        session_id=session_id,
        tool="create_blog_post",
        arguments=decision.proposal or {},
    )
    yield sse(
        "action_proposed",
        {
            "proposal_id": proposal.id,
            "tool": proposal.tool,
            "arguments": proposal.arguments_json,
            "expires_at": proposal.expires_at.isoformat(),
        },
    )
    yield from persist_agent_text("博客已生成，请预览后决定是否保存为草稿。")
    return
```

`POST /api/ai/actions/interpret` 在 `context="blog"` 时使用相同提案路径并返回 `proposals`，不能直接执行 `create_blog_post`。

- [ ] **Step 4: 支持同一会话“同意保存”**

路由输入包含最近的 pending 提案。模型返回确认意图时调用 `confirm_proposal`，并发送 `action_succeeded` 回执；“取消”调用取消服务。

- [ ] **Step 5: 运行相关测试**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_private_agent.py tests/test_chat.py tests/test_action_proposals.py tests/test_blog.py`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/private_agent_router.py backend/app/routers/chat.py backend/app/routers/actions.py backend/tests/test_private_agent.py backend/tests/test_chat.py backend/tests/test_action_proposals.py
git commit -m "feat: propose blogs before saving web drafts"
```

### Task 6: Library 查询优先与服务端去重

**Files:**
- Modify: `backend/app/services/library_actions.py`
- Modify: `backend/app/services/action_executor.py`
- Modify: `backend/app/mcp_lumino.py`
- Modify: `backend/app/mcp_library.py`
- Modify: `backend/tests/test_actions.py`
- Modify: `backend/tests/test_mcp_lumino.py`
- Modify: `backend/tests/test_mcp_library.py`

- [ ] **Step 1: 写完全重复和同标题冲突测试**

```python
def test_library_duplicate_is_rejected_before_write(db, root_user):
    first = upsert_media_card(
        db,
        root_user,
        UpsertLibraryMediaCardArguments(
            title="Harness",
            category="book",
            creator="Someone",
            year="2026",
            url="https://example.com/harness",
        ),
    )

    with pytest.raises(LibraryDuplicateError) as exc:
        upsert_media_card(
            db,
            root_user,
            UpsertLibraryMediaCardArguments(
                title="  harness ",
                category="book",
                creator="someone",
                year="2026",
                url="https://example.com/harness/",
            ),
        )

    assert exc.value.existing_id == first[1].id
    assert len(load_site_profile(db).media_cards) == 1
```

- [ ] **Step 2: 运行并确认当前会创建重复卡片**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_actions.py::test_library_duplicate_is_rejected_before_write`

Expected: FAIL，卡片数量为 2 或未抛出异常。

- [ ] **Step 3: 实现归一化和预检**

```python
def normalize_library_text(value: str | None) -> str:
    return " ".join((value or "").strip().split()).casefold()


def normalize_library_url(value: str | None) -> str:
    return (value or "").strip().rstrip("/").casefold()


def find_media_card_match(profile, payload):
    normalized_url = normalize_library_url(payload.url)
    for card in profile.media_cards:
        if normalized_url and normalize_library_url(card.url) == normalized_url:
            return LibraryMatch(kind="exact", card=card)
        same_title = (
            card.category == payload.category
            and normalize_library_text(card.title) == normalize_library_text(payload.title)
        )
        if same_title:
            exact = (
                normalize_library_text(card.creator) == normalize_library_text(payload.creator)
                and normalize_library_text(card.year) == normalize_library_text(payload.year)
            )
            return LibraryMatch(kind="exact" if exact else "conflict", card=card)
    return None
```

无 `card_id` 新增时先调用该函数；`exact` 抛出包含现有 ID 的 `LibraryDuplicateError`，`conflict` 抛出 `LibraryConflictError`。有稳定 `card_id` 的显式更新不做新增去重，但不能改成与其他卡片重复。

- [ ] **Step 4: Agent 执行前返回已存在或冲突确认**

```python
def preflight_library_upsert(db, arguments):
    payload = UpsertLibraryMediaCardArguments.model_validate(arguments)
    match = find_media_card_match(load_site_profile(db), payload)
    if match and match.kind == "exact":
        return InterpretActionResponse(
            text=f"该内容已经在 Library 中（卡片 {match.card.id}），没有重复添加。",
            actions=[],
        )
    if match and match.kind == "conflict":
        return InterpretActionResponse(
            text="Library 中已有同名但信息不同的内容。请确认是更新现有条目，还是作为不同版本新增。",
            actions=[],
        )
    return None
```

`interpret_and_execute` 在执行 `upsert_library_media_card` 前调用该预检。只有返回 `None` 才进入 `ActionExecutor`；因此“已存在”不会产生虚假成功回执。

- [ ] **Step 5: 增加统一 MCP 查询工具**

```python
@lumino_mcp.tool(description="Search root Library cards before adding or updating one.")
def search_library_media_cards(query: str) -> list[dict[str, Any]]:
    identity = _identity()
    _require_scope(identity, "library:read")
    with SessionLocal() as db:
        user = _user(db, identity)
        _require_root(user)
        return [item.model_dump(mode="json") for item in search_media_cards(db, query)]
```

兼容 Library MCP 的 upsert 改为复用 `library_actions.upsert_media_card`，不再维护独立写入实现。

- [ ] **Step 6: 运行 Library 测试**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_actions.py tests/test_mcp_lumino.py tests/test_mcp_library.py`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add backend/app/services/library_actions.py backend/app/services/action_executor.py backend/app/mcp_lumino.py backend/app/mcp_library.py backend/tests/test_actions.py backend/tests/test_mcp_lumino.py backend/tests/test_mcp_library.py
git commit -m "feat: search and deduplicate Library additions"
```

### Task 7: MCP 创建博客按权限默认公开

**Files:**
- Modify: `backend/app/mcp_blog.py`
- Modify: `backend/app/mcp_lumino.py`
- Modify: `backend/tests/test_blog.py`
- Modify: `backend/tests/test_mcp_lumino.py`

- [ ] **Step 1: 写两种 Token 行为失败测试**

```python
def test_mcp_blog_create_defaults_to_publish_when_allowed(db, mcp_blog_identity):
    mcp_blog_identity.allow_auto_publish = True
    result = create_blog_post(title="公开文章", content="正文")
    assert result["status"] == "published"


def test_mcp_blog_create_stays_draft_when_auto_publish_disabled(db, mcp_blog_identity):
    mcp_blog_identity.allow_auto_publish = False
    result = create_blog_post(title="草稿文章", content="正文")
    assert result["status"] == "draft"
    assert "disabled" in result["notice"].lower()
```

- [ ] **Step 2: 运行并确认默认 `publish=False` 导致失败**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_blog.py tests/test_mcp_lumino.py`

Expected: 至少默认公开测试 FAIL。

- [ ] **Step 3: 修改兼容 Blog MCP 默认参数**

```python
@blog_mcp.tool(description="Create a blog post; publish by default when this token permits auto-publish.")
def create_blog_post(
    title: str,
    content: str,
    category_slug: str | None = None,
    excerpt: str | None = None,
    cover_url: str | None = None,
    tags: list[str] | None = None,
    slug: str | None = None,
    publish: bool = True,
) -> dict[str, Any]:
    return _create_post(
        title=title,
        content=content,
        category_slug=category_slug,
        excerpt=excerpt,
        cover_url=cover_url,
        tags=tags,
        supplied_slug=slug,
        publish=publish,
    )
```

保留 `_create_post` 的 `can_publish = publish and identity.allow_auto_publish`，因此关闭开关的 Token 仍创建草稿。

- [ ] **Step 4: 修改统一 MCP 创建后条件发布**

```python
created = _execute("create_blog_post", arguments, idempotency_key)
if identity.allow_auto_publish:
    _require_scope(identity, "blog:publish")
    return _execute(
        "publish_blog_post",
        {"post_id": created["target_id"]},
        f"{idempotency_key or created['action_id']}:publish",
    )
return {
    **created,
    "notice": "Auto-publish is disabled, so this post was created as a private draft.",
}
```

`update_blog_post` 保持现状，不接收发布字段。

- [ ] **Step 5: 运行 Blog 与 MCP 回归**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q tests/test_blog.py tests/test_mcp_lumino.py tests/test_actions.py`

Expected: PASS，更新草稿/公开文章都保持原状态。

- [ ] **Step 6: 提交**

```bash
git add backend/app/mcp_blog.py backend/app/mcp_lumino.py backend/tests/test_blog.py backend/tests/test_mcp_lumino.py
git commit -m "feat: publish MCP blog creates by token policy"
```

### Task 8: 前端显示博客提案并确认

**Files:**
- Create: `frontend/src/components/ai/ActionProposal.tsx`
- Modify: `frontend/src/components/chat/ChatWindow.tsx`
- Modify: `frontend/src/components/ai/AIQuickAction.tsx`
- Modify: `frontend/src/app/blog/manage/page.tsx`

- [ ] **Step 1: 定义提案类型和确认组件**

```tsx
export interface ActionProposalData {
  proposal_id: number
  tool: 'create_blog_post'
  arguments: { title: string; content: string; excerpt?: string | null }
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  expires_at: string
}

export default function ActionProposal({ proposal, onConfirmed }: Props) {
  const confirm = async () => {
    const response = await api.post(`/ai/actions/proposals/${proposal.proposal_id}/confirm`)
    onConfirmed(response.data)
  }
  return (
    <article>
      <h3>{proposal.arguments.title}</h3>
      <MarkdownPreview source={proposal.arguments.content} />
      <button onClick={confirm}>保存为草稿</button>
      <button onClick={cancel}>取消</button>
    </article>
  )
}
```

- [ ] **Step 2: 处理 `action_proposed` SSE**

```tsx
if (parsed.type === 'action_proposed') {
  setActionProposals((previous) => [
    ...previous.filter((item) => item.proposal_id !== parsed.proposal_id),
    parsed as ActionProposalData,
  ])
}
```

确认成功后移除 pending 卡片、加入 `ActionReceipt`，并刷新博客管理列表。

- [ ] **Step 3: 模块快捷入口支持 `proposals`**

`AIQuickAction` 的响应类型增加 `proposals: ActionProposalData[]`；博客 context 展示提案，账本与待办仍直接展示回执。

- [ ] **Step 4: 运行 TypeScript 和 Lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`

Expected: exit 0；允许仓库已有警告，不得新增错误。

- [ ] **Step 5: 运行生产构建**

Run: `cd frontend && npm run build`

Expected: `Compiled successfully`，并包含 `/chat`、`/blog/manage`、`/ledger` 和 `/todos`。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/ai/ActionProposal.tsx frontend/src/components/chat/ChatWindow.tsx frontend/src/components/ai/AIQuickAction.tsx frontend/src/app/blog/manage/page.tsx
git commit -m "feat: confirm generated blog drafts in the web agent"
```

### Task 9: 文档、全量验证与生产部署

**Files:**
- Modify: `docs/lumino-mcp-chatgpt.md`
- Modify: `docs/operations/2026-08-19-unified-ai-ledger-mcp-release.md`

- [ ] **Step 1: 更新行为文档**

记录以下可验收事实：主聊天每条消息先过 Agent；模块入口工具受限；网页博客确认后保存草稿；MCP 按 Token 开关默认公开；Library 新增查询优先并有服务端去重。

- [ ] **Step 2: 运行中文 UTF-8 检查**

Run: 对本计划涉及的所有中文文件使用 UTF-8 解码，报告 ASCII `?` 与 `\ufffd` 数量，并验证“私人 Agent”“保存为草稿”“Library 去重”“默认公开”等短语存在。

Expected: 零个异常 ASCII `?`、零个 `\ufffd`，所有短语存在。

- [ ] **Step 3: 运行后端全量测试与迁移检查**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q && venv/Scripts/python.exe -m compileall -q app && venv/Scripts/alembic.exe heads`

Expected: 全部测试 PASS，单一 head 为 `c8d7f1a2b304`。

- [ ] **Step 4: 运行前端全量验证**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`

Expected: exit 0。

- [ ] **Step 5: 提交文档**

```bash
git add docs/lumino-mcp-chatgpt.md docs/operations/2026-08-19-unified-ai-ledger-mcp-release.md
git commit -m "docs: document private agent action behavior"
```

- [ ] **Step 6: 推送并部署**

本地与远端 `master` 同步后，在生产服务器干净 `master` 上运行：

```bash
cd /opt/lumino
./scripts/deploy-production.sh
```

- [ ] **Step 7: 生产冒烟**

验证提交号、Alembic head、PM2 单一前后端应用、资源回落、公网 `/api/health`、未认证 MCP 401、后台用户响应校验和 AI 默认模型连接。使用无隐私测试账号验证三张截图场景，测试博客只保存草稿；MCP 默认公开只使用无隐私占位文章并在测试后按产品规则处理。
