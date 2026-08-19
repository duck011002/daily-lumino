from sqlalchemy import func, select

from app.models.ai_action import AIActionRun
from app.models.ledger import LedgerEntry
from app.models.todo import Todo
from app.models.blog import BlogPost
from app.schemas.actions import ActionRequest
from app.schemas.actions import InterpretActionResponse
from app.services.action_executor import (
    ActionPermissionError,
    ActionUndoError,
    execute_action,
    undo_action,
)
from app.services.ai_action_planner import interpret_and_execute


class FakeToolModel:
    def __init__(self):
        self.response = None
        self.offered_tools = []

    def reply_with(self, tool: str, arguments: dict):
        self.response = {"tool": tool, "arguments": arguments}

    def reply_with_text(self, text: str):
        self.response = {"text": text}

    def plan(self, *, message: str, context: str, tools: list[dict]):
        self.offered_tools = [item["function"]["name"] for item in tools]
        return self.response


def test_action_executor_is_idempotent_and_undoes_ledger_create(db, user_factory):
    user = user_factory("actions-ledger")
    request = ActionRequest(
        tool="create_ledger_entry",
        arguments={
            "entry_type": "expense",
            "amount": "18",
            "category_name": "餐饮",
        },
        idempotency_key="action-ledger-1",
    )

    first = execute_action(db, user, request, source="web_ai")
    second = execute_action(db, user, request, source="web_ai")

    assert first.action_id == second.action_id
    assert db.scalar(select(func.count(LedgerEntry.id))) == 1
    assert db.scalar(select(func.count(AIActionRun.id))) == 1

    undone = undo_action(db, user, first.action_id)
    entry = db.get(LedgerEntry, first.target_id)
    assert undone.status == "undone"
    assert entry is not None and entry.deleted_at is not None

    try:
        undo_action(db, user, first.action_id)
    except ActionUndoError:
        pass
    else:
        raise AssertionError("同一行动不能重复撤销")


def test_action_executor_creates_and_undoes_todo(db, user_factory):
    user = user_factory("actions-todo")
    result = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_todo",
            arguments={"title": "整理账本", "priority": "high"},
            idempotency_key="action-todo-1",
        ),
        source="mcp",
        allowed_scopes={"todos:write"},
    )

    assert result.status == "succeeded"
    assert db.get(Todo, result.target_id) is not None
    assert undo_action(db, user, result.action_id).status == "undone"
    assert db.get(Todo, result.target_id) is None


def test_action_scope_and_owner_are_enforced(db, user_factory):
    owner = user_factory("actions-owner")
    stranger = user_factory("actions-stranger")
    request = ActionRequest(
        tool="create_ledger_entry",
        arguments={
            "entry_type": "expense",
            "amount": "8",
            "category_name": "交通",
        },
        idempotency_key="action-owner-1",
    )

    try:
        execute_action(
            db,
            owner,
            request,
            source="mcp",
            allowed_scopes={"todos:write"},
        )
    except ActionPermissionError:
        pass
    else:
        raise AssertionError("缺少 ledger:write 时不能记账")

    result = execute_action(db, owner, request, source="web_ai")
    try:
        undo_action(db, stranger, result.action_id)
    except ActionPermissionError:
        pass
    else:
        raise AssertionError("其他用户不能撤销该行动")


def test_action_rest_api_executes_and_undoes(client, user_cookies_factory):
    _, cookies = user_cookies_factory("actions-api")
    created = client.post(
        "/api/ai/actions/execute",
        cookies=cookies,
        json={
            "tool": "create_todo",
            "arguments": {"title": "测试网页行动"},
            "idempotency_key": "actions-api-1",
        },
    )
    assert created.status_code == 200
    action_id = created.json()["action_id"]
    assert created.json()["can_undo"] is True

    undone = client.post(
        f"/api/ai/actions/{action_id}/undo",
        cookies=cookies,
    )
    assert undone.status_code == 200
    assert undone.json()["status"] == "undone"


