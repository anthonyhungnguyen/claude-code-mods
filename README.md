# cost-pane

A Claude Code mod that tracks token and USD spend per session and per day, kept across sessions.

```
💸 $1.23 session · $5.67 today · 7d ▁▃▂▅▇▄█ $12.34
```

The status line shows the line above. `/cost-pane` opens a pane with token counts, cache hit rate and one bar per day for the last 7 days.

## Install

```sh
git clone git@github.com:anthonyhungnguyen/claude-cost-pane.git ~/.claude/mods/cost-pane
```

Add the folder to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/cost-pane" } }
```

New sessions load it.

## How it counts

- USD is what `/cost` reports, counted per turn from the moment the mod loads.
- Each session writes its own `s:<session-id>:<day>` key to the plugin store (`~/.claude/plugins/store/cost-pane_inline-*.json`). Daily totals sum every session; keys older than 30 days are pruned.
- Days are Vietnam time (UTC+7), set in `dayOf` in `hooks/register.tsx`.
