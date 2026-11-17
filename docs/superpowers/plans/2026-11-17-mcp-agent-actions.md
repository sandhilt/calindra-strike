# MCP Agent Actions (jump, crouch, zoom) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let MCP agents jump, crouch and scope the AWP through three new tools, without touching `shared/` or the protocol.

**Architecture:** A small stateful overlay (`ActionOverlay`) rewrites the `Cmd` produced by the pilot, after `brain.think`, in `GameSession.tick`. The session owns the overlay, validates tool calls against the latest snapshot, and `renderView` reports the resulting state.

**Tech Stack:** Node >= 24 native TypeScript (erasable syntax only, `.ts` import extensions), `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-11-17-mcp-agent-actions-design.md`

## Global Constraints

- Node standard library only; no new dependencies.
- No `enum`, `namespace` or constructor parameter properties; no `any`, non-null `!` or type assertions outside tests.
- No change to `shared/`, the protocol or `PROTOCOL_VERSION`; no change to server bots or human play.
- No magic numbers: the zoom press cooldown is a named constant with its unit.
- Commit messages short, imperative, English. Do not commit or push unless the user asks.
- Run `node --run test` and `node --run typecheck` before finishing.

## Review Focus

- `jump` while airborne or dead: tool errors, never queues a late jump.
- Both cmds of one tick (`tick()` sends 2) must not emit two JUMP presses or two ATTACK2 edges.
- `crouch` must not survive death, respawn, leave or rejoin.
- `zoom` on a weapon without a scope errors; if the scope weapon is lost later the overlay goes inert (no ATTACK2 spam).
- `zoom` with stale snapshots must not overshoot the cycle 0 -> 1 -> 2 -> 0; during the AWP bolt (`resumeZoom > 0`) level 0 cancels the re-scope and a positive level waits.

---

## File Structure

- Create `tools/mcp/actions.ts`: `ActionOverlay`, the only place that knows how actions become buttons.
- Modify `tools/mcp/session.ts`: owns an overlay, applies it in `tick()`, new methods `jump()`, `setCrouch(on)`, `setZoom(level)`.
- Modify `tools/mcp/tools.ts`: tools `jump`, `crouch`, `zoom`; boolean arg helper.
- Modify `tools/mcp/view.ts`: `renderView` adds `you.ducked`, `you.onGround`, `you.zoom`, `you.maxZoom`, `you.actions`.
- Create `tools/test/actions.test.ts`; extend `tools/test/session.test.ts`; update the tool count in `tools/test/integration.test.ts:132` (12 -> 15).
- Docs: `skills/calindra-strike-navigation/SKILL.md`, `skills/calindra-strike-combat/SKILL.md`, README tool table (`README.md` ~line 76).

### Task 1: ActionOverlay

**Files:**
- Create: `tools/mcp/actions.ts`
- Test: `tools/test/actions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ZOOM_PRESS_COOLDOWN_CMDS = 12; // cmds (~100 ms at 2 cmds per 33 ms tick) to wait for a snapshot to show the last scope press
  export class ActionOverlay {
    crouch: boolean;            // latched
    zoom: number | null;        // null = leave the bot's auto-scope alone; 0 = forced off; 1..n = desired level
    requestJump(): void;        // pulses JUMP on the next apply() only
    reset(): void;              // clears crouch, zoom (to null), pending jump, cooldown and edge memory
    apply(cmd: Cmd, self: PlayerState | null): Cmd;  // returns a new Cmd, never mutates the input
  }
  ```

- [ ] **Step 1: Write failing tests in `tools/test/actions.test.ts`** (build a Cmd with `buttons: 0` and a `createPlayerState()` with `weapon: WEAPON.SNIPER`, `onGround: true`):
  - `crouch = true` sets `BTN.DUCK` on every apply, including with `self = null`; `crouch = false` keeps whatever DUCK the brain set.
  - `requestJump()` sets `BTN.JUMP` on exactly one apply (the second apply has no JUMP); it is dropped (no JUMP, nothing queued) when `self.onGround` is false.
  - `zoom = 1` with `self.zoom = 0`: first apply sets `BTN.ATTACK2`; the next `ZOOM_PRESS_COOLDOWN_CMDS` applies do not; after the cooldown, with `self.zoom` still 0, it presses again. With `self.zoom = 1` it never presses.
  - `zoom = 2` from `self.zoom = 1` presses once; `zoom = 0` from `self.zoom = 2` presses once (cycle wraps).
  - ATTACK2 is never emitted on consecutive applies (release between presses), so the server sees an edge each time.
  - `zoom !== null` strips an ATTACK2 coming from the brain; `zoom === null` leaves it.
  - Weapon without scope (`WEAPON.RIFLE`, `zoomFov: []`): `zoom = 1` emits no ATTACK2.
  - `self.resumeZoom > 0`: `zoom = 0` presses once (cancels re-scope), `zoom = 1` does not press.
  - `reset()` clears crouch, zoom and a pending jump.

