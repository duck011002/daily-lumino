from datetime import timedelta

from sqlalchemy import func, select

from app.models.user import User
from app.models.visit_analytics import VisitDailySummary, VisitEvent
from app.services.auth import hash_password
from app.services.visit_analytics import local_now_naive, summarize_and_cleanup


def create_user(db, username: str, *, is_root: bool):
    user = User(
        username=username,
        email=f"{username}@example.com",
        password=hash_password("password123"),
        display_name=username,
        is_root=is_root,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def login(client, username: str):
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": username, "password": "password123"},
    )
    assert response.status_code == 200
    return response.cookies


def test_public_visit_is_deduplicated_and_private_paths_are_ignored(client, db):
    headers = {
        "ali-real-client-ip": "203.0.113.7",
        "ip-country-code": "CN",
        "ip-province-code": "CN-ZJ",
        "ip-city-name": "hangzhou",
        "ip-isp-code": "100017",
        "user-agent": "Mozilla/5.0 (iPhone; Mobile)",
    }
    payload = {"path": "/library?from=home", "referrer_host": "https://example.com/a"}
    assert client.post("/api/analytics/visit", json=payload, headers=headers).status_code == 204
    assert client.post("/api/analytics/visit", json=payload, headers=headers).status_code == 204
    assert (
        client.post(
            "/api/analytics/visit",
            json={"path": "/admin", "referrer_host": None},
            headers=headers,
        ).status_code
        == 204
    )

    events = db.scalars(select(VisitEvent)).all()
    assert len(events) == 1
    event = events[0]
    assert event.path == "/library"
    assert event.ip_address == "203.0.113.7"
    assert event.country_code == "CN"
    assert event.subdivision_code == "CN-ZJ"
    assert event.city_name == "hangzhou"
    assert event.isp_code == "100017"
    assert event.device_type == "mobile"
    assert event.referrer_host == "example.com"


def test_analytics_dashboard_requires_root_and_returns_recent_ip(client, db):
    create_user(db, "analyticsroot", is_root=True)
    create_user(db, "analyticsuser", is_root=False)
    headers = {
        "ali-real-client-ip": "198.51.100.24",
        "ip-country-code": "US",
        "user-agent": "Mozilla/5.0",
    }
    client.post(
        "/api/analytics/visit",
        json={"path": "/", "referrer_host": None},
        headers=headers,
    )

    normal_cookies = login(client, "analyticsuser")
    assert client.get("/api/admin/analytics", cookies=normal_cookies).status_code == 403

    root_cookies = login(client, "analyticsroot")
    response = client.get("/api/admin/analytics?days=7", cookies=root_cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["period_days"] == 7
    assert data["overview"]["today_views"] == 1
    assert data["overview"]["today_unique_visitors"] == 1
    assert data["recent_visits"][0]["ip_address"] == "198.51.100.24"
    assert data["retention"] == {"raw_hours": 48, "summary_days": 180}


def test_completed_days_are_summarized_before_raw_events_are_deleted(db):
    now = local_now_naive().replace(hour=12, minute=0, second=0, microsecond=0)
    old_time = now - timedelta(days=3)
    old_date = old_time.date()
    db.add(
        VisitEvent(
            visited_at=old_time,
            visit_date=old_date,
            bucket_start=old_time.replace(minute=0),
            ip_address="192.0.2.9",
            ip_hash="a" * 64,
            path="/blog",
            country_code="CN",
            subdivision_code="CN-SH",
            city_name="shanghai",
            isp_code="100025",
            device_type="desktop",
            referrer_host="direct",
        )
    )
    db.commit()

    summarize_and_cleanup(db, now)

    summary = db.get(VisitDailySummary, old_date)
    assert summary is not None
    assert summary.page_views == 1
    assert summary.unique_visitors == 1
    assert db.scalar(select(func.count(VisitEvent.id))) == 0
