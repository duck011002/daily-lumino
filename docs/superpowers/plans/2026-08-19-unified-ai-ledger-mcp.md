---
id: plan/unified-ai-ledger-mcp-20260819
type: historical-implementation-plan
status: superseded
source_of_truth: docs/features/ledger-todos/current.md
last_reviewed_at: 2026-08-28
---

# Lumino Unified AI Ledger and MCP Implementation Plan

> **历史计划：** 下方复选框是原实施过程记录，不是当前任务队列。账本、待办与 MCP 的现状分别以 `docs/features/ledger-todos/current.md` 和 `docs/integrations/mcp/current.md` 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个用户交付基础记账，并让网页表单、站内 AI 与统一 MCP 通过同一业务层操作记账、待办、博客和 Library，同时修复管理后台用户列表和 AI 连接自检。

**Architecture:** 新增领域服务、统一行动执行器和带范围的 MCP Token。REST、MCP 和聊天只负责鉴权与协议转换，所有写入由领域服务执行；`ai_action_runs` 提供幂等、审计和撤销。旧博客与 Library MCP 保持兼容。

**Tech Stack:** FastAPI、SQLAlchemy、Alembic、Pydantic、FastMCP、OpenAI-compatible Python SDK、Next.js 14、React、TypeScript、Tailwind CSS、pytest。

---

## 文件结构

后端新增：

- `backend/app/models/ledger.py`：账目与分类 ORM。
- `backend/app/models/ai_action.py`：行动审计 ORM。
- `backend/app/models/mcp_lumino_token.py`：统一 MCP Token ORM。
- `backend/app/schemas/ledger.py`：记账 API 输入输出。
- `backend/app/schemas/actions.py`：行动请求、回执和撤销结构。
- `backend/app/services/ledger.py`：分类、账目和统计领域服务。
- `backend/app/services/todos.py`：待办领域服务。
- `backend/app/services/action_executor.py`：工具注册、权限、幂等和撤销。
- `backend/app/services/ai_provider_health.py`：服务商自检和错误分类。
- `backend/app/services/ai_action_planner.py`：模型工具调用规划。
- `backend/app/routers/ledger.py`：记账 REST 路由。
- `backend/app/routers/actions.py`：站内 AI 快捷行动路由。
- `backend/app/mcp_lumino.py`：统一 MCP 服务。
- `backend/alembic/versions/b4a1f6c8d209_add_ledger_actions_and_lumino_mcp.py`：数据库迁移。
- `backend/tests/test_ledger.py`：记账服务与 API 测试。
- `backend/tests/test_actions.py`：行动、幂等、撤销和权限测试。
- `backend/tests/test_mcp_lumino.py`：统一 MCP 测试。

后端修改：

- `backend/tests/conftest.py`：提供跨领域用户与登录测试工厂。
- `backend/app/models/__init__.py`：注册新增模型。
- `backend/app/schemas/user.py`：分离注册输入与历史用户输出邮箱校验。
- `backend/app/schemas/admin.py`：增加 AI 自检结构。
- `backend/app/routers/admin.py`：返回可解释的 AI 自检结果。
- `backend/app/routers/todos.py`：改为调用待办服务。
- `backend/app/routers/chat.py`：接入工具规划与 SSE 行动事件。
- `backend/app/main.py`：注册记账、行动和统一 MCP。
- `backend/tests/test_admin.py`：增加两个生产问题的回归测试。
- `backend/tests/test_todos_and_anniversaries.py`：增加待办 API 和用户隔离测试。

前端新增：

- `frontend/src/app/ledger/page.tsx`：账本页面。
- `frontend/src/components/ai/AIQuickAction.tsx`：模块快捷输入。
- `frontend/src/components/ai/ActionReceipt.tsx`：行动结果与撤销。
- `frontend/src/components/ledger/LedgerEntryForm.tsx`：快速记账表单。
- `frontend/src/components/ledger/LedgerSummary.tsx`：月度汇总。

前端修改：

- `frontend/src/app/admin/page.tsx`：用户加载错误和 AI 自检详情。
- `frontend/src/app/dashboard/page.tsx`：增加账本入口。
- `frontend/src/app/todos/page.tsx`：增加 AI 快捷输入。
- `frontend/src/app/blog/manage/page.tsx`：增加 AI 快捷输入。
- `frontend/src/app/admin/profile/page.tsx`：超级管理员 Library 快捷输入。
- `frontend/src/app/chat/[id]/page.tsx`：消费行动 SSE 事件。
- `frontend/src/components/chat/ChatWindow.tsx`：展示行动回执。

