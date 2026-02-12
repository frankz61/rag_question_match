import type { RagResponse } from '@/types/api'

export type StepKey = 'upload' | 'ocr' | 'review' | 'rag' | 'explain'

export type StepStatus = 'idle' | 'ready' | 'running' | 'success' | 'error'

export type ExplainBranch = 'high_match_context' | 'low_match_image'

export interface StepState {
  key: StepKey
  label: string
  status: StepStatus
  message?: string
}

export interface FileMeta {
  name: string
  size: number
  type: string
  lastModified: number
}

export interface AuditHttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

export interface AuditHttpResponse {
  status: number
  body: unknown
}

export interface AuditError {
  message: string
  detail?: unknown
}

export interface AuditEntry {
  step: StepKey
  startedAt: string
  endedAt?: string
  durationMs?: number
  request?: AuditHttpRequest
  response?: AuditHttpResponse
  error?: AuditError
}

export interface HttpAuditSnapshot {
  startedAt: string
  endedAt: string
  durationMs: number
  request: AuditHttpRequest
  response?: AuditHttpResponse
  error?: AuditError
}

export interface PipelineState {
  selectedFile: File | null
  previewUrl: string | null
  fileMeta: FileMeta | null
  ocrText: string
  reviewText: string
  reviewConfirmed: boolean
  topK: number
  ragResponse: RagResponse | null
  matchThreshold: number
  explainModel: string
  explainBranch: ExplainBranch | null
  explainPromptAuto: string
  explainPromptDraft: string
  explainResponseText: string
  steps: Record<StepKey, StepState>
  audits: Partial<Record<StepKey, AuditEntry>>
}
