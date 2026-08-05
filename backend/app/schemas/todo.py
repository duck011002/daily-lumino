from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TodoBase(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    status: str = "pending"
    due_at: datetime | None = None
    remind_at: datetime | None = None
    source_url: str | None = None


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    due_at: datetime | None = None
    remind_at: datetime | None = None
    is_reminded: bool | None = None


class TodoOut(TodoBase):
    id: int
    user_id: int
    is_reminded: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
