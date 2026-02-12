export const nowIso = (): string => new Date().toISOString()

export const formatDuration = (durationMs?: number): string => {
  if (durationMs === undefined) {
    return '-'
  }

  if (durationMs < 1000) {
    return `${durationMs.toFixed(0)} ms`
  }

  return `${(durationMs / 1000).toFixed(2)} s`
}
