import { expect, test } from 'claude-code/testing'

import { isRebuild } from '../hooks/register'

const u = (read: number, write: number) => ({
  input_tokens: 10, output_tokens: 10, cache_read_input_tokens: read, cache_creation_input_tokens: write,
})

test('flags a turn that rewrote most of its prompt', () => {
  expect(isRebuild(u(150_000, 3_000))).toBe(false) // normal turn
  expect(isRebuild(u(0, 140_000))).toBe(true) // expired cache
  expect(isRebuild(u(1_000, 8_000))).toBe(false) // small session, not worth a toast
})
