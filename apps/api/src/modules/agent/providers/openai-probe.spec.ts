import { probeOpenAiKey } from './openai-models'

/** Long enough to clear usableAiSecret, shaped like a project key. */
const projectKey = () => `sk-proj-not-a-real-secret-for-tests`

type FetchArgs = Parameters<typeof fetch>

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = []
  const impl = jest.fn(async (...args: FetchArgs) => {
    const url = String(args[0])
    calls.push(url)
    return handler(url, args[1] as RequestInit | undefined)
  })
  global.fetch = impl as unknown as typeof fetch
  return { calls }
}

const listRefused = (body: string, status = 401) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } })

const chatOk = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 })

describe('probeOpenAiKey', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
    jest.restoreAllMocks()
  })

  it('accepts a key that may not list models but can chat', async () => {
    // A restricted sk-proj- key: no api.model.read scope, chat works fine.
    const { calls } = mockFetch((url) =>
      url.includes('/v1/models')
        ? listRefused('{"error":{"message":"Missing scopes: api.model.read","code":"insufficient_permissions"}}')
        : chatOk(),
    )

    await expect(probeOpenAiKey(projectKey())).resolves.toBeUndefined()
    expect(calls.some((u) => u.includes('/v1/chat/completions'))).toBe(true)
  })

  it('rejects a key OpenAI calls invalid without a second call', async () => {
    const { calls } = mockFetch(() =>
      listRefused('{"error":{"message":"Incorrect API key provided","code":"invalid_api_key"}}'),
    )

    await expect(probeOpenAiKey(projectKey())).rejects.toThrow(/401/)
    expect(calls.some((u) => u.includes('/v1/chat/completions'))).toBe(false)
  })

  it('rejects when the fallback chat call also fails', async () => {
    mockFetch((url) =>
      url.includes('/v1/models')
        ? listRefused('{"error":{"message":"Missing scopes"}}')
        : listRefused('{"error":{"message":"Incorrect API key provided"}}'),
    )

    await expect(probeOpenAiKey(projectKey())).rejects.toThrow(/key check failed|invalid/i)
  })

  it('accepts a key that can list models', async () => {
    const { calls } = mockFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await expect(probeOpenAiKey(projectKey())).resolves.toBeUndefined()
    expect(calls).toHaveLength(1)
  })

  it('refuses a placeholder before touching the network', async () => {
    const { calls } = mockFetch(() => chatOk())

    await expect(probeOpenAiKey('sk-your-key-here')).rejects.toThrow(/placeholder|empty/i)
    expect(calls).toHaveLength(0)
  })
})
