import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register, TurnUsage } from 'claude-code'

import type { Totals } from '../types'

const PANE = 'cost-pane'
const KEEP_DAYS = 30
const ZERO: Totals = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }

const sidA = atom({ plugin: 'cost-pane', key: 'sid' } as const, '')
const lastUsdA = atom({ plugin: 'cost-pane', key: 'lastUsd' } as const, 0)
const sessionA = atom({ plugin: 'cost-pane', key: 'session' } as const, ZERO)
// this session's spend per day; the store holds the same under s:<sid>:<day>
const mineA = atom({ plugin: 'cost-pane', key: 'mine' } as const, {})
// every session's spend per day, summed from the store
const daysA = atom({ plugin: 'cost-pane', key: 'days' } as const, {})

// ponytail: fixed UTC+7 (Vietnam has no DST); use the host zone if you travel
export const dayOf = (ms: number) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10)

export const add = (t: Totals, usd: number, u?: TurnUsage): Totals => ({
  usd: t.usd + usd,
  input: t.input + (u?.input_tokens ?? 0),
  output: t.output + (u?.output_tokens ?? 0),
  cacheRead: t.cacheRead + (u?.cache_read_input_tokens ?? 0),
  cacheWrite: t.cacheWrite + (u?.cache_creation_input_tokens ?? 0),
  turns: t.turns + (u ? 1 : 0),
})

export const sum = (a: Totals, b: Totals): Totals => ({
  usd: a.usd + b.usd,
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  turns: a.turns + b.turns,
})

const tok = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

const money = (usd: number) => `$${usd.toFixed(2)}`

// share of input tokens served from the prompt cache
export const hitRate = (t: Totals) => {
  const all = t.input + t.cacheRead + t.cacheWrite
  return all ? Math.round((t.cacheRead / all) * 100) : 0
}

// one block per value, scaled to the largest; zero draws the lowest block
export const spark = (values: number[]) => {
  const max = Math.max(...values)
  return values.map(v => '▁▂▃▄▅▆▇█'[max > 0 ? Math.round((v / max) * 7) : 0]).join('')
}

export const bar = (value: number, max: number, width: number) =>
  max > 0 ? '█'.repeat(Math.max(value > 0 ? 1 : 0, Math.round((value / max) * width))) : ''

const usdNow = async ($: Engine) => (await $.session.usage()).cost?.usd ?? 0

// ponytail: reads every key each refresh; fine for ~30 days of sessions, index by day if it gets slow
async function refresh($: Engine) {
  const cutoff = dayOf((await $.clock.now()) - KEEP_DAYS * 86400e3)
  const days: Record<string, Totals> = {}
  for (const key of await $.store.keys()) {
    const day = key.slice(-10)
    if (!key.startsWith('s:')) continue
    if (day < cutoff) {
      await $.store.delete(key)
      continue
    }
    days[day] = sum(days[day] ?? ZERO, ((await $.store.get(key)) as Totals) ?? ZERO)
  }
  await update($, daysA, () => days)
  const session = await read($, sessionA)
  const now = await $.clock.now()
  const week = [6, 5, 4, 3, 2, 1, 0].map(i => days[dayOf(now - i * 86400e3)]?.usd ?? 0)
  $.ui.status(
    `💸 ${money(session.usd)} session · ${money(week[6] ?? 0)} today · 7d ${spark(week)} ${money(week.reduce((a, b) => a + b, 0))}`,
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cost-pane', description: 'Show token and USD spend in a pane' })

    const sid = await $.session.id()
    if ((await read($, sidA)) !== sid) {
      // new session, /clear or a resume: keep what the store already has for this id
      const mine: Record<string, Totals> = {}
      for (const key of await $.store.keys())
        if (key.startsWith(`s:${sid}:`)) mine[key.slice(-10)] = (await $.store.get(key)) as Totals
      await update($, sidA, () => sid)
      await update($, mineA, () => mine)
      await update($, sessionA, () => Object.values(mine).reduce(sum, ZERO))
      const usd = await usdNow($)
      await update($, lastUsdA, () => usd)
    }

    await refresh($)
    $.clock.every(60_000, () => refresh($)) // picks up other sessions' spend

    return next(e)
  })

  on('command.run', { command: 'cost-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Cost' })

    return { text: 'Cost pane opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    const usd = await usdNow($)
    let delta = 0
    await update($, lastUsdA, last => {
      delta = Math.max(0, usd - last) // a ledger that restarted counts from zero
      return Math.max(usd, last)
    })
    const day = dayOf(await $.clock.now())
    const sid = await read($, sidA)
    await update($, sessionA, t => add(t, delta, e.usage))
    await update($, mineA, m => ({ ...m, [day]: add(m[day] ?? ZERO, delta, e.usage) }))
    await $.store.set(`s:${sid}:${day}`, (await read($, mineA))[day])
    await refresh($)

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const session = await read($, sessionA)
    const days = await read($, daysA)
    const now = await $.clock.now()
    const today = dayOf(now)
    const week = [...Array(7).keys()].map(i => {
      const d = dayOf(now - i * 86400e3)
      return [d, days[d] ?? ZERO] as const
    })
    const weekTotal = week.map(([, t]) => t).reduce(sum, ZERO)
    const month = Object.values(days).reduce(sum, ZERO)
    const max = Math.max(...week.map(([, t]) => t.usd))
    const cols = e.viewport?.columns ?? 60
    const barWidth = Math.max(4, Math.min(24, cols - 22))

    const Row = ({ title, t }: { title: string; t: Totals }) => (
      <Text>
        <Text dimColor>{title.padEnd(8)}</Text>
        <Text bold color="green">{money(t.usd).padStart(8)}</Text>
        <Text dimColor>
          {'  '}↑{tok(t.input + t.cacheRead + t.cacheWrite)} ↓{tok(t.output)} · {t.turns}t · cache {hitRate(t)}%
        </Text>
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Row title="session" t={session} />
        <Row title="today" t={days[today] ?? ZERO} />
        <Box flexDirection="column" marginTop={1}>
          {week.map(([d, t]) => (
            <Box flexDirection="row" gap={1}>
              <Text bold={d === today} dimColor={d !== today}>{d.slice(5)}</Text>
              <Box width={barWidth}>
                <Text color={d === today ? 'green' : 'cyan'}>{bar(t.usd, max, barWidth)}</Text>
              </Box>
              <Text bold={d === today}>{money(t.usd).padStart(8)}</Text>
            </Box>
          ))}
        </Box>
        <Box flexDirection="row" gap={3}>
          <Text>
            <Text dimColor>7d </Text>
            <Text bold>{money(weekTotal.usd)}</Text>
          </Text>
          <Text>
            <Text dimColor>{KEEP_DAYS}d </Text>
            <Text bold>{money(month.usd)}</Text>
          </Text>
          <Text>
            <Text dimColor>avg/day </Text>
            <Text bold>{money(weekTotal.usd / 7)}</Text>
          </Text>
        </Box>
      </Box>
    )
  })
}