def test_update_ledger_action_undo_restores_previous_values(db, user_factory):
    user = user_factory("actions-ledger-update")
    created = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_ledger_entry",
            arguments={
                "entry_type": "expense",
                "amount": "10",
                "category_name": "餐饮",
            },
            idempotency_key="ledger-update-create",
        ),
        source="web_ai",
    )
    updated = execute_action(
        db,
        user,
        ActionRequest(
            tool="update_ledger_entry",
            arguments={"entry_id": created.target_id, "amount": "25"},
            idempotency_key="ledger-update-change",
        ),
        source="web_ai",
    )
    assert db.get(LedgerEntry, created.target_id).amount == 25

    undo_action(db, user, updated.action_id)
    restored = db.get(LedgerEntry, created.target_id)
    db.refresh(restored)
    assert restored.amount == 10


def test_delete_todo_action_undo_restores_datetime_and_id(db, user_factory):
    user = user_factory("actions-todo-delete")
    created = execute_action(
        db,
        user,
        ActionRequest(
            tool="create_todo",
            arguments={
                "title": "按时提交",
                "due_at": "2026-08-20T09:30:00",
            },
            idempotency_key="todo-delete-create",
        ),
        source="web_ai",
    )
    deleted = execute_action(
        db,
        user,
        ActionRequest(
            tool="delete_todo",
            arguments={"todo_id": created.target_id},
            idempotency_key="todo-delete-action",
        ),
        source="web_ai",
    )
    assert db.get(Todo, created.target_id) is None

    undo_action(db, user, deleted.action_id)
    restored = db.get(Todo, created.target_id)
    assert restored is not None
    assert restored.due_at.isoformat() == "2026-08-20T09:30:00"


def test_planner_executes_clear_expense(db, user_factory):
    model = FakeToolModel()
    model.reply_with(
        "create_ledger_entry",
        {
            "entry_type": "expense",
            "amount": "28",
            "category_name": "餐饮",
            "note": "午饭",
        },
    )

    result = interpret_and_execute(
        db,
        user_factory("planner-ledger"),
        "午饭 28",
        context="ledger",
        model=model,
    )

    assert result.actions[0].status == "succeeded"
    assert result.actions[0].tool == "create_ledger_entry"


def test_planner_does_not_execute_ambiguous_amount(db, user_factory):
    model = FakeToolModel()
    model.reply_with_text("请问午饭花了多少钱？")

    result = interpret_and_execute(
        db,
        user_factory("planner-ambiguous"),
        "记一下今天午饭",
        context="ledger",
        model=model,
    )

    assert result.actions == []
    assert "多少钱" in result.text


def test_planner_context_rejects_unrelated_tool(db, user_factory):
    model = FakeToolModel()
    model.reply_with("create_todo", {"title": "不应创建"})

    result = interpret_and_execute(
        db,
        user_factory("planner-context"),
        "新增待办",
        context="ledger",
        model=model,
    )

    assert result.actions == []
    assert db.scalar(select(func.count(Todo.id))) == 0


def test_planner_only_offers_tools_the_user_can_use(db, user_factory):
    model = FakeToolModel()
    model.reply_with_text("请描述要处理的事项。")

    interpret_and_execute(
        db,
        user_factory("planner-private-tools"),
        "帮我处理一下",
        context="general",
        model=model,
    )

    assert "create_ledger_entry" in model.offered_tools
    assert "create_todo" in model.offered_tools
    assert "create_blog_post" not in model.offered_tools
    assert "update_library_profile" not in model.offered_tools


def test_planner_offers_blog_and_library_tools_by_user_permission(db, user_factory):
    writer = user_factory("planner-writer")
    writer.can_write_blog = True
    writer_model = FakeToolModel()
    writer_model.reply_with_text("好的。")

    interpret_and_execute(db, writer, "修改博客", context="general", model=writer_model)

    assert "create_blog_post" in writer_model.offered_tools
    assert "update_library_profile" not in writer_model.offered_tools

    root_model = FakeToolModel()
    root_model.reply_with_text("好的。")
    interpret_and_execute(
        db,
        user_factory("planner-root", is_root=True),
        "修改书房",
        context="general",
        model=root_model,
    )
    assert "create_blog_post" in root_model.offered_tools
    assert "update_library_profile" in root_model.offered_tools


