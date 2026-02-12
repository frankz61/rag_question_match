"""MySQL 导入预处理：清洗 result_json，仅保留题干/正文/选项/答案解析等核心内容。"""

import html
import json
import re
from typing import Any

import pymysql
from llama_index.core import Document

from src.config import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_QUESTION_OCR_QUERY,
    MYSQL_USER,
)

_IMG_TAG_RE = re.compile(r'(?is)<img[^>]*alt=["\']?([^"\'>]*)["\']?[^>]*>')
_HTML_TAG_RE = re.compile(r"(?is)<[^>]+>")
_ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff]")


def _clean_text(value: Any) -> str:
    """清理 HTML/特殊字符并规范化空白。"""
    if value is None:
        return ""

    text = str(value)
    if not text:
        return ""

    text = html.unescape(text)
    text = re.sub(r"(?is)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?is)</\s*p\s*>", "\n", text)
    text = re.sub(r"(?is)<\s*p[^>]*>", "", text)

    def _replace_img(match: re.Match[str]) -> str:
        alt = (match.group(1) or "").strip()
        return f"[图片:{alt}]" if alt else "[图片]"

    text = _IMG_TAG_RE.sub(_replace_img, text)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _ZERO_WIDTH_RE.sub("", text)
    text = text.replace("\xa0", " ")

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _clean_text_list(value: Any) -> str:
    """将列表字段清洗并拼接为多行文本。"""
    if value is None:
        return ""

    if not isinstance(value, list):
        return _clean_text(value)

    cleaned_parts = []
    for item in value:
        if isinstance(item, dict):
            item_text = item.get("title") or item.get("text") or item.get("content") or ""
            item_clean = _clean_text(item_text)
        else:
            item_clean = _clean_text(item)
        if item_clean:
            cleaned_parts.append(item_clean)
    return "\n".join(cleaned_parts)


def _extract_options(question: dict[str, Any]) -> list[dict[str, str]]:
    """提取并清洗选项。"""
    options = []
    for choice in question.get("choices") or []:
        if not isinstance(choice, dict):
            continue
        letter = _clean_text(choice.get("letter"))
        option_text = _clean_text(choice.get("option"))
        if not letter and not option_text:
            continue
        options.append({"letter": letter, "text": option_text})
    return options


def _build_question_item(question: dict[str, Any]) -> dict[str, Any] | None:
    """构建单题结构化数据。"""
    stem = _clean_text_list(question.get("questionTitle"))
    body = _clean_text(question.get("qcontent"))
    options = _extract_options(question)
    answer_analysis = _clean_text_list(question.get("answerAnalysis"))

    item: dict[str, Any] = {
        "stem": stem,
        "body": body,
        "options": options,
        "answer_analysis": answer_analysis,
    }

    item = {k: v for k, v in item.items() if v not in ("", [], None)}
    has_core_content = any(item.get(k) for k in ("stem", "body", "options", "answer_analysis"))
    if not has_core_content:
        return None
    return item


def _render_question_text(item: dict[str, Any]) -> str:
    """将题目结构化字段渲染为纯文本。"""
    parts: list[str] = []

    stem = _clean_text(item.get("stem"))
    body = _clean_text(item.get("body"))
    options = item.get("options") or []
    answer_analysis = _clean_text(item.get("answer_analysis"))

    if stem:
        parts.append(stem)
    if body:
        parts.append(body)
    if options:
        option_lines = []
        for opt in options:
            if not isinstance(opt, dict):
                continue
            letter = _clean_text(opt.get("letter"))
            text = _clean_text(opt.get("text"))
            if letter and text:
                option_lines.append(f"{letter}. {text}")
            elif text:
                option_lines.append(text)
        if option_lines:
            parts.append("\n".join(option_lines))
    if answer_analysis:
        parts.append(f"答案解析：{answer_analysis}")

    return "\n".join([p for p in parts if p]).strip()


def _parse_structured_result(raw_result: Any) -> str | None:
    """解析 result_json，返回按顺序拼接后的清洗文本。"""
    try:
        if isinstance(raw_result, (dict, list)):
            payload = raw_result
        elif isinstance(raw_result, str):
            text = raw_result.strip()
            if not text:
                return None
            payload = json.loads(text)
        else:
            return None
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    data = payload.get("data")
    if not isinstance(data, dict):
        return None

    text_blocks: list[str] = []

    for group in data.get("quesGroups") or []:
        if not isinstance(group, dict):
            continue
        for question in group.get("questionList") or []:
            if not isinstance(question, dict):
                continue

            parent_item = _build_question_item(question)
            if parent_item:
                parent_text = _render_question_text(parent_item)
                if parent_text:
                    text_blocks.append(parent_text)

            for child in question.get("childs") or []:
                if not isinstance(child, dict):
                    continue
                child_item = _build_question_item(child)
                if child_item:
                    child_text = _render_question_text(child_item)
                    if child_text:
                        text_blocks.append(child_text)

    if not text_blocks:
        return None

    return "\n\n".join(text_blocks).strip()


def load_from_mysql() -> list[Document]:
    """
    从 MySQL 加载 question_ocr_results 数据，清洗 result_json 并拼接为纯文本后录入向量库，
    metadata 保存 paper_id、box_id、subject_key（学科）。
    """
    if not MYSQL_DATABASE:
        raise ValueError("请设置 MYSQL_DATABASE 环境变量或配置")

    query = MYSQL_QUESTION_OCR_QUERY.strip()

    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    documents = []
    try:
        with conn.cursor() as cursor:
            cursor.execute(query)
            for row in cursor.fetchall():
                cleaned_text = _parse_structured_result(row.get("result_json"))
                if not cleaned_text:
                    continue

                metadata = {
                    "paper_id": str(row.get("paper_id") or ""),
                    "box_id": str(row.get("box_id") or ""),
                    "subject_key": str(row.get("subject_key") or ""),
                }
                doc = Document(text=cleaned_text, metadata=metadata)
                documents.append(doc)
    finally:
        conn.close()

    return documents
