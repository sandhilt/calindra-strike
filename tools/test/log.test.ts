import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../mcp/log.ts';
import { createMcpServer, result, failure } from '../mcp/jsonrpc.ts';

const at = () => new Date('2026-11-17T12:00:00.000Z');

it('writes the server log line shape: ISO timestamp, then the arguments', () => {
  const lines: string[] = [];
  const log = createLog(true, (line) => lines.push(line), at);
  log('join', JSON.stringify('agent'), 'players=3');
  assert.deepEqual(lines, ['2026-11-17T12:00:00.000Z join "agent" players=3\n']);
});

it('writes nothing when the flag is off', () => {
  const lines: string[] = [];
  const log = createLog(false, (line) => lines.push(line), at);
  log('join', 'agent');
  assert.deepEqual(lines, []);
});

it('logs every tool call with its outcome', async () => {
  const lines: string[] = [];
  const server = createMcpServer({
    info: { name: 't', version: '1' },
    log: createLog(true, (line) => lines.push(line), at),
    tools: [
      { name: 'fine', description: '', inputSchema: {}, call: async () => result('ok') },
      { name: 'bad', description: '', inputSchema: {}, call: async () => failure('Not joined') },
      { name: 'boom', description: '', inputSchema: {}, call: async () => { throw new Error('exploded'); } },
    ],
  });
  for (const name of ['fine', 'bad', 'boom', 'missing']) {
    await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } }));
  }
  const rows = lines.map((line) => line.replace(/ \d+ms\n$/, ''));
  assert.deepEqual(rows, [
    '2026-11-17T12:00:00.000Z tool fine ok',
    '2026-11-17T12:00:00.000Z tool bad error "Not joined"',
    '2026-11-17T12:00:00.000Z tool boom error "exploded"',
    '2026-11-17T12:00:00.000Z tool missing error "Unknown tool"',
  ]);
});

it('answers a tool call whose name is not a string instead of throwing while logging it', async () => {
  const lines: string[] = [];
  const server = createMcpServer({ info: { name: 't', version: '1' }, tools: [], log: createLog(true, (line) => lines.push(line), at) });
  const reply = await server.handleLine('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":{"toString":null}}}');
  assert.equal(JSON.parse(reply ?? '').result.isError, true);
  assert.match(lines[0] ?? '', /tool \(invalid name\) error "Unknown tool"/);
});
