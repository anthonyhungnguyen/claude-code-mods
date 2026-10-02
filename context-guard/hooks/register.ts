import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WARN_AT = 80
const warnedA = atom({ plugin: 'context-guard', key: 'warned' } as const, false)

// warn once per climb past WARN_AT; dropping back under (a compact, a /clear) re-arms it
export const nextWarned = (percent: number, warned: boolean) =>
  percent >= WARN_AT ? { warned: true, toast: !warned } : { warned: false, toast: false }

async function check($: EngineInterface) {
  const percent = Math.round((await $.session.usage()).context.percent ?? 0)
  $.ui.status(`🧠 ${percent}% context`)
  const { warned, toast } = nextWarned(percent, await read($, warnedA))
  await update($, warnedA, () => warned)
  if (toast) $.ui.toast(`Context at ${percent}%. Consider /compact before it auto-compacts.`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const done = await next(e)
    await check($)
    return done
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) await check($)
    return done
  })
}
