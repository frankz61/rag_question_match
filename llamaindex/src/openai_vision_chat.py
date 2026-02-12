"""OpenAI 兼容网关视觉对话封装。"""

from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.base.llms.types import ImageBlock
from llama_index.core.base.llms.types import LLMMetadata
from llama_index.core.base.llms.types import MessageRole
from llama_index.core.base.llms.types import TextBlock
from llama_index.llms.openai import OpenAI
from llama_index.llms.openai.utils import ALL_AVAILABLE_MODELS

from src.config import OPENAI_API_BASE
from src.config import OPENAI_API_KEY
from src.config import OPENAI_VISION_MODEL

_DEFAULT_COMPAT_CONTEXT_WINDOW = 131072


class OpenAICompatible(OpenAI):
    """兼容 OpenAI-like 网关的 LLM，允许自定义模型名。"""

    @property
    def metadata(self) -> LLMMetadata:
        model_name = self._get_model_name()
        if model_name in ALL_AVAILABLE_MODELS:
            return super().metadata

        # 自定义模型名（如 LiteLLM 代理的千问）按 chat model 处理。
        return LLMMetadata(
            context_window=_DEFAULT_COMPAT_CONTEXT_WINDOW,
            num_output=self.max_tokens or -1,
            is_chat_model=True,
            is_function_calling_model=False,
            model_name=self.model,
            system_role=MessageRole.SYSTEM,
        )


def _normalize_api_base(api_base: str) -> str:
    """规范化 OpenAI 兼容 base URL，确保以 /v1 结尾。"""
    normalized = api_base.strip().rstrip("/")
    if not normalized:
        raise ValueError("OPENAI_API_BASE is empty")
    if normalized.lower().endswith("/v1"):
        return normalized
    return f"{normalized}/v1"


def _resolve_model(model: str | None) -> str:
    """优先使用调用方传入模型，否则使用默认模型。"""
    if model and model.strip():
        return model.strip()
    return OPENAI_VISION_MODEL


def _resolve_api_key(api_key: str) -> str:
    """校验并返回 API key。"""
    resolved = api_key.strip()
    if not resolved:
        raise ValueError("OPENAI_API_KEY is empty")
    return resolved


def chat_once(
    prompt: str,
    model: str | None = None,
    image_bytes: bytes | None = None,
    image_mimetype: str | None = None,
) -> str:
    """调用 OpenAI 兼容视觉模型，返回文本响应。"""
    prompt_text = prompt.strip()
    if not prompt_text:
        raise ValueError("prompt cannot be empty")

    blocks = [TextBlock(text=prompt_text)]
    if image_bytes is not None:
        if not image_bytes:
            raise ValueError("image_bytes cannot be empty when provided")
        blocks.append(
            ImageBlock(
                image=image_bytes,
                image_mimetype=image_mimetype,
            )
        )

    llm = OpenAICompatible(
        model=_resolve_model(model),
        api_base=_normalize_api_base(OPENAI_API_BASE),
        api_key=_resolve_api_key(OPENAI_API_KEY),
    )
    response = llm.chat(
        [
            ChatMessage(
                role=MessageRole.USER,
                blocks=blocks,
            )
        ]
    )
    return response.message.content or ""
