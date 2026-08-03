from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_root
from app.schemas.visit_analytics import VisitAnalyticsResponse, VisitCreate
from app.services.visit_analytics import build_admin_analytics, record_visit

DatabaseSession = Annotated[Session, Depends(get_db)]

tracker_router = APIRouter(prefix="/api/analytics", tags=["analytics"])
admin_router = APIRouter(
    prefix="/api/admin/analytics",
    tags=["admin-analytics"],
    dependencies=[Depends(require_root)],
)


@tracker_router.post("/visit", status_code=status.HTTP_204_NO_CONTENT)
def create_visit(
    payload: VisitCreate,
    request: Request,
    db: DatabaseSession,
):
    record_visit(db, request, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get("", response_model=VisitAnalyticsResponse)
def get_visit_analytics(
    db: DatabaseSession,
    days: Annotated[int, Query(ge=7, le=90)] = 30,
):
    return build_admin_analytics(db, days)
