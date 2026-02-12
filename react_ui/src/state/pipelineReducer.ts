import type { RagResponse } from '@/types/api'
import type {
  AuditEntry,
  ExplainBranch,
  FileMeta,
  PipelineState,
  StepKey,
  StepState,
} from '@/types/pipeline'

export interface PipelineDefaults {
  defaultTopK: number
  defaultMatchThreshold: number
  defaultExplainModel: string
}

export const STEP_ORDER: StepKey[] = ['upload', 'ocr', 'review', 'rag', 'explain']

const STEP_LABELS: Record<StepKey, string> = {
  upload: '上传图片',
  ocr: 'OCR识别',
  review: '文本审核',
  rag: '向量检索',
  explain: '试题讲解',
}

const createInitialSteps = (): Record<StepKey, StepState> => ({
  upload: { key: 'upload', label: STEP_LABELS.upload, status: 'ready' },
  ocr: { key: 'ocr', label: STEP_LABELS.ocr, status: 'idle' },
  review: { key: 'review', label: STEP_LABELS.review, status: 'idle' },
  rag: { key: 'rag', label: STEP_LABELS.rag, status: 'idle' },
  explain: { key: 'explain', label: STEP_LABELS.explain, status: 'idle' },
})

const omitAudits = (
  audits: Partial<Record<StepKey, AuditEntry>>,
  keys: StepKey[],
): Partial<Record<StepKey, AuditEntry>> => {
  const nextAudits = { ...audits }
  for (const key of keys) {
    delete nextAudits[key]
  }
  return nextAudits
}

const explainReadyMessage = (branch: ExplainBranch): string =>
  branch === 'high_match_context'
    ? '匹配度较高，可基于检索上下文生成讲解'
    : '匹配度较低，建议上传图片生成讲解'

export const createInitialState = (defaults: PipelineDefaults): PipelineState => ({
  selectedFile: null,
  previewUrl: null,
  fileMeta: null,
  ocrText: '',
  reviewText: '',
  reviewConfirmed: false,
  topK: defaults.defaultTopK,
  ragResponse: null,
  matchThreshold: defaults.defaultMatchThreshold,
  explainModel: defaults.defaultExplainModel,
  explainBranch: null,
  explainPromptAuto: '',
  explainPromptDraft: '',
  explainResponseText: '',
  audits: {},
  steps: createInitialSteps(),
})

type PipelineAction =
  | {
      type: 'FILE_INVALID'
      payload: {
        message: string
      }
    }
  | {
      type: 'FILE_SELECTED'
      payload: {
        file: File
        previewUrl: string
        fileMeta: FileMeta
        audit: AuditEntry
      }
    }
  | {
      type: 'RUN_OCR_START'
    }
  | {
      type: 'RUN_OCR_SUCCESS'
      payload: {
        text: string
        audit: AuditEntry
      }
    }
  | {
      type: 'RUN_OCR_ERROR'
      payload: {
        message: string
        audit?: AuditEntry
      }
    }
  | {
      type: 'UPDATE_REVIEW_TEXT'
      payload: {
        text: string
      }
    }
  | {
      type: 'CONFIRM_REVIEW'
      payload: {
        audit: AuditEntry
      }
    }
  | {
      type: 'SET_TOP_K'
      payload: {
        value: number
      }
    }
  | {
      type: 'SET_MATCH_THRESHOLD'
      payload: {
        value: number
      }
    }
  | {
      type: 'SET_EXPLAIN_MODEL'
      payload: {
        value: string
      }
    }
  | {
      type: 'SET_EXPLAIN_PROMPT_DRAFT'
      payload: {
        value: string
      }
    }
  | {
      type: 'RESET_EXPLAIN_PROMPT_TO_AUTO'
    }
  | {
      type: 'SYNC_EXPLAIN_PROMPT'
      payload: {
        branch: ExplainBranch
        promptAuto: string
      }
    }
  | {
      type: 'RUN_RAG_START'
    }
  | {
      type: 'RUN_RAG_SUCCESS'
      payload: {
        response: RagResponse
        audit: AuditEntry
        explainBranch: ExplainBranch
        explainPromptAuto: string
      }
    }
  | {
      type: 'RUN_RAG_ERROR'
      payload: {
        message: string
        audit?: AuditEntry
      }
    }
  | {
      type: 'RUN_EXPLAIN_START'
    }
  | {
      type: 'RUN_EXPLAIN_SUCCESS'
      payload: {
        text: string
        audit: AuditEntry
      }
    }
  | {
      type: 'RUN_EXPLAIN_ERROR'
      payload: {
        message: string
        audit?: AuditEntry
      }
    }
  | {
      type: 'RESET'
      payload: {
        defaults: PipelineDefaults
      }
    }

