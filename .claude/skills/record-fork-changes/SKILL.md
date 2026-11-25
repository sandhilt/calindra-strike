---
name: record-fork-changes
description: Keep FORK_CHANGES.md, the history of what this fork changed relative to upstream. Use whenever you change anything in this repository (code, config, docs, skills), before calling the change done or committing it, when syncing with upstream, and when asked what the fork changed.
---

# Record fork changes

`FORK_CHANGES.md` at the repo root is the history of this fork against `upstream`. Every change gets an entry in the same change, whichever agent or person makes it.

## Before you start a change

List the commits nobody recorded yet:

```bash
(
  since=$(sed -n 's/^- Covered through: `\([0-9a-f]*\)`.*/\1/p' FORK_CHANGES.md)
  git rev-parse -q --verify upstream/main >/dev/null || { echo "SCAN FAILED: no upstream/main, run git fetch upstream"; exit 1; }
  if ! git merge-base --is-ancestor "$since" HEAD 2>/dev/null; then
    echo "history was rewritten: scanning from the fork point, add only what the file does not say"
    since=$(git merge-base upstream/main HEAD)
  fi
  commits=$(git rev-list --reverse "$since"..HEAD --not upstream/main) || { echo "SCAN FAILED"; exit 1; }
  echo "$commits" | while read -r c; do
    [ -n "$c" ] || continue
    files=$(git show --format= --name-only "$c")
    [ -n "$files" ] || continue
    echo "$files" | grep -qx FORK_CHANGES.md || git log -1 --date=short --format='%h %ad %s' "$c"
  done
  echo "scan done"
)
```

A commit that touched the file is taken as recorded, and a merge shows up only when it changed files itself. For each listed commit, read its diff (`git show <hash>`) and add what is missing from the log under the commit's date. Then set `Covered through` to `git rev-parse --short HEAD`. Move it only after the scan printed `scan done` and every listed commit is described.

## With your change

Add a bullet under `## Log`, in a `### YYYY-MM-DD` heading for today (newest day first).

- Write in English, one bullet per change a reader would notice: behaviour, setting, protocol, tool, map, dependency or skill. Several commits for one thing share a bullet.
- Say what differs now and name the key file or setting. Leave how it works to `README.md` and `AGENTS.md`.
- A change that undoes or replaces an earlier entry gets its own bullet saying so. Leave old entries and the baseline as they are.
- Skip edits with no effect on the fork's behaviour or rules, such as typo fixes.
- The commit that carries your change should include `FORK_CHANGES.md`. Commit only when the user asks.

## Syncing with upstream

```bash
git fetch upstream
git log --date=short --format='%h %ad %an %s' HEAD..upstream/main
```

After a merge or rebase onto upstream, add a log bullet naming what came in and which fork changes upstream now has or that the merge dropped. Update `Upstream compared` to the new `upstream/main` commit.
