---
name: bump-calindra-strike-mcp
description: Use after ANY change to the Calindra Strike MCP server (tools/mcp/**, or code it imports from shared/src and server/src such as bot.ts and nav.ts) and before calling the work done. The MCP is consumed from GitHub pinned to a commit in the user's nix-shared home-manager config, so the pin must be bumped or no harness sees the change.
---

# Bump the Calindra Strike MCP pin

The user's harnesses (Claude Code, Codex, OpenCode, Gemini/Antigravity, Cursor) do not run this working tree. They run the MCP fetched from GitHub (`sandhilt/calindra-strike`) at a fixed commit, declared in:

`~/.dotfiles/.config/nix-shared/home/ai-tools.nix` (`calindraStrikeSrc`: `rev` and `hash`)

So a change to the MCP is invisible until that pin moves. Treat the bump as part of finishing the change.

## When it applies

Any change that alters what the MCP server does: `tools/mcp/**`, plus files it imports (`shared/src/**`, `server/src/bot.ts`, `server/src/nav.ts`). Docs-only, client-only and server-only changes that the MCP does not import do not need it.

## Steps

1. Commit and push to `origin/main` of `sandhilt/calindra-strike`. Do not push or commit without the user's permission. If they have not allowed it, stop here and tell them the pin still needs a bump after the push.
2. Get the pushed commit and confirm GitHub has it:
   ```bash
   REV=$(git rev-parse HEAD)
   git ls-remote https://github.com/sandhilt/calindra-strike refs/heads/main   # must show $REV
   ```
3. Compute the hash:
   ```bash
   H=$(nix-prefetch-url --unpack --type sha256 "https://github.com/sandhilt/calindra-strike/archive/$REV.tar.gz")
   nix hash convert --hash-algo sha256 --to sri "$H"
   ```
4. Replace `rev` and `hash` in `calindraStrikeSrc` in `ai-tools.nix` with the new values.
5. Check it evaluates and fetches (from `~/.dotfiles/.config/nixos`):
   ```bash
   nix eval --json '.#nixosConfigurations.nixos.config.home-manager.users.sandhilt' \
     --apply 'c: c.programs.mcp.servers.calindra-strike.args'
   ```
   The first arg must point at a `/nix/store/...-source/tools/mcp/launch.ts`.
6. Tell the user to run the home-manager switch and restart open sessions. Do not run the switch yourself unless asked.

## New or renamed MCP tools

The Codex approvals are a list in the same file (`calindraStrikeTools`, mirroring the tool names in `tools/mcp/tools.ts`). If the change adds, removes or renames a tool, update that list in the same edit, otherwise Codex asks for approval on the new tool again.

## Testing without pushing

To try a local change before pushing, set `useLocalClone = true` in the same file (it points the MCP at `~/workspace/calindra-strike`), switch, test, then set it back to `false` and do the steps above once the change is pushed.

## Notes

- The Cursor config (`~/.cursor/mcp.json`) is generated from the same value, so one bump covers every harness.
- This repo's own `.mcp.json` and `opencode.json` are separate (the plugin and project-level configs) and are not affected by the pin.
