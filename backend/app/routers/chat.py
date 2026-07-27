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
from app.services.llm import stream_chat_completion, resolve_multimodal_support

def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    chinese_chars = 0
    other_chars = 0
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            chinese_chars += 1
        else:
            other_chars += 1
    return int(chinese_chars * 1.3 + other_chars * 0.25) + 1

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
    if session_in.model is not None:
        session.model = session_in.model

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

    # Check daily limit
    if not current_user.is_root:
        from app.services.llm import get_system_config
        limit_str = get_system_config(db, "chat_daily_limit") or "20"
        try:
            limit = int(limit_str)
        except ValueError:
            limit = 20

        # Count user's messages today
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = db.scalar(
            select(func.count(ChatMessage.id))
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(
                ChatSession.user_id == current_user.id,
                ChatMessage.role == ChatRoleType.USER,
                ChatMessage.created_at >= today_start
            )
        )
        if today_count >= limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"您已达到每日对话次数限制（今日已发送 {today_count}/{limit} 次）。"
            )

    is_multimodal = resolve_multimodal_support(session.model)
    if message_in.attachments and not is_multimodal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该模型当前配置仅支持文本输入，不支持图片附件。"
        )

    # Save the user's message
    user_msg = ChatMessage(
        session_id=session_id,
        role=ChatRoleType.USER,
        content=message_in.content,
        attachments=message_in.attachments,
        tokens_used=estimate_tokens(message_in.content),
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
                    tokens_used=estimate_tokens(accumulated_text),
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


@router.get("/models")
def list_available_models(db: Session = Depends(get_db)):
    from app.models.system_config import SystemConfig
    cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == "ai_providers"))
    providers_list = []
    if cfg and cfg.config_val:
        try:
            data = json.loads(cfg.config_val)
            for p in data:
                pid = p.get("id")
                pname = p.get("name")
                is_reachable = p.get("is_reachable", True)
                
                # Check models list
                models = p.get("models")
                if models and isinstance(models, list):
                    for mname in models:
                        providers_list.append({
                            "id": f"{pid}:{mname}",
                            "name": f"{mname} ({pname})",
                            "model": mname,
                            "provider_id": pid,
                            "provider_name": pname,
                            "is_reachable": is_reachable,
                            "is_multimodal": resolve_multimodal_support(mname)
                        })
                elif p.get("model"):
                    # Legacy fallback
                    mname = p.get("model")
                    providers_list.append({
                        "id": f"{pid}:{mname}",
                        "name": f"{mname} ({pname})",
                        "model": mname,
                        "provider_id": pid,
                        "provider_name": pname,
                        "is_reachable": is_reachable,
                        "is_multimodal": resolve_multimodal_support(mname)
                    })
        except Exception:
            pass
    
    if not providers_list:
        providers_list = [
            {
                "id": "deepseek:deepseek-chat",
                "name": "deepseek-chat (DeepSeek)",
                "model": "deepseek-chat",
                "provider_id": "deepseek",
                "provider_name": "DeepSeek",
                "is_reachable": True,
                "is_multimodal": False
            },
            {
                "id": "qwen:gpt-5.5",
                "name": "gpt-5.5 (Qwen)",
                "model": "gpt-5.5",
                "provider_id": "qwen",
                "provider_name": "Qwen",
                "is_reachable": True,
                "is_multimodal": True
            }
        ]
    return providers_list

