export interface OcrResponse {
  filename: string
  text: string
}

export interface RagRequest {
  question: string
  top_k: number
}

export interface RagResultItem {
  rank: number
  score: number
  text_preview: string
  metadata: Record<string, string>
}

export interface RagResponse {
  question: string
  top_k: number
  result_count: number
  results: RagResultItem[]
}
