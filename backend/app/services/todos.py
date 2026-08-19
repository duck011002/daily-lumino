from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.todo import Todo
from app.models.user import User
from app.schemas.todo import TodoCreate, TodoStatus, TodoUpdate


class TodoNotFoundError(ValueError):
    pass


def list_todos(
    db: Session, user: User, *, status_filter: TodoStatus | None = None
) -> list[Todo]:
    stmt = select(Todo).where(Todo.user_id == user.id)
    if status_filter:
        stmt = stmt.where(Todo.status == status_filter)
    return list(db.scalars(stmt.order_by(Todo.created_at.desc())).all())


def create_todo(
    db: Session,
    user: User,
    payload: TodoCreate,
    *,
    commit: bool = True,
) -> Todo:
    todo = Todo(
        user_id=user.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        priority=payload.priority,
        status=payload.status,
        due_at=payload.due_at,
        remind_at=payload.remind_at,
        source_url=payload.source_url,
    )
    db.add(todo)
    if commit:
        db.commit()
        db.refresh(todo)
    else:
        db.flush()
    return todo


def get_owned_todo(db: Session, user: User, todo_id: int) -> Todo:
    todo = db.scalar(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == user.id)
    )
    if not todo:
        raise TodoNotFoundError("待办事项不存在")
    return todo


def update_todo(
    db: Session,
    user: User,
    todo_id: int,
    payload: TodoUpdate,
    *,
    commit: bool = True,
) -> Todo:
    todo = get_owned_todo(db, user, todo_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in {"title", "description"} and value:
            value = value.strip()
        setattr(todo, field, value)
    if commit:
        db.commit()
        db.refresh(todo)
    else:
        db.flush()
    return todo


def delete_todo(
    db: Session,
    user: User,
    todo_id: int,
    *,
    commit: bool = True,
) -> None:
    todo = get_owned_todo(db, user, todo_id)
    db.delete(todo)
    if commit:
        db.commit()
    else:
        db.flush()
