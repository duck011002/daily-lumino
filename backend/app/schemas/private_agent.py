from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


AgentRoute = Literal["chat", "execute", "clarify"]
AgentContext = Literal["ledger", "todos", "blog", "library"]


class PrivateAgentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route: AgentRoute
    context: AgentContext | None = None
    question: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_route_fields(self):
        if self.route == "execute" and self.context is None:
            raise ValueError("执行路线必须指定上下文。")
        if self.route == "clarify" and not self.question:
            raise ValueError("追问路线必须提供问题。")
        return self
