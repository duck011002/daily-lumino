from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ledger import (
    LedgerCategoryCreate,
    LedgerCategoryOut,
    LedgerCategoryUpdate,
    LedgerEntryCreate,
    LedgerEntryOut,
    LedgerEntryUpdate,
    LedgerSummaryOut,
)
from app.services import ledger as ledger_service

router = APIRouter(prefix="/api/ledger", tags=["ledger"])
SHANGHAI = timezone(timedelta(hours=8))


def _translate_error(exc: ledger_service.LedgerError) -> HTTPException:
    if isinstance(exc, ledger_service.LedgerNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ledger_service.LedgerConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/categories", response_model=list[LedgerCategoryOut])
def get_categories(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ledger_service.list_categories(
        db, current_user, include_archived=include_archived
    )


@router.post(
    "/categories", response_model=LedgerCategoryOut, status_code=status.HTTP_201_CREATED
)
def post_category(
    payload: LedgerCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.create_category(db, current_user, payload)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.patch("/categories/{category_id}", response_model=LedgerCategoryOut)
def patch_category(
    category_id: int,
    payload: LedgerCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if payload.name is not None:
            category = ledger_service.rename_category(
                db, current_user, category_id, payload.name
            )
        else:
            categories = ledger_service.list_categories(
                db, current_user, include_archived=True
            )
            category = next((item for item in categories if item.id == category_id), None)
            if category is None:
                raise ledger_service.LedgerNotFoundError("记账分类不存在。")
        if payload.is_archived is not None:
            category = ledger_service.archive_category(
                db, current_user, category_id, archived=payload.is_archived
            )
        return category
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.delete("/categories/{category_id}", response_model=LedgerCategoryOut)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.archive_category(db, current_user, category_id)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.get("/entries", response_model=list[LedgerEntryOut])
def get_entries(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (year is None) != (month is None):
        raise HTTPException(status_code=400, detail="year 和 month 必须同时提供。")
    return ledger_service.list_entries(
        db,
        current_user,
        year=year,
        month=month,
        include_deleted=include_deleted,
    )


@router.post(
    "/entries", response_model=LedgerEntryOut, status_code=status.HTTP_201_CREATED
)
def post_entry(
    payload: LedgerEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.create_entry(db, current_user, payload)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.patch("/entries/{entry_id}", response_model=LedgerEntryOut)
def patch_entry(
    entry_id: int,
    payload: LedgerEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.update_entry(db, current_user, entry_id, payload)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.delete("/entries/{entry_id}", response_model=LedgerEntryOut)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.soft_delete_entry(db, current_user, entry_id)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.post("/entries/{entry_id}/restore", response_model=LedgerEntryOut)
def restore_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return ledger_service.restore_entry(db, current_user, entry_id)
    except ledger_service.LedgerError as exc:
        raise _translate_error(exc) from exc


@router.get("/summary", response_model=LedgerSummaryOut)
def get_summary(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(SHANGHAI)
    return ledger_service.get_month_summary(
        db, current_user, year or now.year, month or now.month
    )
