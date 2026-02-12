import { useEffect, useMemo, useReducer, useState } from 'react'
import AuditTrailPanel from '@/components/AuditTrailPanel'
import ImageUploadPanel from '@/components/ImageUploadPanel'
import OcrReviewPanel from '@/components/OcrReviewPanel'
import RagResultTable from '@/components/RagResultTable'
import RagSearchPanel from '@/components/RagSearchPanel'
import WorkflowStepper from '@/components/WorkflowStepper'
import { callOcr, callRag, getErrorAudit, getErrorMessage } from '@/services/api'
import {
  STEP_ORDER,
  createInitialState,
  pipelineReducer,
} from '@/state/pipelineReducer'
import type { AuditEntry, HttpAuditSnapshot, StepKey } from '@/types/pipeline'
import { createPreviewUrl, revokePreviewUrl, toFileMeta, validateImageFile } from '@/utils/file'
import { nowIso } from '@/utils/time'

const parseDefaultTopK = (): number => {
  const parsed = Number(import.meta.env.VITE_DEFAULT_TOP_K ?? 5)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return 5
  }
  return parsed
}

const toAuditEntry = (step: StepKey, snapshot: HttpAuditSnapshot): AuditEntry => ({
  step,
  startedAt: snapshot.startedAt,
  endedAt: snapshot.endedAt,
  durationMs: snapshot.durationMs,
  request: snapshot.request,
  response: snapshot.response,
  error: snapshot.error,
})

