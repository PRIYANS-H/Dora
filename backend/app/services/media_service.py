import os
import uuid
from typing import List, Tuple, Optional
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image
import io

from app.models import PostMedia
from app.storage.local import storage_provider

ALLOWED_IMAGE_MIMES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"]
}

ALLOWED_VIDEO_MIMES = {
    "video/mp4": [".mp4"],
    "video/webm": [".webm"],
    "video/quicktime": [".mov"]
}

MAX_IMAGE_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB

def validate_media_file(file: UploadFile) -> Tuple[str, str, int]:
    """
    Validates MIME type, extension, and file size.
    Returns (media_type, safe_ext, file_size).
    """
    content_type = file.content_type.lower() if file.content_type else ""
    filename = file.filename or "uploaded_media"
    _, ext = os.path.splitext(filename.lower())

    media_type = None
    if content_type in ALLOWED_IMAGE_MIMES:
        if ext not in ALLOWED_IMAGE_MIMES[content_type] and ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ALLOWED_IMAGE_MIMES[content_type][0]
        media_type = "image"
    elif content_type in ALLOWED_VIDEO_MIMES:
        if ext not in ALLOWED_VIDEO_MIMES[content_type] and ext not in [".mp4", ".webm", ".mov"]:
            ext = ALLOWED_VIDEO_MIMES[content_type][0]
        media_type = "video"
    else:
        # Fallback to extension check if content_type was generic octet-stream
        if ext in [".jpg", ".jpeg", ".png", ".webp"]:
            media_type = "image"
            content_type = "image/jpeg" if ext in [".jpg", ".jpeg"] else f"image/{ext.lstrip('.')}"
        elif ext in [".mp4", ".webm", ".mov"]:
            media_type = "video"
            content_type = "video/quicktime" if ext == ".mov" else f"video/{ext.lstrip('.')}"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{content_type or ext}'. Supported: JPG, PNG, WEBP images and MP4, WEBM, MOV videos."
            )

    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size <= 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if media_type == "image" and file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"Image exceeds maximum limit of {MAX_IMAGE_SIZE // (1024*1024)}MB.")

    if media_type == "video" and file_size > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail=f"Video exceeds maximum limit of {MAX_VIDEO_SIZE // (1024*1024)}MB.")

    return media_type, content_type, ext, file_size

def process_and_store_media(file: UploadFile, db: Session) -> PostMedia:
    media_type, mime_type, ext, file_size = validate_media_file(file)

    width = None
    height = None
    duration = None

    # Inspect image metadata & integrity
    if media_type == "image":
        try:
            file_bytes = file.file.read()
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()  # verify integrity
            # Reopen to get dimensions since verify() closes image state
            img = Image.open(io.BytesIO(file_bytes))
            width, height = img.size
            file.file.seek(0)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Corrupt or invalid image file: {str(e)}")

    # Generate collision-free filename
    unique_filename = f"{media_type}_{uuid.uuid4().hex[:12]}{ext}"

    # Save to storage provider
    storage_res = storage_provider.save(file.file, unique_filename, subfolder="media")

    # Persist media row
    media_record = PostMedia(
        media_type=media_type,
        file_name=unique_filename,
        file_path=storage_res.file_path,
        url=storage_res.url,
        mime_type=mime_type,
        file_size=file_size,
        width=width,
        height=height,
        duration=duration
    )
    db.add(media_record)
    db.commit()
    db.refresh(media_record)
    return media_record

def get_media_records_by_ids(media_ids: List[str], db: Session) -> List[PostMedia]:
    if not media_ids:
        return []
    return db.query(PostMedia).filter(PostMedia.id.in_(media_ids)).all()
