interface JsonViewerProps {
  data: unknown
}

const jsonReplacer = (_: string, value: unknown): unknown => {
  if (value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    }
  }
  return value
}

export default function JsonViewer({ data }: JsonViewerProps) {
  const content =
    data === undefined ? 'undefined' : JSON.stringify(data, jsonReplacer, 2) ?? 'undefined'

  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
      {content}
    </pre>
  )
}
