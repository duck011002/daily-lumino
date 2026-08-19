from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LedgerEntryType = Literal["expense", "income"]


class LedgerCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    entry_type: LedgerEntryType


class LedgerCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_archived: bool | None = None


class LedgerCategoryOut(BaseModel):
    id: int
    user_id: int
    name: str
    entry_type: LedgerEntryType
    is_default: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LedgerEntryCreate(BaseModel):
    entry_type: LedgerEntryType
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    category_id: int | None = None
    category_name: str | None = Field(None, min_length=1, max_length=100)
    occurred_at: datetime | None = None
    note: str | None = Field(None, max_length=500)
    currency: Literal["CNY"] = "CNY"
    idempotency_key: str | None = Field(None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_category(self):
        if self.category_id is None and not self.category_name:
            raise ValueError("请选择或提供一个分类。")
        if self.category_id is not None and self.category_name:
            raise ValueError("category_id 和 category_name 只能提供一个。")
        return self


class LedgerEntryUpdate(BaseModel):
    entry_type: LedgerEntryType | None = None
    amount: Decimal | None = Field(None, gt=0, max_digits=12, decimal_places=2)
    category_id: int | None = None
    category_name: str | None = Field(None, min_length=1, max_length=100)
    occurred_at: datetime | None = None
    note: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_category(self):
        if self.category_id is not None and self.category_name:
            raise ValueError("category_id 和 category_name 只能提供一个。")
        return self


class LedgerEntryOut(BaseModel):
    id: int
    user_id: int
    entry_type: LedgerEntryType
    amount: Decimal
    currency: str
    category_id: int
    category: LedgerCategoryOut
    occurred_at: datetime
    note: str | None
    source: str
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LedgerCategoryTotal(BaseModel):
    category_id: int
    category_name: str
    entry_type: LedgerEntryType
    total: Decimal


class LedgerDailyTotal(BaseModel):
    date: str
    income: Decimal
    expense: Decimal


class LedgerSummaryOut(BaseModel):
    year: int
    month: int
    income_total: Decimal
    expense_total: Decimal
    balance: Decimal
    category_totals: list[LedgerCategoryTotal]
    daily_totals: list[LedgerDailyTotal]