文档修改：

- `docs/operations/production-deployment-runbook.md`：增加迁移、用户列表和 AI 自检门禁。
- `docs/lumino-mcp-chatgpt.md`：补充统一 MCP 配置。

### Task 0: 建立跨领域测试工厂

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: 增加用户和登录工厂**

```python
@pytest.fixture
def user_factory(db):
    def create(username: str, *, is_root: bool = False) -> User:
        user = User(
            username=username,
            email=f"{username}@example.com",
            password=hash_password("password123"),
            display_name=username,
            is_root=is_root,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return create


@pytest.fixture
def user_cookies_factory(client, user_factory):
    def create(username: str, *, is_root: bool = False):
        user = user_factory(username, is_root=is_root)
        response = client.post(
            "/api/auth/login",
            json={"username_or_email": username, "password": "password123"},
        )
        assert response.status_code == 200
        return user, response.cookies

    return create
```

- [ ] **Step 2: 运行现有测试确认工厂无副作用**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_admin.py backend/tests/test_blog.py -q`

Expected: PASS。

- [ ] **Step 3: 提交**

```bash
git add backend/tests/conftest.py
git commit -m "test: add authenticated user factories"
```

### Task 1: 修复两个生产回归

**Files:**
- Modify: `backend/app/schemas/user.py`
- Create: `backend/app/services/ai_provider_health.py`
- Modify: `backend/app/schemas/admin.py`
- Modify: `backend/app/routers/admin.py`
- Modify: `backend/tests/test_admin.py`
- Modify: `frontend/src/app/admin/page.tsx`

- [ ] **Step 1: 写历史 `.local` 邮箱失败测试**

```python
def test_admin_lists_legacy_local_email(client, admin_test_setup, db):
    legacy = User(
        username="legacy-user",
        email="legacy@lumino.local",
        password=hash_password("password123"),
        is_active=True,
    )
    db.add(legacy)
    db.commit()
    response = client.get("/api/admin/users", cookies=admin_test_setup["admin"])
    assert response.status_code == 200
    assert any(item["email"] == "legacy@lumino.local" for item in response.json())
```

- [ ] **Step 2: 运行测试并确认响应校验失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_admin.py::test_admin_lists_legacy_local_email -q`

Expected: FAIL，`ResponseValidationError` 指向保留域邮箱。

- [ ] **Step 3: 分离输入与输出模型**

```python
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    is_root: bool
    is_active: bool
    can_create_spaces: bool
    is_discipline_authorized: bool
    can_write_blog: bool
    can_use_mcp: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

`UserCreate` 继续继承含 `EmailStr` 的输入模型，新注册邮箱仍严格校验。

- [ ] **Step 4: 写 AI 错误分类失败测试**

```python
def test_ai_connection_classifies_product_not_activated(client, admin_test_setup, monkeypatch):
    monkeypatch.setattr(
        "app.routers.admin.run_provider_health_check",
        lambda **kwargs: ProviderHealthResult.failure(
            model="qwen-flash",
            category="product_not_activated",
            message="The product is not activated",
        ),
    )
    response = client.post(
        "/api/admin/ai/test-connection",
        cookies=admin_test_setup["admin"],
        json={"id": "qwen", "base_url": "https://example.com/v1", "api_key": "masked****key", "model": "qwen-flash"},
    )
    assert response.json()["error_category"] == "product_not_activated"
    assert response.json()["model"] == "qwen-flash"
```

- [ ] **Step 5: 实现服务商自检结果**

```python
class ProviderHealthResult(BaseModel):
    status: Literal["success", "error"]
    message: str
    model: str
    checked_at: datetime
    latency_ms: int
    error_category: str | None = None
    action_hint: str | None = None
