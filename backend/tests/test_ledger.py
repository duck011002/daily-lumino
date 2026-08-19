from datetime import datetime
from decimal import Decimal

from app.models.ledger import LedgerCategory, LedgerEntry
from app.schemas.ledger import LedgerEntryCreate
from app.services.ledger import (
    create_entry,
    get_month_summary,
    soft_delete_entry,
)


def test_ledger_entry_uses_decimal_and_user_scoped_idempotency(db, user_factory):
    user = user_factory("ledger-model")
    category = LedgerCategory(
        user_id=user.id,
        name="餐饮",
        normalized_name="餐饮",
        entry_type="expense",
    )
    db.add(category)
    db.flush()
    entry = LedgerEntry(
        user_id=user.id,
        category_id=category.id,
        entry_type="expense",
        amount=Decimal("28.50"),
        currency="CNY",
        occurred_at=datetime(2026, 8, 19, 12, 0),
        source="web_form",
        idempotency_key="model-test",
    )
    db.add(entry)
    db.commit()

    assert entry.amount == Decimal("28.50")


def test_create_entry_initializes_categories_and_is_idempotent(db, user_factory):
    user = user_factory("ledger-service")
    payload = LedgerEntryCreate(
        entry_type="expense",
        amount="28",
        category_name="餐饮",
        note="午饭",
        occurred_at=datetime(2026, 8, 19, 12, 30),
        idempotency_key="lunch-1",
    )

    first = create_entry(db, user, payload)
    second = create_entry(db, user, payload)

    assert first.id == second.id
    assert first.amount == Decimal("28.00")
    assert first.category.name == "餐饮"


def test_summary_excludes_other_users_and_deleted_entries(db, user_factory):
    owner = user_factory("ledger-owner")
    stranger = user_factory("ledger-stranger")
    first_payload = LedgerEntryCreate(
        entry_type="expense",
        amount="20",
        category_name="餐饮",
        occurred_at=datetime(2026, 8, 2, 12, 0),
        idempotency_key="owner-a",
    )
    removed_payload = LedgerEntryCreate(
        entry_type="expense",
        amount="30",
        category_name="交通",
        occurred_at=datetime(2026, 8, 3, 12, 0),
        idempotency_key="owner-b",
    )
    stranger_payload = LedgerEntryCreate(
        entry_type="expense",
        amount="900",
        category_name="购物",
        occurred_at=datetime(2026, 8, 3, 12, 0),
        idempotency_key="stranger-c",
    )
    create_entry(db, owner, first_payload)
    removed = create_entry(db, owner, removed_payload)
    soft_delete_entry(db, owner, removed.id)
    create_entry(db, stranger, stranger_payload)

    summary = get_month_summary(db, owner, 2026, 8)

    assert summary.expense_total == Decimal("20.00")
    assert summary.income_total == Decimal("0.00")
    assert summary.balance == Decimal("-20.00")


def test_ledger_api_is_private_and_supports_summary(client, user_cookies_factory):
    _, owner_cookies = user_cookies_factory("ledger-api-owner")
    _, stranger_cookies = user_cookies_factory("ledger-api-stranger")

    created = client.post(
        "/api/ledger/entries",
        cookies=owner_cookies,
        json={
            "entry_type": "income",
            "amount": "120.50",
            "category_name": "工资",
            "occurred_at": "2026-08-19T09:00:00",
            "note": "八月工资",
            "idempotency_key": "salary-api",
        },
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    stranger_list = client.get(
        "/api/ledger/entries?year=2026&month=8", cookies=stranger_cookies
    )
    assert stranger_list.status_code == 200
    assert stranger_list.json() == []
    assert client.delete(
        f"/api/ledger/entries/{entry_id}", cookies=stranger_cookies
    ).status_code == 404

    summary = client.get(
        "/api/ledger/summary?year=2026&month=8", cookies=owner_cookies
    )
    assert summary.status_code == 200
    assert Decimal(summary.json()["income_total"]) == Decimal("120.50")


def test_ledger_api_rejects_non_positive_amount(client, user_cookies_factory):
    _, cookies = user_cookies_factory("ledger-invalid")
    response = client.post(
        "/api/ledger/entries",
        cookies=cookies,
        json={
            "entry_type": "expense",
            "amount": "0",
            "category_name": "餐饮",
        },
    )
    assert response.status_code == 422
