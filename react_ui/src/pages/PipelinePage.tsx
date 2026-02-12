import { useEffect, useMemo, useReducer, useState } from 'react'
import AuditTrailPanel from '@/components/AuditTrailPanel'
import ExplainPanel from '@/components/ExplainPanel'
import ImageUploadPanel from '@/components/ImageUploadPanel'
import OcrReviewPanel from '@/components/OcrReviewPanel'
import RagResultTable from '@/components/RagResultTable'
import RagSearchPanel from '@/components/RagSearchPanel'
import WorkflowStepper from '@/components/WorkflowStepper'
import { buildExplainPromptPlan } from '@/prompts/explainPrompts'
import {
  callOcr,
  callRag,
  callVisionExplain,
  getErrorAudit,
  getErrorMessage,
} from '@/services/api'
import {
  STEP_ORDER,
  createInitialState,
  pipelineReducer,
  type PipelineDefaults,
} from '@/state/pipelineReducer'
import type { AuditEntry, HttpAuditSnapshot, StepKey } from '@/types/pipeline'
import {
  createPreviewUrl,
  revokePreviewUrl,
  toFileMeta,
  validateImageFile,
} from '@/utils/file'
import { nowIso } from '@/utils/time'

const parseDefaultTopK = (): number => {
  const parsed = Number(import.meta.env.VITE_DEFAULT_TOP_K ?? 5)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return 5
  }
  return parsed
}

const parseDefaultMatchThreshold = (): number => {
  const parsed = Number(import.meta.env.VITE_DEFAULT_MATCH_THRESHOLD ?? 0.03)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return 0.03
  }
  return parsed
}

const parseExplainModels = (): string[] => {
  const value = import.meta.env.VITE_EXPLAIN_MODELS ?? 'qwen-vl-max'
  const options = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return options.length > 0 ? options : ['qwen-vl-max']
}

