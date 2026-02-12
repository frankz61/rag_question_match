"""配置：模型、Milvus、MySQL、OCR、chunk 参数"""

import os
from pathlib import Path

from dotenv import load_dotenv

# 优先加载项目根目录的 config.local.env（本地配置，不提交版本库）
_CONFIG_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_CONFIG_DIR / "config.local.env", override=True)

# Embedding 模型
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "4"))

# Milvus
MILVUS_URI = os.getenv("MILVUS_URI", "http://localhost:19530")
MILVUS_COLLECTION = os.getenv("MILVUS_COLLECTION", "llamaindex_bge_m3")

# Chunk 参数
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "65535"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))

# MySQL
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "test_rag")

# question_ocr_results 表：录入字段 result_json，元数据含 paper_id、box_id、学科(subject_key)
# 可通过 MYSQL_QUERY 环境变量覆盖
_DEFAULT_QUESTION_OCR_QUERY = """
SELECT q.id, q.paper_id, q.box_id, q.result_json, p.subject_key
FROM question_ocr_results q
JOIN papers p ON q.paper_id = p.id
WHERE q.result_json IS NOT NULL AND q.result_json != ''
"""
MYSQL_QUESTION_OCR_QUERY = os.getenv("MYSQL_QUERY", _DEFAULT_QUESTION_OCR_QUERY).strip()

# OCR
OCR_LANG = os.getenv("OCR_LANG", "ch")
OCR_DEVICE = os.getenv("OCR_DEVICE", "auto")

# Hybrid RRF
HYBRID_RRF_K = int(os.getenv("HYBRID_RRF_K", "60"))

# OpenAI 兼容网关（用于视觉对话）
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "http://localhost:4000/")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "qwen-vl-max")
