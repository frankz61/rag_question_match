"""录入：MySQL Document -> 切分 -> 建索引 -> 写入 Milvus（Hybrid dense+sparse, RRF）"""

from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.milvus.utils import BM25BuiltInFunction
from pymilvus import DataType

from src.config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    EMBED_BATCH_SIZE,
    EMBED_DIM,
    EMBED_MODEL,
    HYBRID_RRF_K,
    MILVUS_COLLECTION,
    MILVUS_URI,
)
from src.milvus_store import create_milvus_vector_store
from src.mysql_ingest import load_from_mysql

_METADATA_FIELDS = ["paper_id", "box_id", "subject_key"]
_METADATA_FIELD_TYPES = [DataType.VARCHAR, DataType.VARCHAR, DataType.VARCHAR]


def _ensure_metadata_indexes(vector_store) -> None:
    """为元数据字段创建标量索引（存在则跳过）。"""
    for field_name in _METADATA_FIELDS:
        try:
            existing = vector_store.client.list_indexes(
                collection_name=vector_store.collection_name,
                field_name=field_name,
            )
            if existing:
                continue

            index_params = vector_store.client.prepare_index_params()
            index_params.add_index(
                field_name=field_name,
                index_name=f"{field_name}_idx",
                index_type="INVERTED",
            )
            vector_store.client.create_index(
                collection_name=vector_store.collection_name,
                index_params=index_params,
            )
            print(f"已创建 metadata 索引: {field_name}_idx")
        except Exception as exc:
            # 索引已存在/版本不支持时不中断录入流程。
            print(f"创建 metadata 索引跳过 ({field_name}): {exc}")


def run_ingest(overwrite: bool = False) -> None:
    """
    从 MySQL 导入数据并写入 Milvus。
    overwrite=True：清空重建 collection
    overwrite=False：增量追加
    """
    documents = load_from_mysql()
    if not documents:
        print("未从 MySQL 获取到任何文档，请检查 MYSQL_* 配置与数据。")
        return

    print(f"从 MySQL 加载了 {len(documents)} 条文档")

    Settings.embed_model = HuggingFaceEmbedding(
        model_name=EMBED_MODEL,
        embed_batch_size=EMBED_BATCH_SIZE,
    )
    Settings.chunk_size = CHUNK_SIZE
    Settings.chunk_overlap = CHUNK_OVERLAP

    vector_store = create_milvus_vector_store(
        uri=MILVUS_URI,
        dim=EMBED_DIM,
        collection_name=MILVUS_COLLECTION,
        overwrite=overwrite,
        enable_sparse=True,
        sparse_embedding_function=BM25BuiltInFunction(),
        hybrid_ranker="RRFRanker",
        hybrid_ranker_params={"k": HYBRID_RRF_K},
        scalar_field_names=_METADATA_FIELDS,
        scalar_field_types=_METADATA_FIELD_TYPES,
    )
    _ensure_metadata_indexes(vector_store)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,
        insert_batch_size=64,
    )
    print("录入完成，数据已写入 Milvus")
