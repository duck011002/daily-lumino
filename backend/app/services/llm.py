import json
from typing import Any, Dict, Generator, List

from sqlalchemy import select
from sqlalchemy.orm import Session
from openai import OpenAI

from app.models.chat import ChatMessage, ChatModelType, ChatSession
from app.models.system_config import SystemConfig
from app.utils.crypto import decrypt_value


def get_system_config(db: Session, key: str) -> str:
    cfg = db.scalar(select(SystemConfig).where(SystemConfig.config_key == key))
    if cfg and cfg.config_val:
        return cfg.config_val
    return ""


def get_llm_client_and_model(db: Session, model_type: ChatModelType):
    if model_type == ChatModelType.QWEN:
        api_key_enc = get_system_config(db, "qwen_api_key")
        base_url = get_system_config(db, "qwen_base_url")
        api_key = decrypt_value(api_key_enc)
        # The user has configured first key to map to "gpt-5.5" model (multimodal, OpenAI format)
        model_name = "gpt-5.5"
    else:
        api_key_enc = get_system_config(db, "deepseek_api_key")
        base_url = get_system_config(db, "deepseek_base_url")
        api_key = decrypt_value(api_key_enc)
        model_name = "deepseek-chat"

    if not api_key:
        raise ValueError(f"API key for {model_type.value} is not configured.")

    # Initialize openai client
    client = OpenAI(api_key=api_key, base_url=base_url or None)
    return client, model_name


def build_messages_payload(
    history: List[ChatMessage],
    current_content: str,
    current_attachments: List[str] | None,
    model_type: ChatModelType,
) -> List[Dict[str, Any]]:
    payload = []

    # Format previous messages in the session
    for msg in history:
        role = msg.role.value  # "user", "assistant", "system"

        # Parse attachments
        attachments_list = None
        if msg.attachments:
            if isinstance(msg.attachments, str):
                try:
                    attachments_list = json.loads(msg.attachments)
                except Exception:
                    attachments_list = None
            elif isinstance(msg.attachments, list):
                attachments_list = msg.attachments
            elif isinstance(msg.attachments, dict):
                attachments_list = msg.attachments.get("image_urls") or msg.attachments.get("urls")

        if attachments_list and model_type == ChatModelType.QWEN:
            # Multimodal payload for Qwen
            content_parts = [{"type": "text", "text": msg.content}]
            for url in attachments_list:
                if isinstance(url, str):
                    content_parts.append({"type": "image_url", "image_url": {"url": url}})
                elif isinstance(url, dict) and "url" in url:
                    content_parts.append({"type": "image_url", "image_url": {"url": url["url"]}})
            payload.append({"role": role, "content": content_parts})
        else:
            # Simple text payload
            payload.append({"role": role, "content": msg.content})

    # Format the current user message
    if current_attachments and model_type == ChatModelType.QWEN:
        content_parts = [{"type": "text", "text": current_content}]
        for url in current_attachments:
            content_parts.append({"type": "image_url", "image_url": {"url": url}})
        payload.append({"role": "user", "content": content_parts})
    else:
        payload.append({"role": "user", "content": current_content})

    return payload


def stream_chat_completion(
    db: Session,
    session: ChatSession,
    history: List[ChatMessage],
    current_content: str,
    current_attachments: List[str] | None,
) -> Generator[str, None, None]:
    client, model_name = get_llm_client_and_model(db, session.model)
    messages = build_messages_payload(history, current_content, current_attachments, session.model)

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=True,
    )

    for chunk in response:
        if chunk.choices and len(chunk.choices) > 0:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
