import type {
  OcrResponse,
  RagRequest,
  RagResponse,
  VisionExplainResponse,
} from '@/types/api'
import type { HttpAuditSnapshot } from '@/types/pipeline'
import httpClient, { HttpClientError, isHttpClientError } from '@/services/httpClient'

const OCR_API_PREFIX = import.meta.env.VITE_OCR_API_PREFIX || '/api/ocr'
const RAG_API_PREFIX = import.meta.env.VITE_RAG_API_PREFIX || '/api/rag'

export interface ApiCallResult<T> {
  data: T
  audit: HttpAuditSnapshot
}

const ensureAudit = (audit: HttpAuditSnapshot | undefined, fallbackBody: unknown): HttpAuditSnapshot =>
  audit ?? {
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 0,
    request: {
      method: 'UNKNOWN',
      url: '',
      headers: {},
      body: undefined,
    },
    response: {
      status: 200,
      body: fallbackBody,
    },
  }

export const callOcr = async (file: File): Promise<ApiCallResult<OcrResponse>> => {
  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await httpClient.post<OcrResponse>(`${OCR_API_PREFIX}/image`, formData, {
    headers: {
      Accept: 'application/json',
    },
  })
  const responseWithAudit = response as typeof response & {
    audit?: HttpAuditSnapshot
  }

  return {
    data: response.data,
    audit: ensureAudit(responseWithAudit.audit, response.data),
  }
}

export const callRag = async (payload: RagRequest): Promise<ApiCallResult<RagResponse>> => {
  const response = await httpClient.post<RagResponse>(
    `${RAG_API_PREFIX}/v1/query/search`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  const responseWithAudit = response as typeof response & {
    audit?: HttpAuditSnapshot
  }

  return {
    data: response.data,
    audit: ensureAudit(responseWithAudit.audit, response.data),
  }
}

export const callVisionExplain = async (payload: {
  prompt: string
  model: string
  image?: File
}): Promise<ApiCallResult<VisionExplainResponse>> => {
  const formData = new FormData()
  formData.append('prompt', payload.prompt)
  formData.append('model', payload.model)
  if (payload.image) {
    formData.append('image', payload.image, payload.image.name)
  }

  const response = await httpClient.post<VisionExplainResponse>(
    `${RAG_API_PREFIX}/v1/chat/vision`,
    formData,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )
  const responseWithAudit = response as typeof response & {
    audit?: HttpAuditSnapshot
  }

  return {
    data: response.data,
    audit: ensureAudit(responseWithAudit.audit, response.data),
  }
}

export const getErrorMessage = (
  error: unknown,
  fallbackMessage = '服务请求失败，请稍后重试。',
): string => {
  if (isHttpClientError(error)) {
    if (error.status) {
      return `请求失败（${error.status}）`
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallbackMessage
}

export const getErrorAudit = (error: unknown): HttpAuditSnapshot | undefined => {
  if (error instanceof HttpClientError) {
    return error.audit
  }
  return undefined
}
