from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ledger import LedgerCategory, LedgerEntry
from app.models.user import User
from app.schemas.ledger import (
    LedgerCategoryCreate,
    LedgerCategoryTotal,
    LedgerDailyTotal,
    LedgerEntryCreate,
    LedgerEntryUpdate,
    LedgerSummaryOut,
)

SHANGHAI = timezone(timedelta(hours=8))

DEFAULT_CATEGORIES = {
    "expense": ["餐饮", "交通", "购物", "住房", "娱乐", "医疗", "教育", "其他"],
    "income": ["工资", "奖金", "其他收入"],
}


class LedgerError(ValueError):
    pass


class LedgerNotFoundError(LedgerError):
    pass


class LedgerConflictError(LedgerError):
    pass


def normalize_category_name(name: str) -> str:
    return " ".join(name.strip().split()).casefold()


def ensure_default_categories(
    db: Session, user: User, *, commit: bool = True
) -> list[LedgerCategory]:
    existing = list(
        db.scalars(
            select(LedgerCategory).where(LedgerCategory.user_id == user.id)
        ).all()
    )
    keys = {(item.entry_type, item.normalized_name) for item in existing}
    created = False
    for entry_type, names in DEFAULT_CATEGORIES.items():
        for name in names:
            normalized = normalize_category_name(name)
            if (entry_type, normalized) in keys:
                continue
            item = LedgerCategory(
                user_id=user.id,
                name=name,
                normalized_name=normalized,
                entry_type=entry_type,
                is_default=True,
            )
            db.add(item)
            existing.append(item)
            keys.add((entry_type, normalized))
            created = True
    if created and commit:
        db.commit()
    elif created:
        db.flush()
    return sorted(existing, key=lambda item: (item.entry_type, item.id or 0))


