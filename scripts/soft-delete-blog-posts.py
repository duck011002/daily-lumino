#!/usr/bin/env python3
import argparse
import json
from datetime import UTC, datetime

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models.blog import BlogPost


def parse_target(value: str) -> tuple[int, str]:
    post_id, separator, slug = value.partition(":")
    if not separator or not post_id.isdigit() or not slug:
        raise argparse.ArgumentTypeError("target must use ID:SLUG format")
    return int(post_id), slug


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", action="append", type=parse_target, required=True)
    parser.add_argument("--expected-active-total", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    expected_targets = dict(args.target)
    if len(expected_targets) != len(args.target):
        raise RuntimeError("Duplicate target IDs are not allowed.")

    with SessionLocal() as db:
        active_total = db.scalar(
            select(func.count(BlogPost.id)).where(BlogPost.deleted_at.is_(None))
        )
        if active_total != args.expected_active_total:
            raise RuntimeError(
                f"Expected {args.expected_active_total} active posts, found {active_total}."
            )

        posts = list(
            db.scalars(select(BlogPost).where(BlogPost.id.in_(expected_targets))).all()
        )
        if len(posts) != len(expected_targets):
            raise RuntimeError("One or more target post IDs do not exist.")
        for post in posts:
            if post.slug != expected_targets[post.id]:
                raise RuntimeError(
                    f"Slug mismatch for post {post.id}; refusing to continue."
                )
            if post.deleted_at is not None:
                raise RuntimeError(f"Post {post.id} is already soft-deleted.")

        summary = {
            "mode": "apply" if args.apply else "dry-run",
            "active_total_before": active_total,
            "targets": [
                {"id": post.id, "slug": post.slug, "title": post.title}
                for post in sorted(posts, key=lambda item: item.id)
            ],
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if not args.apply:
            return

        deleted_at = datetime.now(UTC).replace(tzinfo=None)
        for post in posts:
            post.deleted_at = deleted_at
            post.is_featured = False
        db.commit()

        active_total_after = db.scalar(
            select(func.count(BlogPost.id)).where(BlogPost.deleted_at.is_(None))
        )
        if active_total_after != active_total - len(posts):
            raise RuntimeError(
                "Soft deletion committed but the active-count invariant failed."
            )

        print(
            json.dumps(
                {
                    "status": "completed",
                    "soft_deleted_ids": sorted(expected_targets),
                    "active_total_after": active_total_after,
                },
                ensure_ascii=False,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
