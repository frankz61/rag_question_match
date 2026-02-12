import type { FileMeta } from '@/types/pipeline'

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

export const toFileMeta = (file: File): FileMeta => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
})

export const validateImageFile = (
  file: File,
  maxSizeBytes: number = MAX_IMAGE_SIZE_BYTES,
): string | null => {
  if (!file.type.startsWith('image/')) {
    return '仅支持上传图片文件。'
  }

  if (file.size > maxSizeBytes) {
    return `图片大小不能超过 ${formatFileSize(maxSizeBytes)}。`
  }

  return null
}

export const createPreviewUrl = (file: File): string => URL.createObjectURL(file)

export const revokePreviewUrl = (url: string | null): void => {
  if (!url) {
    return
  }
  URL.revokeObjectURL(url)
}
