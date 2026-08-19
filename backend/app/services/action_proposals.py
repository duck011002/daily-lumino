from datetime import datetime, timedelta
from typing import Any

from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.ai_action_proposal import AIActionProposal
from app.models.user import User
from app.schemas.actions import ActionReceipt, ActionRequest
from app.services import action_executor


PROPOSAL_TTL = timedelta(hours=24)
ALLOWED_PROPOSAL_TOOLS = {"create_blog_post"}


class ProposalExpiredError(action_executor.ActionConflictError):
    pass


class ProposalConflictError(action_executor.ActionConflictError):
    pass


def create_proposal(
    db: Session,
    user: User,
    *,
    session_id: int | None,
    tool: str,
    arguments: dict[str, Any],
) -> AIActionProposal:
    if tool not in ALLOWED_PROPOSAL_TOOLS:
        raise action_executor.ActionValidationError("该操作不支持待确认提案。")
    if not user.is_root and not user.can_write_blog:
        raise action_executor.ActionPermissionError("当前用户没有博客写作权限。")
    action_tool = action_executor.TOOLS[tool]
    try:
        action_tool.argument_model.model_validate(arguments)
    except ValidationError as exc:
        raise action_executor.ActionValidationError(str(exc)) from exc
    proposal = AIActionProposal(
        user_id=user.id,
        session_id=session_id,
        tool=tool,
        arguments_json=jsonable_encoder(arguments),
        status="pending",
        expires_at=datetime.utcnow() + PROPOSAL_TTL,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def get_owned_proposal(
    db: Session, user: User, proposal_id: int
) -> AIActionProposal:
    proposal = db.get(AIActionProposal, proposal_id)
    if proposal is None:
        raise action_executor.ActionNotFoundError("待确认提案不存在。")
    if proposal.user_id != user.id:
        raise action_executor.ActionPermissionError("不能访问其他用户的待确认提案。")
    return proposal


def confirm_proposal(
    db: Session, user: User, proposal_id: int
) -> ActionReceipt:
    proposal = get_owned_proposal(db, user, proposal_id)
    request = ActionRequest(
        tool=proposal.tool,
        arguments=proposal.arguments_json,
        idempotency_key=f"proposal:{proposal.id}",
    )
    if proposal.status == "confirmed":
        return action_executor.execute_action(
            db, user, request, source="web_ai_confirmation"
        )
    if proposal.status != "pending":
        raise ProposalConflictError("该提案已经处理，不能再次确认。")
    if proposal.expires_at <= datetime.utcnow():
        proposal.status = "expired"
        proposal.resolved_at = datetime.utcnow()
        db.commit()
        raise ProposalExpiredError("该博客提案已过期。")
    receipt = action_executor.execute_action(
        db, user, request, source="web_ai_confirmation"
    )
    proposal.status = "confirmed"
    proposal.action_run_id = receipt.action_id
    proposal.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(proposal)
    return receipt


def cancel_proposal(
    db: Session, user: User, proposal_id: int
) -> AIActionProposal:
    proposal = get_owned_proposal(db, user, proposal_id)
    if proposal.status == "cancelled":
        return proposal
    if proposal.status != "pending":
        raise ProposalConflictError("该提案已经处理，不能取消。")
    proposal.status = "cancelled"
    proposal.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(proposal)
    return proposal