def test_planner_parse_failure_never_executes(db, user_factory):
    class BrokenModel:
        def plan(self, **_):
            raise ValueError("invalid json")

    result = interpret_and_execute(
        db,
        user_factory("planner-broken"),
        "帮我记一下",
        context="ledger",
        model=BrokenModel(),
    )

    assert result.actions == []
    assert "没有修改" in result.text
    assert db.scalar(select(func.count(LedgerEntry.id))) == 0


def test_interpret_rest_endpoint_returns_receipts(
    client, user_cookies_factory, monkeypatch
):
    _, cookies = user_cookies_factory("planner-api")

    def fake_interpret(*_, **__):
        return InterpretActionResponse(text="请补充金额。", actions=[])

    monkeypatch.setattr("app.routers.actions.interpret_and_execute", fake_interpret)
    response = client.post(
        "/api/ai/actions/interpret",
        cookies=cookies,
        json={"message": "记一笔午饭", "context": "ledger"},
    )

    assert response.status_code == 200
    assert response.json() == {"text": "请补充金额。", "actions": []}


def test_blog_update_action_preserves_publication_state(db, user_factory):
    author = user_factory("blog-action-author")
    author.can_write_blog = True
    post = BlogPost(
        title="Published",
        slug="published-action",
        content="old",
        author_id=author.id,
        is_public=True,
        is_published=True,
    )
    db.add(post)
    db.commit()

    result = execute_action(
        db,
        author,
        ActionRequest(
            tool="update_blog_post",
            arguments={"post_id": post.id, "content": "new"},
            idempotency_key="blog-update-action",
        ),
        source="web_ai",
    )
    db.refresh(post)

    assert result.status == "succeeded"
    assert post.content == "new"
    assert post.is_public is True
    assert post.is_published is True


def test_library_action_rejects_non_root(db, user_factory):
    normal_user = user_factory("library-action-user")

    try:
        execute_action(
            db,
            normal_user,
            ActionRequest(
                tool="update_library_profile",
                arguments={"headline": "不应更新"},
                idempotency_key="library-denied",
            ),
            source="web_ai",
        )
    except ActionPermissionError:
        pass
    else:
        raise AssertionError("非超级管理员不能修改 Library")


def test_blog_create_is_draft_and_publish_is_separate(db, user_factory):
    author = user_factory("blog-action-draft")
    author.can_write_blog = True
    created = execute_action(
        db,
        author,
        ActionRequest(
            tool="create_blog_post",
            arguments={"title": "私密草稿", "content": "正文"},
            idempotency_key="blog-create-draft",
        ),
        source="web_ai",
    )
    post = db.get(BlogPost, created.target_id)
    assert post.is_public is False
    assert post.is_published is False

    published = execute_action(
        db,
        author,
        ActionRequest(
            tool="publish_blog_post",
            arguments={"post_id": post.id},
            idempotency_key="blog-publish-explicit",
        ),
        source="web_ai",
    )
    assert db.get(BlogPost, post.id).is_published is True
    undo_action(db, author, published.action_id)
    assert db.get(BlogPost, post.id).is_published is False


def test_root_library_action_is_undoable(db, user_factory):
    root = user_factory("library-action-root", is_root=True)
    updated = execute_action(
        db,
        root,
        ActionRequest(
            tool="update_library_profile",
            arguments={"headline": "新的 Library 标题"},
            idempotency_key="library-update-root",
        ),
        source="web_ai",
    )
    assert updated.result["headline"] == "新的 Library 标题"

    undone = undo_action(db, root, updated.action_id)
    assert undone.status == "undone"
    assert undone.result["undo"]["headline"] != "新的 Library 标题"