```

错误分类至少覆盖 `network`、`authentication`、`product_not_activated`、`model_unavailable`、`rate_limit`、`quota` 和 `unknown`。

- [ ] **Step 6: 更新后台展示并验证**

失败时展示实际模型、检查时间、错误分类和操作建议；用户列表请求失败时显示错误，不再伪装成“共 0 个账号”。

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_admin.py -q`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add backend/app/schemas/user.py backend/app/services/ai_provider_health.py backend/app/schemas/admin.py backend/app/routers/admin.py backend/tests/test_admin.py frontend/src/app/admin/page.tsx
git commit -m "fix: restore admin users and explain AI health checks"
```

### Task 2: 建立记账数据库模型

**Files:**
- Create: `backend/app/models/ledger.py`
- Create: `backend/app/models/ai_action.py`
- Create: `backend/app/models/mcp_lumino_token.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/b4a1f6c8d209_add_ledger_actions_and_lumino_mcp.py`
- Create: `backend/tests/test_ledger.py`

- [ ] **Step 1: 写模型约束测试**

```python
def test_ledger_entry_uses_decimal_and_user_scoped_idempotency(db, user_factory):
    user = user_factory("ledger-model")
    category = LedgerCategory(user_id=user.id, name="餐饮", normalized_name="餐饮", entry_type="expense")
    db.add(category)
    db.flush()
    entry = LedgerEntry(
        user_id=user.id,
        category_id=category.id,
        entry_type="expense",
        amount=Decimal("28.50"),
        currency="CNY",
        occurred_at=datetime(2026, 8, 19, 12, 0),
        source="web_form",
        idempotency_key="model-test",
    )
    db.add(entry)
    db.commit()
    assert entry.amount == Decimal("28.50")
```

- [ ] **Step 2: 确认测试因模型不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_ledger.py -q`

Expected: FAIL，无法导入 `LedgerEntry`。

- [ ] **Step 3: 实现三个模型和约束**

模型使用 `BIGINT_PK`、`BIGINT_FK`，账目金额使用 `Numeric(12, 2)`；分类唯一约束覆盖 `user_id`、`entry_type`、`normalized_name`；账目幂等唯一约束覆盖 `user_id`、`idempotency_key`。

- [ ] **Step 4: 编写 Alembic 升降级**

迁移从 `e8f9a2b4c105` 向前，创建 `ledger_categories`、`ledger_entries`、`ai_action_runs` 和 `mcp_lumino_tokens`，并建立用户、月份查询、Token 哈希和幂等索引。

- [ ] **Step 5: 验证模型测试和迁移语法**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_ledger.py -q`

Expected: PASS。

Run: `cd backend && venv/Scripts/alembic.exe heads`

Expected: `b4a1f6c8d209 (head)`。

- [ ] **Step 6: 提交**

```bash
git add backend/app/models backend/alembic/versions/b4a1f6c8d209_add_ledger_actions_and_lumino_mcp.py backend/tests/test_ledger.py
git commit -m "feat: add ledger action and unified MCP models"
```

### Task 3: 实现记账领域服务和 REST API

**Files:**
- Create: `backend/app/schemas/ledger.py`
- Create: `backend/app/services/ledger.py`
- Create: `backend/app/routers/ledger.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_ledger.py`

- [ ] **Step 1: 写默认分类、查重和创建账目失败测试**

```python
def test_create_entry_initializes_categories_and_is_idempotent(db, user_factory):
    user = user_factory("ledger-service")
    first = create_entry(db, user, LedgerEntryCreate(entry_type="expense", amount="28", category_name="餐饮", note="午饭", idempotency_key="lunch-1"))
    second = create_entry(db, user, LedgerEntryCreate(entry_type="expense", amount="28", category_name="餐饮", note="午饭", idempotency_key="lunch-1"))
    assert first.id == second.id
    assert first.amount == Decimal("28.00")
```

- [ ] **Step 2: 确认服务不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_ledger.py::test_create_entry_initializes_categories_and_is_idempotent -q`

Expected: FAIL。

- [ ] **Step 3: 实现分类和账目服务**

服务函数包括 `ensure_default_categories`、`create_category`、`rename_category`、`archive_category`、`create_entry`、`list_entries`、`update_entry`、`soft_delete_entry`、`restore_entry` 和 `get_month_summary`。所有实体查询必须同时过滤 `user_id`。

- [ ] **Step 4: 写用户隔离和统计测试**

