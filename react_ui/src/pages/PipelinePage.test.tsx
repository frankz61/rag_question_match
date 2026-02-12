import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PipelinePage from '@/pages/PipelinePage'
import type { OcrResponse, RagResponse } from '@/types/api'
import type { HttpAuditSnapshot } from '@/types/pipeline'

const callOcrMock = vi.fn()
const callRagMock = vi.fn()
const callVisionExplainMock = vi.fn()

vi.mock('@/services/api', () => ({
  callOcr: (...args: unknown[]) => callOcrMock(...args),
  callRag: (...args: unknown[]) => callRagMock(...args),
  callVisionExplain: (...args: unknown[]) => callVisionExplainMock(...args),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'request error',
  getErrorAudit: () => undefined,
}))

const mockAudit: HttpAuditSnapshot = {
  startedAt: '2026-02-12T00:00:00.000Z',
  endedAt: '2026-02-12T00:00:00.200Z',
  durationMs: 200,
  request: {
    method: 'POST',
    url: '/mock',
    headers: {},
    body: {},
  },
  response: {
    status: 200,
    body: {},
  },
}

const mockOcrData: OcrResponse = {
  filename: 'sample.png',
  text: 'OCR 原始文本',
}

const highScoreRagData: RagResponse = {
  question: '修正后的文本',
  top_k: 5,
  result_count: 1,
  results: [
    {
      rank: 1,
      score: 0.889,
      text_preview: 'result-preview',
      metadata: { paper_id: 'p1' },
    },
  ],
}

const lowScoreRagData: RagResponse = {
  question: '修正后的文本',
  top_k: 5,
  result_count: 1,
  results: [
    {
      rank: 1,
      score: 0.01,
      text_preview: 'weak-result-preview',
      metadata: { paper_id: 'p1' },
    },
  ],
}

describe('PipelinePage', () => {
  beforeEach(() => {
    callOcrMock.mockReset()
    callRagMock.mockReset()
    callVisionExplainMock.mockReset()
    callOcrMock.mockResolvedValue({ data: mockOcrData, audit: mockAudit })
    callRagMock.mockResolvedValue({ data: highScoreRagData, audit: mockAudit })
    callVisionExplainMock.mockResolvedValue({
      data: {
        text: '## 题目识别\n内容A',
      },
      audit: mockAudit,
    })
  })

  it('runs high-match explain branch without image', async () => {
    const user = userEvent.setup()
    render(<PipelinePage />)

    const uploadInput = screen.getByLabelText('上传图片文件')
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await user.click(screen.getByRole('button', { name: '执行OCR' }))
    await waitFor(() => expect(callOcrMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByDisplayValue('OCR 原始文本')).toBeTruthy()

    const textArea = screen.getByPlaceholderText(
      'OCR返回后可在此修正错别字，再进入检索。',
    )
    await user.clear(textArea)
    await user.type(textArea, '修正后的文本')
    await user.click(screen.getByRole('button', { name: '确认审核文本' }))

    await user.click(screen.getByRole('button', { name: '执行检索' }))
    await waitFor(() => expect(callRagMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '生成试题讲解' }))
    await waitFor(() => expect(callVisionExplainMock).toHaveBeenCalledTimes(1))

    const payload = callVisionExplainMock.mock.calls[0][0] as {
      prompt: string
      model: string
      image?: File
    }
    expect(payload.model).toBe('qwen-vl-max')
    expect(payload.image).toBeUndefined()
    expect(payload.prompt).toContain('高匹配')
    expect(await screen.findByText('题目识别')).toBeTruthy()
  })

  it('runs low-match explain branch with image', async () => {
    callRagMock.mockResolvedValueOnce({ data: lowScoreRagData, audit: mockAudit })

    const user = userEvent.setup()
    render(<PipelinePage />)

    const uploadInput = screen.getByLabelText('上传图片文件')
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await user.click(screen.getByRole('button', { name: '执行OCR' }))
    await waitFor(() => expect(callOcrMock).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: '确认审核文本' }))

    await user.click(screen.getByRole('button', { name: '执行检索' }))
    await waitFor(() => expect(callRagMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '生成试题讲解' }))
    await waitFor(() => expect(callVisionExplainMock).toHaveBeenCalledTimes(1))

    const payload = callVisionExplainMock.mock.calls[0][0] as {
      prompt: string
      model: string
      image?: File
    }
    expect(payload.image).toBeInstanceOf(File)
    expect((payload.image as File).name).toBe('sample.png')
    expect(payload.prompt).toContain('低匹配')
  })

  it('rebuilds prompt when threshold changes', async () => {
    const user = userEvent.setup()
    render(<PipelinePage />)

    const uploadInput = screen.getByLabelText('上传图片文件')
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await user.click(screen.getByRole('button', { name: '执行OCR' }))
    await waitFor(() => expect(callOcrMock).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: '确认审核文本' }))
    await user.click(screen.getByRole('button', { name: '执行检索' }))
    await waitFor(() => expect(callRagMock).toHaveBeenCalledTimes(1))

    const promptArea = screen.getByPlaceholderText(
      '检索完成后会自动生成提示词。',
    ) as HTMLTextAreaElement
    expect(promptArea.value).toContain('高匹配')

    const thresholdInput = screen.getByLabelText('匹配阈值（0 - 1）')
    await user.clear(thresholdInput)
    await user.type(thresholdInput, '0.95')

    expect(promptArea.value).toContain('低匹配')
  })

  it('blocks rag call when top_k is invalid', async () => {
    const user = userEvent.setup()
    render(<PipelinePage />)

    const uploadInput = screen.getByLabelText('上传图片文件')
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await user.click(screen.getByRole('button', { name: '执行OCR' }))
    await waitFor(() => expect(callOcrMock).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: '确认审核文本' }))

    const topKInput = screen.getByLabelText('top_k')
    await user.clear(topKInput)
    await user.type(topKInput, '30')
    await user.click(screen.getByRole('button', { name: '执行检索' }))

    expect(callRagMock).toHaveBeenCalledTimes(0)
    expect(screen.getByText('top_k 必须是 1 到 20 的整数。')).toBeTruthy()
  })
})