- [ ] **Step 2: Run `node --test tools/test/actions.test.ts`; expect FAIL (module missing).**

- [ ] **Step 3: Implement `tools/mcp/actions.ts`.** Use `weaponDef(self.weapon).zoomFov.length` for scope capability and the constants from `shared`'s `BTN`. Keep `cooldown` and `lastButtons` private; a press is allowed only when the previous apply did not emit ATTACK2 and `cooldown === 0`.

- [ ] **Step 4: Run the test file; expect PASS.**

- [ ] **Step 5: Commit** `Add an action overlay for agent jump, crouch and zoom`.

### Task 2: Session, tools and state

**Files:**
- Modify: `tools/mcp/session.ts`, `tools/mcp/tools.ts`, `tools/mcp/view.ts`
- Test: `tools/test/session.test.ts`, `tools/test/integration.test.ts`

**Interfaces:**
- Consumes: `ActionOverlay` from Task 1.
- Produces on `GameSession`: `jump(): object`, `setCrouch(on: boolean): object`, `setZoom(level: number): object`; each returns `{ crouch, zoom }` (current overlay values) and throws `Error` with these exact messages: `'Not on the ground'`, `'No living player snapshot yet'`, `'Weapon has no scope'`, `'Zoom level out of range'` (level > `zoomFov.length`). Tool names: `jump` (no args), `crouch` (`{ on: boolean }`, required), `zoom` (`{ level: integer 0..2 }`, required). `renderView(v, intent, actions?: { crouch: boolean; zoom: number | null })`.

- [ ] **Step 1: Write failing tests in `tools/test/session.test.ts`**, reusing its `setup()`/`Socket`/welcome-snapshot helpers:
  - `crouch {on:true}` then running the tick job: the sent `in` packet's decoded cmds have `BTN.DUCK`, also with intent `idle`; `on:false` clears it.
  - `jump` with snapshot `onGround` true: exactly one cmd across the next tick has `BTN.JUMP`; with `onGround` false: tool result is an error `'Not on the ground'`.
  - `zoom {level:1}` with an AWP snapshot presses ATTACK2 once; with a rifle snapshot errors `'Weapon has no scope'`; `level: 3` fails strict arg validation (schema max 2).
  - Dead snapshot (`me` null / health 0) resets crouch and zoom: after a respawn snapshot no DUCK is emitted.
  - `get_state` `you` includes `ducked`, `onGround`, `zoom`, `maxZoom` (2 for AWP, 0 for rifle) and `actions`.
  - Update the tool count assertion in `integration.test.ts` to 15.

- [ ] **Step 2: Run `node --test tools/test/session.test.ts`; expect FAIL.**

- [ ] **Step 3: Implement.** `session.ts`: field `private readonly actions = new ActionOverlay()`; in `tick()`, after `pilot.nextCmd`, map each cmd through `this.actions.apply(cmd, view.self)`; call `actions.reset()` when `view.self` is null or has `health <= 0`, on `close()`, and on a new `welcome`. The three methods validate against `view.self` as listed above, then mutate the overlay. `tools.ts`: add a `boolean(a, k)` helper next to `number`/`string` that throws `Invalid <k>`. `view.ts`: add the fields to `you` (`maxZoom` from `weaponDef(s.weapon).zoomFov.length`); `getState` passes the overlay values.

- [ ] **Step 4: Run `node --run test`; expect all PASS.**

- [ ] **Step 5: Commit** `Expose jump, crouch and zoom as MCP tools`.

### Task 3: Docs

**Files:**
- Modify: `skills/calindra-strike-navigation/SKILL.md`, `skills/calindra-strike-combat/SKILL.md`, `README.md`

- [ ] **Step 1:** README tool table gets one row: `jump` / `crouch` / `zoom` with a one-line description each (latched vs pulse, AWP only, levels 0-2, zoom overrides the bot's auto-scope once set).
- [ ] **Step 2:** navigation skill: when `jump`/`crouch` help (ledges, stuck handling, low cover); combat skill: crouch lowers the hitbox and spread, AWP zoom levels, scoped speed 150 vs 250, scope drops during the bolt cycle and returns by itself. Keep the existing tone and length of each file.
- [ ] **Step 3:** Run `node --run test` and `node --run typecheck`; expect PASS.
- [ ] **Step 4: Commit** `Document jump, crouch and zoom for agents`.

## Self-Review

- Spec coverage: jump (T1/T2), crouch latched + reset + idle (T1/T2), zoom guards + override (T1/T2), get_state fields (T2), skills/README (T3), tests (T1/T2). No gaps.
- Calls I made beyond the spec: zoom stays manually controlled once set (no "back to auto" value, YAGNI); a lost scope weapon makes the overlay inert rather than clearing it; cooldown of 12 cmds.
