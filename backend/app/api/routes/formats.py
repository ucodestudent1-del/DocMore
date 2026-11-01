"""API routes: supported formats."""

from fastapi import APIRouter
from app.registry import registry

router = APIRouter(tags=["formats"])


@router.get("/formats")
def list_formats():
    caps = registry.format_capabilities()
    return {
        "formats": [
            {
                "name": c.name,
                "extensions": sorted(c.extensions),
                "mime_types": sorted(c.mime_types),
                "status": c.status,
                "notes": c.notes,
            }
            for c in caps
        ]
    }


@router.get("/conversions")
def list_conversions():
    return {
        "matrix": registry.compatibility_matrix(),
        "engines": registry.engine_status(),
    }


@router.get("/convert-options/{source}/{target}")
def convert_options(source: str, target: str):
    entry = registry.get_entry(source, target)
    if not entry:
        return {"supported": False}
    return {"supported": True, "engine": entry.engine, "status": entry.status, "notes": entry.notes}


@router.get("/conversions/{source}")
def conversions_for_source(source: str):
    targets = registry.supported_targets(source)
    return {
        "source": source,
        "targets": sorted(targets),
    }
