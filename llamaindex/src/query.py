"""检索：连接 Milvus -> Hybrid + RRF 相似检索 -> 打印结果"""

import logging
import threading
from time import perf_counter
from typing import Any

from llama_index.core import Settings, VectorStoreIndex
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.milvus.utils import BM25BuiltInFunction
from pymilvus import DataType

from src.config import (
    EMBED_BATCH_SIZE,
    EMBED_DIM,
    EMBED_MODEL,
    HYBRID_RRF_K,
    MILVUS_COLLECTION,
    MILVUS_URI,
)
from src.milvus_store import create_milvus_vector_store

_METADATA_FIELDS = ["paper_id", "box_id", "subject_key"]
_METADATA_FIELD_TYPES = [DataType.VARCHAR, DataType.VARCHAR, DataType.VARCHAR]
_LOGGER = logging.getLogger(__name__)
_INDEX_CACHE: VectorStoreIndex | None = None
_INDEX_LOCK = threading.Lock()


def _build_index() -> VectorStoreIndex:
    """创建并返回新的 VectorStoreIndex 实例。"""
    Settings.embed_model = HuggingFaceEmbedding(
        model_name=EMBED_MODEL,
        embed_batch_size=EMBED_BATCH_SIZE,
    )

    vector_store = create_milvus_vector_store(
        uri=MILVUS_URI,
        dim=EMBED_DIM,
        collection_name=MILVUS_COLLECTION,
        overwrite=False,
        enable_sparse=True,
        sparse_embedding_function=BM25BuiltInFunction(),
        hybrid_ranker="RRFRanker",
        hybrid_ranker_params={"k": HYBRID_RRF_K},
        scalar_field_names=_METADATA_FIELDS,
        scalar_field_types=_METADATA_FIELD_TYPES,
    )
    return VectorStoreIndex.from_vector_store(vector_store)


def get_index(force_refresh: bool = False) -> VectorStoreIndex:
    """从 Milvus 加载索引（带进程内缓存）。"""
    global _INDEX_CACHE
    if _INDEX_CACHE is not None and not force_refresh:
        return _INDEX_CACHE

    with _INDEX_LOCK:
        if _INDEX_CACHE is not None and not force_refresh:
            return _INDEX_CACHE

        build_start = perf_counter()
        _INDEX_CACHE = _build_index()
        _LOGGER.warning(
            "get_index_built force_refresh=%s elapsed_ms=%.2f",
            force_refresh,
            (perf_counter() - build_start) * 1000,
        )
        return _INDEX_CACHE


def clear_index_cache() -> None:
    """清空缓存索引，下次查询会重新初始化。"""
    global _INDEX_CACHE
    with _INDEX_LOCK:
        _INDEX_CACHE = None
    _LOGGER.warning("get_index_cache_cleared")


def _to_float_or_none(value: Any) -> float | None:
    """将得分值转为 float，无法转换时返回 None。"""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _metadata_to_str_dict(metadata: dict[str, Any] | None) -> dict[str, str]:
    """将 metadata 规范化为 string-string 字典。"""
    if not metadata:
        return {}
    return {str(k): str(v) for k, v in metadata.items()}


def query_structured(q: str, top_k: int = 5, result_preview_chars: int = 200) -> dict[str, Any]:
    """使用 Hybrid + RRF 检索，返回结构化匹配结果。"""
    total_start = perf_counter()
    try:
        get_index_start = perf_counter()
        index = get_index()
        get_index_ms = (perf_counter() - get_index_start) * 1000

        retriever_start = perf_counter()
        retriever = index.as_retriever(
            similarity_top_k=top_k,
            vector_store_query_mode="hybrid",
        )
        build_retriever_ms = (perf_counter() - retriever_start) * 1000

        retrieve_start = perf_counter()
        nodes = retriever.retrieve(q)
        retrieve_ms = (perf_counter() - retrieve_start) * 1000

        format_start = perf_counter()
        items: list[dict[str, Any]] = []
        for i, node_with_score in enumerate(nodes, 1):
            node_text = node_with_score.node.text or ""
            snippet = (
                node_text[:result_preview_chars] + "..."
                if len(node_text) > result_preview_chars
                else node_text
            )
            items.append(
                {
                    "rank": i,
                    "score": _to_float_or_none(getattr(node_with_score, "score", None)),
                    "text_preview": snippet,
                    "metadata": _metadata_to_str_dict(node_with_score.node.metadata or {}),
                }
            )
        format_ms = (perf_counter() - format_start) * 1000
        total_ms = (perf_counter() - total_start) * 1000

        _LOGGER.warning(
            "query_timing question_len=%d top_k=%d get_index_ms=%.2f "
            "build_retriever_ms=%.2f retrieve_ms=%.2f format_ms=%.2f total_ms=%.2f result_count=%d",
            len(q),
            top_k,
            get_index_ms,
            build_retriever_ms,
            retrieve_ms,
            format_ms,
            total_ms,
            len(items),
        )

        return {
            "question": q,
            "top_k": top_k,
            "result_count": len(items),
            "results": items,
        }
    except Exception:
        _LOGGER.exception(
            "query_failed question_len=%d top_k=%d elapsed_ms=%.2f",
            len(q),
            top_k,
            (perf_counter() - total_start) * 1000,
        )
        raise


def query(q: str, top_k: int = 5) -> None:
    """使用 Hybrid + RRF 检索，纯检索模式，打印匹配结果。"""
    data = query_structured(q=q, top_k=top_k)

    print(f"\n查询: {data['question']}")
    print(f"匹配到 {data['result_count']} 条结果:\n")
    for item in data["results"]:
        i = item["rank"]
        score = item["score"] if item["score"] is not None else "N/A"
        text = item["text_preview"]
        meta = item["metadata"]
        print(f"--- 结果 {i} (score: {score}) ---")
        print(text)
        if meta:
            print(f"metadata: {meta}")
        print()
