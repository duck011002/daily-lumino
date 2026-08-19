class FakeRouterModel:
    def __init__(self, response: dict):
        self.response = response
        self.allowed_contexts: set[str] = set()
        self.history: list[dict[str, str]] = []

    def route(self, *, message, history, allowed_contexts, now):
        self.allowed_contexts = set(allowed_contexts)
        self.history = history
        return self.response


def test_router_exposes_only_permitted_contexts(db, user_factory):
    from app.services.private_agent_router import route_private_agent

    user = user_factory("agent-router")
    model = FakeRouterModel({"route": "execute", "context": "ledger"})

    decision = route_private_agent(
        db,
        user,
        "记录，20号吃饭50",
        history=[{"role": "user", "content": "上一条"}],
        model=model,
    )

    assert decision.route == "execute"
    assert decision.context == "ledger"
    assert "ledger" in model.allowed_contexts
    assert "todos" in model.allowed_contexts
    assert "blog" not in model.allowed_contexts
    assert "library" not in model.allowed_contexts
    assert model.history[-1]["content"] == "上一条"


def test_root_router_can_choose_library(db, user_factory):
    from app.services.private_agent_router import route_private_agent

    root = user_factory("agent-router-root", is_root=True)
    model = FakeRouterModel({"route": "execute", "context": "library"})

    decision = route_private_agent(db, root, "添加到 Library", history=[], model=model)

    assert decision.context == "library"
    assert "blog" in model.allowed_contexts
    assert "library" in model.allowed_contexts


def test_router_rejects_context_the_user_cannot_use(db, user_factory):
    from app.services.private_agent_router import route_private_agent

    user = user_factory("agent-router-denied")
    model = FakeRouterModel({"route": "execute", "context": "library"})

    decision = route_private_agent(db, user, "添加到 Library", history=[], model=model)

    assert decision.route == "clarify"
    assert "权限" in decision.question


def test_router_keeps_only_recent_text_history(db, user_factory):
    from app.services.private_agent_router import route_private_agent

    model = FakeRouterModel({"route": "chat"})
    history = [
        {"role": "user", "content": f"message-{index}"}
        for index in range(12)
    ]

    route_private_agent(
        db,
        user_factory("agent-router-history"),
        "继续",
        history=history,
        model=model,
    )

    assert len(model.history) == 8
    assert model.history[0]["content"] == "message-4"


def test_router_accepts_complete_blog_proposal(db, user_factory):
    from app.services.private_agent_router import route_private_agent

    writer = user_factory("agent-router-blog")
    writer.can_write_blog = True
    model = FakeRouterModel(
        {
            "route": "propose_blog",
            "context": "blog",
            "proposal": {"title": "私人 Agent", "content": "完整正文"},
        }
    )

    decision = route_private_agent(
        db, writer, "写一篇关于私人 Agent 的博客", history=[], model=model
    )

    assert decision.route == "propose_blog"
    assert decision.proposal.title == "私人 Agent"
