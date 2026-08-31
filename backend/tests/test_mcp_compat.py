import json

from fastapi.testclient import TestClient
from starlette.responses import JSONResponse

from app.mcp_compat import MCPDiscoveryFallbackMiddleware


class EchoBodyApp:
    async def __call__(self, scope, receive, send):
        message = await receive()
        response = JSONResponse(json.loads(message.get("body", b"{}")))
        await response(scope, receive, send)


def test_discovery_probe_returns_method_not_found_for_legacy_fallback():
    client = TestClient(MCPDiscoveryFallbackMiddleware(EchoBodyApp()))

    response = client.post(
        "/",
        json={
            "jsonrpc": "2.0",
            "id": "discover-1",
            "method": "server/discover",
            "params": {
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": "2026-07-28"
                }
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "jsonrpc": "2.0",
        "id": "discover-1",
        "error": {"code": -32601, "message": "Method not found"},
    }


def test_non_discovery_request_body_is_replayed_unchanged():
    client = TestClient(MCPDiscoveryFallbackMiddleware(EchoBodyApp()))
    payload = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}

    response = client.post("/", json=payload)

    assert response.status_code == 200
    assert response.json() == payload
