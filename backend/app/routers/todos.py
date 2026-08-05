from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.todo import Todo
from app.models.user import User
from app.schemas.todo import TodoCreate, TodoOut, TodoUpdate

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=list[TodoOut])
def get_todos(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Todo).where(Todo.user_id == current_user.id)
    if status_filter:
        stmt = stmt.where(Todo.status == status_filter)
    stmt = stmt.order_by(Todo.created_at.desc())
    todos = db.scalars(stmt).all()
    return todos


@router.post("", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(
    payload: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = Todo(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status=payload.status,
        due_at=payload.due_at,
        remind_at=payload.remind_at,
        source_url=payload.source_url,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.patch("/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = db.scalar(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == current_user.id)
    )
    if not todo:
        raise HTTPException(status_code=404, detail="待办事项不存在")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(todo, field, val)

    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = db.scalar(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == current_user.id)
    )
    if not todo:
        raise HTTPException(status_code=404, detail="待办事项不存在")

    db.delete(todo)
    db.commit()
    return None
