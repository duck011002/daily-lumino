from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.mcp_blog import blog_mcp, blog_mcp_asgi
from app.mcp_library import library_mcp, library_mcp_asgi
from app.routers import (
    ai,
    admin,
    albums,
    auth,
    blog,
    chat,
    discipline,
    notes,
    site,
    spaces,
    upload,
    visit_analytics,
)
from app.services.invite_requests import start_invite_request_worker, stop_invite_request_worker
from app.services.visit_analytics import (
    start_visit_analytics_worker,
    stop_visit_analytics_worker,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Mounted Starlette apps do not run their own lifespan under FastAPI.
    async with blog_mcp.session_manager.run():
        async with library_mcp.session_manager.run():
            start_invite_request_worker()
            start_visit_analytics_worker()
            try:
                yield
            finally:
                stop_visit_analytics_worker()
                stop_invite_request_worker()

app = FastAPI(title="Lumino API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(site.public_router)
app.include_router(site.admin_router)
app.include_router(chat.router)
app.include_router(spaces.router)
app.include_router(albums.router)
app.include_router(notes.router)
app.include_router(blog.router)
app.include_router(upload.router)
app.include_router(discipline.router)
app.include_router(visit_analytics.tracker_router)
app.include_router(visit_analytics.admin_router)
app.include_router(ai.router)
app.mount("/api/mcp/blog", blog_mcp_asgi)
app.mount("/api/mcp/library", library_mcp_asgi)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Lumino"}
