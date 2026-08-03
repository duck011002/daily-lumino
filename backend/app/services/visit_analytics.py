import hashlib
import hmac
import ipaddress
import re
import threading
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import Request
from sqlalchemy import delete, distinct, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.visit_analytics import (
    VisitDailyDimension,
    VisitDailySummary,
    VisitEvent,
)
from app.schemas.visit_analytics import VisitCreate

SHANGHAI_TZ = timezone(timedelta(hours=8))
PUBLIC_PATH_RE = re.compile(r"^/blog/[^/?#]{1,300}/?$")
PRIVATE_BLOG_PATHS = {"/blog/manage", "/blog/write"}
UNKNOWN_VALUE = "XX"
DIRECT_REFERRER = "direct"

DIMENSION_COLUMNS = {
    "path": VisitEvent.path,
    "country": VisitEvent.country_code,
    "subdivision": VisitEvent.subdivision_code,
    "city": VisitEvent.city_name,
    "isp": VisitEvent.isp_code,
    "device": VisitEvent.device_type,
    "referrer": VisitEvent.referrer_host,
}

_worker_stop_event = threading.Event()
_worker_thread: threading.Thread | None = None


def local_now_naive() -> datetime:
    return datetime.now(SHANGHAI_TZ).replace(tzinfo=None)


def normalize_public_path(raw_path: str) -> str | None:
    raw_path = raw_path.strip()
    if not raw_path:
        return None
    parsed = urlsplit(raw_path)
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    if path in {"/", "/blog", "/library"}:
        return path
    if path in PRIVATE_BLOG_PATHS:
        return None
    if PUBLIC_PATH_RE.fullmatch(path):
        return path
    return None


def normalize_referrer_host(raw_host: str | None) -> str:
    if not raw_host:
        return DIRECT_REFERRER
    candidate = raw_host.strip().lower()
    if not candidate:
        return DIRECT_REFERRER
    if "://" in candidate:
        candidate = urlsplit(candidate).hostname or ""
    else:
        candidate = candidate.split("/")[0].split(":")[0]
    try:
        candidate = candidate.encode("idna").decode("ascii")
    except UnicodeError:
        return DIRECT_REFERRER
    if not candidate or len(candidate) > 255:
        return DIRECT_REFERRER
    if not re.fullmatch(r"[a-z0-9.-]+", candidate):
        return DIRECT_REFERRER
    return candidate


def _valid_ip(raw_value: str | None) -> str | None:
    if not raw_value:
        return None
    candidate = raw_value.split(",", 1)[0].strip()
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def resolve_client_ip(request: Request) -> tuple[str, bool]:
    for header_name in ("ali-real-client-ip", "true-client-ip-in", "true-client-ip"):
        value = _valid_ip(request.headers.get(header_name))
        if value:
            return value, True
    value = _valid_ip(request.headers.get("x-real-ip"))
    if value:
        return value, False
    value = _valid_ip(request.client.host if request.client else None)
    return value or "0.0.0.0", False


def _safe_geo_header(request: Request, names: tuple[str, ...], trusted: bool) -> str:
    if not trusted and settings.APP_ENV != "testing":
        return UNKNOWN_VALUE
    for name in names:
        value = request.headers.get(name, "").strip()
        if value and len(value) <= 100 and re.fullmatch(r"[\w .+:-]+", value):
            return value
    return UNKNOWN_VALUE


def detect_device_type(user_agent: str) -> str:
    normalized = user_agent.lower()
    if not normalized:
        return "unknown"
    if any(token in normalized for token in ("bot", "crawler", "spider", "slurp")):
        return "bot"
    if any(token in normalized for token in ("ipad", "tablet", "kindle")):
        return "tablet"
    if any(token in normalized for token in ("mobile", "android", "iphone")):
        return "mobile"
    return "desktop"


