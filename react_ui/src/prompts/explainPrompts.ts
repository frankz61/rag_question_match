import type { ExplainBranch } from '@/types/pipeline'

interface ExplainPromptBaseInput {
  reviewText: string
  top1Score?: number
  threshold: number
}

interface HighMatchPromptInput extends ExplainPromptBaseInput {
  top1TextPreview: string
}

export interface ExplainPromptPlan {
  branch: ExplainBranch
  prompt: string
}

const OUTPUT_FORMAT_REQUIREMENT = `请严格使用以下 Markdown 结构输出：
## 题目识别
## 正确答案
## 详细解析
## 易错点
## 最终结论`

const formatScore = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A'
  }
  return value.toFixed(6)
}

const sanitizeText = (value: string): string => value.trim() || '（无可用文本）'

export const buildHighMatchPrompt = (input: HighMatchPromptInput): string => `你是一名严谨的中学题目讲解老师。请基于题目文本和高匹配检索上下文给出答案与讲解。

【题目文本】
${sanitizeText(input.reviewText)}

【检索上下文（Top1）】
${sanitizeText(input.top1TextPreview)}

【匹配信息】
Top1 分数: ${formatScore(input.top1Score)}
阈值: ${input.threshold.toFixed(3)}
当前判断: 高匹配（可重点参考检索上下文）

【任务要求】
1. 不要凭空编造未提供的题干或选项。
2. 如果题目信息不完整，明确指出缺失信息。
3. 先给出明确答案，再给出条理化讲解。
4. 语言简洁，避免冗余。

${OUTPUT_FORMAT_REQUIREMENT}`

export const buildLowMatchPrompt = (input: ExplainPromptBaseInput): string => `你是一名严谨的中学题目讲解老师。当前检索匹配度偏低，请以图片识别到的内容为主完成答题与讲解。

【题目文本（可能不完整）】
${sanitizeText(input.reviewText)}

【匹配信息】
Top1 分数: ${formatScore(input.top1Score)}
阈值: ${input.threshold.toFixed(3)}
当前判断: 低匹配（必须以图片识别为准，检索仅作弱参考）

【任务要求】
1. 先准确识别图片中的题目，再进行作答和分析。
2. 若题目信息缺失或模糊，请明确说明不确定性。
3. 不要编造不存在的选项或条件。
4. 先给出明确答案，再解释依据。

${OUTPUT_FORMAT_REQUIREMENT}`

export const buildExplainPromptPlan = (input: {
  reviewText: string
  top1Score?: number
  top1TextPreview?: string
  threshold: number
}): ExplainPromptPlan => {
  const hasHighMatch =
    typeof input.top1Score === 'number' &&
    input.top1Score >= input.threshold &&
    Boolean(input.top1TextPreview?.trim())

  if (hasHighMatch) {
    return {
      branch: 'high_match_context',
      prompt: buildHighMatchPrompt({
        reviewText: input.reviewText,
        top1Score: input.top1Score,
        threshold: input.threshold,
        top1TextPreview: input.top1TextPreview as string,
      }),
    }
  }

  return {
    branch: 'low_match_image',
    prompt: buildLowMatchPrompt({
      reviewText: input.reviewText,
      top1Score: input.top1Score,
      threshold: input.threshold,
    }),
  }
}
