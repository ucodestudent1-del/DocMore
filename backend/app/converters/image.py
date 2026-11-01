"""Image conversion engine using Pillow."""

import os
from typing import Any

from PIL import Image, ImageOps

from app.converters.base import ConverterEngine, ConversionResult

IMAGE_FORMATS = {"png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif"}
SAVE_FORMAT_MAP = {
    "png": "PNG", "jpg": "JPEG", "jpeg": "JPEG", "webp": "WEBP",
    "gif": "GIF", "bmp": "BMP", "tiff": "TIFF", "tif": "TIFF",
}


class ImageConverter(ConverterEngine):
    name = "image"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        src = source_ext.lower()
        tgt = target_ext.lower()
        if tgt == "pdf":
            return src in IMAGE_FORMATS
        return src in IMAGE_FORMATS and tgt in IMAGE_FORMATS

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "pdf":
                return self._to_pdf(source_path, target_path)
            return self._convert_image(source_path, target_path, target_ext, options)
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    def _convert_image(self, source_path: str, target_path: str, ext: str, options: dict) -> ConversionResult:
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            save_kwargs = {}
            if ext in {"jpg", "jpeg"}:
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                save_kwargs["quality"] = int(options.get("quality", 85))
            elif ext == "webp":
                save_kwargs["quality"] = int(options.get("quality", 85))
            elif ext == "png":
                save_kwargs["optimize"] = True
            fmt = SAVE_FORMAT_MAP[ext]
            img.save(target_path, fmt, **save_kwargs)
        status = "partial" if ext in {"svg", "ico"} else "done"
        return ConversionResult(ok=True, output_path=target_path, engine=self.name, status=status)

    def _to_pdf(self, source_path: str, target_path: str) -> ConversionResult:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.utils import ImageReader
        from PIL import Image as PILImage, ImageOps

        with PILImage.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            width, height = img.size
        page_w, page_h = letter
        scale = min(page_w / width, page_h / height)
        dw, dh = width * scale, height * scale
        c = rl_canvas.Canvas(target_path, pagesize=letter)
        c.drawImage(ImageReader(source_path), (page_w - dw) / 2, (page_h - dh) / 2, dw, dh)
        c.showPage()
        c.save()
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def status(self) -> str:
        return "done"
