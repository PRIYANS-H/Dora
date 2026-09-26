from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.models import Post, PostLike, PostComment, PostShare
from app.services.post_service import get_post_or_404

router = APIRouter(tags=["Engagement"])

# ==========================================
# 1. Post Likes
# ==========================================

@router.post(
    "/posts/{post_id}/like",
    response_model=schemas.LikeResponse,
    status_code=status.HTTP_200_OK,
    summary="Like a post",
    description="Adds a like from the current user. Repeated likes are idempotent and will not create duplicate entries."
)
def like_post(
    post_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(post_id, db)
    user_id = x_user_id or "user_demo"

    # Check for existing like
    existing = db.query(PostLike).filter(
        PostLike.post_id == post.id,
        PostLike.user_id == user_id
    ).first()

    if not existing:
        like = PostLike(post_id=post.id, user_id=user_id)
        db.add(like)
        db.commit()

    total_likes = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    return schemas.LikeResponse(post_id=post.id, likes_count=total_likes, liked=True)


@router.delete(
    "/posts/{post_id}/like",
    response_model=schemas.LikeResponse,
    status_code=status.HTTP_200_OK,
    summary="Unlike a post",
    description="Removes a like by the current user on the specified post."
)
def unlike_post(
    post_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(post_id, db)
    user_id = x_user_id or "user_demo"

    existing = db.query(PostLike).filter(
        PostLike.post_id == post.id,
        PostLike.user_id == user_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()

    total_likes = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    return schemas.LikeResponse(post_id=post.id, likes_count=total_likes, liked=False)


# ==========================================
# 2. Post Comments
# ==========================================

@router.post(
    "/posts/{post_id}/comments",
    response_model=schemas.CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a post",
    description="Submits a comment on a designer's post. Validates content length and non-empty body."
)
def add_comment(
    post_id: str,
    payload: schemas.CommentCreate,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(post_id, db)
    user_id = x_user_id or "user_demo"
    user_name = x_user_name or "Fashion Enthusiast"

    content = payload.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Comment content cannot be empty or whitespace only."
        )

    comment = PostComment(
        post_id=post.id,
        user_id=user_id,
        user_name=user_name,
        content=content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return schemas.CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user=schemas.CommentAuthor(id=comment.user_id, name=comment.user_name),
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )


@router.get(
    "/posts/{post_id}/comments",
    response_model=List[schemas.CommentResponse],
    summary="Get comments for a post",
    description="Returns all comments for the specified post ordered by creation timestamp (newest first)."
)
def get_comments(
    post_id: str,
    db: Session = Depends(get_db)
):
    post = get_post_or_404(post_id, db)
    comments = db.query(PostComment).filter(
        PostComment.post_id == post.id
    ).order_by(PostComment.created_at.desc()).all()

    return [
        schemas.CommentResponse(
            id=c.id,
            post_id=c.post_id,
            user=schemas.CommentAuthor(id=c.user_id, name=c.user_name, avatar=c.user_avatar),
            content=c.content,
            created_at=c.created_at,
            updated_at=c.updated_at
        )
        for c in comments
    ]


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete comment",
    description="Deletes a comment. Only the author of the comment is authorized."
)
def delete_comment(
    comment_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    comment = db.query(PostComment).filter(PostComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    user_id = x_user_id or "user_demo"
    if comment.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this comment."
        )

    db.delete(comment)
    db.commit()
    return {"detail": "Comment successfully deleted", "id": comment_id}


# ==========================================
# 3. Post Shares
# ==========================================

@router.post(
    "/posts/{post_id}/share",
    response_model=schemas.ShareResponse,
    status_code=status.HTTP_200_OK,
    summary="Record a post share",
    description="Tracks an analytics share event for the post and returns the updated share count."
)
def share_post(
    post_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    post = get_post_or_404(post_id, db)
    user_id = x_user_id or "user_demo"

    share = PostShare(post_id=post.id, user_id=user_id)
    db.add(share)
    db.commit()

    total_shares = db.query(PostShare).filter(PostShare.post_id == post.id).count()
    return schemas.ShareResponse(post_id=post.id, shares_count=total_shares)
