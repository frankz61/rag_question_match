import ReactMarkdown from 'react-markdown'
import type { ExplainBranch, StepState } from '@/types/pipeline'

interface ExplainPanelProps {
  explainStep: StepState
  matchThreshold: number
  top1Score?: number
  explainBranch: ExplainBranch | null
  modelOptions: string[]
  explainModel: string
  promptDraft: string
  explainResult: string
  thresholdError: string | null
  canRunExplain: boolean
  onThresholdChange: (value: number) => void
  onModelChange: (value: string) => void
  onPromptDraftChange: (value: string) => void
  onResetPrompt: () => void
  onRunExplain: () => void
}

const BRANCH_LABELS: Record<ExplainBranch, string> = {
  high_match_context: '高匹配：仅传检索上下文',
  low_match_image: '低匹配：传图片识别',
}

const formatScore = (value?: number): string =>
  typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(6) : 'N/A'

export default function ExplainPanel({
  explainStep,
  matchThreshold,
  top1Score,
  explainBranch,
  modelOptions,
  explainModel,
  promptDraft,
  explainResult,
  thresholdError,
  canRunExplain,
  onThresholdChange,
  onModelChange,
  onPromptDraftChange,
  onResetPrompt,
  onRunExplain,
}: ExplainPanelProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">5. 试题讲解</h3>
          <p className="text-sm text-slate-500">根据匹配度自动选择上下文或图片分支生成讲解。</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canRunExplain || explainStep.status === 'running'}
          onClick={onRunExplain}
        >
          {explainStep.status === 'running' ? '生成中...' : '生成试题讲解'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="match-threshold-input">
            匹配阈值（0 - 1）
          </label>
          <input
            id="match-threshold-input"
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={Number.isFinite(matchThreshold) ? matchThreshold : ''}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-brand-200 transition focus:ring"
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
          {thresholdError ? (
            <p className="mt-1 text-xs text-rose-600">{thresholdError}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Top1 分数大于等于阈值时走高匹配分支</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="explain-model-select">
            讲解模型
          </label>
          <select
            id="explain-model-select"
            value={explainModel}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-brand-200 transition focus:ring"
            onChange={(event) => onModelChange(event.target.value)}
          >
            {modelOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">当前调用接口: /api/v1/chat/vision</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
          <p className="text-slate-500">Top1 分数</p>
          <p className="mt-1 font-semibold text-slate-700">{formatScore(top1Score)}</p>
          <p className="mt-2 text-slate-500">分支判定</p>
          <p className="mt-1 font-semibold text-slate-700">
            {explainBranch ? BRANCH_LABELS[explainBranch] : '尚未生成检索结果'}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-700">讲解提示词（可编辑）</h4>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            onClick={onResetPrompt}
            disabled={!promptDraft.trim()}
          >
            恢复默认提示词
          </button>
        </div>
        <textarea
          value={promptDraft}
          placeholder="检索完成后会自动生成提示词。"
          className="mt-2 h-44 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none ring-brand-200 transition focus:ring"
          onChange={(event) => onPromptDraftChange(event.target.value)}
        />
      </div>

      {explainStep.message ? (
        <p
          className={`mt-3 text-sm ${
            explainStep.status === 'error' ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          {explainStep.message}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <h4 className="text-sm font-semibold text-slate-700">讲解结果（Markdown）</h4>
        {explainResult.trim() ? (
          <div className="prose prose-slate mt-3 max-w-none rounded-lg bg-white p-4 text-sm">
            <ReactMarkdown>{explainResult}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">生成后在此展示讲解结果。</p>
        )}
      </div>
    </section>
  )
}
