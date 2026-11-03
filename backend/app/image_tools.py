"""Image processing toolkit: resize, convert, compress, rotate.

Uses Pillow for all image operations. Supports PNG, JPEG, WEBP, GIF, BMP,
TIFF, SVG (via cairosvg if available), and ICO.
"""

import io
from pathlib import Path
from typing import List, Optional

from PIL import Image, ImageOps

from app.converters.base import ConversionResult

# Pillow format map for save
SAVE_FORMATS = {
    "png": "PNG",
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "webp": "WEBP",
    "gif": "GIF",
    "bmp": "BMP",
    "tiff": "TIFF",
    "ico": "ICO",
}

# Formats that Pillow can open for reading (source)
READ_FORMATS = {"png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "ico"}


def _open_image(source_path: str) -> Image.Image:
    return Image.open(source_path)


def _save_image(img: Image.Image, output_path: str, fmt: str, quality: int = 85) -> None:
    save_fmt = SAVE_FORMATS.get(fmt.lower(), "PNG")
    kwargs: dict = {}
    if save_fmt in ("JPEG", "WEBP"):
        kwargs["quality"] = quality
        if save_fmt == "JPEG":
            # JPEG cannot store alpha; convert to RGB
            if img.mode in ("RGBA", "P", "LA"):
                img = img.convert("RGB")
    if save_fmt == "PNG":
        kwargs["optimize"] = True
    if save_fmt == "ICO":
        kwargs["sizes"] = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(output_path, format=save_fmt, **kwargs)


# ---------------------------------------------------------------------------
# Convert between image formats
# ---------------------------------------------------------------------------
def convert_image(source_path: str, output_path: str, target_fmt: str,
                  quality: int = 85) -> ConversionResult:
    """Convert an image from one format to another."""
    target_fmt = target_fmt.lower().lstrip(".")
    if target_fmt not in SAVE_FORMATS:
        return ConversionResult(
            ok=False, error=f"Unsupported target format {target_fmt}",
            engine="image_tools",
        )
    try:
        img = _open_image(source_path)
    except Exception as exc:
        return ConversionResult(ok=False, error=f"Cannot open image: {exc}", engine="image_tools")
    try:
        _save_image(img, output_path, target_fmt, quality=quality)
    except Exception as exc:
        return ConversionResult(ok=False, error=f"Cannot save image: {exc}", engine="image_tools")
    return ConversionResult(ok=True, output_path=output_path, engine="image_tools")


# ---------------------------------------------------------------------------
# Resize
# ---------------------------------------------------------------------------
def resize_image(source_path: str, output_path: str, width: Optional[int] = None,
                 height: Optional[int] = None, fit: str = "cover",
                 quality: int = 85) -> ConversionResult:
    """Resize an image.

    `fit`: "cover" (crop to fill), "contain" (fit within bounds), "stretch" (exact).
    """
    try:
        img = _open_image(source_path)
    except Exception as exc:
        return ConversionResult(ok=False, error=f"Cannot open image: {exc}", engine="image_tools")
    orig_w, orig_h = img.size
    if not width and not height:
        return ConversionResult(ok=False, error="At least one of width/height required",
                                engine="image_tools")
    if width and height:
        if fit == "stretch":
            new_size = (width, height)
        elif fit == "contain":
            ratio = min(width / orig_w, height / orig_h)
            new_size = (int(orig_w * ratio), int(orig_h * ratio))
        else:  # cover
            ratio = max(width / orig_w, height / orig_h)
            new_size = (int(orig_w * ratio), int(orig_h * ratio))
            img = ImageOps.fit(img, new_size, Image.Resampling.LANCZOS)
            _save_image(img, output_path, Path(output_path).suffix.lstrip(".") or "png", quality=quality)
            return ConversionResult(ok=True, output_path=output_path, engine="image_tools")
    elif width:
        ratio = width / orig_w
        new_size = (width, int(orig_h * ratio))
    else:
        ratio = height / orig_h
        new_size = (int(orig_w * ratio), height)

    img = img.resize(new_size, Image.Resampling.LANCZOS)
    fmt = Path(output_path).suffix.lstrip(".") or "png"
    _save_image(img, output_path, fmt, quality=quality)
    return ConversionResult(ok=True, output_path=output_path, engine="image_tools")


# ---------------------------------------------------------------------------
# Compress
# ---------------------------------------------------------------------------
def compress_image(source_path: str, output_path: str, quality: int = 60) -> ConversionResult:
    """Compress an image by re-encoding at a lower quality."""
    try:
        img = _open_image(source_path)
    except Exception as exc:
        return ConversionResult(ok=False, error=f"Cannot open image: {exc}", engine="image_tools")
    fmt = Path(output_path).suffix.lstrip(".") or "png"
    _save_image(img, output_path, fmt, quality=quality)
    return ConversionResult(ok=True, output_path=output_path, engine="image_tools")


# ---------------------------------------------------------------------------
# Rotate
# ---------------------------------------------------------------------------
def rotate_image(source_path: str, output_path: str, degrees: int,
                 expand: bool = True, quality: int = 85) -> ConversionResult:
    """Rotate an image clockwise by `degrees`."""
    try:
        img = _open_image(source_path)
    except Exception as exc:
        return ConversionResult(ok=False, error=f"Cannot open image: {exc}", engine="image_tools")
    img = img.rotate(-degrees, expand=expand, resample=Image.Resampling.BICUBIC)
    fmt = Path(output_path).suffix.lstrip(".") or "png"
    _save_image(img, output_path, fmt, quality=quality)
    return ConversionResult(ok=True, output_path=output_path, engine="image_tools")


# ---------------------------------------------------------------------------
# Images to PDF
# ---------------------------------------------------------------------------
def images_to_pdf(inputs: List[str], output_path: str,
                  page_size: str = "letter", quality: int = 85) -> ConversionResult:
    """Combine multiple images into a single PDF."""
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.pdfgen import canvas as rl_canvas

    psize = {"letter": letter, "a4": A4}.get(page_size.lower(), letter)
    c = rl_canvas.Canvas(output_path, pagesize=psize)
    page_w, page_h = psize

    for inp in inputs:
        try:
            img = _open_image(inp)
        except Exception:
            continue
        iw, ih = img.size
        ratio = min(page_w / iw, page_h / ih)
        dw, dh = iw * ratio, ih * ratio
        # Save to a temp buffer as PNG for reportlab
        buf = io.BytesIO()
        save_fmt = "PNG"
        if img.mode in ("RGBA", "P"):
            img.save(buf, format=save_fmt)
        else:
            img.convert("RGB").save(buf, format="JPEG", quality=quality)
        buf.seek(0)
        c.drawImage(buf, (page_w - dw) / 2, (page_h - dh) / 2, dw, dh)
        c.showPage()
    c.save()
    return ConversionResult(ok=True, output_path=output_path, engine="image_tools")


__all__ = [
    "convert_image",
    "resize_image",
    "compress_image",
    "rotate_image",
    "images_to_pdf",
    "SAVE_FORMATS",
    "READ_FORMATS",
]
