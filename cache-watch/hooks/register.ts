import { atom, read, update } from 'claude-code'
import type { ModelUsage, Register } from 'claude-code'

const MIN_REBUILD = 20_000
const lastEndA = atom({ plugin: 'cache-watch', key: 'lastEnd' } as const, 0)
const lastModelA = atom({ plugin: 'cache-watch', key: 'lastModel' } as const, '')
const lastUsdA = atom({ plugin: 'cache-watch', key: 'lastUsd' } as const, 0)

// a rebuild writes most of the prompt to the cache instead of reading it back;
// normal turns only write the few new messages
export const isRebuild = (u: ModelUsage) =>
  u.cache_creation_input_tokens >= MIN_REBUILD &&
  u.cache_creation_input_tokens > u.cache_read_input_tokens

const tok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const done = await next(e)
    const usd = (await $.session.usage()).cost?.usd ?? 0
    await update($, lastUsdA, last => Math.max(last, usd))
    return done
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || !e.usage) return done

    const now = await $.clock.now()
    const usd = (await $.session.usage()).cost?.usd ?? 0
    let turnUsd = 0
    await update($, lastUsdA, last => ((turnUsd = Math.max(0, usd - last)), Math.max(usd, last)))
    const lastEnd = await read($, lastEndA)
    const lastModel = await read($, lastModelA)
    await update($, lastEndA, () => now)
    await update($, lastModelA, () => e.usage?.model ?? '')

    if (isRebuild(e.usage)) {
      // gap between the last turn's end and this turn's start
      const idleMin = lastEnd ? Math.round((now - e.durationMs - lastEnd) / 60_000) : 0
      const cause =
        lastModel && lastModel !== e.usage.model ? 'model changed'
        : idleMin >= 5 ? `idle ${idleMin}m`
        : lastEnd ? 'cause unknown'
        : 'first turn'
      $.ui.toast(
        `Cache rebuilt: ${tok(e.usage.cache_creation_input_tokens)} tokens written (${cause}), turn cost $${turnUsd.toFixed(2)}`,
      )
    }
    return done
  })
}
