from datetime import UTC, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_space_member
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate

router = APIRouter(prefix="/api/spaces/{space_id}/notes", tags=["notes"])


def get_note_or_404(db: Session, note_id: int, space_id: int) -> Note:
    note = db.scalar(
        select(Note)
        .options(joinedload(Note.author), joinedload(Note.locked_user))
        .where(Note.id == note_id, Note.space_id == space_id)
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="笔记不存在。"
        )
    return note


@router.get("", response_model=List[NoteResponse])
def list_notes(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    notes = db.scalars(
        select(Note)
        .options(joinedload(Note.author), joinedload(Note.locked_user))
        .where(Note.space_id == space_id)
        .order_by(Note.created_at.desc())
    ).all()
    return notes


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    space_id: int,
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = Note(
        space_id=space_id,
        title=note_in.title,
        content=note_in.content,
        cover_url=note_in.cover_url,
        author_id=current_user.id,
        is_published=note_in.is_published,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    # Refresh with relationships loaded
    return get_note_or_404(db, note.id, space_id)


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    space_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    return get_note_or_404(db, note_id, space_id)


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
    space_id: int,
    note_id: int,
    note_in: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = get_note_or_404(db, note_id, space_id)

    # Check pessimistic edit lock
    now = datetime.now(UTC).replace(tzinfo=None)
    if note.lock_by is not None and note.lock_by != current_user.id:
        if note.lock_at is not None:
            lock_age = now - note.lock_at
            if lock_age < timedelta(minutes=30):
                # Lock is active and held by someone else
                locker = note.locked_user
                locker_name = locker.display_name or locker.username if locker else "其他成员"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"该笔记正在被 {locker_name} 编辑中，无法保存。",
                )

    # Update note contents
    if note_in.title is not None:
        note.title = note_in.title
    if note_in.content is not None:
        note.content = note_in.content
    if note_in.cover_url is not None:
        note.cover_url = note_in.cover_url
    if note_in.is_published is not None:
        note.is_published = note_in.is_published

    # Auto refresh/acquire lock on successful update if it's not locked or expired
    note.lock_by = current_user.id
    note.lock_at = now

    db.commit()
    db.refresh(note)
    return get_note_or_404(db, note.id, space_id)


@router.delete("/{note_id}")
def delete_note(
    space_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = get_note_or_404(db, note_id, space_id)
    db.delete(note)
    db.commit()
    return {"status": "ok", "message": "笔记已删除。"}


@router.post("/{note_id}/lock")
def acquire_lock(
    space_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = get_note_or_404(db, note_id, space_id)
    now = datetime.now(UTC).replace(tzinfo=None)

    # Check if currently locked by someone else and active
    if note.lock_by is not None and note.lock_by != current_user.id:
        if note.lock_at is not None:
            lock_age = now - note.lock_at
            if lock_age < timedelta(minutes=30):
                locker = note.locked_user
                locker_name = locker.display_name or locker.username if locker else "其他成员"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"该笔记正在被 {locker_name} 编辑中。",
                )

    # Acquire lock
    note.lock_by = current_user.id
    note.lock_at = now
    db.commit()
    db.refresh(note)

    return {
        "status": "ok",
        "lock_by": note.lock_by,
        "lock_at": note.lock_at,
    }


@router.post("/{note_id}/heartbeat")
def heartbeat_lock(
    space_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = get_note_or_404(db, note_id, space_id)
    now = datetime.now(UTC).replace(tzinfo=None)

    # If lock is held by someone else, we cannot heartbeat it
    if note.lock_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="您未持有该笔记的编辑锁，或已被他人接管。",
        )

    # Update lock timestamp
    note.lock_at = now
    db.commit()
    db.refresh(note)

    return {
        "status": "ok",
        "lock_at": note.lock_at,
    }


@router.delete("/{note_id}/lock")
def release_lock(
    space_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member=Depends(require_space_member),
):
    note = get_note_or_404(db, note_id, space_id)

    # Only release if held by current user
    if note.lock_by == current_user.id:
        note.lock_by = None
        note.lock_at = None
        db.commit()
        return {"status": "ok", "message": "编辑锁已释放。"}

    return {"status": "ok", "message": "编辑锁未被您持有，无需释放。"}