```python
def test_summary_excludes_other_users_and_deleted_entries(db, user_factory):
    owner = user_factory("ledger-owner")
    stranger = user_factory("ledger-stranger")
    first_payload = LedgerEntryCreate(entry_type="expense", amount="20", category_name="餐饮", idempotency_key="a")
    removed_payload = LedgerEntryCreate(entry_type="expense", amount="30", category_name="交通", idempotency_key="b")
    stranger_payload = LedgerEntryCreate(entry_type="expense", amount="900", category_name="购物", idempotency_key="c")
    create_entry(db, owner, first_payload)
    removed = create_entry(db, owner, removed_payload)
    soft_delete_entry(db, owner, removed.id)
    create_entry(db, stranger, stranger_payload)
    summary = get_month_summary(db, owner, 2026, 8)
    assert summary.expense_total == Decimal("20.00")
```

- [ ] **Step 5: 实现 REST 路由并写鉴权测试**

路由按设计提供分类、账目、恢复和汇总接口。缺少登录态返回 401，跨用户实体统一返回 404。

- [ ] **Step 6: 运行记账测试**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_ledger.py -q`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add backend/app/schemas/ledger.py backend/app/services/ledger.py backend/app/routers/ledger.py backend/app/main.py backend/tests/test_ledger.py
git commit -m "feat: add private ledger API and monthly summaries"
```

### Task 4: 交付账本网页

**Files:**
- Create: `frontend/src/app/ledger/page.tsx`
- Create: `frontend/src/components/ledger/LedgerEntryForm.tsx`
- Create: `frontend/src/components/ledger/LedgerSummary.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: 定义前端账本类型和 API 调用**

页面读取 `/ledger/categories`、`/ledger/entries` 和 `/ledger/summary`，金额始终按字符串接收后格式化，不能先转二进制浮点再累计。

- [ ] **Step 2: 实现快速记账与分类新增**

表单包含收支类型、金额、分类、时间和备注。分类选择支持在同一表单新增；成功后刷新汇总和列表。

- [ ] **Step 3: 实现月度概览、筛选和软删除恢复**

删除后显示恢复按钮；切换月份时同时刷新列表与汇总。移动端保持单列，桌面端使用概览加列表布局。

- [ ] **Step 4: 增加工作台入口**

新增“我的账本”卡片，链接 `/ledger`，只对登录用户显示。

- [ ] **Step 5: 验证类型和构建**

Run: `cd frontend && npx tsc --noEmit`

Expected: exit 0。

Run: `cd frontend && npm run lint`

Expected: exit 0。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/app/ledger frontend/src/components/ledger frontend/src/app/dashboard/page.tsx
git commit -m "feat: add personal ledger workspace"
```

### Task 5: 加固待办领域并增加统一服务

**Files:**
- Create: `backend/app/services/todos.py`
- Modify: `backend/app/schemas/todo.py`
- Modify: `backend/app/routers/todos.py`
- Modify: `backend/tests/test_todos_and_anniversaries.py`

- [ ] **Step 1: 写非法枚举和跨用户失败测试**

```python
def test_todo_api_rejects_invalid_priority(client, user_cookies_factory):
    _, cookies = user_cookies_factory("todo-invalid")
    response = client.post("/api/todos", cookies=cookies, json={"title": "x", "priority": "urgent"})
    assert response.status_code == 422

def test_todo_update_hides_other_users_item(client, db, user_cookies_factory):
    owner, _ = user_cookies_factory("todo-owner")
    _, stranger_cookies = user_cookies_factory("todo-stranger")
    todo = Todo(user_id=owner.id, title="private")
    db.add(todo)
    db.commit()
    response = client.patch(f"/api/todos/{todo.id}", cookies=stranger_cookies, json={"status": "completed"})
    assert response.status_code == 404
```

- [ ] **Step 2: 确认非法优先级当前被接受**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_todos_and_anniversaries.py -q`

Expected: FAIL。

- [ ] **Step 3: 用 Literal 收紧输入并抽取服务**

`TodoCreate` 与 `TodoUpdate` 使用 Literal；路由只做 Depends 和 HTTP 转换，领域服务负责用户过滤、创建和更新。

- [ ] **Step 4: 运行测试并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_todos_and_anniversaries.py -q`

Expected: PASS。

```bash
git add backend/app/services/todos.py backend/app/schemas/todo.py backend/app/routers/todos.py backend/tests/test_todos_and_anniversaries.py
git commit -m "refactor: harden user-scoped todo services"
```

