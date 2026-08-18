import { formatGeminiContents } from './model.providers'

describe('formatGeminiContents', () => {
  it('keeps tool calls as functionCall / functionResponse, not plain text', () => {
    const contents = formatGeminiContents([
      { role: 'system', content: 'You are SPLARO Command' },
      { role: 'user', content: 'low stock?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_low_stock', arguments: { limit: 5 } }],
      },
      { role: 'tool', name: 'get_low_stock', toolCallId: 'c1', content: '3 SKUs' },
    ])

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'low stock?' }] },
      {
        role: 'model',
        parts: [{ functionCall: { name: 'get_low_stock', args: { limit: 5 } } }],
      },
      {
        role: 'user',
        parts: [{ functionResponse: { name: 'get_low_stock', response: { result: '3 SKUs' } } }],
      },
    ])
  })
})
