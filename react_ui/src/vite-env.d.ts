/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OCR_API_PREFIX: string
  readonly VITE_RAG_API_PREFIX: string
  readonly VITE_DEFAULT_TOP_K: string
  readonly VITE_REQUEST_TIMEOUT_MS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
