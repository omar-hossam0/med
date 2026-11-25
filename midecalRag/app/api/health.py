"""Liveness endpoint - the only route that does not require the API key."""

from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> Any:
    return {"status": "ok", "service": "careos-rag", "phase": 0}
