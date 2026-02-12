import MockAdapter from 'axios-mock-adapter'
import { describe, expect, it, afterEach } from 'vitest'
import { callOcr, callRag } from '@/services/api'
import httpClient, { HttpClientError } from '@/services/httpClient'

const mock = new MockAdapter(httpClient)

afterEach(() => {
  mock.reset()
})

describe('api service', () => {
  it('sends multipart form data to OCR endpoint', async () => {
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })

    mock.onPost('/api/ocr/image').reply((config) => {
      expect(config.data).toBeInstanceOf(FormData)
      return [
        200,
        {
          filename: 'sample.png',
          text: '识别成功',
        },
      ]
    })

    const result = await callOcr(file)
    expect(result.data.filename).toBe('sample.png')
    expect(result.audit.request.method).toBe('POST')
    expect(result.audit.response?.status).toBe(200)
  })

  it('sends JSON payload to RAG endpoint', async () => {
    mock.onPost('/api/rag/v1/query/search').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({
        question: 'test question',
        top_k: 3,
      })
      return [
        200,
        {
          question: 'test question',
          top_k: 3,
          result_count: 1,
          results: [
            {
              rank: 1,
              score: 0.99,
              text_preview: 'preview',
              metadata: {
                paper_id: '1',
              },
            },
          ],
        },
      ]
    })

    const result = await callRag({ question: 'test question', top_k: 3 })
    expect(result.data.result_count).toBe(1)
    expect(result.audit.request.url).toBe('/api/rag/v1/query/search')
  })

  it('normalizes HTTP error with status and audit', async () => {
    const file = new File(['image-binary'], 'sample.png', { type: 'image/png' })
    mock.onPost('/api/ocr/image').reply(500, { detail: 'ocr error' })

    await expect(callOcr(file)).rejects.toBeInstanceOf(HttpClientError)
    try {
      await callOcr(file)
    } catch (error) {
      const normalizedError = error as HttpClientError
      expect(normalizedError.status).toBe(500)
      expect(normalizedError.audit.response?.status).toBe(500)
      expect(normalizedError.audit.error?.message).toBeTruthy()
    }
  })

  it('normalizes timeout error', async () => {
    mock.onPost('/api/rag/v1/query/search').timeout()

    await expect(
      callRag({
        question: 'timeout case',
        top_k: 5,
      }),
    ).rejects.toBeInstanceOf(HttpClientError)
  })
})
