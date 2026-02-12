# LlamaIndex BGE-M3 检索与录入项目

基于 LlamaIndex 的 RAG 项目，使用 BGE-M3 作为 embedding 模型，支持 MySQL 导入、向量检索与后道 OCR 匹配。

## 功能

- **录入**：从 MySQL 导入数据，切分后写入 Milvus（Hybrid dense+sparse，RRF 融合）
- **检索**：Hybrid 混合检索（语义 + 关键词）+ RRF 排序
- **OCR 匹配**：图片/扫描 PDF → PaddleOCR 识别 → 在 Milvus 中匹配

## 环境要求

- Python 3.10+
- Milvus 服务（`localhost:19530`，需 Standalone/Distributed，非 Lite）
- MySQL

## 安装

```bash
pip install -r requirements.txt
```

## 配置

**推荐**：复制 `config.local.env.example` 为 `config.local.env`，填写本地配置（该文件已加入 .gitignore）：

```bash
cp config.local.env.example config.local.env
# 编辑 config.local.env，填入 MYSQL_PASSWORD 等
```

也支持通过环境变量配置，`config.local.env` 会覆盖默认值：

| 变量 | 说明 | 默认 |
|------|------|------|
| `MILVUS_URI` | Milvus 地址 | `http://localhost:19530` |
| `MILVUS_COLLECTION` | Collection 名称 | `llamaindex_bge_m3` |
| `MYSQL_HOST` | MySQL 主机 | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 端口 | `3306` |
| `MYSQL_USER` | MySQL 用户 | `root` |
| `MYSQL_PASSWORD` | MySQL 密码 | - |
| `MYSQL_DATABASE` | 数据库名 | `test_rag` |
| `MYSQL_QUERY` | 自定义 SQL（默认从 question_ocr_results 读取 result_json，元数据含 paper_id、box_id、subject_key） | 见 config.py |

## 使用

```bash
# 从 MySQL 导入并录入 Milvus
python main.py ingest

# 清空重建
python main.py ingest --overwrite

# 检索
python main.py query "你的问题"
python main.py query   # 交互式

# 后道 OCR 匹配
python main.py ocr-match path/to/image.png
python main.py ocr-match path/to/scanned.pdf
```

## 项目结构

```
├── src/
│   ├── config.py       # 配置
│   ├── mysql_ingest.py # MySQL 导入预处理
│   ├── ingest.py       # 录入 Milvus
│   ├── query.py        # 检索
│   └── ocr_match.py    # OCR 匹配
├── main.py
├── requirements.txt
└── README.md
```
