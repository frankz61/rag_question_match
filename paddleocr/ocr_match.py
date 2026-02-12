"""后道 OCR：图片/PDF -> PaddleOCR 识别 -> 匹配 Milvus（Hybrid + RRF）"""

from pathlib import Path
import threading

try:
    from src.config import OCR_DEVICE, OCR_LANG
except Exception:
    OCR_DEVICE = "gpu"
    OCR_LANG = "ch"

from llama_index.readers.paddle_ocr import PDFPaddleOCRReader
from paddleocr import PaddleOCR

_thread_local = threading.local()


class ConfigurablePDFPaddleOCRReader(PDFPaddleOCRReader):
    """允许显式指定 OCR 设备（cpu/gpu）。"""

    def __init__(self, use_angle_cls: bool = True, lang: str = "en", device: str = "cpu"):
        self.ocr = PaddleOCR(use_angle_cls=use_angle_cls, lang=lang, device=device)


def _resolve_ocr_device() -> str:
    """根据配置和环境解析 OCR 设备。"""
    value = (OCR_DEVICE or "auto").strip().lower()
    if value in {"cpu", "gpu"}:
        requested = value
    else:
        requested = "auto"

    try:
        import paddle

        has_cuda = paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
    except Exception:
        has_cuda = False

    if requested == "gpu":
        if has_cuda:
            return "gpu"
        print("OCR_DEVICE=gpu 但当前环境无可用 CUDA，已回退到 CPU。")
        return "cpu"

    if requested == "auto":
        return "gpu" if has_cuda else "cpu"

    return "cpu"


def _get_ocr_reader(
    *,
    use_angle_cls: bool = True,
    lang: str = OCR_LANG,
    device: str,
) -> ConfigurablePDFPaddleOCRReader:
    """
    线程内缓存 OCR reader，避免每次请求重复初始化 PaddleOCR。
    - 每个线程按 (use_angle_cls, lang, device) 维度各初始化一次
    - 避免跨线程共享同一个 reader 带来的并发风险
    """
    cache = getattr(_thread_local, "ocr_reader_cache", None)
    if cache is None:
        cache = {}
        _thread_local.ocr_reader_cache = cache

    key = (use_angle_cls, lang, device)
    reader = cache.get(key)
    if reader is None:
        reader = ConfigurablePDFPaddleOCRReader(
            use_angle_cls=use_angle_cls,
            lang=lang,
            device=device,
        )
        cache[key] = reader
    return reader


def _extract_text_from_file(file_path: str | Path) -> str:
    """
    从图片或 PDF 中提取文本。
    - PDF：使用 PDFPaddleOCRReader
    - 图片：使用 PDFPaddleOCRReader.extract_text_from_image（读入字节）
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    resolved_device = _resolve_ocr_device()
    reader = _get_ocr_reader(
        use_angle_cls=True,
        lang=OCR_LANG,
        device=resolved_device,
    )
    ext = path.suffix.lower()

    if ext == ".pdf":
        docs = reader.load_data(path)
        texts = [d.text for d in docs if d.text and reader.is_text_meaningful(d.text)]
        return " ".join(texts).strip()

    # 单张图片：读入字节，调用 extract_text_from_image
    if ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff"):
        with open(path, "rb") as f:
            image_data = f.read()
        return extract_text_from_image_bytes(image_data, lang=OCR_LANG)

    raise ValueError(f"不支持的文件类型: {ext}，支持 pdf, png, jpg, jpeg, bmp, tiff")


def extract_text_from_image_bytes(image_data: bytes, *, lang: str = OCR_LANG) -> str:
    """从单张图片字节中提取文本。"""
    if not image_data:
        return ""

    resolved_device = _resolve_ocr_device()
    reader = _get_ocr_reader(
        use_angle_cls=True,
        lang=lang,
        device=resolved_device,
    )
    return reader.extract_text_from_image(image_data) or ""