### Task 6: 建立行动执行器、幂等和撤销

**Files:**
- Create: `backend/app/schemas/actions.py`
- Create: `backend/app/services/action_executor.py`
- Create: `backend/app/routers/actions.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_actions.py`

- [ ] **Step 1: 写重复行动和撤销失败测试**

```python
def test_action_executor_is_idempotent_and_undoes_ledger_create(db, user_factory):
    user = user_factory("actions")
    request = ActionRequest(tool="create_ledger_entry", arguments={"entry_type": "expense", "amount": "18", "category_name": "餐饮"}, idempotency_key="action-1")
    first = execute_action(db, user, request, source="web_ai")
    second = execute_action(db, user, request, source="web_ai")
    assert first.action_id == second.action_id
    undo = undo_action(db, user, first.action_id)
    assert undo.status == "undone"
```

- [ ] **Step 2: 确认执行器不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_actions.py -q`

Expected: FAIL。

- [ ] **Step 3: 实现工具注册与标准回执**

```python
@dataclass(frozen=True)
class ActionTool:
    name: str
    required_scope: str
    argument_model: type[BaseModel]
    execute: Callable[..., ActionMutation]
    undo: Callable[..., ActionMutation]
```

注册记账和待办工具。`ActionExecutor` 在调用前校验参数与权限，在同一事务写入业务实体和 `AIActionRun`。

- [ ] **Step 4: 实现行动 REST API**

提供 `POST /api/ai/actions/execute` 和 `POST /api/ai/actions/{action_id}/undo`。网页只使用登录态，不能传入权限范围。

- [ ] **Step 5: 运行测试并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_actions.py -q`

Expected: PASS。

```bash
git add backend/app/schemas/actions.py backend/app/services/action_executor.py backend/app/routers/actions.py backend/app/main.py backend/tests/test_actions.py
git commit -m "feat: add audited idempotent AI actions"
```

### Task 7: 建立统一 Lumino MCP

**Files:**
- Create: `backend/app/mcp_lumino.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/routers/admin.py`
- Modify: `backend/app/schemas/admin.py`
- Modify: `frontend/src/app/admin/page.tsx`
- Create: `backend/tests/test_mcp_lumino.py`

- [ ] **Step 1: 写 Token 范围和绑定用户测试**

```python
def test_lumino_mcp_token_limits_scopes(db, user_factory):
    user = user_factory("mcp-ledger")
    raw, credential = issue_lumino_token(db, user, label="Codex", scopes=["ledger:read", "ledger:write"])
    identity = resolve_lumino_identity(db, raw, record_usage=False)
    assert identity.user_id == user.id
    assert "todo:write" not in identity.scopes
```

- [ ] **Step 2: 确认统一 MCP 模块不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_mcp_lumino.py -q`

Expected: FAIL。

- [ ] **Step 3: 实现 Token 中间件和工具**

统一 MCP 工具调用 `ActionExecutor`。第一批完整暴露记账分类、账目、汇总、待办和撤销；博客与 Library 工具通过 Task 10 的适配器注册。

- [ ] **Step 4: 增加后台 Token 管理**

超级管理员可选择绑定用户和范围；Library 写范围只允许 root；原始 Token 只显示一次。

- [ ] **Step 5: 挂载会话生命周期**

`main.py` 在 lifespan 启动 `lumino_mcp.session_manager`，并挂载 `/api/mcp/lumino`。

- [ ] **Step 6: 运行测试并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_mcp_lumino.py backend/tests/test_admin.py -q`

Expected: PASS。

```bash
git add backend/app/mcp_lumino.py backend/app/main.py backend/app/routers/admin.py backend/app/schemas/admin.py frontend/src/app/admin/page.tsx backend/tests/test_mcp_lumino.py
git commit -m "feat: add scoped unified Lumino MCP"
```

### Task 8: 实现 AI 工具规划和快捷行动

**Files:**
- Create: `backend/app/services/ai_action_planner.py`
- Modify: `backend/app/routers/actions.py`
- Modify: `backend/tests/test_actions.py`

- [ ] **Step 1: 写明确记账、分类新增和模糊金额测试**

