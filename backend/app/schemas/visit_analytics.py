from datetime import date, datetime

from pydantic import BaseModel, Field


class VisitCreate(BaseModel):
    path: str = Field(..., min_length=1, max_length=400)
    referrer_host: str | None = Field(None, max_length=255)


class VisitOverview(BaseModel):
    today_views: int
    today_unique_visitors: int
    period_views: int
    average_daily_unique_visitors: int


class VisitTrendItem(BaseModel):
    date: date
    page_views: int
    unique_visitors: int


class VisitDimensionItem(BaseModel):
    value: str
    page_views: int
    unique_visitors: int


class RecentVisitItem(BaseModel):
    visited_at: datetime
    ip_address: str
    path: str
    country_code: str
    subdivision_code: str
    city_name: str
    isp_code: str
    device_type: str
    referrer_host: str | None


class VisitRetentionInfo(BaseModel):
    raw_hours: int
    summary_days: int


class VisitAnalyticsResponse(BaseModel):
    generated_at: datetime
    period_days: int
    overview: VisitOverview
    trend: list[VisitTrendItem]
    breakdowns: dict[str, list[VisitDimensionItem]]
    recent_visits: list[RecentVisitItem]
    retention: VisitRetentionInfo
