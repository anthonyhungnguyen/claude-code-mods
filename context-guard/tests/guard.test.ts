import { expect, test } from 'claude-code/testing'

import { nextWarned } from '../hooks/register'

test('warns once per climb past the threshold', () => {
  expect(nextWarned(50, false)).toEqual({ warned: false, toast: false })
  expect(nextWarned(82, false)).toEqual({ warned: true, toast: true })
  expect(nextWarned(90, true)).toEqual({ warned: true, toast: false })
  expect(nextWarned(30, true)).toEqual({ warned: false, toast: false })
})
