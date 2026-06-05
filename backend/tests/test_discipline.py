import pytest
import io
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.user import User
from app.models.discipline import UserHealthProfile, DailyDisciplineLog


@pytest.fixture
def discipline_test_setup(client: TestClient, db):
    # Register and login User A (no permission)
    client.post(
        "/api/auth/register",
        json={"username": "unauthorizeduser", "email": "unauthorized@example.com", "password": "password123"},
    )
    res_unauthorized = client.post("/api/auth/login", json={"username_or_email": "unauthorizeduser", "password": "password123"})
    unauthorized_cookies = res_unauthorized.cookies

    # Register and login User B (we will authorize this user)
    client.post(
        "/api/auth/register",
        json={"username": "authorizeduser", "email": "authorized@example.com", "password": "password123"},
    )
    res_authorized = client.post("/api/auth/login", json={"username_or_email": "authorizeduser", "password": "password123"})
    authorized_cookies = res_authorized.cookies
    auth_user = db.scalar(select(User).where(User.username == "authorizeduser"))

    # Register Admin user
    client.post(
        "/api/auth/register",
        json={"username": "adminuser", "email": "admin@example.com", "password": "password123"},
    )
    admin_db = db.scalar(select(User).where(User.username == "adminuser"))
    admin_db.is_root = True
    db.commit()

    # Login Admin
    res_admin = client.post("/api/auth/login", json={"username_or_email": "adminuser", "password": "password123"})
    admin_cookies = res_admin.cookies

    return {
        "unauthorized": unauthorized_cookies,
        "authorized": authorized_cookies,
        "authorized_user_id": auth_user.id,
        "admin": admin_cookies
    }


