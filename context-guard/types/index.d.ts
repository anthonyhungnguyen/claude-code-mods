export type Percent = number

declare module 'claude-code' {
  interface PluginState {
    'context-guard': { warned: boolean }
  }
}
