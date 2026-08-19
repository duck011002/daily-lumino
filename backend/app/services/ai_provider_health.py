from collections.abc import Callable
from datetime import UTC, datetime
from time import monotonic
from typing import Literal

from pydantic import BaseModel


class ProviderHealthResult(BaseModel):
    status: Literal["success", "error"]
    message: str
    model: str
    checked_at: datetime
    latency_ms: int
    error_category: str | None = None
    action_hint: str | None = None


ERROR_HINTS = {
    "network": "请检查服务地址、网络连通性和服务商状态后重试。",
    "authentication": "请检查 API Key 是否正确、有效且属于当前服务地址。",
    "product_not_activated": "请在服务商控制台开通对应模型产品，然后重新测试。",
    "model_unavailable": "请确认模型名称可用于当前服务地址和账号。",
    "rate_limit": "请求触发限流，请稍后重试或检查服务商并发限制。",
    "quota": "请检查服务商账户余额、额度或计费状态。",
    "unknown": "请根据服务商返回信息检查配置，必要时更换模型后重试。",
}


def classify_provider_error(exc: Exception) -> str:
    message = str(exc).lower()
    if "product is not activated" in message or "not activated" in message:
        return "product_not_activated"
    if any(value in message for value in ("invalid api key", "authentication", "unauthorized", "401")):
        return "authentication"
    if any(value in message for value in ("model not found", "model_not_found", "does not exist", "invalid model")):
        return "model_unavailable"
    if any(value in message for value in ("rate limit", "too many requests", "429")):
        return "rate_limit"
    if any(value in message for value in ("insufficient balance", "quota", "credit", "billing")):
        return "quota"
    if any(value in message for value in ("connection", "network", "timeout", "timed out", "dns")):
        return "network"
    return "unknown"


def run_provider_health_check(
    *,
    client_factory: Callable,
    api_key: str,
    base_url: str | None,
    model: str,
) -> ProviderHealthResult:
    started_at = monotonic()
    checked_at = datetime.now(UTC)
    try:
        client = client_factory(api_key=api_key, base_url=base_url or None)
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            timeout=10.0,
        )
    except Exception as exc:
        category = classify_provider_error(exc)
        return ProviderHealthResult(
            status="error",
            message=f"连接测试失败: {str(exc)[:800]}",
            model=model,
            checked_at=checked_at,
            latency_ms=max(0, round((monotonic() - started_at) * 1000)),
            error_category=category,
            action_hint=ERROR_HINTS[category],
        )

    return ProviderHealthResult(
        status="success",
        message="连接测试成功！",
        model=model,
        checked_at=checked_at,
        latency_ms=max(0, round((monotonic() - started_at) * 1000)),
    )