def test_discipline_permissions(client: TestClient, discipline_test_setup):
    unauth_cookies = discipline_test_setup["unauthorized"]
    auth_cookies = discipline_test_setup["authorized"]
    admin_cookies = discipline_test_setup["admin"]
    auth_user_id = discipline_test_setup["authorized_user_id"]

    # 1. Unauthorized user tries to access profile -> 403
    res = client.get("/api/discipline/profile", cookies=unauth_cookies)
    assert res.status_code == 403
    assert "您尚未获得自律记录功能的授权" in res.json()["detail"]

    # 2. Admin upgrades User B (authorizeduser)
    res_patch = client.patch(
        f"/api/admin/users/{auth_user_id}",
        json={"is_discipline_authorized": True},
        cookies=admin_cookies
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["is_discipline_authorized"] is True

    # 3. Authorized user accesses profile -> should succeed (returns null initially)
    res_profile = client.get("/api/discipline/profile", cookies=auth_cookies)
    assert res_profile.status_code == 200
    assert res_profile.json() is None


def test_discipline_profile_and_logs(client: TestClient, discipline_test_setup, db):
    auth_cookies = discipline_test_setup["authorized"]
    admin_cookies = discipline_test_setup["admin"]
    auth_user_id = discipline_test_setup["authorized_user_id"]

    # Grant permission
    client.patch(
        f"/api/admin/users/{auth_user_id}",
        json={"is_discipline_authorized": True},
        cookies=admin_cookies
    )

    # 1. Post to profile to create it
    res = client.post(
        "/api/discipline/profile",
        json={"height": 175.0, "initial_weight": 70.0, "target_weight": 65.0},
        cookies=auth_cookies
    )
    assert res.status_code == 200
    assert res.json()["height"] == 175.0
    assert res.json()["initial_weight"] == 70.0
    assert res.json()["target_weight"] == 65.0
    # BMI calculation: 70 / (1.75 * 1.75) = 22.857... -> 22.86
    assert res.json()["bmi"] == 22.86

    # 2. Get profile to check persistence
    res_get = client.get("/api/discipline/profile", cookies=auth_cookies)
    assert res_get.status_code == 200
    assert res_get.json()["bmi"] == 22.86

    # 3. Add a daily punch log
    res_log = client.post(
        "/api/discipline/log",
        json={
            "log_date": "2026-06-05",
            "weight": 71.0,
            "step_count": 8000,
            "active_energy": 350.0,
            "diet_text": "牛排沙拉",
            "intake_calories": 500
        },
        cookies=auth_cookies
    )
    assert res_log.status_code == 200
    assert res_log.json()["weight"] == 71.0
    assert res_log.json()["step_count"] == 8000
    assert res_log.json()["active_energy"] == 350.0
    assert res_log.json()["diet_text"] == "牛排沙拉"
    assert res_log.json()["intake_calories"] == 500

    # Auto calculation check
    # BMR = 10 * 71.0 + 6.25 * 175.0 - 5 * 25 + 5 = 710 + 1093.75 - 125 + 5 = 1683.75
    # Burned = BMR + active_energy = 1683.75 + 350 = 2033.75 -> int 2033
    # Calorie Gap = 2033 - 500 = 1533
    assert res_log.json()["burned_calories"] == 2033
    assert res_log.json()["calorie_gap"] == 1533

    # 4. Fetch logs list for 2026-06
    res_logs = client.get(
        "/api/discipline/logs",
        params={"year": 2026, "month": 6},
        cookies=auth_cookies
    )
    assert res_logs.status_code == 200
    assert len(res_logs.json()) == 1
    assert res_logs.json()[0]["log_date"] == "2026-06-05"


def test_apple_health_xml_import(client: TestClient, discipline_test_setup, db):
    auth_cookies = discipline_test_setup["authorized"]
    admin_cookies = discipline_test_setup["admin"]
    auth_user_id = discipline_test_setup["authorized_user_id"]

    # Grant permission
    client.patch(
        f"/api/admin/users/{auth_user_id}",
        json={"is_discipline_authorized": True},
        cookies=admin_cookies
    )

    # Setup profile first
    client.post(
        "/api/discipline/profile",
        json={"height": 180.0, "initial_weight": 80.0},
        cookies=auth_cookies
    )

    # 1. Mock Apple Health XML file content
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE HealthData [
      <!ELEMENT HealthData (ExportDate,Me,Record*)>
      <!ELEMENT ExportDate EMPTY>
      <!ELEMENT Me EMPTY>
      <!ELEMENT Record EMPTY>
      <!ATTLIST ExportDate value CDATA #REQUIRED>
      <!ATTLIST Record type CDATA #REQUIRED sourceName CDATA #REQUIRED sourceVersion CDATA #REQUIRED device CDATA #IMPLIED creationDate CDATA #REQUIRED startDate CDATA #REQUIRED endDate CDATA #REQUIRED value CDATA #REQUIRED unit CDATA #REQUIRED>
    ]>
    <HealthData>
      <ExportDate value="2026-06-05 11:19:28 +0800"/>
      <Me/>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" sourceVersion="17.4" creationDate="2026-06-05 11:19:28 +0800" startDate="2026-06-05 10:00:00 +0800" endDate="2026-06-05 11:00:00 +0800" value="6000" unit="count"/>
      <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="iPhone" sourceVersion="17.4" creationDate="2026-06-05 11:19:28 +0800" startDate="2026-06-05 10:00:00 +0800" endDate="2026-06-05 11:00:00 +0800" value="300.2" unit="kcal"/>
    </HealthData>
    """
    
    # 2. Upload the mock XML
    file_payload = {"file": ("export.xml", io.BytesIO(xml_content.encode("utf-8")), "text/xml")}
    res_import = client.post(
        "/api/discipline/import-apple-health",
        files=file_payload,
        cookies=auth_cookies
    )
    assert res_import.status_code == 200
    assert "成功导入苹果健康数据" in res_import.json()["message"]

    # 3. Check if log record is populated correctly
    res_logs = client.get(
        "/api/discipline/logs",
        params={"year": 2026, "month": 6},
        cookies=auth_cookies
    )
    assert res_logs.status_code == 200
    assert len(res_logs.json()) == 1
    
    log_record = res_logs.json()[0]
    assert log_record["log_date"] == "2026-06-05"
    assert log_record["step_count"] == 6000
    assert log_record["active_energy"] == 300.2
    
    # Check total BMR calculation: 10 * 80 + 6.25 * 180 - 5 * 25 + 5 = 800 + 1125 - 125 + 5 = 1805
    # Total burned = 1805 + active_energy (300.2) = 2105.2 -> 2105
    assert log_record["burned_calories"] == 2105
