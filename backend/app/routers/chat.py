import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.dependencies import get_current_user
from app.models.chat import ChatMessage, ChatModelType, ChatRoleType, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatSessionCreate,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    ChatSessionUpdate,
)
from app.services.llm import stream_chat_completion

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = session_in.title or "新对话"
    session = ChatSession(
        user_id=current_user.id,
        title=title,
        model=session_in.model,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = db.scalars(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    ).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到会话或您没有访问权限。"
        )

    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    ).all()

    return {
        "id": session.id,
        "user_id": session.user_id,
        "title": session.title,
        "model": session.model,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "messages": messages,
    }


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
def update_session(
    session_id: int,
    session_in: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到会话或您没有访问权限。"
        )

    if session_in.title is not None:
        session.title = session_in.title

    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到会话或您没有访问权限。"
        )

    db.delete(session)
    db.commit()
    return {"status": "ok", "message": "会话已成功删除。"}


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: int,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="未找到会话或您没有访问权限。"
        )

    if session.model == ChatModelType.DEEPSEEK and message_in.attachments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="DeepSeek 模型只支持文本输入，不支持图片。"
        )

    # Save the user's message
    user_msg = ChatMessage(
        session_id=session_id,
        role=ChatRoleType.USER,
        content=message_in.content,
        attachments=message_in.attachments,
    )
    db.add(user_msg)
    session.updated_at = func.now()
    db.commit()

    async def sse_generator():
        with SessionLocal() as local_db:
            try:
                # Fetch history excluding the current message
                history = list(
                    local_db.scalars(
                        select(ChatMessage)
                        .where(
                            ChatMessage.session_id == session_id,
                            ChatMessage.id < user_msg.id,
                        )
                        .order_by(ChatMessage.created_at.asc())
                    ).all()
                )

                local_session = local_db.get(ChatSession, session_id)
                if not local_session:
                    yield f"data: {json.dumps({'type': 'error', 'content': '会话已删除'})}\n\n"
                    return

                accumulated_text = ""
                generator = stream_chat_completion(
                    local_db,
                    local_session,
                    history,
                    message_in.content,
                    message_in.attachments,
                )
                for chunk in generator:
                    accumulated_text += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"

                # Save assistant's message to database
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role=ChatRoleType.ASSISTANT,
                    content=accumulated_text,
                    attachments=None,
                    tokens_used=0,
                )
                local_db.add(assistant_msg)

                # Update session update time
                local_session.updated_at = datetime.now()
                local_db.commit()

                # Yield done message
                yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg.id}, ensure_ascii=False)}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
