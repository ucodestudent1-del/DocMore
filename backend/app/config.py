import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
TEMP_DIR = DATA_DIR / "temp"
HISTORY_FILE = DATA_DIR / "history.json"

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", str(50 * 1024 * 1024)))  # 50 MB
MAX_BATCH_FILES = int(os.getenv("MAX_BATCH_FILES", "20"))
PROCESSING_TIMEOUT = int(os.getenv("PROCESSING_TIMEOUT", "300"))  # seconds
CLEANUP_AFTER_HOURS = int(os.getenv("CLEANUP_AFTER_HOURS", "24"))

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://everydoc:everydoc@localhost:5432/everydoc")

# Stripe payments
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Email (SendGrid)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "noreply@everydoc.app")

# AWS S3 / Object Storage
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "everydoc-uploads")
AWS_S3_REGION = os.getenv("AWS_S3_REGION", "us-east-1")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", None)  # For MinIO or other S3-compatible

# Auth config
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

ALLOWED_EXTENSIONS = {
    # Documents
    "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "html", "htm", "xml",
    "json", "csv", "tsv",
    # Spreadsheets
    "xls", "xlsx", "xlsm", "ods",
    # Presentations
    "ppt", "pptx", "odp",
    # Images
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "svg", "ico",
    "heic", "avif",
    # Ebooks
    "epub",
}

# Magic byte signatures for file type validation (first bytes -> expected extension set)
MAGIC_SIGNATURES = {
    b"%PDF": {"pdf"},
    b"\xD0\xCF\x11\xE0": {"doc", "xls", "ppt"},  # OLE2 compound document
    b"PK\x03\x04": {"docx", "odt", "xlsx", "xlsm", "pptx", "ods", "odp", "epub"},  # ZIP-based
    b"\xFF\xD8\xFF": {"jpg", "jpeg"},
    b"\x89PNG\r\n\x1a\n": {"png"},
    b"GIF87a": {"gif"},
    b"GIF89a": {"gif"},
    b"RIFF": {"webp"},  # WEBP starts with RIFF....WEBP
    b"BM": {"bmp"},
    b"\x49\x49\x2A\x00": {"tiff", "tif"},
    b"\x4D\x4D\x00\x2A": {"tiff", "tif"},
    b"\x00\x00\x01\x00": {"ico"},
    b"\x00\x00\x02\x00": {"ico"},
    b"%!PS": {},  # PostScript - not directly supported
}

TEXT_MIME_PREFIXES = {"text/", "application/json", "application/xml"}

for d in (DATA_DIR, UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
    d.mkdir(parents=True, exist_ok=True)
