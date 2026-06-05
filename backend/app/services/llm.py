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


def resolve_multimodal_support(model_id: str) -> bool:
    lowered = model_id.lower()
    return "qwen" in lowered or "vl" in lowered or "vision" in lowered or "multimodal" in lowered


def get_llm_client_and_model(db: Session, model_id: str):
    provider_id = model_id
    model_name = None
    if ":" in model_id:
        provider_id, model_name = model_id.split(":", 1)

    # Try to dynamically load provider from system config "ai_providers"
    providers_json = get_system_config(db, "ai_providers")
    if providers_json:
        try:
            providers = json.loads(providers_json)
            for p in providers:
                if p.get("id") == provider_id:
                    api_key = p.get("api_key")
                    if api_key:
                        try:
                            api_key = decrypt_value(api_key)
                        except Exception:
                            # Fallback if stored plain
                            pass
                    base_url = p.get("base_url")
                    
                    # Determine model name
                    if not model_name:
                        models_list = p.get("models")
                        if models_list and isinstance(models_list, list) and len(models_list) > 0:
                            model_name = models_list[0]
                        else:
                            model_name = p.get("model") or "gpt-3.5-turbo"
                    
                    if not api_key:
                         raise ValueError(f"AI 服务商 {provider_id} 的 API Key 未配置。")
                          
                    client = OpenAI(api_key=api_key, base_url=base_url or None)
                    return client, model_name
        except Exception as e:
            print(f"解析 ai_providers 配置失败: {e}")

    # Fallback to legacy static keys if not found dynamically
    if provider_id == "qwen":
        api_key_enc = get_system_config(db, "qwen_api_key")
        base_url = get_system_config(db, "qwen_base_url")
        api_key = decrypt_value(api_key_enc)
        if not model_name:
            model_name = "gpt-5.5"
    elif provider_id == "deepseek":
        api_key_enc = get_system_config(db, "deepseek_api_key")
        base_url = get_system_config(db, "deepseek_base_url")
        api_key = decrypt_value(api_key_enc)
        if not model_name:
            model_name = "deepseek-chat"
    else:
        raise ValueError(f"不支持的 AI 服务商或模型: {model_id}")

    if not api_key:
        raise ValueError(f"服务商 {provider_id} 的 API Key 未配置。")

    # Initialize openai client
    client = OpenAI(api_key=api_key, base_url=base_url or None)
    return client, model_name


def get_discipline_llm(db: Session, task_type: str = "text"):
    """
    Get LLM client and model for discipline tasks (diet, fitness analysis, daily report).
    Priority 1: ModelScope
      - Text: Qwen/Qwen3.5-35B-A3B
      - Vision: Qwen/Qwen3-VL-235B-A22B-Instruct
    Priority 2: Aliyun BaiLian (Qwen)
      - Text: qwen-plus
      - Vision: qwen-vl-max
    """
    providers_json = get_system_config(db, "ai_providers")
    providers = []
    if providers_json:
        try:
            providers = json.loads(providers_json)
        except Exception as e:
            print(f"Failed to parse ai_providers in get_discipline_llm: {e}")

    def get_provider_client(provider_id: str, default_model: str):
        for p in providers:
            if p.get("id") == provider_id:
                api_key_enc = p.get("api_key")
                if not api_key_enc:
                    continue
                try:
                    api_key = decrypt_value(api_key_enc)
                except Exception:
                    api_key = api_key_enc
                
                base_url = p.get("base_url")
                
                # Check if the provider lists Qwen-VL or Qwen3.5
                model_name = default_model
                models_list = p.get("models") or []
                if task_type == "vision":
                    vl_models = [m for m in models_list if "vl" in m.lower() or "vision" in m.lower() or "image" in m.lower()]
                    if vl_models:
                        model_name = vl_models[0]
                else:
                    txt_models = [m for m in models_list if not ("vl" in m.lower() or "vision" in m.lower() or "image" in m.lower())]
                    if txt_models:
                        model_name = txt_models[0]
                    elif models_list:
                        model_name = models_list[0]
                        
                client = OpenAI(api_key=api_key, base_url=base_url or None)
                return client, model_name
        return None

    # Try ModelScope (Priority 1)
    try:
        res = get_provider_client(
            "modelscope", 
            "Qwen/Qwen3-VL-235B-A22B-Instruct" if task_type == "vision" else "Qwen/Qwen3.5-35B-A3B"
        )
        if res:
            return res[0], res[1]
    except Exception as e:
        print(f"Failed to load ModelScope client: {e}")

    # Try Aliyun BaiLian (Priority 2)
    try:
        res = get_provider_client(
            "qwen", 
            "qwen-vl-max" if task_type == "vision" else "qwen-plus"
        )
        if res:
            return res[0], res[1]
    except Exception as e:
        print(f"Failed to load Qwen (BaiLian) client: {e}")

    # Static Fallback if dynamic config failed
    try:
        api_key_enc = get_system_config(db, "qwen_api_key")
        base_url = get_system_config(db, "qwen_base_url")
        api_key = decrypt_value(api_key_enc)
        if api_key:
            client = OpenAI(api_key=api_key, base_url=base_url or None)
            model_name = "qwen-vl-max" if task_type == "vision" else "qwen-plus"
            return client, model_name
    except Exception as e:
        print(f"Static fallback config failed: {e}")

    raise ValueError("无法加载任何自律记录 AI 客户端配置。")




def build_messages_payload(
    history: List[ChatMessage],
    current_content: str,
    current_attachments: List[str] | None,
    model_id: str,
) -> List[Dict[str, Any]]:
    payload = []
    is_qwen = resolve_multimodal_support(model_id)

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

        if attachments_list and is_qwen:
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
    if current_attachments and is_qwen:
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
