from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TodoPriority = Literal["low", "medium", "high"]
TodoStatus = Literal["pending", "completed", "cancelled"]


class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=5000)
    priority: TodoPriority = "medium"
    status: TodoStatus = "pending"
    due_at: datetime | None = None
    remind_at: datetime | None = None
    source_url: str | None = Field(None, max_length=512)


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=5000)
    priority: TodoPriority | None = None
    status: TodoStatus | None = None
    due_at: datetime | None = None
    remind_at: datetime | None = None
    is_reminded: bool | None = None
    source_url: str | None = Field(None, max_length=512)


class TodoOut(TodoBase):
    id: int
    user_id: int
    is_reminded: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