export const pipelineReducer = (
  state: PipelineState,
  action: PipelineAction,
): PipelineState => {
  switch (action.type) {
    case 'FILE_INVALID':
      return {
        ...state,
        selectedFile: null,
        previewUrl: null,
        fileMeta: null,
        ocrText: '',
        reviewText: '',
        reviewConfirmed: false,
        ragResponse: null,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: {},
        steps: {
          ...createInitialSteps(),
          upload: {
            ...createInitialSteps().upload,
            status: 'error',
            message: action.payload.message,
          },
        },
      }

    case 'FILE_SELECTED':
      return {
        ...state,
        selectedFile: action.payload.file,
        previewUrl: action.payload.previewUrl,
        fileMeta: action.payload.fileMeta,
        ocrText: '',
        reviewText: '',
        reviewConfirmed: false,
        ragResponse: null,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: { upload: action.payload.audit },
        steps: {
          ...createInitialSteps(),
          upload: {
            ...createInitialSteps().upload,
            status: 'success',
            message: '图片已准备完成',
          },
          ocr: { ...createInitialSteps().ocr, status: 'ready' },
        },
      }

    case 'RUN_OCR_START':
      return {
        ...state,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: omitAudits(state.audits, ['ocr', 'review', 'rag', 'explain']),
        steps: {
          ...state.steps,
          ocr: {
            ...state.steps.ocr,
            status: 'running',
            message: '正在调用OCR服务',
          },
          review: { ...state.steps.review, status: 'idle', message: undefined },
          rag: { ...state.steps.rag, status: 'idle', message: undefined },
          explain: { ...state.steps.explain, status: 'idle', message: undefined },
        },
        reviewConfirmed: false,
        ragResponse: null,
      }

    case 'RUN_OCR_SUCCESS':
      return {
        ...state,
        ocrText: action.payload.text,
        reviewText: action.payload.text,
        reviewConfirmed: false,
        ragResponse: null,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: {
          ...omitAudits(state.audits, ['review', 'rag', 'explain']),
          ocr: action.payload.audit,
        },
        steps: {
          ...state.steps,
          ocr: {
            ...state.steps.ocr,
            status: 'success',
            message: action.payload.text.trim()
              ? 'OCR识别完成'
              : 'OCR返回空文本，可手动录入',
          },
          review: {
            ...state.steps.review,
            status: 'ready',
            message: '请审核OCR文本',
          },
          rag: {
            ...state.steps.rag,
            status: 'idle',
            message: undefined,
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'RUN_OCR_ERROR':
      return {
        ...state,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: {
          ...omitAudits(state.audits, ['explain']),
          ...(action.payload.audit ? { ocr: action.payload.audit } : {}),
        },
        steps: {
          ...state.steps,
          ocr: {
            ...state.steps.ocr,
            status: 'error',
            message: action.payload.message,
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'UPDATE_REVIEW_TEXT':
      return {
        ...state,
        reviewText: action.payload.text,
        reviewConfirmed: false,
        ragResponse: null,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: omitAudits(state.audits, ['rag', 'explain']),
        steps: {
          ...state.steps,
          review:
            state.steps.review.status === 'idle'
              ? state.steps.review
              : {
                  ...state.steps.review,
                  status: 'ready',
                  message: '文本已更新，请确认后检索',
                },
          rag: {
            ...state.steps.rag,
            status: 'idle',
            message: undefined,
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'CONFIRM_REVIEW':
      return {
        ...state,
        reviewConfirmed: true,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: {
          ...omitAudits(state.audits, ['rag', 'explain']),
          review: action.payload.audit,
        },
        steps: {
          ...state.steps,
          review: {
            ...state.steps.review,
            status: 'success',
            message: '文本审核已确认',
          },
          rag: {
            ...state.steps.rag,
            status: 'ready',
            message: '可执行向量检索',
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'SET_TOP_K':
      return {
        ...state,
        topK: action.payload.value,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: omitAudits(state.audits, ['explain']),
        steps: {
          ...state.steps,
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'SET_MATCH_THRESHOLD':
      return {
        ...state,
        matchThreshold: action.payload.value,
      }

    case 'SET_EXPLAIN_MODEL':
      return {
        ...state,
        explainModel: action.payload.value,
      }

    case 'SET_EXPLAIN_PROMPT_DRAFT':
      return {
        ...state,
        explainPromptDraft: action.payload.value,
      }

    case 'RESET_EXPLAIN_PROMPT_TO_AUTO':
      return {
        ...state,
        explainPromptDraft: state.explainPromptAuto,
      }

    case 'SYNC_EXPLAIN_PROMPT':
      return {
        ...state,
        explainBranch: action.payload.branch,
        explainPromptAuto: action.payload.promptAuto,
        explainPromptDraft: action.payload.promptAuto,
        explainResponseText: '',
        audits: omitAudits(state.audits, ['explain']),
        steps: {
          ...state.steps,
          explain: {
            ...state.steps.explain,
            status: 'ready',
            message: explainReadyMessage(action.payload.branch),
          },
        },
      }

    case 'RUN_RAG_START':
      return {
        ...state,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: omitAudits(state.audits, ['explain']),
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'running',
            message: '正在执行向量检索',
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'RUN_RAG_SUCCESS':
      return {
        ...state,
        ragResponse: action.payload.response,
        explainBranch: action.payload.explainBranch,
        explainPromptAuto: action.payload.explainPromptAuto,
        explainPromptDraft: action.payload.explainPromptAuto,
        explainResponseText: '',
        audits: {
          ...omitAudits(state.audits, ['explain']),
          rag: action.payload.audit,
        },
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'success',
            message: `返回 ${action.payload.response.result_count} 条结果`,
          },
          explain: {
            ...state.steps.explain,
            status: 'ready',
            message: explainReadyMessage(action.payload.explainBranch),
          },
        },
      }

    case 'RUN_RAG_ERROR':
      return {
        ...state,
        explainBranch: null,
        explainPromptAuto: '',
        explainPromptDraft: '',
        explainResponseText: '',
        audits: {
          ...omitAudits(state.audits, ['explain']),
          ...(action.payload.audit ? { rag: action.payload.audit } : {}),
        },
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'error',
            message: action.payload.message,
          },
          explain: {
            ...state.steps.explain,
            status: 'idle',
            message: undefined,
          },
        },
      }

    case 'RUN_EXPLAIN_START':
      return {
        ...state,
        explainResponseText: '',
        audits: omitAudits(state.audits, ['explain']),
        steps: {
          ...state.steps,
          explain: {
            ...state.steps.explain,
            status: 'running',
            message: '正在生成试题讲解',
          },
        },
      }

    case 'RUN_EXPLAIN_SUCCESS':
      return {
        ...state,
        explainResponseText: action.payload.text,
        audits: {
          ...state.audits,
          explain: action.payload.audit,
        },
        steps: {
          ...state.steps,
          explain: {
            ...state.steps.explain,
            status: 'success',
            message: '讲解生成完成',
          },
        },
      }

    case 'RUN_EXPLAIN_ERROR':
      return {
        ...state,
        audits: {
          ...state.audits,
          ...(action.payload.audit ? { explain: action.payload.audit } : {}),
        },
        steps: {
          ...state.steps,
          explain: {
            ...state.steps.explain,
            status: 'error',
            message: action.payload.message,
          },
        },
      }

    case 'RESET':
      return createInitialState(action.payload.defaults)

    default:
      return state
  }
}
