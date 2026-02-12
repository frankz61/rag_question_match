import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Suspense, lazy } from 'react'
import { STEP_ORDER } from '@/state/pipelineReducer'
import type { AuditEntry, StepKey } from '@/types/pipeline'
import { formatDuration } from '@/utils/time'

interface AuditTrailPanelProps {
  audits: Partial<Record<StepKey, AuditEntry>>
}

const JsonViewer = lazy(() => import('@/components/JsonViewer'))

const STEP_NAME: Record<StepKey, string> = {
  upload: '上传',
  ocr: 'OCR',
  review: '审核',
  rag: '检索',
  explain: '讲解',
}

export default function AuditTrailPanel({ audits }: AuditTrailPanelProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <h2 className="text-lg font-semibold text-slate-800">审计面板</h2>
      <p className="mt-1 text-sm text-slate-500">可展开查看每一步完整请求与响应数据。</p>

      <div className="mt-4 space-y-3">
        {STEP_ORDER.map((step) => {
          const entry = audits[step]
          const hasError = Boolean(entry?.error)
          return (
            <Disclosure key={step} as="div" className="rounded-xl border border-slate-200 bg-slate-50">
              {({ open }) => (
                <>
                  <DisclosureButton className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {STEP_NAME[step]}审计
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry ? `耗时 ${formatDuration(entry.durationMs)}` : '暂无数据'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          !entry
                            ? 'bg-slate-200 text-slate-600'
                            : hasError
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {!entry ? 'pending' : hasError ? 'error' : 'ok'}
                      </span>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </DisclosureButton>

                  <DisclosurePanel className="space-y-3 border-t border-slate-200 px-3 pb-3 pt-2">
                    {!entry ? (
                      <p className="text-sm text-slate-500">该步骤尚未产生审计数据。</p>
                    ) : (
                      <>
                        <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                          <p>开始时间: {entry.startedAt}</p>
                          <p>结束时间: {entry.endedAt ?? '-'}</p>
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Request
                          </p>
                          <Suspense fallback={<p className="text-xs text-slate-500">加载中...</p>}>
                            <JsonViewer data={entry.request} />
                          </Suspense>
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Response
                          </p>
                          <Suspense fallback={<p className="text-xs text-slate-500">加载中...</p>}>
                            <JsonViewer data={entry.response} />
                          </Suspense>
                        </div>

                        {entry.error ? (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                              Error
                            </p>
                            <Suspense fallback={<p className="text-xs text-slate-500">加载中...</p>}>
                              <JsonViewer data={entry.error} />
                            </Suspense>
                          </div>
                        ) : null}
                      </>
                    )}
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>
          )
        })}
      </div>
    </section>
  )
}
