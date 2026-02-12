import logging
from time import perf_counter

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from src.api.schemas import (
    HealthResponse,
    VectorSearchRequest,
    VectorSearchResponse,
)
from src.query import query_structured

router = APIRouter()
_LOGGER = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="rag-api")


@router.post("/query/search", response_model=VectorSearchResponse)
async def vector_search_api(payload: VectorSearchRequest) -> VectorSearchResponse:
    start = perf_counter()
    try:
        data = await run_in_threadpool(query_structured, payload.question, payload.top_k)
        response = VectorSearchResponse(
            question=data["question"],
            top_k=data["top_k"],
            result_count=data["result_count"],
            results=data["results"],
        )
        _LOGGER.warning(
            "vector_search_api_timing question_len=%d top_k=%d total_ms=%.2f result_count=%d",
            len(payload.question),
            payload.top_k,
            (perf_counter() - start) * 1000,
            response.result_count,
        )
        return response
    except Exception as exc:
        _LOGGER.exception(
            "vector_search_api_failed question_len=%d top_k=%d elapsed_ms=%.2f",
            len(payload.question),
            payload.top_k,
            (perf_counter() - start) * 1000,
        )
        raise HTTPException(status_code=500, detail=f"vector search failed: {exc}") from exc
