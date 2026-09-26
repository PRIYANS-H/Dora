from fastapi import APIRouter, Depends, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.services.media_service import process_and_store_media

router = APIRouter(prefix="/media", tags=["Media"])

@router.post(
    "/upload",
    response_model=schemas.MediaUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload image or video media",
    description="Uploads an image (JPG, PNG, WEBP) or video (MP4, WEBM, MOV), validates size & format, and returns stored media metadata."
)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    media = process_and_store_media(file, db)
    return schemas.MediaUploadResponse(
        id=media.id,
        url=media.url,
        media_type=media.media_type,
        file_name=media.file_name,
        mime_type=media.mime_type,
        file_size=media.file_size,
        width=media.width,
        height=media.height,
        duration=media.duration
    )