```python
class FakeToolModel:
    def __init__(self):
        self.response = None

    def reply_with(self, tool: str, arguments: dict):
        self.response = {"tool": tool, "arguments": arguments}

    def reply_with_text(self, text: str):
        self.response = {"text": text}


@pytest.fixture
def fake_tool_model():
    return FakeToolModel()


def test_planner_executes_clear_expense(fake_tool_model, db, user_factory):
    fake_tool_model.reply_with("create_ledger_entry", {"entry_type": "expense", "amount": "28", "category_name": "餐饮", "note": "午饭"})
    result = interpret_and_execute(db, user_factory("planner"), "午饭 28", context="ledger", model=fake_tool_model)
    assert result.actions[0].status == "succeeded"

def test_planner_does_not_execute_ambiguous_amount(fake_tool_model, db, user_factory):
    fake_tool_model.reply_with_text("请问金额是多少")
    result = interpret_and_execute(db, user_factory("planner-ambiguous"), "记一下今天午饭", context="ledger", model=fake_tool_model)
    assert result.actions == []
```

- [ ] **Step 2: 确认规划器不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_actions.py -q`

Expected: FAIL。

- [ ] **Step 3: 实现工具定义、模型调用和结果生成**

规划器只向模型提供当前用户有权使用的工具。优先处理原生 `tool_calls`；服务商明确不支持工具时使用严格 JSON 行动数组降级。任何解析失败都返回追问文本且不执行。

- [ ] **Step 4: 增加快捷解释接口**

`POST /api/ai/actions/interpret` 接受 `message` 和 `context`，返回文本答复与结构化行动回执。

- [ ] **Step 5: 运行测试并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_actions.py -q`

Expected: PASS。

```bash
git add backend/app/services/ai_action_planner.py backend/app/routers/actions.py backend/tests/test_actions.py
git commit -m "feat: interpret natural language into Lumino actions"
```

### Task 9: 接入网页聊天 SSE 和快捷入口

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/tests/test_chat.py`
- Create: `frontend/src/components/ai/AIQuickAction.tsx`
- Create: `frontend/src/components/ai/ActionReceipt.tsx`
- Modify: `frontend/src/components/chat/ChatWindow.tsx`
- Modify: `frontend/src/app/chat/[id]/page.tsx`
- Modify: `frontend/src/app/ledger/page.tsx`
- Modify: `frontend/src/app/todos/page.tsx`
- Modify: `frontend/src/app/blog/manage/page.tsx`
- Modify: `frontend/src/app/admin/profile/page.tsx`

- [ ] **Step 1: 写 SSE 行动事件测试**

```python
def test_chat_stream_emits_action_receipt(client, user_cookies, fake_action_planner):
    response = client.post("/api/chat/sessions/1/messages", cookies=user_cookies, json={"content": "午饭 28", "attachments": []})
    assert '"type": "action_succeeded"' in response.text
    assert '"tool": "create_ledger_entry"' in response.text
```

- [ ] **Step 2: 确认当前聊天只输出 chunk 和 done**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_chat.py::test_chat_stream_emits_action_receipt -q`

Expected: FAIL。

- [ ] **Step 3: 扩展聊天生成器**

生成器先发行动开始事件，执行后发成功或失败事件，再生成最终答复并保存 assistant 消息。业务失败必须转为事件，不能中断整个 SSE。

- [ ] **Step 4: 实现统一快捷输入和回执卡片**

`AIQuickAction` 接受 `context` 和可选占位文案，调用 `/ai/actions/interpret`；`ActionReceipt` 展示记账、待办、博客和 Library 结果以及撤销按钮。

- [ ] **Step 5: 接入四个页面**

账本和待办对所有登录用户显示；博客管理只对可写作者显示；Library 只对 root 显示。

