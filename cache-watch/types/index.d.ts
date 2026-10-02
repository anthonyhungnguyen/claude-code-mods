export type Millis = number

declare module 'claude-code' {
  interface PluginState {
    'cache-watch': { lastEnd: Millis; lastModel: string; lastUsd: number }
  }
}
