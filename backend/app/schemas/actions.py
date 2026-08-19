from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ActionRequest(BaseModel):
    tool: str = Field(..., min_length=1, max_length=100)
    arguments: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(..., min_length=1, max_length=100)


class ActionReceipt(BaseModel):
    action_id: int
    tool: str
    status: Literal["succeeded", "undone", "failed"]
    result: dict[str, Any] | None = None
    target_type: str | None = None
    target_id: int | None = None
    can_undo: bool
    created_at: datetime


class ActionProposalResponse(BaseModel):
    id: int
    tool: str
    arguments: dict[str, Any]
    status: str
    expires_at: datetime


class EntryIdArguments(BaseModel):
    entry_id: int = Field(..., gt=0)


class TodoIdArguments(BaseModel):
    todo_id: int = Field(..., gt=0)


class InterpretActionRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: Literal["general", "ledger", "todos", "blog", "library"] = "general"
    model: str | None = Field(None, max_length=200)
    idempotency_key: str | None = Field(None, min_length=1, max_length=100)


class InterpretActionResponse(BaseModel):
    text: str
    actions: list[ActionReceipt]
