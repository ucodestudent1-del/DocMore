"""API routes: document management for the integrated editor.

Endpoints:
  GET    /api/documents              - list user documents
  POST   /api/documents              - create a new document
  GET    /api/documents/{id}         - get document content + metadata
  PUT    /api/documents/{id}         - update document content (autosave)
  DELETE /api/documents/{id}         - delete document
  GET    /api/documents/{id}/versions - version history
  POST   /api/documents/{id}/versions/{versionId}/restore - restore a version
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.storage import storage
from app.prisma_client import get_prisma
from app.api.routes.auth import get_current_user
from app.services.generation_service import service as gen_service

router = APIRouter(tags=["documents"])


class DocumentCreate(BaseModel):
    title: str
    content: str = ""
    folder_id: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None


@router.get("/documents")
async def list_documents(
    folder_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    docs = await prisma.document.find_many(
        where={
            "userId": current_user["username"],
            "folderId": folder_id,
        },
        order={"updatedAt": "desc"},
        include={"versions": True},
    )
    return {
        "documents": [
            {
                "id": d.id,
                "title": d.originalName,
                "folder_id": d.folderId,
                "kind": d.kind,
                "mime": d.mime,
                "size": d.size,
                "updated_at": d.updatedAt.isoformat(),
                "created_at": d.createdAt.isoformat(),
                "version_count": len(d.versions),
            }
            for d in docs
        ]
    }


@router.post("/documents")
async def create_document(
    req: DocumentCreate,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc_id = uuid.uuid4().hex
    doc = await prisma.document.create({
        "id": doc_id,
        "userId": current_user["username"],
        "folderId": req.folder_id,
        "kind": "TEMPLATE",
        "originalName": req.title,
        "storedName": f"{doc_id}",
        "mime": "application/vnd.document+json",
        "ext": "json",
        "size": len(req.content.encode("utf-8")),
        "storagePath": f"documents/{doc_id}",
        "storageBackend": "local",
    })
    # Store initial version
    await prisma.documentversion.create({
        "id": uuid.uuid4().hex,
        "documentId": doc_id,
        "version": 1,
        "fileId": doc_id,
    })
    return {
        "id": doc.id,
        "title": doc.originalName,
        "content": req.content,
        "version": 1,
    }


@router.get("/documents/{doc_id}")
async def get_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc = await prisma.document.find_unique(
        where={"id": doc_id},
        include={"versions": {"orderBy": {"version": "desc"}, "take": 1}},
    )
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")
    # Retrieve content from storage
    entry = await storage.get_file_entry(doc_id, user_id=current_user["username"])
    content = ""
    if entry:
        path = entry["path"]
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            content = ""
    return {
        "id": doc.id,
        "title": doc.originalName,
        "content": content,
        "folder_id": doc.folderId,
        "mime": doc.mime,
        "updated_at": doc.updatedAt.isoformat(),
        "version": doc.versionHead,
    }


@router.put("/documents/{doc_id}")
async def update_document(
    doc_id: str,
    req: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc = await prisma.document.find_unique(where={"id": doc_id})
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")

    # Store new version
    new_version = doc.versionHead + 1
    content_bytes = (req.content or "").encode("utf-8")

    # Save content to storage
    await storage.save_output(
        file_id=doc_id,
        content=content_bytes,
        ext="json",
        user_id=current_user["username"],
        original_name=doc.originalName,
        document_id=doc_id,
    )

    # Update document record
    update_data: dict = {}
    if req.title is not None:
        update_data["originalName"] = req.title
    if req.content is not None:
        update_data["size"] = len(content_bytes)
        update_data["versionHead"] = new_version
    if req.folder_id is not None:
        update_data["folderId"] = req.folder_id

    updated = await prisma.document.update(
        where={"id": doc_id},
        data=update_data,
    )

    # Create version record
    await prisma.documentversion.create({
        "id": uuid.uuid4().hex,
        "documentId": doc_id,
        "version": new_version,
        "fileId": doc_id,
    })

    return {
        "id": updated.id,
        "title": updated.originalName,
        "version": new_version,
        "updated_at": updated.updatedAt.isoformat(),
    }


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc = await prisma.document.find_unique(where={"id": doc_id})
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")
    await prisma.document.delete(where={"id": doc_id})
    await storage.delete_file(doc_id, user_id=current_user["username"])
    return {"detail": "Document deleted"}


@router.get("/documents/{doc_id}/versions")
async def list_versions(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc = await prisma.document.find_unique(where={"id": doc_id})
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")
    versions = await prisma.documentversion.find_many(
        where={"documentId": doc_id},
        order={"version": "desc"},
    )
    return {
        "versions": [
            {
                "id": v.id,
                "version": v.version,
                "created_at": v.createdAt.isoformat(),
            }
            for v in versions
        ]
    }


@router.post("/documents/{doc_id}/versions/{version_id}/restore")
async def restore_version(
    doc_id: str,
    version_id: str,
    current_user: dict = Depends(get_current_user),
):
    prisma = get_prisma()
    doc = await prisma.document.find_unique(where={"id": doc_id})
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")
    version = await prisma.documentversion.find_unique(where={"id": version_id})
    if not version or version.documentId != doc_id:
        raise HTTPException(status_code=404, detail="Version not found")
    # Restore content from storage
    entry = await storage.get_file_entry(doc_id, user_id=current_user["username"])
    content = ""
    if entry:
        try:
            with open(entry["path"], "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            content = ""
    # Bump version head
    await prisma.document.update(
        where={"id": doc_id},
        data={"versionHead": doc.versionHead + 1},
    )
    return {
        "id": doc.id,
        "title": doc.originalName,
        "content": content,
        "restored_from_version": version.version,
    }


@router.post("/documents/{doc_id}/export")
async def export_document(
    doc_id: str,
    format: str,
    current_user: dict = Depends(get_current_user),
):
    """Export a document to PDF, DOCX, HTML, MD, or TXT."""
    fmt = format.lower()
    if fmt not in {"pdf", "docx", "html", "md", "txt"}:
        raise HTTPException(status_code=400, detail=f"Unsupported export format {fmt}")
    prisma = get_prisma()
    doc = await prisma.document.find_unique(where={"id": doc_id})
    if not doc or doc.userId != current_user["username"]:
        raise HTTPException(status_code=404, detail="Document not found")
    entry = await storage.get_file_entry(doc_id, user_id=current_user["username"])
    content = ""
    if entry:
        try:
            with open(entry["path"], "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            content = ""
    out_id = uuid.uuid4().hex
    from pathlib import Path
    from app.config import OUTPUT_DIR
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{fmt}")
    res = gen_service.render_sync(
        [{"type": "heading", "data": {"text": doc.originalName, "level": 1}},
         {"type": "paragraph", "data": {"text": content}}],
        fmt=fmt,
        output_path=out_path,
    )
    if not res.ok:
        raise HTTPException(status_code=500, detail=res.error or "Export failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    saved = await storage.save_output(
        out_id, file_data, fmt,
        user_id=current_user["username"],
        original_name=f"{doc.originalName}.{fmt}",
        document_id=doc_id,
    )
    return {
        "id": saved["id"],
        "name": saved["original_name"],
        "ext": fmt,
        "download_url": f"/api/files/{saved['id']}/download",
    }


__all__ = ["router"]
