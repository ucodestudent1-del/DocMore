# EveryDoc - Universal Document Studio

A full-stack document conversion, generation, and management studio built with Next.js 15, FastAPI, and Python.

## Features

### Document Conversion
- Convert between PDF, DOCX, XLSX, PPTX, images, HTML, Markdown, CSV, JSON, and more
- Batch processing support
- Format detection via magic bytes

### PDF Tools
- Merge, split, rotate, rearrange, extract, and delete pages
- Add page numbers, watermarks, headers, and footers
- Extract text, images, and metadata
- Password protection and encryption
- PDF repair and optimization
- OCR (Optical Character Recognition) with multi-language support

### Document Generation
- Generate PDF, DOCX, ODT, HTML, Markdown, and TXT documents
- Template-based generation with placeholders
- Document editor with rich text blocks
- Template library: Invoice, Resume, Report, Certificate, Cover Letter, Meeting Minutes

### Document Comparison
- Compare two documents and highlight differences
- Support for PDF, DOCX, and text files

### Authentication & Subscription Tiers
- User registration and authentication (JWT)
- Three subscription tiers: Free, Premium, Enterprise
- Subscription management via Stripe

## Tech Stack

### Backend
- FastAPI (Python 3.12)
- PostgreSQL for data storage
- Redis for background job queue (Celery)
- Docker for containerization

### Frontend
- Next.js 15 with React 18
- Tailwind CSS
- shadcn/ui components
- PWA support

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/everydoc.git
cd EveryDoc

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Docker Deployment

```bash
docker-compose up --build
```

### Railway Deployment

1. Connect your GitHub repository to Railway
2. Add environment variables (see below)
3. Deploy automatically on push

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Secret key for JWT signing | `change-me-in-production` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments | Required for paid features |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Required for webhooks |
| `SENDGRID_API_KEY` | SendGrid API key for emails | Optional |
| `SENDGRID_FROM_EMAIL` | From email address | `noreply@everydoc.app` |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | Optional |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional |
| `AWS_S3_BUCKET` | S3 bucket name | Optional |
| `AWS_S3_REGION` | AWS region | `us-east-1` |
| `AWS_S3_ENDPOINT_URL` | Custom S3 endpoint (MinIO, etc.) | Optional |
| `FRONTEND_URL` | Frontend URL for redirects | `http://localhost:3000` |
| `PORT` | Backend port | `8000` |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/token` - Login and get access token
- `GET /api/auth/me` - Get current user profile

### Upload & Conversion
- `POST /api/upload` - Upload a file
- `POST /api/convert` - Convert a document
- `GET /api/download/{file_id}` - Download converted file
- `GET /api/formats` - List supported formats

### PDF Tools
- `POST /api/pdf/merge` - Merge PDFs
- `POST /api/pdf/split` - Split PDF
- `POST /api/pdf/watermark` - Add watermark
- `POST /api/pdf/protect` - Password protect PDF
- `POST /api/pdf/ocr` - OCR scanned PDF

### Document Generation
- `POST /api/generate` - Generate document from blocks
- `GET /api/generate/templates` - List templates

### Payments
- `POST /api/payments/checkout` - Create Stripe checkout session
- `POST /api/payments/webhook` - Stripe webhook endpoint

## Development

### Running Tests
```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/
```

### Linting
```bash
cd backend
pip install ruff
ruff check .
cd frontend
npm run lint
```

## Deployment Options

### Railway (Recommended)
Connect your GitHub repository to Railway for automatic deployments on push.

### Docker
```bash
docker build -t everyday-doc .
docker run -p 8000:8000 -e SECRET_KEY=your-secret-key everyday-doc
```

### Docker Compose
```bash
docker-compose up --build
```

## Security

- All form submissions are protected with CSRF tokens
- Sensitive headers (HSTS, CSP, X-Content-Type-Options) are set
- File uploads are validated by magic bytes and extension
- Passwords are hashed with bcrypt
- JWT tokens are used for authentication
- Rate limiting is enforced per subscription tier

## License

MIT License. See LICENSE file for details.

## Support

For support, email support@everydoc.app or create an issue on GitHub.