def _bucket_start(now: datetime) -> datetime:
    minute = (now.minute // settings.VISIT_DEDUPE_MINUTES) * settings.VISIT_DEDUPE_MINUTES
    return now.replace(minute=minute, second=0, microsecond=0)


def _daily_ip_hash(ip_address: str, visit_date: date) -> str:
    message = f"{visit_date.isoformat()}:{ip_address}".encode()
    return hmac.new(settings.JWT_SECRET.encode(), message, hashlib.sha256).hexdigest()


def record_visit(db: Session, request: Request, payload: VisitCreate) -> bool:
    path = normalize_public_path(payload.path)
    if not path:
        return False

    user_agent = request.headers.get("user-agent", "")
    device_type = detect_device_type(user_agent)
    if device_type == "bot":
        return False

    now = local_now_naive()
    visit_date = now.date()
    ip_address, trusted_edge = resolve_client_ip(request)
    bucket_start = _bucket_start(now)
    ip_hash = _daily_ip_hash(ip_address, visit_date)
    duplicate_id = db.scalar(
        select(VisitEvent.id).where(
            VisitEvent.visit_date == visit_date,
            VisitEvent.bucket_start == bucket_start,
            VisitEvent.ip_hash == ip_hash,
            VisitEvent.path == path,
        )
    )
    if duplicate_id is not None:
        return False

    event = VisitEvent(
        visited_at=now,
        visit_date=visit_date,
        bucket_start=bucket_start,
        ip_address=ip_address,
        ip_hash=ip_hash,
        path=path,
        country_code=_safe_geo_header(
            request, ("x-lumino-country", "ip-country-code"), trusted_edge
        ),
        subdivision_code=_safe_geo_header(
            request, ("x-lumino-province", "ip-province-code"), trusted_edge
        ),
        city_name=_safe_geo_header(request, ("x-lumino-city", "ip-city-name"), trusted_edge),
        isp_code=_safe_geo_header(request, ("x-lumino-isp", "ip-isp-code"), trusted_edge),
        device_type=device_type,
        referrer_host=normalize_referrer_host(payload.referrer_host),
    )
    db.add(event)
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def _summarize_date(db: Session, summary_date: date) -> None:
    page_views, unique_visitors = db.execute(
        select(func.count(VisitEvent.id), func.count(distinct(VisitEvent.ip_hash))).where(
            VisitEvent.visit_date == summary_date
        )
    ).one()
    if not page_views:
        return

    summary = db.get(VisitDailySummary, summary_date)
    if not summary:
        summary = VisitDailySummary(summary_date=summary_date)
        db.add(summary)
    summary.page_views = int(page_views or 0)
    summary.unique_visitors = int(unique_visitors or 0)

    db.execute(delete(VisitDailyDimension).where(VisitDailyDimension.summary_date == summary_date))
    for dimension_type, column in DIMENSION_COLUMNS.items():
        value_expression = func.coalesce(column, DIRECT_REFERRER)
        rows = db.execute(
            select(
                value_expression.label("dimension_value"),
                func.count(VisitEvent.id),
                func.count(distinct(VisitEvent.ip_hash)),
            )
            .where(VisitEvent.visit_date == summary_date)
            .group_by(value_expression)
        ).all()
        db.add_all(
            VisitDailyDimension(
                summary_date=summary_date,
                dimension_type=dimension_type,
                dimension_value=str(value or UNKNOWN_VALUE),
                page_views=int(views or 0),
                unique_visitors=int(visitors or 0),
            )
            for value, views, visitors in rows
        )


def summarize_and_cleanup(db: Session | None = None, now: datetime | None = None) -> None:
    owns_session = db is None
    session = db or SessionLocal()
    current = now or local_now_naive()
    today = current.date()
    try:
        pending_dates = session.scalars(
            select(VisitEvent.visit_date)
            .where(VisitEvent.visit_date < today)
            .distinct()
            .order_by(VisitEvent.visit_date.asc())
        ).all()
        for summary_date in pending_dates:
            _summarize_date(session, summary_date)
        session.flush()

        raw_cutoff = current - timedelta(hours=settings.VISIT_RAW_RETENTION_HOURS)
        session.execute(
            delete(VisitEvent).where(
                VisitEvent.visited_at < raw_cutoff,
                VisitEvent.visit_date < today,
            )
        )
        summary_cutoff = today - timedelta(days=settings.VISIT_SUMMARY_RETENTION_DAYS)
        session.execute(
            delete(VisitDailyDimension).where(VisitDailyDimension.summary_date < summary_cutoff)
        )
        session.execute(
            delete(VisitDailySummary).where(VisitDailySummary.summary_date < summary_cutoff)
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        if owns_session:
            session.close()


def _daily_metrics(db: Session, start_date: date, end_date: date) -> dict[date, tuple[int, int]]:
    metrics: dict[date, tuple[int, int]] = {
        row.summary_date: (int(row.page_views), int(row.unique_visitors))
        for row in db.scalars(
            select(VisitDailySummary).where(
                VisitDailySummary.summary_date.between(start_date, end_date)
            )
        ).all()
    }
    summarized_dates = set(metrics)
    raw_query = (
        select(
            VisitEvent.visit_date,
            func.count(VisitEvent.id),
            func.count(distinct(VisitEvent.ip_hash)),
        )
        .where(VisitEvent.visit_date.between(start_date, end_date))
        .group_by(VisitEvent.visit_date)
    )
    if summarized_dates:
        raw_query = raw_query.where(VisitEvent.visit_date.not_in(summarized_dates))
    for metric_date, views, visitors in db.execute(raw_query).all():
        metrics[metric_date] = (int(views or 0), int(visitors or 0))
    return metrics


def _dimension_breakdowns(
    db: Session, start_date: date, end_date: date
) -> dict[str, list[dict[str, int | str]]]:
    merged: dict[str, dict[str, list[int]]] = {
        dimension_type: defaultdict(lambda: [0, 0]) for dimension_type in DIMENSION_COLUMNS
    }
    summary_rows = db.execute(
        select(
            VisitDailyDimension.dimension_type,
            VisitDailyDimension.dimension_value,
            func.sum(VisitDailyDimension.page_views),
            func.sum(VisitDailyDimension.unique_visitors),
        )
        .where(VisitDailyDimension.summary_date.between(start_date, end_date))
        .group_by(
            VisitDailyDimension.dimension_type,
            VisitDailyDimension.dimension_value,
        )
    ).all()
    for dimension_type, value, views, visitors in summary_rows:
        if dimension_type in merged:
            merged[dimension_type][value][0] += int(views or 0)
            merged[dimension_type][value][1] += int(visitors or 0)

    summarized_dates = set(
        db.scalars(
            select(VisitDailySummary.summary_date).where(
                VisitDailySummary.summary_date.between(start_date, end_date)
            )
        ).all()
    )
    raw_dates = [
        start_date + timedelta(days=offset)
        for offset in range((end_date - start_date).days + 1)
        if start_date + timedelta(days=offset) not in summarized_dates
    ]
    if raw_dates:
        for dimension_type, column in DIMENSION_COLUMNS.items():
            value_expression = func.coalesce(column, DIRECT_REFERRER)
            rows = db.execute(
                select(
                    value_expression.label("dimension_value"),
                    func.count(VisitEvent.id),
                    func.count(distinct(VisitEvent.ip_hash)),
                )
                .where(VisitEvent.visit_date.in_(raw_dates))
                .group_by(value_expression)
            ).all()
            for value, views, visitors in rows:
                key = str(value or UNKNOWN_VALUE)
                merged[dimension_type][key][0] += int(views or 0)
                merged[dimension_type][key][1] += int(visitors or 0)

    result: dict[str, list[dict[str, int | str]]] = {}
    for dimension_type, values in merged.items():
        ranked = sorted(values.items(), key=lambda item: (-item[1][0], item[0]))[:8]
        result[dimension_type] = [
            {
                "value": value,
                "page_views": counts[0],
                "unique_visitors": counts[1],
            }
            for value, counts in ranked
        ]
    return result


def build_admin_analytics(db: Session, period_days: int) -> dict:
    current = local_now_naive()
    summarize_and_cleanup(db, current)
    today = current.date()
    start_date = today - timedelta(days=period_days - 1)
    metrics = _daily_metrics(db, start_date, today)
    today_views, today_visitors = metrics.get(today, (0, 0))
    period_views = sum(item[0] for item in metrics.values())
    average_daily_unique = round(sum(item[1] for item in metrics.values()) / max(period_days, 1))

    trend_days = min(period_days, 30)
    trend_start = today - timedelta(days=trend_days - 1)
    trend = []
    cursor = trend_start
    while cursor <= today:
        views, visitors = metrics.get(cursor, (0, 0))
        trend.append({"date": cursor, "page_views": views, "unique_visitors": visitors})
        cursor += timedelta(days=1)

    recent_visits = db.scalars(
        select(VisitEvent).order_by(VisitEvent.visited_at.desc()).limit(50)
    ).all()
    return {
        "generated_at": current,
        "period_days": period_days,
        "overview": {
            "today_views": today_views,
            "today_unique_visitors": today_visitors,
            "period_views": period_views,
            "average_daily_unique_visitors": average_daily_unique,
        },
        "trend": trend,
        "breakdowns": _dimension_breakdowns(db, start_date, today),
        "recent_visits": [
            {
                "visited_at": event.visited_at,
                "ip_address": event.ip_address,
                "path": event.path,
                "country_code": event.country_code,
                "subdivision_code": event.subdivision_code,
                "city_name": event.city_name,
                "isp_code": event.isp_code,
                "device_type": event.device_type,
                "referrer_host": event.referrer_host,
            }
            for event in recent_visits
        ],
        "retention": {
            "raw_hours": settings.VISIT_RAW_RETENTION_HOURS,
            "summary_days": settings.VISIT_SUMMARY_RETENTION_DAYS,
        },
    }


def _worker_loop() -> None:
    while not _worker_stop_event.wait(10):
        try:
            summarize_and_cleanup()
        except Exception:
            pass
        if _worker_stop_event.wait(settings.VISIT_SUMMARY_INTERVAL_SECONDS):
            break


def start_visit_analytics_worker() -> None:
    global _worker_thread
    if not settings.VISIT_ANALYTICS_WORKER_ENABLED:
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    _worker_stop_event.clear()
    _worker_thread = threading.Thread(
        target=_worker_loop,
        name="visit-analytics-worker",
        daemon=True,
    )
    _worker_thread.start()


def stop_visit_analytics_worker() -> None:
    global _worker_thread
    _worker_stop_event.set()
    if _worker_thread and _worker_thread.is_alive():
        _worker_thread.join(timeout=1)
    _worker_thread = None
