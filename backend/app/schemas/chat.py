from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field

from app.models.chat import ChatModelType, ChatRoleType


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    model: ChatModelType = ChatModelType.QWEN


class ChatSessionUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)


class ChatMessageCreate(BaseModel):
    content: str
    attachments: Optional[List[str]] = None


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: ChatRoleType
    content: str
    attachments: Optional[Any] = None
    tokens_used: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    model: ChatModelType
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True
