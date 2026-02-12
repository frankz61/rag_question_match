import { formatFileSize } from '@/utils/file'
import type { StepState } from '@/types/pipeline'
import type { ChangeEvent } from 'react'

interface ImageUploadPanelProps {
  step: StepState
  previewUrl: string | null
  fileMeta: {
    name: string
    size: number
    type: string
  } | null
  onSelectFile: (file: File) => void
  onReset: () => void
}

export default function ImageUploadPanel({
  step,
  previewUrl,
  fileMeta,
  onSelectFile,
  onReset,
}: ImageUploadPanelProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    if (file) {
      onSelectFile(file)
    }
    event.target.value = ''
  }

  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">1. 图片上传</h3>
          <p className="text-sm text-slate-500">支持单张图片，最大 10MB。</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {step.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          选择图片
          <input
            aria-label="上传图片文件"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleInputChange}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onReset}
        >
          重置流程
        </button>
      </div>

      {step.message ? (
        <p
          className={`mt-3 text-sm ${
            step.status === 'error' ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          {step.message}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
          {previewUrl ? (
            <img src={previewUrl} alt="上传预览图" className="h-56 w-full object-contain" />
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">
              暂无预览
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <h4 className="text-sm font-semibold text-slate-700">文件信息</h4>
          {fileMeta ? (
            <dl className="mt-2 space-y-2 text-sm text-slate-600">
              <div>
                <dt className="text-slate-500">文件名</dt>
                <dd className="break-all font-medium text-slate-700">{fileMeta.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">大小</dt>
                <dd className="font-medium text-slate-700">{formatFileSize(fileMeta.size)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">类型</dt>
                <dd className="font-medium text-slate-700">{fileMeta.type || '-'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">请选择一张图片</p>
          )}
        </div>
      </div>
    </section>
  )
}
