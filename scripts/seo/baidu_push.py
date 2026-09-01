#!/usr/bin/env python3
"""
Lumino 百度搜索资源平台 API 自动推送脚本
用法:
    python scripts/seo/baidu_push.py             # 自动抓取并推送 sitemap.xml 中的所有 URL
    python scripts/seo/baidu_push.py url1 url2   # 推送指定 URL
"""

import sys
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error

SITE = "https://lovestory1314.fun"
TOKEN = "KwAZCpnLPpbLlOQj"
API_ENDPOINT = f"http://data.zz.baidu.com/urls?site={SITE}&token={TOKEN}"
SITEMAP_URL = f"{SITE}/sitemap.xml"


def get_sitemap_urls(sitemap_url: str) -> list[str]:
    req = urllib.request.Request(
        sitemap_url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LuminoBaiduPusher/1.0)"}
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        xml_content = res.read()
    
    root = ET.fromstring(xml_content)
    # 处理 xml 命名空间
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text.strip() for loc in root.findall(".//sm:loc", ns) if loc.text]
    return urls


def push_urls_to_baidu(urls: list[str]) -> dict:
    if not urls:
        print("未发现需要推送的 URL。")
        return {}

    payload = "\n".join(urls).encode("utf-8")
    req = urllib.request.Request(
        API_ENDPOINT,
        data=payload,
        headers={"Content-Type": "text/plain"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            body = res.read().decode("utf-8")
            print(f"[百度推送成功] 状态码: {res.status}")
            print(f"[返回数据] {body}")
            return {"status": res.status, "body": body}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[百度推送异常] 状态码: {e.code}")
        print(f"[错误信息] {body}")
        return {"status": e.code, "body": body}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_urls = sys.argv[1:]
        print(f"准备向百度推送 {len(target_urls)} 条指定 URL...")
    else:
        print(f"正在从 {SITEMAP_URL} 解析全量站点地图...")
        try:
            target_urls = get_sitemap_urls(SITEMAP_URL)
            print(f"成功解析出 {len(target_urls)} 条 URL。")
        except Exception as e:
            print(f"解析站点地图失败: {e}")
            sys.exit(1)

    push_urls_to_baidu(target_urls)
