from datetime import datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models.blog import BlogPost
from app.services.action_proposals import (
    ProposalConflictError,
    ProposalExpiredError,
    cancel_proposal,
    confirm_proposal,
    create_proposal,
)
from app.services.action_executor import ActionPermissionError


def _writer(user_factory, name: str):
    user = user_factory(name)
    user.can_write_blog = True
    return user


def test_blog_proposal_creates_draft_only_after_confirmation(db, user_factory):
    author = _writer(user_factory, "proposal-author")
    proposal = create_proposal(
        db,
        author,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "私人 Agent", "content": "正文"},
    )

    assert db.scalar(select(func.count(BlogPost.id))) == 0
    receipt = confirm_proposal(db, author, proposal.id)
    post = db.get(BlogPost, receipt.target_id)
    assert post is not None
    assert post.is_public is False
    assert post.is_published is False


def test_blog_proposal_confirmation_is_idempotent(db, user_factory):
    author = _writer(user_factory, "proposal-repeat")
    proposal = create_proposal(
        db,
        author,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "只创建一次", "content": "正文"},
    )

    first = confirm_proposal(db, author, proposal.id)
    second = confirm_proposal(db, author, proposal.id)

    assert first.action_id == second.action_id
    assert db.scalar(select(func.count(BlogPost.id))) == 1


def test_blog_proposal_is_owner_only(db, user_factory):
    owner = _writer(user_factory, "proposal-owner")
    stranger = _writer(user_factory, "proposal-stranger")
    proposal = create_proposal(
        db,
        owner,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "私有", "content": "正文"},
    )

    with pytest.raises(ActionPermissionError):
        confirm_proposal(db, stranger, proposal.id)


def test_blog_proposal_can_be_cancelled(db, user_factory):
    author = _writer(user_factory, "proposal-cancel")
    proposal = create_proposal(
        db,
        author,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "取消", "content": "正文"},
    )

    cancelled = cancel_proposal(db, author, proposal.id)
    assert cancelled.status == "cancelled"
    with pytest.raises(ProposalConflictError):
        confirm_proposal(db, author, proposal.id)


def test_expired_blog_proposal_cannot_be_confirmed(db, user_factory):
    author = _writer(user_factory, "proposal-expired")
    proposal = create_proposal(
        db,
        author,
        session_id=None,
        tool="create_blog_post",
        arguments={"title": "过期", "content": "正文"},
    )
    proposal.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.commit()

    with pytest.raises(ProposalExpiredError):
        confirm_proposal(db, author, proposal.id)
    assert db.scalar(select(func.count(BlogPost.id))) == 0
