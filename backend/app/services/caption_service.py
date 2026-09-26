import os
from dotenv import load_dotenv
load_dotenv(override=True)

from typing import List, Optional
from fastapi import HTTPException
from PIL import Image
from app.models import PostMedia

TONE_PROMPTS = {
    "professional": "Style: Clean, thoughtful, and refined. Focus simply on the cut and tailoring.",
    "creative": "Style: Poetic and artistic, yet simple and grounded. Focus on silhouette and mood.",
    "minimal": "Style: Understated and quiet. Pure simplicity with few words.",
    "luxury": "Style: Effortlessly elegant. Warm, subtle luxury without over-the-top buzzwords.",
    "casual": "Style: Relaxed, friendly, and easygoing. Sounds like an effortless everyday favorite.",
    "streetwear": "Style: Crisp, modern, and confident. A natural urban feel."
}

def generate_caption_for_media(media_records: List[PostMedia], tone: str = "creative") -> str:
    """
    Analyzes uploaded media items using Gemini Vision model and returns a fashion caption.
    Raises HTTPException if API key is missing or model fails.
    """
    if not media_records:
        raise HTTPException(status_code=400, detail="At least one media item is required to generate a caption.")

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(
            status_code=503,
            detail="AI caption generation is unavailable: GEMINI_API_KEY environment variable is not configured."
        )

    tone_instruction = TONE_PROMPTS.get(tone.lower(), TONE_PROMPTS["creative"])

    # Load up to 3 image files for multimodal prompt
    loaded_images = []
    for m in media_records:
        if m.media_type == "image" and os.path.exists(m.file_path):
            try:
                img = Image.open(m.file_path)
                loaded_images.append(img)
                if len(loaded_images) >= 3:
                    break
            except Exception as e:
                print(f"[CaptionService] Unable to open image {m.file_path}: {e}")

    if not loaded_images:
        raise HTTPException(
            status_code=400,
            detail="No readable image media found among the selected media IDs to analyze."
        )

    prompt = f"""
You are a thoughtful fashion designer sharing a new piece on your personal feed.
Look at the attached garment image and write a short, human, elegant caption.

{tone_instruction}

Guidelines:
1. Keep it SHORT: exactly 1 or 2 concise, natural sentences (under 30 words).
2. Sound like a real person, not an AI or marketing brochure. Use simple, graceful words.
3. Avoid generic AI cliches like "interplay of silhouettes", "testament to", "elevate your wardrobe", "masterful layering", or "exquisite symphony".
4. Focus simply on what makes the piece feel special (the drape, the soft color, or the silhouette).
5. Output ONLY the caption text itself. No hashtags, no quotes, no emojis.
"""

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        
        # Use gemini-2.5-flash (supported by current Gemini API)
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
        except Exception:
            model = genai.GenerativeModel("gemini-flash-latest")
        
        contents = [prompt] + loaded_images
        response = model.generate_content(contents)
        
        if response and response.text:
            return response.text.strip().strip('"')
        else:
            raise HTTPException(status_code=502, detail="AI model returned an empty response.")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini AI caption generation error: {str(e)}"
        )
