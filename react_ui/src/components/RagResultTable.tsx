import type { RagResponse } from '@/types/api'

interface RagResultTableProps {
  ragResponse: RagResponse | null
}

export default function RagResultTable({ ragResponse }: RagResultTableProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">4. 检索结果</h3>
        {ragResponse ? (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            共 {ragResponse.result_count} 条
          </span>
        ) : null}
      </div>

      {!ragResponse ? (
        <p className="mt-3 text-sm text-slate-500">执行检索后在此展示结果。</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Rank</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Text Preview</th>
                <th className="px-3 py-2 font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {ragResponse.results.map((item) => (
                <tr key={`${item.rank}-${item.metadata.box_id ?? 'unknown'}`}>
                  <td className="px-3 py-2 align-top font-semibold">{item.rank}</td>
                  <td className="px-3 py-2 align-top">{item.score.toFixed(6)}</td>
                  <td className="max-w-xl px-3 py-2 align-top">{item.text_preview}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-1">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <p key={key} className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">{key}:</span> {value}
                        </p>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
