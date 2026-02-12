import type { RagResponse } from '@/types/api'
import type {
  AuditEntry,
  FileMeta,
  PipelineState,
  StepKey,
  StepState,
} from '@/types/pipeline'

export const STEP_ORDER: StepKey[] = ['upload', 'ocr', 'review', 'rag']

const STEP_LABELS: Record<StepKey, string> = {
  upload: '上传图片',
  ocr: 'OCR识别',
  review: '文本审核',
  rag: '向量检索',
}

const createInitialSteps = (): Record<StepKey, StepState> => ({
  upload: { key: 'upload', label: STEP_LABELS.upload, status: 'ready' },
  ocr: { key: 'ocr', label: STEP_LABELS.ocr, status: 'idle' },
  review: { key: 'review', label: STEP_LABELS.review, status: 'idle' },
  rag: { key: 'rag', label: STEP_LABELS.rag, status: 'idle' },
})

export const createInitialState = (defaultTopK: number): PipelineState => ({
  selectedFile: null,
  previewUrl: null,
  fileMeta: null,
  ocrText: '',
  reviewText: '',
  reviewConfirmed: false,
  topK: defaultTopK,
  ragResponse: null,
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
      type: 'RUN_RAG_START'
    }
  | {
      type: 'RUN_RAG_SUCCESS'
      payload: {
        response: RagResponse
        audit: AuditEntry
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
      type: 'RESET'
      payload: {
        defaultTopK: number
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
        steps: {
          ...state.steps,
          ocr: {
            ...state.steps.ocr,
            status: 'running',
            message: '正在调用OCR服务',
          },
          review: { ...state.steps.review, status: 'idle', message: undefined },
          rag: { ...state.steps.rag, status: 'idle', message: undefined },
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
        audits: {
          ...state.audits,
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
        },
      }

    case 'RUN_OCR_ERROR':
      return {
        ...state,
        audits: {
          ...state.audits,
          ...(action.payload.audit ? { ocr: action.payload.audit } : {}),
        },
        steps: {
          ...state.steps,
          ocr: {
            ...state.steps.ocr,
            status: 'error',
            message: action.payload.message,
          },
        },
      }

    case 'UPDATE_REVIEW_TEXT':
      return {
        ...state,
        reviewText: action.payload.text,
        reviewConfirmed: false,
        ragResponse: null,
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
        },
      }

    case 'CONFIRM_REVIEW':
      return {
        ...state,
        reviewConfirmed: true,
        audits: {
          ...state.audits,
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
        },
      }

    case 'SET_TOP_K':
      return {
        ...state,
        topK: action.payload.value,
      }

    case 'RUN_RAG_START':
      return {
        ...state,
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'running',
            message: '正在执行向量检索',
          },
        },
      }

    case 'RUN_RAG_SUCCESS':
      return {
        ...state,
        ragResponse: action.payload.response,
        audits: {
          ...state.audits,
          rag: action.payload.audit,
        },
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'success',
            message: `返回 ${action.payload.response.result_count} 条结果`,
          },
        },
      }

    case 'RUN_RAG_ERROR':
      return {
        ...state,
        audits: {
          ...state.audits,
          ...(action.payload.audit ? { rag: action.payload.audit } : {}),
        },
        steps: {
          ...state.steps,
          rag: {
            ...state.steps.rag,
            status: 'error',
            message: action.payload.message,
          },
        },
      }

    case 'RESET':
      return createInitialState(action.payload.defaultTopK)

    default:
      return state
  }
}
