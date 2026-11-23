import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { toolDefinitions } from '../mcp/tools.ts';
async function freePort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const address = socket.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => socket.close((e) => (e ? reject(e) : resolve())));
  return address.port;
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 1000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}
test('stdio MCP plays against the real authoritative WebSocket server', { timeout: 14000 }, async (t) => {
  const port = await freePort(),
    origin = 'http://localhost:5173',
    url = `http://127.0.0.1:${port}`;
  let logs = '';
  const game = spawn(process.execPath, ['server/src/index.ts'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ALLOWED_ORIGINS: origin,
      WARMUP_MIN_PLAYERS: '1',
      BOT_FILL: '2',
      JOIN_CODE: '',
      GAME_MODES: 'ffa',
      GAME_MAPS: 'forja',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => stop(game));
  game.stdout?.on('data', (c) => {
    logs += String(c);
  });
  game.stderr?.on('data', (c) => {
    logs += String(c);
  });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url + '/status', { signal: AbortSignal.timeout(200) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    if (game.exitCode !== null) break;
    await delay(50);
  }
  assert.ok(ready, logs);
  const mcp = spawn(
    process.execPath,
    ['tools/mcp/index.ts', '--url', `ws://127.0.0.1:${port}/ws`, '--origin', origin],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  t.after(() => stop(mcp));
  let stderr = '';
  mcp.stderr.on('data', (c) => {
    stderr += String(c);
  });
  const received: Record<string, unknown>[] = [];
  const pending = new Map<
    number,
    { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }
  >();
  let invalid = '';
  createInterface({ input: mcp.stdout }).on('line', (line) => {
    try {
      const response = JSON.parse(line);
      assert.equal(response.jsonrpc, '2.0');
      received.push(response);
      pending.get(response.id)?.resolve(response);
      pending.delete(response.id);
    } catch {
      invalid += line;
    }
  });
  mcp.once('exit', () => {
    for (const p of pending.values()) p.reject(new Error(`MCP exited: ${stderr}`));
    pending.clear();
  });
  let id = 0;
  async function rpc(
    method: string,
    params: object = {},
  ): Promise<{ tools: unknown[]; isError?: boolean; content: { text: string }[] }> {
    const requestId = ++id;
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`RPC timed out: ${method} ${stderr}`));
      }, 8000);
      pending.set(requestId, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });
      mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    });
    assert.equal(response.error, undefined);
    return response.result as { tools: unknown[]; isError?: boolean; content: { text: string }[] };
  }
  async function tool(name: string, args: object = {}) {
    const r = await rpc('tools/call', { name, arguments: args });
    assert.notEqual(r.isError, true, JSON.stringify(r));
    return JSON.parse(r.content[0].text);
  }
  await rpc('initialize', { protocolVersion: '2025-06-18' });
  mcp.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  assert.equal((await rpc('tools/list')).tools.length, toolDefinitions.length);
  await tool('join', { name: 'mcp-integration' });
  await tool('hunt');
  await tool('radio', { menu: 'comandos', line: 1 });
  const before = await tool('wait', { ms: 500 });
  assert.partialDeepStrictEqual(before.chat.find((c: { radio?: boolean; name?: string }) => c.radio && c.name === 'mcp-integration'), { text: 'Me cobre!', name: 'mcp-integration' });
  const afterWait = await tool('wait', { ms: 3000 });
  assert.notDeepEqual(afterWait.you.pos, before.you.pos);
  assert.equal(afterWait.you.name, 'mcp-integration');
  assert.equal(afterWait.you.intent.kind, 'hunt');
  await tool('sprint', { on: true });
  await tool('lean', { side: 'left' });
  assert.partialDeepStrictEqual((await tool('get_state')).you.actions, { sprint: true, lean: 'left', prone: false });
  await tool('sprint', { on: false });
  await tool('lean', { side: 'off' });
  const state = await tool('get_state');
  assert.ok(['warmup', 'live', 'podium'].includes(state.phase));
  const status = (await (await fetch(url + '/status')).json()) as {
    players: number;
    bots: number;
    leaders: { name: string }[];
  };
  assert.equal(status.players, 1);
  assert.ok(status.leaders.some((p: { name: string }) => p.name === 'mcp-integration'));
  assert.ok(status.bots >= 1);
  assert.equal(invalid, '');
  assert.equal(received.length, id);
  mcp.stdin.end();
  await delay(100);
});
