import { expect, mock, test } from 'claude-code/testing'

const USAGE = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 10, model: 'm' }
const TURN = { answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer', usage: USAGE } as const
const T1 = { usd: 1, input: 1, output: 1, cacheRead: 1, cacheWrite: 1, turns: 1 }

test('spend lands per session per VN day and sums across sessions', async ($, on) => {
  // 2026-10-01T18:00Z is already 10-02 in Vietnam
  mock.clock(on, { now: Date.parse('2026-10-01T18:00:00Z') })
  const store = new Map<string, unknown>([['s:OTHER:2026-10-02', T1], ['s:OLD:2026-08-01', T1]])
  on('store.keys', async () => ({ value: [...store.keys()] }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', async (_$, e) => (store.delete(e.key), { value: undefined }))
  let usd = 0.5 // already on the ledger before the mod loaded: not counted
  on('session.id', async () => ({ value: 'S1' }))
  on('session.usage', async () => ({ value: { cost: { usd } } }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: undefined }) as never)
  on('session.start', async () => ({}) as never)
  on('turn.complete', async () => ({}) as never)

  await $.session.start({ source: 'startup' } as never)
  usd = 1.25
  await $.turn.complete(TURN as never)
  usd = 2
  await $.turn.complete(TURN as never)

  expect(store.get('s:S1:2026-10-02')).toEqual({
    usd: 1.5, input: 200, output: 100, cacheRead: 2000, cacheWrite: 20, turns: 2,
  })
  expect(store.has('s:OLD:2026-08-01')).toBe(false) // pruned past 30 days
})
