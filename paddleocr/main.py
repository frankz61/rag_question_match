from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from ocr_match import extract_text_from_image_bytes


app = FastAPI(title="Simple OCR API", version="0.1.0")

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr/image")
async def ocr_image(file: UploadFile = File(...)) -> dict[str, str]:
    filename = (file.filename or "").lower()
    if not filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="仅支持 png/jpg/jpeg/bmp/tiff 图片")

    image_data = await file.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="上传文件为空")

    try:
        text = await run_in_threadpool(extract_text_from_image_bytes, image_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR 处理失败: {exc}") from exc

    return {"filename": file.filename or "", "text": text}
