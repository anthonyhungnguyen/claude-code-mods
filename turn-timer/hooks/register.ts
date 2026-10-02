import type { Register } from 'claude-code'

const LONG_MS = 120_000

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || e.isAborted || e.durationMs < LONG_MS) return done

    const min = Math.round(e.durationMs / 60_000)
    const ok = e.reason === 'answer'
    $.ui.toast(`${ok ? 'Done' : 'Stopped'} after ${min} min`)
    // no synthesizer (Linux, a remote surface): the toast still shows
    void $.audio.speak(ok ? `Claude finished, ${min} minutes` : 'Claude stopped with an error').catch(() => {})
    return done
  })
}
