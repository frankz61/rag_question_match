import axios, {
  AxiosHeaders,
  isAxiosError,
  type AxiosResponse,
  type RawAxiosRequestHeaders,
} from 'axios'
import type { HttpAuditSnapshot } from '@/types/pipeline'

interface RequestMetadata {
  startedAt: string
  startedTick: number
  requestBody: unknown
  requestHeaders: Record<string, string>
}

const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? 300000)

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata
  }
}

const nowTick = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

type PlainHeaderValue = string | string[] | number | boolean | null

const normalizeHeaderValue = (value: unknown): PlainHeaderValue => {
  if (value === null) {
    return null
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

const normalizeHeaders = (
  headers: AxiosHeaders | RawAxiosRequestHeaders | undefined,
): Record<string, string> => {
  if (!headers) {
    return {}
  }

  const compactHeaders: Record<string, PlainHeaderValue> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      compactHeaders[key] = normalizeHeaderValue(value)
    }
  }

  const json = new AxiosHeaders(compactHeaders).toJSON()
  return Object.fromEntries(
    Object.entries(json).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)]),
  )
}

const serializeBody = (body: unknown): unknown => {
  if (body instanceof FormData) {
    const snapshot: Record<string, unknown> = {}
    for (const [key, value] of body.entries()) {
      if (value instanceof File) {
        snapshot[key] = {
          name: value.name,
          size: value.size,
          type: value.type,
          lastModified: value.lastModified,
        }
      } else {
        snapshot[key] = value
      }
    }
    return snapshot
  }
  return body
}

const makeAudit = (response: AxiosResponse): HttpAuditSnapshot => {
  const metadata = response.config.metadata
  const endedAt = new Date().toISOString()
  const durationMs = Math.max(0, nowTick() - (metadata?.startedTick ?? nowTick()))

  return {
    startedAt: metadata?.startedAt ?? endedAt,
    endedAt,
    durationMs,
    request: {
      method: (response.config.method ?? 'GET').toUpperCase(),
      url: response.config.url ?? '',
      headers: metadata?.requestHeaders ?? normalizeHeaders(response.config.headers),
      body: metadata?.requestBody ?? serializeBody(response.config.data),
    },
    response: {
      status: response.status,
      body: response.data,
    },
  }
}

const makeErrorAudit = (error: unknown): HttpAuditSnapshot => {
  const endedAt = new Date().toISOString()

  if (!isAxiosError(error) || !error.config) {
    return {
      startedAt: endedAt,
      endedAt,
      durationMs: 0,
      request: {
        method: 'UNKNOWN',
        url: '',
        headers: {},
        body: undefined,
      },
      error: {
        message: '未知请求错误',
        detail: error,
      },
    }
  }

  const metadata = error.config.metadata
  const durationMs = Math.max(0, nowTick() - (metadata?.startedTick ?? nowTick()))
  return {
    startedAt: metadata?.startedAt ?? endedAt,
    endedAt,
    durationMs,
    request: {
      method: (error.config.method ?? 'GET').toUpperCase(),
      url: error.config.url ?? '',
      headers: metadata?.requestHeaders ?? normalizeHeaders(error.config.headers),
      body: metadata?.requestBody ?? serializeBody(error.config.data),
    },
    response: error.response
      ? {
          status: error.response.status,
          body: error.response.data,
        }
      : undefined,
    error: {
      message: error.message,
      detail: error.response?.data,
    },
  }
}

export class HttpClientError extends Error {
  readonly status?: number
  readonly data?: unknown
  readonly audit: HttpAuditSnapshot

  constructor(params: {
    message: string
    status?: number
    data?: unknown
    audit: HttpAuditSnapshot
  }) {
    super(params.message)
    this.name = 'HttpClientError'
    this.status = params.status
    this.data = params.data
    this.audit = params.audit
  }
}

export const isHttpClientError = (error: unknown): error is HttpClientError =>
  error instanceof HttpClientError

const httpClient = axios.create({
  timeout: Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 300000,
})

httpClient.interceptors.request.use((config) => {
  config.metadata = {
    startedAt: new Date().toISOString(),
    startedTick: nowTick(),
    requestBody: serializeBody(config.data),
    requestHeaders: normalizeHeaders(config.headers),
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => {
    const responseWithAudit = response as AxiosResponse & {
      audit?: HttpAuditSnapshot
    }
    responseWithAudit.audit = makeAudit(response)
    return response
  },
  (error: unknown) => {
    const audit = makeErrorAudit(error)

    if (isAxiosError(error)) {
      const normalized = new HttpClientError({
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        audit,
      })
      return Promise.reject(normalized)
    }

    return Promise.reject(
      new HttpClientError({
        message: '请求执行失败',
        audit,
        data: error,
      }),
    )
  },
)

export default httpClient
