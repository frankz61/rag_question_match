import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PipelinePage from '@/pages/PipelinePage'
import type { OcrResponse, RagResponse } from '@/types/api'
import type { HttpAuditSnapshot } from '@/types/pipeline'

const callOcrMock = vi.fn()
const callRagMock = vi.fn()

vi.mock('@/services/api', () => ({
  callOcr: (...args: unknown[]) => callOcrMock(...args),
  callRag: (...args: unknown[]) => callRagMock(...args),
  getErrorMessage: () => 'request error',
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

const mockRagData: RagResponse = {
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

describe('PipelinePage', () => {
  beforeEach(() => {
    callOcrMock.mockReset()
    callRagMock.mockReset()
    callOcrMock.mockResolvedValue({ data: mockOcrData, audit: mockAudit })
    callRagMock.mockResolvedValue({ data: mockRagData, audit: mockAudit })
  })

  it('runs upload -> OCR -> review -> RAG pipeline', async () => {
    const user = userEvent.setup()
    render(<PipelinePage />)

    const uploadInput = screen.getByLabelText('上传图片文件')
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await user.click(screen.getByRole('button', { name: '执行OCR' }))
    await waitFor(() => expect(callOcrMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByDisplayValue('OCR 原始文本')).toBeTruthy()

    const textArea = screen.getByPlaceholderText('OCR返回后可在此修正错别字，再进入检索。')
    await user.clear(textArea)
    await user.type(textArea, '修正后的文本')
    await user.click(screen.getByRole('button', { name: '确认审核文本' }))

    await user.click(screen.getByRole('button', { name: '执行检索' }))
    await waitFor(() => expect(callRagMock).toHaveBeenCalledTimes(1))
    expect(callRagMock).toHaveBeenCalledWith({
      question: '修正后的文本',
      top_k: 5,
    })
    expect(await screen.findByText('result-preview')).toBeTruthy()
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
