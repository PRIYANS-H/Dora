from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.services.media_service import get_media_records_by_ids
from app.services.caption_service import generate_caption_for_media, TONE_PROMPTS

router = APIRouter(prefix="/posts", tags=["AI Caption"])

@router.post(
    "/generate-caption",
    response_model=schemas.CaptionGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI fashion caption from uploaded media",
    description="Analyzes uploaded design media items using Gemini Vision AI and produces a stylish, context-aware fashion caption in the requested tone."
)
def generate_caption(
    payload: schemas.CaptionGenerateRequest,
    db: Session = Depends(get_db)
):
    if not payload.media_ids:
        raise HTTPException(status_code=400, detail="media_ids list cannot be empty.")

    tone = (payload.tone or "creative").lower()
    if tone not in TONE_PROMPTS:
        valid_tones = ", ".join(TONE_PROMPTS.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tone '{payload.tone}'. Must be one of: {valid_tones}"
        )

    media_records = get_media_records_by_ids(payload.media_ids, db)
    if not media_records:
        raise HTTPException(
            status_code=404,
            detail="None of the specified media_ids were found."
        )

    caption = generate_caption_for_media(media_records, tone=tone)
    return schemas.CaptionGenerateResponse(
        caption=caption,
        tone=tone,
        media_count=len(media_records)
    )