- [ ] **Step 6: 运行后端和前端检查并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_chat.py backend/tests/test_actions.py -q`

Expected: PASS。

Run: `cd frontend && npx tsc --noEmit && npm run lint`

Expected: exit 0。

```bash
git add backend/app/routers/chat.py backend/tests/test_chat.py frontend/src/components/ai frontend/src/components/chat/ChatWindow.tsx frontend/src/app/chat frontend/src/app/ledger frontend/src/app/todos/page.tsx frontend/src/app/blog/manage/page.tsx frontend/src/app/admin/profile/page.tsx
git commit -m "feat: execute Lumino actions from web chat"
```

### Task 10: 接入博客和 Library 领域适配器

**Files:**
- Create: `backend/app/services/blog_actions.py`
- Create: `backend/app/services/library_actions.py`
- Modify: `backend/app/mcp_blog.py`
- Modify: `backend/app/mcp_library.py`
- Modify: `backend/app/mcp_lumino.py`
- Modify: `backend/app/services/action_executor.py`
- Modify: `backend/tests/test_blog.py`
- Modify: `backend/tests/test_mcp_library.py`
- Modify: `backend/tests/test_mcp_lumino.py`

- [ ] **Step 1: 写发布状态不变和 Library root 限制测试**

```python
def test_blog_action_update_preserves_publication(db, user_factory):
    author = user_factory("blog-action-author")
    author.can_write_blog = True
    post = BlogPost(title="Published", slug="published-action", content="old", author_id=author.id, is_public=True, is_published=True)
    db.add(post)
    db.commit()
    update_blog_content(db, author, post.id, content="revised")
    db.refresh(post)
    assert post.is_published is True
    assert post.is_public is True

def test_library_action_rejects_non_root(db, user_factory):
    normal_user = user_factory("library-action-user")
    with pytest.raises(ActionPermissionError):
        update_library_profile(db, normal_user, {"headline": "nope"})
```

- [ ] **Step 2: 确认统一适配器不存在而失败**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_blog.py backend/tests/test_mcp_library.py -q`

Expected: FAIL 新测试。

- [ ] **Step 3: 抽取服务并保持旧 MCP 契约**

现有工具函数改为调用适配器，返回字段和工具名不变。统一 MCP 注册相同能力，但使用统一身份和范围。

- [ ] **Step 4: 运行兼容性测试并提交**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_blog.py backend/tests/test_mcp_library.py backend/tests/test_mcp_lumino.py -q`

Expected: PASS。

```bash
git add backend/app/services/blog_actions.py backend/app/services/library_actions.py backend/app/mcp_blog.py backend/app/mcp_library.py backend/app/mcp_lumino.py backend/app/services/action_executor.py backend/tests/test_blog.py backend/tests/test_mcp_library.py backend/tests/test_mcp_lumino.py
git commit -m "refactor: share blog and library actions across MCP clients"
```

### Task 11: 文档、完整验证与生产门禁

**Files:**
- Modify: `docs/operations/production-deployment-runbook.md`
- Modify: `docs/lumino-mcp-chatgpt.md`

- [ ] **Step 1: 更新统一 MCP 配置文档**

记录 `/api/mcp/lumino/`、Token 一次显示、环境变量方式、范围说明和旧端点兼容性，不写入真实 Token。

- [ ] **Step 2: 更新部署门禁**

明确要求数据库备份、Alembic 升级、PM2 重启、本机健康检查、`/api/admin/users` 历史邮箱回归、AI 默认模型真实自检、账目用户隔离和统一 MCP 无 Token 401。

- [ ] **Step 3: 验证中文文件编码**

Run: UTF-8 读取全部本次中文文件，报告 ASCII 问号、Unicode replacement character 和预期中文短语；任何意外字符均先修复。

- [ ] **Step 4: 运行完整后端测试**

Run: `backend/venv/Scripts/python.exe -m pytest backend/tests -q`

Expected: 0 failed。

- [ ] **Step 5: 运行前端检查**

Run: `cd frontend && npx tsc --noEmit`

Expected: exit 0。

Run: `cd frontend && npm run lint`

Expected: exit 0。

Run: `cd frontend && npm run build`

Expected: exit 0，并列出 `/ledger` 路由。

- [ ] **Step 6: 复核变更和敏感信息**

Run: `git diff --check`，随后检查 staged diff 中不存在密码、Bearer Token、API Key 或用户提供的截图内容。

- [ ] **Step 7: 提交文档**

```bash
git add docs/operations/production-deployment-runbook.md docs/lumino-mcp-chatgpt.md
git commit -m "docs: add unified MCP and production verification gates"
```

- [ ] **Step 8: 生产部署需单独执行**

只有完整验证通过后才执行既有 `scripts/deploy-production.sh`。部署后必须在真实浏览器验证用户列表、AI 自检、账本、AI 快捷记账、待办和私密博客行为；不得在文档、日志或命令输出中暴露任何密钥。
