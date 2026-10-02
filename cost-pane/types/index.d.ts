export type Totals = {
  usd: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
}

declare module 'claude-code' {
  interface PluginState {
    'cost-pane': {
      sid: string
      lastUsd: number
      session: Totals
      mine: Record<string, Totals>
      days: Record<string, Totals>
    }
  }
}
