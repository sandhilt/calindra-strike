import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the launcher runs from a copy that has no node_modules', () => {
  const copy = mkdtempSync(join(tmpdir(), 'calindra-strike-launch-'));
  try {
    cpSync('shared/src', join(copy, 'shared/src'), { recursive: true });
    cpSync('server/src', join(copy, 'server/src'), { recursive: true });
    cpSync('tools/mcp', join(copy, 'tools/mcp'), { recursive: true });
    const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    const run = spawnSync(process.execPath, ['tools/mcp/launch.ts'], { cwd: copy, input: request + '\n', encoding: 'utf8', timeout: 10_000 });
    const reply = JSON.parse(run.stdout.split('\n')[0]);
    assert.equal(reply.result.serverInfo.name, 'calindra-strike');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
