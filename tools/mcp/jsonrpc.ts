import { silent, type Log } from './log.ts';

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}
export const result = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
});
export const failure = (error: unknown): ToolResult => ({
  ...result(error instanceof Error ? error.message : String(error)),
  isError: true,
});
export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
  call(args: unknown): Promise<ToolResult>;
}
export function createMcpServer(options: { info: { name: string; version: string }; tools: McpTool[]; log?: Log }) {
  const log = options.log ?? silent;
  return {
    async handleLine(line: string): Promise<string | null> {
      let msg: unknown;
      try {
        msg = JSON.parse(line);
      } catch {
        return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg))
        return JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid request' },
        });
      const m = msg as Record<string, unknown>;
      const id = typeof m.id === 'string' || typeof m.id === 'number' ? m.id : null;
      const error = (code: number, message: string) =>
        JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
      if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') return error(-32600, 'Invalid request');
      if (!('id' in m)) return null;
      const p = m.params && typeof m.params === 'object' ? (m.params as Record<string, unknown>) : {};
      let value: unknown;
      if (m.method === 'initialize')
        value = {
          protocolVersion: ['2025-06-18', '2025-03-26', '2024-11-05'].includes(String(p.protocolVersion))
            ? p.protocolVersion
            : '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: options.info,
        };
      else if (m.method === 'ping') value = {};
      else if (m.method === 'tools/list')
        value = {
          tools: options.tools.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        };
      else if (m.method === 'tools/call') {
        const tool = options.tools.find((t) => t.name === p.name);
        const started = performance.now();
        try {
          value = tool ? await tool.call(p.arguments ?? {}) : failure('Unknown tool');
        } catch (e) {
          value = failure(e);
        }
        const failed = (value as ToolResult).isError ? (value as ToolResult).content[0]?.text : undefined;
        log('tool', typeof p.name === 'string' ? p.name : '(invalid name)', failed === undefined ? 'ok' : `error ${JSON.stringify(failed)}`, `${Math.round(performance.now() - started)}ms`);
      } else return error(-32601, 'Method not found');
      return JSON.stringify({ jsonrpc: '2.0', id, result: value });
    },
  };
}
