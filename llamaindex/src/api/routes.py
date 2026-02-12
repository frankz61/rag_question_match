import logging
from time import perf_counter

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from src.api.schemas import (
    HealthResponse,
    VisionChatResponse,
    VectorSearchRequest,
    VectorSearchResponse,
)
from src.config import OPENAI_VISION_MODEL
from src.openai_vision_chat import chat_once
from src.query import query_structured

router = APIRouter()
_LOGGER = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="rag-api")


@router.post("/chat/vision", response_model=VisionChatResponse)
async def vision_chat_api(
    prompt: str = Form(..., min_length=1, description="提示词"),
    model: str | None = Form(default=None, description="模型名称"),
    image: UploadFile | None = File(default=None, description="可选图片文件"),
) -> VisionChatResponse:
    start = perf_counter()
    has_image = image is not None
    resolved_model = model.strip() if model and model.strip() else OPENAI_VISION_MODEL
    image_bytes: bytes | None = None
    image_mimetype: str | None = None

    try:
        if image is not None:
            image_mimetype = (image.content_type or "").strip().lower()
            if not image_mimetype.startswith("image/"):
                raise HTTPException(status_code=400, detail="image must be an image/* file")

            image_bytes = await image.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="image file is empty")

        text = await run_in_threadpool(
            chat_once,
            prompt=prompt,
            model=model,
            image_bytes=image_bytes,
            image_mimetype=image_mimetype,
        )
        _LOGGER.warning(
            "vision_chat_api_timing prompt_len=%d model=%s has_image=%s total_ms=%.2f",
            len(prompt),
            resolved_model,
            has_image,
            (perf_counter() - start) * 1000,
        )
        return VisionChatResponse(text=text)
    except HTTPException:
        _LOGGER.warning(
            "vision_chat_api_bad_request prompt_len=%d model=%s has_image=%s elapsed_ms=%.2f",
            len(prompt),
            resolved_model,
            has_image,
            (perf_counter() - start) * 1000,
        )
        raise
    except Exception as exc:
        _LOGGER.exception(
            "vision_chat_api_failed prompt_len=%d model=%s has_image=%s elapsed_ms=%.2f",
            len(prompt),
            resolved_model,
            has_image,
            (perf_counter() - start) * 1000,
        )
        raise HTTPException(status_code=500, detail=f"vision chat failed: {exc}") from exc
    finally:
        if image is not None:
            await image.close()


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
