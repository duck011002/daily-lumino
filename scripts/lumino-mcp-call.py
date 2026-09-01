#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
from datetime import timedelta
from pathlib import Path

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


ENDPOINTS = {
    "lumino": (
        "https://lovestory1314.fun/api/mcp/lumino/",
        "LUMINO_MCP_TOKEN",
    ),
    "blog": (
        "https://lovestory1314.fun/api/mcp/blog/",
        "LUMINO_BLOG_MCP_TOKEN",
    ),
}


async def call_tool(endpoint: str, tool: str, arguments: dict) -> dict:
    url, token_name = ENDPOINTS[endpoint]
    token = os.environ.get(token_name)
    if not token:
        raise RuntimeError(f"Missing required environment variable: {token_name}")

    headers = {"Authorization": f"Bearer {token}"}
    async with streamablehttp_client(
        url,
        headers=headers,
        timeout=timedelta(seconds=60),
        sse_read_timeout=timedelta(seconds=120),
    ) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await session.call_tool(tool, arguments=arguments)
            return result.model_dump(mode="json")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", choices=ENDPOINTS, required=True)
    parser.add_argument("--tool", required=True)
    parser.add_argument("--arguments", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    arguments = {}
    if args.arguments:
        arguments = json.loads(args.arguments.read_text(encoding="utf-8"))

    result = asyncio.run(call_tool(args.endpoint, args.tool, arguments))
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
