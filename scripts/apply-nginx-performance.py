#!/usr/bin/env python3
import argparse
from pathlib import Path


PERFORMANCE_BEGIN = "    # LUMINO PERFORMANCE BEGIN\n"
PERFORMANCE_END = "    # LUMINO PERFORMANCE END\n"
PUBLIC_BEGIN = "    # LUMINO PUBLIC API BEGIN\n"
PUBLIC_END = "    # LUMINO PUBLIC API END\n"

PERFORMANCE_BLOCK = """    # LUMINO PERFORMANCE BEGIN
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_proxied any;
    gzip_types application/json application/javascript application/xml image/svg+xml text/css text/plain text/xml;
    # LUMINO PERFORMANCE END

"""

PUBLIC_API_BLOCK = """    # LUMINO PUBLIC API BEGIN
    location ^~ /api/public/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Authorization "";
        proxy_set_header   Cookie "";
        proxy_set_header   Accept-Encoding "";
        proxy_hide_header  Set-Cookie;
        proxy_hide_header  Cache-Control;
        add_header         Cache-Control "public, max-age=0, s-maxage=60, stale-while-revalidate=120";
    }
    # LUMINO PUBLIC API END

"""


def remove_managed_block(source: str, begin: str, end: str) -> str:
    while begin in source:
        start = source.index(begin)
        finish = source.index(end, start) + len(end)
        if source[finish : finish + 1] == "\n":
            finish += 1
        source = source[:start] + source[finish:]
    return source


def render(source: str) -> str:
    source = remove_managed_block(source, PERFORMANCE_BEGIN, PERFORMANCE_END)
    source = remove_managed_block(source, PUBLIC_BEGIN, PUBLIC_END)

    server_anchor = "    client_max_body_size 20m;\n\n"
    api_anchor = "    location /api/ {\n"
    sse_anchor = "        proxy_buffering    off;\n"
    if server_anchor not in source:
        raise ValueError("could not find the primary server configuration anchor")
    if api_anchor not in source:
        raise ValueError("could not find the private API location anchor")
    if sse_anchor not in source:
        raise ValueError("could not find the SSE buffering anchor")

    source = source.replace(server_anchor, server_anchor + PERFORMANCE_BLOCK, 1)
    source = source.replace(api_anchor, PUBLIC_API_BLOCK + api_anchor, 1)
    source = source.replace(sse_anchor, sse_anchor + "        gzip               off;\n", 1)
    source = source.replace(
        "        gzip               off;\n        gzip               off;\n",
        "        gzip               off;\n",
    )
    return source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    rendered = render(args.source.read_text(encoding="utf-8"))
    args.destination.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