const resolveDefaultExplainModel = (options: string[]): string => {
  const preferred = (import.meta.env.VITE_DEFAULT_EXPLAIN_MODEL ?? '').trim()
  if (preferred && options.includes(preferred)) {
    return preferred
  }
  return options[0]
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
  const explainModelOptions = useMemo(() => parseExplainModels(), [])
  const defaults = useMemo<PipelineDefaults>(
    () => ({
      defaultTopK: parseDefaultTopK(),
      defaultMatchThreshold: parseDefaultMatchThreshold(),
      defaultExplainModel: resolveDefaultExplainModel(explainModelOptions),
    }),
    [explainModelOptions],
  )
  const [state, dispatch] = useReducer(pipelineReducer, defaults, createInitialState)
  const [topKError, setTopKError] = useState<string | null>(null)
  const [thresholdError, setThresholdError] = useState<string | null>(null)

  useEffect(() => {
    return () => revokePreviewUrl(state.previewUrl)
  }, [state.previewUrl])

  const orderedSteps = useMemo(
    () => STEP_ORDER.map((key) => state.steps[key]),
    [state.steps],
  )

  const top1Result = state.ragResponse?.results?.[0]
  const top1Score = top1Result?.score

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

  const handleMatchThresholdChange = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      setThresholdError('匹配阈值必须是 0 到 1 的数字。')
      return
    }

    setThresholdError(null)
    dispatch({
      type: 'SET_MATCH_THRESHOLD',
      payload: { value },
    })

    if (!state.ragResponse) {
      return
    }

    const plan = buildExplainPromptPlan({
      reviewText: state.reviewText,
      top1Score: state.ragResponse.results[0]?.score,
      top1TextPreview: state.ragResponse.results[0]?.text_preview,
      threshold: value,
    })

    dispatch({
      type: 'SYNC_EXPLAIN_PROMPT',
      payload: {
        branch: plan.branch,
        promptAuto: plan.prompt,
      },
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
      const plan = buildExplainPromptPlan({
        reviewText: question,
        top1Score: result.data.results[0]?.score,
        top1TextPreview: result.data.results[0]?.text_preview,
        threshold: state.matchThreshold,
      })
      dispatch({
        type: 'RUN_RAG_SUCCESS',
        payload: {
          response: result.data,
          audit: toAuditEntry('rag', result.audit),
          explainBranch: plan.branch,
          explainPromptAuto: plan.prompt,
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

  const handleRunExplain = async () => {
    if (!state.ragResponse || !state.explainBranch) {
      return
    }

    if (!state.explainPromptDraft.trim()) {
      dispatch({
        type: 'RUN_EXPLAIN_ERROR',
        payload: {
          message: '提示词为空，请先生成或编辑提示词。',
        },
      })
      return
    }

    if (state.explainBranch === 'low_match_image' && !state.selectedFile) {
      dispatch({
        type: 'RUN_EXPLAIN_ERROR',
        payload: {
          message: '低匹配分支需要原始图片，但当前未找到图片文件。',
        },
      })
      return
    }

    dispatch({ type: 'RUN_EXPLAIN_START' })
    try {
      const result = await callVisionExplain({
        prompt: state.explainPromptDraft,
        model: state.explainModel,
        image: state.explainBranch === 'low_match_image' ? state.selectedFile ?? undefined : undefined,
      })
      dispatch({
        type: 'RUN_EXPLAIN_SUCCESS',
        payload: {
          text: result.data.text ?? '',
          audit: toAuditEntry('explain', result.audit),
        },
      })
    } catch (error) {
      const auditSnapshot = getErrorAudit(error)
      dispatch({
        type: 'RUN_EXPLAIN_ERROR',
        payload: {
          message: getErrorMessage(error),
          audit: auditSnapshot ? toAuditEntry('explain', auditSnapshot) : undefined,
        },
      })
    }
  }

  const handleReset = () => {
    if (state.previewUrl) {
      revokePreviewUrl(state.previewUrl)
    }
    setTopKError(null)
    setThresholdError(null)
    dispatch({
      type: 'RESET',
      payload: {
        defaults,
      },
    })
  }

  const canRunOcr =
    Boolean(state.selectedFile) && state.steps.ocr.status !== 'running'
  const canConfirmReview =
    state.steps.review.status === 'ready' &&
    state.reviewText.trim().length > 0 &&
    state.steps.ocr.status === 'success'
  const canRunRag =
    state.reviewConfirmed &&
    state.reviewText.trim().length > 0 &&
    state.steps.rag.status !== 'running'
  const canRunExplain =
    Boolean(state.ragResponse) &&
    Boolean(state.explainBranch) &&
    state.explainPromptDraft.trim().length > 0 &&
    state.steps.explain.status !== 'running' &&
    (state.explainBranch !== 'low_match_image' || Boolean(state.selectedFile))

  return (
    <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">
      <header className="mb-5 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
          OCR + RAG + Explain Pipeline
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          图片文本识别、检索与试题讲解审核台
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">
          上传图片后，按步骤执行 OCR、人工审核文本、RAG 检索和试题讲解。系统会根据匹配度自动选择讲解分支，并保留每一步完整审计数据。
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
          <ExplainPanel
            explainStep={state.steps.explain}
            matchThreshold={state.matchThreshold}
            top1Score={top1Score}
            explainBranch={state.explainBranch}
            modelOptions={explainModelOptions}
            explainModel={state.explainModel}
            promptDraft={state.explainPromptDraft}
            explainResult={state.explainResponseText}
            thresholdError={thresholdError}
            canRunExplain={canRunExplain}
            onThresholdChange={handleMatchThresholdChange}
            onModelChange={(value) =>
              dispatch({
                type: 'SET_EXPLAIN_MODEL',
                payload: { value },
              })
            }
            onPromptDraftChange={(value) =>
              dispatch({
                type: 'SET_EXPLAIN_PROMPT_DRAFT',
                payload: { value },
              })
            }
            onResetPrompt={() => dispatch({ type: 'RESET_EXPLAIN_PROMPT_TO_AUTO' })}
            onRunExplain={handleRunExplain}
          />
        </div>

        <AuditTrailPanel audits={state.audits} />
      </div>
    </div>
  )
}
