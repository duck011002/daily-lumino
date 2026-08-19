from datetime import datetime
from decimal import Decimal

from app.models.ledger import LedgerCategory, LedgerEntry


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
