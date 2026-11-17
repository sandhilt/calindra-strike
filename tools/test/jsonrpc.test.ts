import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer, result } from '../mcp/jsonrpc.ts';
test('MCP dispatches initialization, tools, ping, errors and notifications', async () => {
  const server = createMcpServer({
    info: { name: 'test', version: '1' },
    tools: [{ name: 'echo', description: 'echo', inputSchema: {}, call: async (a) => result(a) }],
  });
  const call = async (method: string, params: object = {}) =>
    JSON.parse((await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })))!);
  for (const protocolVersion of ['2024-11-05', '2025-03-26', '2025-06-18'])
    assert.equal((await call('initialize', { protocolVersion })).result.protocolVersion, protocolVersion);
  assert.equal((await call('initialize')).result.protocolVersion, '2025-06-18');
  assert.equal((await call('tools/list')).result.tools[0].name, 'echo');
  assert.equal(
    (await call('tools/call', { name: 'echo', arguments: { x: 1 } })).result.content[0].text,
    '{"x":1}',
  );
  assert.equal((await call('tools/call', { name: 'missing' })).result.isError, true);
  assert.deepEqual((await call('ping')).result, {});
  assert.equal((await call('missing')).error.code, -32601);
  assert.equal(JSON.parse((await server.handleLine('{'))!).error.code, -32700);
  assert.equal(JSON.parse((await server.handleLine('[]'))!).error.code, -32600);
  assert.equal(await server.handleLine('{"jsonrpc":"2.0","method":"notifications/initialized"}'), null);
  assert.equal(
    await server.handleLine('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo"}}'),
    null,
  );
});
