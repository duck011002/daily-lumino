from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.actions import (
    ActionProposalResponse,
    ActionReceipt,
    ActionRequest,
    InterpretActionRequest,
    InterpretActionResponse,
)
from app.services import action_executor
from app.services import action_proposals
from app.services.ai_action_planner import interpret_and_execute

router = APIRouter(prefix="/api/ai/actions", tags=["ai-actions"])


def _proposal_response(proposal) -> ActionProposalResponse:
    return ActionProposalResponse(
        id=proposal.id,
        tool=proposal.tool,
        arguments=proposal.arguments_json,
        status=proposal.status,
        expires_at=proposal.expires_at,
    )


def _http_error(exc: action_executor.ActionError) -> HTTPException:
    if isinstance(exc, action_executor.ActionPermissionError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, action_executor.ActionNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, (action_executor.ActionConflictError, action_executor.ActionUndoError)):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, action_executor.ActionValidationError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/execute", response_model=ActionReceipt)
def execute(
    payload: ActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return action_executor.execute_action(
            db, current_user, payload, source="web_ai"
        )
    except action_executor.ActionError as exc:
        raise _http_error(exc) from exc


@router.post("/proposals/{proposal_id}/confirm", response_model=ActionReceipt)
def confirm_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return action_proposals.confirm_proposal(db, current_user, proposal_id)
    except action_executor.ActionError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/proposals/{proposal_id}/cancel", response_model=ActionProposalResponse
)
def cancel_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        proposal = action_proposals.cancel_proposal(db, current_user, proposal_id)
        return _proposal_response(proposal)
    except action_executor.ActionError as exc:
        raise _http_error(exc) from exc


@router.post("/{action_id}/undo", response_model=ActionReceipt)
def undo(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return action_executor.undo_action(db, current_user, action_id)
    except action_executor.ActionError as exc:
        raise _http_error(exc) from exc


@router.post("/interpret", response_model=InterpretActionResponse)
def interpret(
    payload: InterpretActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return interpret_and_execute(
            db,
            current_user,
            payload.message,
            context=payload.context,
            model_id=payload.model,
            idempotency_key=payload.idempotency_key,
        )
    except action_executor.ActionError as exc:
        raise _http_error(exc) from exc
