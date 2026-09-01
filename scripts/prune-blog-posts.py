#!/usr/bin/env python3
import argparse
import json
import os
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models.blog import BlogPost


def json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def serialize_post(post: BlogPost) -> dict:
    return {
        column.name: json_value(getattr(post, column.name))
        for column in BlogPost.__table__.columns
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep-id", type=int, required=True)
    parser.add_argument("--keep-slug", required=True)
    parser.add_argument("--expected-total", type=int, required=True)
    parser.add_argument("--backup", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    with SessionLocal() as db:
        posts = list(db.scalars(select(BlogPost).order_by(BlogPost.id.asc())).all())
        if len(posts) != args.expected_total:
            raise RuntimeError(
                f"Expected {args.expected_total} posts, found {len(posts)}; refusing to continue."
            )

        keep = next((post for post in posts if post.id == args.keep_id), None)
        if not keep or keep.slug != args.keep_slug:
            raise RuntimeError("The requested keep-id and keep-slug do not identify one post.")
        if not keep.is_public or not keep.is_published:
            raise RuntimeError("The retained post must already be public and published.")

        targets = [post for post in posts if post.id != keep.id]
        print(
            json.dumps(
                {
                    "mode": "apply" if args.apply else "dry-run",
                    "keep": {"id": keep.id, "slug": keep.slug, "title": keep.title},
                    "delete_count": len(targets),
                    "delete_ids": [post.id for post in targets],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        if not args.apply:
            return

        args.backup.parent.mkdir(parents=True, exist_ok=True)
        with args.backup.open("x", encoding="utf-8") as backup_file:
            json.dump(
                {
                    "kept_post": serialize_post(keep),
                    "deleted_posts": [serialize_post(post) for post in targets],
                },
                backup_file,
                ensure_ascii=False,
                indent=2,
            )
            backup_file.write("\n")
        os.chmod(args.backup, 0o600)

        for post in targets:
            db.delete(post)
        db.commit()

        remaining = list(db.scalars(select(BlogPost).order_by(BlogPost.id.asc())).all())
        if len(remaining) != 1 or remaining[0].id != keep.id:
            raise RuntimeError("Post pruning committed but the final invariant was not met.")

        print(
            json.dumps(
                {
                    "status": "completed",
                    "backup": str(args.backup),
                    "remaining_count": 1,
                    "remaining_id": remaining[0].id,
                },
                ensure_ascii=False,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
