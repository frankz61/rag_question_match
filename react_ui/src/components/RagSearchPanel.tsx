import type { StepState } from '@/types/pipeline'

interface RagSearchPanelProps {
  ragStep: StepState
  topK: number
  topKError: string | null
  canRunRag: boolean
  onTopKChange: (value: number) => void
  onRunRag: () => void
}

export default function RagSearchPanel({
  ragStep,
  topK,
  topKError,
  canRunRag,
  onTopKChange,
  onRunRag,
}: RagSearchPanelProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">3. 向量检索</h3>
          <p className="text-sm text-slate-500">使用审核后的文本执行 RAG 查询。</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canRunRag || ragStep.status === 'running'}
          onClick={onRunRag}
        >
          {ragStep.status === 'running' ? '检索中...' : '执行检索'}
        </button>
      </div>

      <div className="mt-4 max-w-sm">
        <label className="text-sm font-medium text-slate-700" htmlFor="top-k-input">
          top_k
        </label>
        <input
          id="top-k-input"
          type="number"
          min={1}
          max={20}
          value={Number.isFinite(topK) ? topK : ''}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-brand-200 transition focus:ring"
          onChange={(event) => onTopKChange(Number(event.target.value))}
        />
        {topKError ? (
          <p className="mt-1 text-sm text-rose-600">{topKError}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">可配置范围：1 ~ 20</p>
        )}
      </div>

      {ragStep.message ? (
        <p
          className={`mt-3 text-sm ${
            ragStep.status === 'error' ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          {ragStep.message}
        </p>
      ) : null}
    </section>
  )
}
