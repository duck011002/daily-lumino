"""Compatibility helpers for MCP clients newer than the pinned server SDK."""

import json

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class MCPDiscoveryFallbackMiddleware:
    """Return METHOD_NOT_FOUND for the newer discovery probe.

    MCP clients using the 2026-07-28 protocol probe legacy servers with
    ``server/discover`` before falling back to ``initialize``. MCP SDK 1.8.1
    treats the unknown method as a validation exception and cancels the
    server-wide task group. Intercepting only this probe keeps the legacy
    handshake available without weakening the surrounding token middleware.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] != "http.request":
                await self.app(scope, _replay_receive(bytes(body), receive), send)
                return
            body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                break

        try:
            payload = json.loads(body)
        except (TypeError, ValueError, UnicodeDecodeError):
            payload = None

        if isinstance(payload, dict) and payload.get("method") == "server/discover":
            response = JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": payload.get("id"),
                    "error": {"code": -32601, "message": "Method not found"},
                }
            )
            await response(scope, receive, send)
            return

        await self.app(scope, _replay_receive(bytes(body), receive), send)


def _replay_receive(body: bytes, receive: Receive) -> Receive:
    replayed = False

    async def wrapped_receive() -> Message:
        nonlocal replayed
        if not replayed:
            replayed = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()

    return wrapped_receive
