import type { StepState, StepStatus } from '@/types/pipeline'

interface WorkflowStepperProps {
  steps: StepState[]
}

const STATUS_LABELS: Record<StepStatus, string> = {
  idle: '未开始',
  ready: '待执行',
  running: '执行中',
  success: '成功',
  error: '失败',
}

const STATUS_STYLES: Record<StepStatus, string> = {
  idle: 'bg-slate-200 text-slate-600',
  ready: 'bg-brand-100 text-brand-700',
  running: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
}

export default function WorkflowStepper({ steps }: WorkflowStepperProps) {
  return (
    <section className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-card backdrop-blur">
      <h2 className="text-lg font-semibold text-slate-800">执行流程</h2>
      <ol className="mt-4 flex flex-col gap-3 lg:flex-row lg:gap-2">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-500">STEP {index + 1}</p>
                <p className="text-base font-semibold text-slate-800">{step.label}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[step.status]}`}
              >
                {STATUS_LABELS[step.status]}
              </span>
            </div>
            {step.message ? (
              <p className="mt-2 text-xs text-slate-600 line-clamp-2">{step.message}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">等待操作</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
