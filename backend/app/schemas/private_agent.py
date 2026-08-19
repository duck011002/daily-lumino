from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


AgentRoute = Literal[
    "chat",
    "execute",
    "clarify",
    "propose_blog",
    "confirm_proposal",
    "cancel_proposal",
]
AgentContext = Literal["ledger", "todos", "blog", "library"]


class BlogProposalArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    slug: str | None = Field(default=None, max_length=300)
    excerpt: str | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None
    category_id: int | None = None


class PrivateAgentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route: AgentRoute
    context: AgentContext | None = None
    question: str | None = Field(default=None, max_length=500)
    proposal: BlogProposalArguments | None = None
    proposal_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_route_fields(self):
        if self.route == "execute" and self.context is None:
            raise ValueError("执行路线必须指定上下文。")
        if self.route == "clarify" and not self.question:
            raise ValueError("追问路线必须提供问题。")
        if self.route == "propose_blog" and self.proposal is None:
            raise ValueError("博客提案路线必须提供完整提案。")
        if self.route in {"confirm_proposal", "cancel_proposal"} and not self.proposal_id:
            raise ValueError("处理提案时必须提供提案编号。")
        return self
