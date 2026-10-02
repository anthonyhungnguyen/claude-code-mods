# claude-code-mods

Mods for Claude Code, one folder each. A mod is a plugin of function hooks: panes, status lines, slash commands, tool guards.

| Mod | What it does |
| --- | --- |
| [cost-pane](cost-pane/) | Token and USD spend per session and per day, in the status line and a `/cost-pane` pane |

## Install

```sh
git clone git@github.com:anthonyhungnguyen/claude-code-mods.git ~/.claude/mods
```

List each mod folder you want in `~/.claude/settings.json`, separated by `:`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/cost-pane" } }
```

New sessions load them. Check a mod with `claude plugin validate ~/.claude/mods/<mod>`.