def list_categories(
    db: Session, user: User, *, include_archived: bool = False
) -> list[LedgerCategory]:
    ensure_default_categories(db, user)
    stmt = select(LedgerCategory).where(LedgerCategory.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(LedgerCategory.is_archived.is_(False))
    return list(db.scalars(stmt.order_by(LedgerCategory.entry_type, LedgerCategory.id)).all())


def create_category(
    db: Session, user: User, payload: LedgerCategoryCreate, *, commit: bool = True
) -> LedgerCategory:
    ensure_default_categories(db, user, commit=False)
    name = " ".join(payload.name.strip().split())
    normalized = normalize_category_name(name)
    existing = db.scalar(
        select(LedgerCategory).where(
            LedgerCategory.user_id == user.id,
            LedgerCategory.entry_type == payload.entry_type,
            LedgerCategory.normalized_name == normalized,
        )
    )
    if existing:
        if existing.is_archived:
            existing.is_archived = False
            if commit:
                db.commit()
                db.refresh(existing)
        return existing

    custom_count = db.scalar(
        select(func.count(LedgerCategory.id)).where(
            LedgerCategory.user_id == user.id,
            LedgerCategory.is_default.is_(False),
        )
    ) or 0
    if custom_count >= 100:
        raise LedgerConflictError("自定义分类数量已达到 100 个上限。")

    category = LedgerCategory(
        user_id=user.id,
        name=name,
        normalized_name=normalized,
        entry_type=payload.entry_type,
        is_default=False,
    )
    db.add(category)
    if commit:
        db.commit()
        db.refresh(category)
    else:
        db.flush()
    return category


def rename_category(
    db: Session, user: User, category_id: int, name: str
) -> LedgerCategory:
    category = _get_owned_category(db, user, category_id, include_archived=True)
    normalized = normalize_category_name(name)
    conflict = db.scalar(
        select(LedgerCategory.id).where(
            LedgerCategory.user_id == user.id,
            LedgerCategory.entry_type == category.entry_type,
            LedgerCategory.normalized_name == normalized,
            LedgerCategory.id != category.id,
        )
    )
    if conflict:
        raise LedgerConflictError("同类型下已存在该分类。")
    category.name = " ".join(name.strip().split())
    category.normalized_name = normalized
    db.commit()
    db.refresh(category)
    return category


def archive_category(
    db: Session, user: User, category_id: int, *, archived: bool = True
) -> LedgerCategory:
    category = _get_owned_category(db, user, category_id, include_archived=True)
    category.is_archived = archived
    db.commit()
    db.refresh(category)
    return category


def _get_owned_category(
    db: Session,
    user: User,
    category_id: int,
    *,
    include_archived: bool = False,
) -> LedgerCategory:
    stmt = select(LedgerCategory).where(
        LedgerCategory.id == category_id,
        LedgerCategory.user_id == user.id,
    )
    if not include_archived:
        stmt = stmt.where(LedgerCategory.is_archived.is_(False))
    category = db.scalar(stmt)
    if not category:
        raise LedgerNotFoundError("记账分类不存在。")
    return category


def _resolve_category(
    db: Session,
    user: User,
    *,
    entry_type: str,
    category_id: int | None,
    category_name: str | None,
    commit: bool,
) -> LedgerCategory:
    if category_id is not None:
        category = _get_owned_category(db, user, category_id)
        if category.entry_type != entry_type:
            raise LedgerConflictError("分类类型与账目收支类型不一致。")
        return category
    return create_category(
        db,
        user,
        LedgerCategoryCreate(name=category_name or "其他", entry_type=entry_type),
        commit=commit,
    )


def create_entry(
    db: Session,
    user: User,
    payload: LedgerEntryCreate,
    *,
    source: str = "web_form",
    commit: bool = True,
) -> LedgerEntry:
    idempotency_key = payload.idempotency_key or uuid4().hex
    existing = db.scalar(
        select(LedgerEntry)
        .options(selectinload(LedgerEntry.category))
        .where(
            LedgerEntry.user_id == user.id,
            LedgerEntry.idempotency_key == idempotency_key,
        )
    )
    if existing:
        return existing

    category = _resolve_category(
        db,
        user,
        entry_type=payload.entry_type,
        category_id=payload.category_id,
        category_name=payload.category_name,
        commit=False,
    )
    occurred_at = payload.occurred_at or datetime.now(SHANGHAI).replace(tzinfo=None)
    if occurred_at.tzinfo is not None:
        occurred_at = occurred_at.astimezone(SHANGHAI).replace(tzinfo=None)
    entry = LedgerEntry(
        user_id=user.id,
        category_id=category.id,
        entry_type=payload.entry_type,
        amount=payload.amount.quantize(Decimal("0.01")),
        currency=payload.currency,
        occurred_at=occurred_at,
        note=payload.note.strip() if payload.note else None,
        source=source,
        idempotency_key=idempotency_key,
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    else:
        db.flush()
    entry.category = category
    return entry


def list_entries(
    db: Session,
    user: User,
    *,
    year: int | None = None,
    month: int | None = None,
    include_deleted: bool = False,
) -> list[LedgerEntry]:
    stmt = (
        select(LedgerEntry)
        .options(selectinload(LedgerEntry.category))
        .where(LedgerEntry.user_id == user.id)
    )
    if not include_deleted:
        stmt = stmt.where(LedgerEntry.deleted_at.is_(None))
    if year is not None and month is not None:
        start, end = _month_bounds(year, month)
        stmt = stmt.where(
            LedgerEntry.occurred_at >= start,
            LedgerEntry.occurred_at < end,
        )
    return list(db.scalars(stmt.order_by(LedgerEntry.occurred_at.desc(), LedgerEntry.id.desc())).all())


def get_entry(
    db: Session, user: User, entry_id: int, *, include_deleted: bool = False
) -> LedgerEntry:
    return _get_owned_entry(db, user, entry_id, include_deleted=include_deleted)


def update_entry(
    db: Session,
    user: User,
    entry_id: int,
    payload: LedgerEntryUpdate,
    *,
    commit: bool = True,
) -> LedgerEntry:
    entry = _get_owned_entry(db, user, entry_id, include_deleted=False)
    data = payload.model_dump(exclude_unset=True)
    next_type = data.pop("entry_type", entry.entry_type)
    category_id = data.pop("category_id", None)
    category_name = data.pop("category_name", None)
    if category_id is not None or category_name is not None or next_type != entry.entry_type:
        category = _resolve_category(
            db,
            user,
            entry_type=next_type,
            category_id=category_id,
            category_name=category_name or (entry.category.name if next_type == entry.entry_type else "其他"),
            commit=False,
        )
        entry.category_id = category.id
        entry.category = category
    entry.entry_type = next_type
    for field, value in data.items():
        if field == "amount" and value is not None:
            value = value.quantize(Decimal("0.01"))
        if field == "note" and value:
            value = value.strip()
        setattr(entry, field, value)
    if commit:
        db.commit()
        db.refresh(entry)
    else:
        db.flush()
    return entry


def soft_delete_entry(
    db: Session, user: User, entry_id: int, *, commit: bool = True
) -> LedgerEntry:
    entry = _get_owned_entry(db, user, entry_id, include_deleted=False)
    entry.deleted_at = datetime.now(SHANGHAI).replace(tzinfo=None)
    if commit:
        db.commit()
        db.refresh(entry)
    else:
        db.flush()
    return entry


def restore_entry(
    db: Session, user: User, entry_id: int, *, commit: bool = True
) -> LedgerEntry:
    entry = _get_owned_entry(db, user, entry_id, include_deleted=True)
    entry.deleted_at = None
    if commit:
        db.commit()
        db.refresh(entry)
    else:
        db.flush()
    return entry


def _get_owned_entry(
    db: Session, user: User, entry_id: int, *, include_deleted: bool
) -> LedgerEntry:
    stmt = (
        select(LedgerEntry)
        .options(selectinload(LedgerEntry.category))
        .where(LedgerEntry.id == entry_id, LedgerEntry.user_id == user.id)
    )
    if not include_deleted:
        stmt = stmt.where(LedgerEntry.deleted_at.is_(None))
    entry = db.scalar(stmt)
    if not entry:
        raise LedgerNotFoundError("账目不存在。")
    return entry


def get_month_summary(
    db: Session, user: User, year: int, month: int
) -> LedgerSummaryOut:
    entries = list_entries(db, user, year=year, month=month)
    income_total = Decimal("0.00")
    expense_total = Decimal("0.00")
    categories: dict[tuple[int, str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
    daily: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0.00"), "expense": Decimal("0.00")}
    )
    for entry in entries:
        amount = Decimal(entry.amount).quantize(Decimal("0.01"))
        if entry.entry_type == "income":
            income_total += amount
        else:
            expense_total += amount
        categories[(entry.category_id, entry.category.name, entry.entry_type)] += amount
        daily[entry.occurred_at.date().isoformat()][entry.entry_type] += amount

    return LedgerSummaryOut(
        year=year,
        month=month,
        income_total=income_total,
        expense_total=expense_total,
        balance=income_total - expense_total,
        category_totals=[
            LedgerCategoryTotal(
                category_id=category_id,
                category_name=name,
                entry_type=entry_type,
                total=total,
            )
            for (category_id, name, entry_type), total in sorted(
                categories.items(), key=lambda item: item[1], reverse=True
            )
        ],
        daily_totals=[
            LedgerDailyTotal(date=date, income=values["income"], expense=values["expense"])
            for date, values in sorted(daily.items())
        ],
    )


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    if month < 1 or month > 12:
        raise LedgerConflictError("月份必须在 1 到 12 之间。")
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    return start, end
