import type { StepState } from '@/types/pipeline'

interface OcrReviewPanelProps {
  ocrStep: StepState
  reviewStep: StepState
  ocrText: string
  reviewText: string
  canRunOcr: boolean
  canConfirmReview: boolean
  onRunOcr: () => void
  onReviewTextChange: (value: string) => void
  onConfirmReview: () => void
}

export default function OcrReviewPanel({
  ocrStep,
  reviewStep,
  ocrText,
  reviewText,
  canRunOcr,
  canConfirmReview,
  onRunOcr,
  onReviewTextChange,
  onConfirmReview,
}: OcrReviewPanelProps) {
  const ocrRunning = ocrStep.status === 'running'
  const reviewEditable = ocrStep.status === 'success' || reviewStep.status === 'ready'

  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">2. OCR识别与审核</h3>
          <p className="text-sm text-slate-500">先提取文字，再人工确认文本质量。</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canRunOcr || ocrRunning}
          onClick={onRunOcr}
        >
          {ocrRunning ? '识别中...' : '执行OCR'}
        </button>
      </div>

      {ocrStep.message ? (
        <p
          className={`mt-3 text-sm ${
            ocrStep.status === 'error' ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          {ocrStep.message}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <h4 className="text-sm font-semibold text-slate-700">OCR原始文本</h4>
          <div className="mt-2 h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700">
            {ocrText.trim() ? ocrText : 'OCR结果为空，或尚未执行。'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <h4 className="text-sm font-semibold text-slate-700">审核文本（可编辑）</h4>
          <textarea
            className="mt-2 h-40 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none ring-brand-200 transition focus:ring disabled:cursor-not-allowed disabled:bg-slate-100"
            value={reviewText}
            placeholder="OCR返回后可在此修正错别字，再进入检索。"
            onChange={(event) => onReviewTextChange(event.target.value)}
            disabled={!reviewEditable}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={!canConfirmReview}
          onClick={onConfirmReview}
        >
          确认审核文本
        </button>
        {reviewStep.message ? (
          <p
            className={`text-sm ${
              reviewStep.status === 'error' ? 'text-rose-600' : 'text-slate-600'
            }`}
          >
            {reviewStep.message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
