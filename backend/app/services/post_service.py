from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_
from fastapi import HTTPException

from app.models import Post, PostMedia, PostLike, PostComment, PostShare
from app import schemas

def get_post_or_404(post_id: str, db: Session) -> Post:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

def format_post_detail(post: Post, current_user_id: Optional[str] = None, db: Optional[Session] = None) -> schemas.PostDetailResponse:
    likes_cnt = len(post.likes) if post.likes is not None else 0
    comments_cnt = len(post.comments) if post.comments is not None else 0
    shares_cnt = len(post.shares) if post.shares is not None else 0
    
    liked_by_me = False
    if current_user_id and post.likes:
        liked_by_me = any(l.user_id == current_user_id for l in post.likes)

    media_items = [schemas.MediaResponse.model_validate(m) for m in post.media]

    # Designer fallback values
    d_id = post.designer_id or post.designer_handle or "designer-demo"
    d_name = post.designer_name or "Elena Rostova"
    d_handle = post.designer_handle or "@elena_couture"
    d_avatar = post.designer_avatar or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"

    # Primary image_url fallback from media
    img_url = post.image_url
    if (not img_url or img_url.startswith("/static/uploads/media/default")) and media_items:
        img_url = media_items[0].url

    return schemas.PostDetailResponse(
        id=post.id,
        designer=schemas.DesignerProfile(
            id=d_id,
            name=d_name,
            handle=d_handle,
            profile_image=d_avatar
        ),
        media=media_items,
        caption=post.caption,
        likes_count=likes_cnt,
        comments_count=comments_cnt,
        shares_count=shares_cnt,
        liked_by_current_user=liked_by_me,
        created_at=post.created_at,
        updated_at=post.updated_at,
        is_published=post.is_published,
        title=post.title or "Couture Garment",
        designer_name=d_name,
        designer_handle=d_handle,
        image_url=img_url,
        base_attributes=post.base_attributes or {},
        price_reference=post.price_reference or 250
    )

def get_paginated_feed(
    db: Session,
    page: int = 1,
    limit: int = 20,
    sort: str = "newest",
    current_user_id: Optional[str] = None,
    designer_filter: Optional[str] = None
) -> Tuple[List[schemas.PostDetailResponse], int]:
    """
    Retrieves paginated posts with eager-loaded media, likes, comments, and shares.
    Avoids N+1 query overhead using joinedload.
    """
    page = max(1, page)
    limit = max(1, min(100, limit))
    offset = (page - 1) * limit

    query = db.query(Post).filter(Post.is_published == True)

    if designer_filter:
        query = query.filter(
            or_(
                Post.designer_id == designer_filter,
                Post.designer_handle == designer_filter,
                Post.designer_name.ilike(f"%{designer_filter}%")
            )
        )

    total = query.count()

    # Eager load related entities
    query = query.options(
        joinedload(Post.media),
        joinedload(Post.likes),
        joinedload(Post.comments),
        joinedload(Post.shares)
    )

    if sort == "newest":
        query = query.order_by(desc(Post.created_at))
    elif sort == "popular":
        # Order by total likes count descending
        likes_sub = db.query(PostLike.post_id, func.count(PostLike.id).label("cnt")).group_by(PostLike.post_id).subquery()
        query = query.outerjoin(likes_sub, Post.id == likes_sub.c.post_id).order_by(desc(func.coalesce(likes_sub.c.cnt, 0)), desc(Post.created_at))
    else:
        query = query.order_by(desc(Post.created_at))

    posts = query.offset(offset).limit(limit).all()

    # Convert distinct posts (joinedload may duplicate rows in memory without unique())
    # Note: query.all() with joinedload across multiple collections should use unique()
    unique_posts = []
    seen_ids = set()
    for p in posts:
        if p.id not in seen_ids:
            seen_ids.add(p.id)
            unique_posts.append(p)

    items = [format_post_detail(p, current_user_id=current_user_id, db=db) for p in unique_posts]
    return items, total
