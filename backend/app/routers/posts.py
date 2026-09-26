from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.models import Post, PostMedia
from app.services.media_service import get_media_records_by_ids
from app.services.caption_service import generate_caption_for_media
from app.services.post_service import (
    get_post_or_404,
    format_post_detail,
    get_paginated_feed
)

router = APIRouter(tags=["Designer Posts"])

@router.post(
    "/posts",
    response_model=schemas.PostDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new designer fashion post",
    description="Publishes a designer garment post with attached media, optional manual or AI-generated caption, and design metadata."
)
def create_post(
    payload: schemas.PostCreate,
    x_designer_id: Optional[str] = Header(None, alias="X-Designer-Id"),
    x_designer_name: Optional[str] = Header(None, alias="X-Designer-Name"),
    x_designer_handle: Optional[str] = Header(None, alias="X-Designer-Handle"),
    db: Session = Depends(get_db)
):
    # Resolve designer identity (defaults to Elena Rostova if unauthenticated)
    designer_id = x_designer_id or "designer-elena"
    designer_name = x_designer_name or "Elena Rostova"
    designer_handle = x_designer_handle or "@elena_couture"

    caption = payload.caption

    # Optional AI caption generation if requested and no caption provided
    if payload.generate_ai_caption and not caption and payload.media_ids:
        media_records = get_media_records_by_ids(payload.media_ids, db)
        if media_records:
            try:
                caption = generate_caption_for_media(media_records, tone="creative")
            except Exception as e:
                # If AI fails, proceed without crashing as per specification
                print(f"[CreatePost] Auto AI caption generation skipped: {e}")

    # Determine primary image URL
    primary_image_url = ""
    associated_media = []
    if payload.media_ids:
        associated_media = get_media_records_by_ids(payload.media_ids, db)
        for m in associated_media:
            if m.media_type == "image":
                primary_image_url = m.url
                break
        if not primary_image_url and associated_media:
            primary_image_url = associated_media[0].url

    if not primary_image_url:
        primary_image_url = "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop"

    post = Post(
        designer_id=designer_id,
        designer_name=designer_name,
        designer_handle=designer_handle,
        title=payload.title or "Couture Design",
        caption=caption,
        image_url=primary_image_url,
        base_attributes=payload.base_attributes or {
            "neckline": "mandarin",
            "sleeves": "full",
            "fabric": "heavy cotton twill",
            "color": "onyx",
            "fit": "regular"
        },
        price_reference=payload.price_reference or 250,
        is_published=True
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Associate uploaded media with this post
    if associated_media:
        for m in associated_media:
            m.post_id = post.id
        db.commit()
        db.refresh(post)

    return format_post_detail(post, current_user_id=designer_id, db=db)


@router.get(
    "/posts",
    response_model=Union[schemas.PaginatedFeedResponse, List[schemas.PostResponse]],
    summary="Get home feed / all posts",
    description="Retrieves posts ordered by newest or popular. Supports pagination via '?page=1&limit=20'. If page and limit are omitted, returns legacy list for frontend compatibility."
)
def get_posts_feed(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    sort: Optional[str] = Query("newest", description="Sort order: newest or popular"),
    designer: Optional[str] = Query(None, description="Filter by designer ID or handle"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    # Backward compatibility: if no pagination params provided, return legacy List[PostResponse]
    if page is None and limit is None:
        posts = db.query(Post).filter(Post.is_published == True).order_by(Post.created_at.desc()).all()
        # Build list matching legacy PostResponse
        results = []
        for p in posts:
            results.append(schemas.PostResponse(
                id=p.id,
                designer_name=p.designer_name,
                designer_handle=p.designer_handle,
                image_url=p.image_url,
                title=p.title,
                base_attributes=p.base_attributes or {},
                price_reference=p.price_reference or 250,
                created_at=p.created_at,
                caption=p.caption,
                designer_id=p.designer_id,
                designer_avatar=p.designer_avatar,
                likes_count=len(p.likes) if p.likes else 0,
                comments_count=len(p.comments) if p.comments else 0,
                shares_count=len(p.shares) if p.shares else 0,
                media=[schemas.MediaResponse.model_validate(m) for m in p.media]
            ))
        return results

    # Paginated feed response
    cur_page = page or 1
    cur_limit = limit or 20
    items, total = get_paginated_feed(
        db=db,
        page=cur_page,
        limit=cur_limit,
        sort=sort or "newest",
        current_user_id=x_user_id,
        designer_filter=designer
    )
    return schemas.PaginatedFeedResponse(
        items=items,
        page=cur_page,
        limit=cur_limit,
        total=total
    )


@router.get(
    "/posts/{id}",
    response_model=schemas.PostDetailResponse,
    summary="Get single post detail",
    description="Retrieves a single designer post by ID with full media, engagement counts, and designer profile."
)
def get_single_post(
    id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(id, db)
    return format_post_detail(post, current_user_id=x_user_id, db=db)


@router.patch(
    "/posts/{id}",
    response_model=schemas.PostDetailResponse,
    summary="Update post caption or status",
    description="Allows the post owner to edit their caption or toggle publish status."
)
def update_post(
    id: str,
    payload: schemas.PostUpdate,
    x_designer_id: Optional[str] = Header(None, alias="X-Designer-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(id, db)

    # Ownership check
    if post.designer_id and x_designer_id and post.designer_id != x_designer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to edit this post."
        )

    if payload.caption is not None:
        post.caption = payload.caption
    if payload.is_published is not None:
        post.is_published = payload.is_published

    db.commit()
    db.refresh(post)
    return format_post_detail(post, current_user_id=x_designer_id, db=db)


@router.delete(
    "/posts/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete post",
    description="Deletes a post and all associated media records, likes, and comments. Restricted to post owner."
)
def delete_post(
    id: str,
    x_designer_id: Optional[str] = Header(None, alias="X-Designer-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(id, db)

    # Ownership check
    if post.designer_id and x_designer_id and post.designer_id != x_designer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this post."
        )

    db.delete(post)
    db.commit()
    return {"detail": "Post successfully deleted", "id": id}


@router.get(
    "/designers/{designer_id}/posts",
    response_model=schemas.PaginatedFeedResponse,
    summary="Get published posts by a designer",
    description="Retrieves a paginated list of posts published by the given designer."
)
def get_designer_posts(
    designer_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    items, total = get_paginated_feed(
        db=db,
        page=page,
        limit=limit,
        sort="newest",
        current_user_id=x_user_id,
        designer_filter=designer_id
    )
    return schemas.PaginatedFeedResponse(
        items=items,
        page=page,
        limit=limit,
        total=total
    )
