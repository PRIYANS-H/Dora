import os
import hashlib
import json
from PIL import Image, ImageEnhance, ImageDraw
import io
import requests
import cloudinary.uploader

REMIX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "remixes")
os.makedirs(REMIX_DIR, exist_ok=True)

COLOR_MAP = {
    "emerald": (16, 185, 129),
    "navy": (30, 58, 138),
    "burgundy": (136, 19, 55),
    "ochre": (217, 119, 6),
    "ivory": (245, 245, 240),
    "onyx": (24, 24, 27),
    "rose": (244, 63, 94),
    "sapphire": (37, 99, 235),
    "earth tones": (180, 83, 9)
}


def _hex_to_rgb(value: str):
    """Custom colors from the studio's color picker arrive as #rrggbb."""
    value = (value or "").strip().lstrip("#")
    if len(value) != 6:
        return None
    try:
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def get_attributes_hash(post_id: str, attributes: dict) -> str:
    sorted_attr = json.dumps(attributes, sort_keys=True)
    return hashlib.md5(f"{post_id}:{sorted_attr}".encode()).hexdigest()


def build_diff_prompt(base_attributes: dict, new_attributes: dict) -> str:
    diffs = []
    for key, new_val in new_attributes.items():
        base_val = base_attributes.get(key)
        if base_val and base_val.lower() != new_val.lower():
            shown = f"custom colour {new_val.upper()} (hex)" if key == "color" and _hex_to_rgb(new_val) else new_val
            diffs.append(f"{key}: {base_val} -> {shown}")

    if not diffs:
        return "Same silhouette and attributes"

    return ", ".join(diffs)


def _fetch_base_image_bytes(base_image_url: str):
    """Returns (bytes, mime_type) for the source garment photo, local or remote."""
    if base_image_url.startswith("http://") or base_image_url.startswith("https://"):
        resp = requests.get(base_image_url, timeout=10)
        resp.raise_for_status()
        mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        return resp.content, mime
    if base_image_url.startswith("/static/"):
        rel_path = base_image_url.replace("/static/", "")
        local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", rel_path)
        with open(local_path, "rb") as handle:
            return handle.read(), "image/jpeg"
    raise FileNotFoundError(f"Could not resolve base image at {base_image_url}")


def _upload_to_cloud(image_bytes: bytes, public_id: str) -> str:
    """Uploads the generated remix to Cloudinary and returns a persistent CDN URL.

    Local disk isn't safe here: most hosts (Render/Vercel-style deploys) run on an
    ephemeral filesystem, so a remix saved only to /static would vanish on the next
    deploy or restart. Cloudinary is already configured for posts/avatars/fabrics.
    """
    result = cloudinary.uploader.upload(
        io.BytesIO(image_bytes),
        folder="dori/remixes",
        public_id=public_id,
        overwrite=False,
        unique_filename=False,
        resource_type="image",
    )
    return result["secure_url"]


def _generate_with_gemini(prompt_text: str, base_bytes: bytes, base_mime: str) -> bytes:
    """Image-to-image edit via Gemini 2.5 Flash Image ("nano banana").

    This model is a multimodal generate_content model, not the Imagen
    generate_images endpoint — it must receive the source photo alongside the
    text instructions so it edits the actual garment instead of hallucinating
    an unrelated image.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=[
            prompt_text,
            types.Part.from_bytes(data=base_bytes, mime_type=base_mime),
        ],
    )
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return inline.data
    raise RuntimeError("Gemini did not return an image for this remix.")


def _fallback_synthesize(base_img: Image.Image, new_attributes: dict, diff_prompt: str) -> Image.Image:
    """Deterministic PIL-based visual stand-in, used only if Gemini is unavailable or fails."""
    img = base_img.copy()

    color_val = new_attributes.get("color", "").lower()
    rgb = COLOR_MAP.get(color_val) or _hex_to_rgb(color_val)
    if rgb:
        color_layer = Image.new("RGB", img.size, color=rgb)
        img = Image.blend(img, color_layer, alpha=0.28)

    img = ImageEnhance.Contrast(img).enhance(1.15)

    draw = ImageDraw.Draw(img)
    w, h = img.size
    draw.rectangle([0, h - 90, w, h], fill=(15, 17, 26))
    neck = new_attributes.get("neckline", "").title()
    sleeve = new_attributes.get("sleeves", "").title()
    fabric = new_attributes.get("fabric", "").title()
    col = new_attributes.get("color", "").title()
    draw.text((20, h - 60), f"REMIX: {neck} | {sleeve} | {fabric} | {col}", fill=(234, 179, 8))
    draw.text((20, h - 35), f"Diff: {diff_prompt}", fill=(209, 213, 219))
    return img


def generate_remixed_image(post_id: str, base_image_url: str, base_attributes: dict, new_attributes: dict) -> str:
    """Generates the remixed garment image and returns a persistent (cloud-hosted) URL.

    Deterministic by (post_id, attributes): Cloudinary is asked to store the result
    under a hash-derived public_id with overwrite=False, so re-requesting the exact
    same attribute combination reuses the existing asset instead of regenerating it.
    """
    attr_hash = get_attributes_hash(post_id, new_attributes)
    public_id = f"remix_{post_id[:12]}_{attr_hash[:12]}"
    diff_prompt = build_diff_prompt(base_attributes, new_attributes)

    cloud_configured = bool(os.getenv("CLOUDINARY_CLOUD_NAME") and os.getenv("CLOUDINARY_API_SECRET"))
    gemini_key = os.getenv("GEMINI_API_KEY")

    image_bytes = None
    if gemini_key:
        try:
            base_bytes, base_mime = _fetch_base_image_bytes(base_image_url)
            prompt_text = (
                "Edit this garment photo to reflect the following changes while keeping the same "
                f"model pose, framing, and studio lighting: {diff_prompt}. "
                "Keep it photorealistic couture-quality fashion photography."
            )
            image_bytes = _generate_with_gemini(prompt_text, base_bytes, base_mime)
        except Exception as e:
            print(f"[RemixEngine] Gemini image edit failed, using visual fallback: {e}")

    if image_bytes is None:
        try:
            base_bytes, _ = _fetch_base_image_bytes(base_image_url)
            base_img = Image.open(io.BytesIO(base_bytes)).convert("RGB")
        except Exception:
            base_img = Image.new("RGB", (600, 800), color=(30, 32, 45))
        fallback_img = _fallback_synthesize(base_img, new_attributes, diff_prompt)
        buffer = io.BytesIO()
        fallback_img.save(buffer, "JPEG", quality=92)
        image_bytes = buffer.getvalue()

    if cloud_configured:
        try:
            return _upload_to_cloud(image_bytes, public_id)
        except Exception as e:
            print(f"[RemixEngine] Cloudinary upload failed, saving locally instead: {e}")

    filename = f"{public_id}.jpg"
    filepath = os.path.join(REMIX_DIR, filename)
    with open(filepath, "wb") as handle:
        handle.write(image_bytes)
    return f"/static/remixes/{filename}"