export default function PipelinePage() {
  const defaultTopK = useMemo(() => parseDefaultTopK(), [])
  const [state, dispatch] = useReducer(
    pipelineReducer,
    defaultTopK,
    createInitialState,
  )
  const [topKError, setTopKError] = useState<string | null>(null)

  useEffect(() => {
    return () => revokePreviewUrl(state.previewUrl)
  }, [state.previewUrl])

  const orderedSteps = useMemo(() => STEP_ORDER.map((key) => state.steps[key]), [state.steps])

  const handleSelectFile = (file: File) => {
    const validateMessage = validateImageFile(file)
    if (validateMessage) {
      if (state.previewUrl) {
        revokePreviewUrl(state.previewUrl)
      }
      dispatch({
        type: 'FILE_INVALID',
        payload: { message: validateMessage },
      })
      return
    }

    const previewUrl = createPreviewUrl(file)
    if (state.previewUrl) {
      revokePreviewUrl(state.previewUrl)
    }

    const fileMeta = toFileMeta(file)
    const timestamp = nowIso()
    const uploadAudit: AuditEntry = {
      step: 'upload',
      startedAt: timestamp,
      endedAt: timestamp,
      durationMs: 0,
      request: {
        method: 'LOCAL',
        url: 'browser:file-input',
        headers: {},
        body: fileMeta,
      },
      response: {
        status: 200,
        body: { accepted: true, previewCreated: true },
      },
    }

    dispatch({
      type: 'FILE_SELECTED',
      payload: { file, previewUrl, fileMeta, audit: uploadAudit },
    })
  }

  const handleRunOcr = async () => {
    if (!state.selectedFile) {
      return
    }

    dispatch({ type: 'RUN_OCR_START' })
    try {
      const result = await callOcr(state.selectedFile)
      dispatch({
        type: 'RUN_OCR_SUCCESS',
        payload: {
          text: result.data.text ?? '',
          audit: toAuditEntry('ocr', result.audit),
        },
      })
    } catch (error) {
      const auditSnapshot = getErrorAudit(error)
      dispatch({
        type: 'RUN_OCR_ERROR',
        payload: {
          message: getErrorMessage(error),
          audit: auditSnapshot ? toAuditEntry('ocr', auditSnapshot) : undefined,
        },
      })
    }
  }

  const handleReviewTextChange = (value: string) => {
    dispatch({
      type: 'UPDATE_REVIEW_TEXT',
      payload: { text: value },
    })
  }

  const handleConfirmReview = () => {
    const timestamp = nowIso()
    dispatch({
      type: 'CONFIRM_REVIEW',
      payload: {
        audit: {
          step: 'review',
          startedAt: timestamp,
          endedAt: timestamp,
          durationMs: 0,
          request: {
            method: 'LOCAL',
            url: 'browser:review-confirm',
            headers: {},
            body: {
              ocrText: state.ocrText,
              reviewText: state.reviewText,
            },
          },
          response: {
            status: 200,
            body: {
              confirmed: true,
              length: state.reviewText.length,
            },
          },
        },
      },
    })
  }

  const handleTopKChange = (value: number) => {
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      setTopKError('top_k 必须是 1 到 20 的整数。')
    } else {
      setTopKError(null)
    }
    dispatch({
      type: 'SET_TOP_K',
      payload: { value },
    })
  }

  const handleRunRag = async () => {
    if (!Number.isInteger(state.topK) || state.topK < 1 || state.topK > 20) {
      setTopKError('top_k 必须是 1 到 20 的整数。')
      return
    }
    setTopKError(null)

    const question = state.reviewText.trim()
    if (!question) {
      dispatch({
        type: 'RUN_RAG_ERROR',
        payload: {
          message: '审核文本为空，无法执行检索。',
        },
      })
      return
    }

    dispatch({ type: 'RUN_RAG_START' })
    try {
      const result = await callRag({
        question,
        top_k: state.topK,
      })
      dispatch({
        type: 'RUN_RAG_SUCCESS',
        payload: {
          response: result.data,
          audit: toAuditEntry('rag', result.audit),
        },
      })
    } catch (error) {
      const auditSnapshot = getErrorAudit(error)
      dispatch({
        type: 'RUN_RAG_ERROR',
        payload: {
          message: getErrorMessage(error),
          audit: auditSnapshot ? toAuditEntry('rag', auditSnapshot) : undefined,
        },
      })
    }
  }

  const handleReset = () => {
    if (state.previewUrl) {
      revokePreviewUrl(state.previewUrl)
    }
    setTopKError(null)
    dispatch({
      type: 'RESET',
      payload: {
        defaultTopK,
      },
    })
  }

  const canRunOcr = Boolean(state.selectedFile) && state.steps.ocr.status !== 'running'
  const canConfirmReview =
    state.steps.review.status === 'ready' &&
    state.reviewText.trim().length > 0 &&
    state.steps.ocr.status === 'success'
  const canRunRag =
    state.reviewConfirmed &&
    state.reviewText.trim().length > 0 &&
    state.steps.rag.status !== 'running'

  return (
    <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">
      <header className="mb-5 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
          OCR + RAG Visual Pipeline
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          图片文本识别与向量检索审核台
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">
          上传图片后，按步骤执行 OCR、人工审核文本、RAG 检索。每一步都可查看完整请求和响应数据，便于调试与追溯。
        </p>
      </header>

      <WorkflowStepper steps={orderedSteps} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.75fr,1fr]">
        <div className="space-y-5">
          <ImageUploadPanel
            step={state.steps.upload}
            previewUrl={state.previewUrl}
            fileMeta={state.fileMeta}
            onSelectFile={handleSelectFile}
            onReset={handleReset}
          />
          <OcrReviewPanel
            ocrStep={state.steps.ocr}
            reviewStep={state.steps.review}
            ocrText={state.ocrText}
            reviewText={state.reviewText}
            canRunOcr={canRunOcr}
            canConfirmReview={canConfirmReview}
            onRunOcr={handleRunOcr}
            onReviewTextChange={handleReviewTextChange}
            onConfirmReview={handleConfirmReview}
          />
          <RagSearchPanel
            ragStep={state.steps.rag}
            topK={state.topK}
            topKError={topKError}
            canRunRag={canRunRag}
            onTopKChange={handleTopKChange}
            onRunRag={handleRunRag}
          />
          <RagResultTable ragResponse={state.ragResponse} />
        </div>

        <AuditTrailPanel audits={state.audits} />
      </div>
    </div>
  )
}
