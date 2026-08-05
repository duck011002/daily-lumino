"""Offline IP geolocation used only for privacy-conscious visit analytics."""

from __future__ import annotations

import ipaddress
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

try:
    from ip2region import searcher as ip2region_searcher
    from ip2region import util as ip2region_util
except ImportError:  # pragma: no cover - deployment installs the pinned requirement.
    ip2region_searcher = None
    ip2region_util = None


UNKNOWN_VALUE = "XX"
DATABASE_DIR = Path(__file__).resolve().parents[2] / "resources" / "ip2region"
DATABASE_PATHS = {
    4: DATABASE_DIR / "ip2region_v4.xdb",
    6: DATABASE_DIR / "ip2region_v6.xdb",
}
_thread_local = threading.local()


@dataclass(frozen=True)
class GeoLocation:
    country_code: str = UNKNOWN_VALUE
    subdivision_code: str = UNKNOWN_VALUE
    city_name: str = UNKNOWN_VALUE
    isp_code: str = UNKNOWN_VALUE


@lru_cache(maxsize=2)
def _vector_index(database_path: str) -> bytes:
    if ip2region_util is None:
        raise RuntimeError("py-ip2region is not installed")
    return ip2region_util.load_vector_index_from_file(database_path)


def _get_searcher(version: int):
    if ip2region_searcher is None or ip2region_util is None:
        return None
    database_path = DATABASE_PATHS[version]
    if not database_path.is_file():
        return None

    searchers = getattr(_thread_local, "searchers", None)
    if searchers is None:
        searchers = {}
        _thread_local.searchers = searchers
    if version not in searchers:
        ip_version = ip2region_util.IPv4 if version == 4 else ip2region_util.IPv6
        searchers[version] = ip2region_searcher.new_with_vector_index(
            ip_version,
            str(database_path),
            _vector_index(str(database_path)),
        )
    return searchers[version]


def _field(value: str | None) -> str:
    normalized = (value or "").strip()
    return normalized if normalized and normalized != "0" else UNKNOWN_VALUE


def lookup_ip_geolocation(ip_address: str) -> GeoLocation:
    """Resolve a globally routable address without any outbound network request."""
    try:
        parsed_ip = ipaddress.ip_address(ip_address)
    except ValueError:
        return GeoLocation()
    if not parsed_ip.is_global:
        return GeoLocation()

    try:
        searcher = _get_searcher(parsed_ip.version)
        region = searcher.search(ip_address) if searcher else ""
    except (OSError, RuntimeError, ValueError):
        return GeoLocation()
    parts = region.split("|")
    if len(parts) != 5:
        return GeoLocation()

    country, subdivision, city, isp, country_code = parts
    normalized_country_code = country_code.upper().strip()
    if len(normalized_country_code) != 2 or not normalized_country_code.isalpha():
        normalized_country_code = UNKNOWN_VALUE
    return GeoLocation(
        country_code=normalized_country_code,
        subdivision_code=_field(subdivision),
        city_name=_field(city),
        isp_code=_field(isp),
    )
