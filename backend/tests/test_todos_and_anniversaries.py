from datetime import datetime
from app.models.user import User
from app.models.todo import Todo
from app.models.space import Space, SpaceAnniversary, SpaceType
from app.services.auth import hash_password


def create_test_user(db, username: str):
    user = User(
        username=username,
        email=f"{username}@example.com",
        password=hash_password("password123"),
        display_name=username,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def test_todo_and_anniversary_db_creation(db):
    user = create_test_user(db, "todouser1")

    # Todo 创建测试
    todo = Todo(user_id=user.id, title="全栈开发待办", priority="high")
    db.add(todo)
    db.commit()
    assert todo.id is not None
    assert todo.title == "全栈开发待办"

    # Space 纪念日创建测试
    space = Space(name="测试空间", type=SpaceType.PERSONAL, created_by=user.id)
    db.add(space)
    db.commit()

    anniv = SpaceAnniversary(
        space_id=space.id,
        title="测试纪念日",
        target_date=datetime.utcnow(),
        created_by=user.id,
    )
    db.add(anniv)
    db.commit()
    assert anniv.id is not None
    assert anniv.title == "测试纪念日"
