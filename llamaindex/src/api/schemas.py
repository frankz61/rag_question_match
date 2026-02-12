from pydantic import BaseModel
from pydantic import Field


class OCRMatchItem(BaseModel):
    rank: int
    score: float | None = None
    text_preview: str
    metadata: dict[str, str]


class HealthResponse(BaseModel):
    status: str
    service: str


class VectorSearchRequest(BaseModel):
    question: str = Field(min_length=1, description="检索问题")
    top_k: int = Field(default=5, ge=1, le=20, description="返回 top-k 结果")


class VectorSearchResponse(BaseModel):
    question: str
    top_k: int
    result_count: int
    results: list[OCRMatchItem]
