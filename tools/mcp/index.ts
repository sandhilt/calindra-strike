import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { GameSession } from './session.ts';
import { createTools } from './tools.ts';
import { createMcpServer } from './jsonrpc.ts';
import { createLog } from './log.ts';
const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'ws://127.0.0.1:7350/ws' },
    origin: { type: 'string', default: 'http://localhost:5173' },
    code: { type: 'string', default: '' },
    omniscient: { type: 'boolean', default: false },
    'auto-vote': { type: 'boolean', default: false },
    skill: { type: 'string', default: '0.7' },
    log: { type: 'boolean', default: false },
  },
});
const skill = Number(values.skill);
if (!Number.isFinite(skill) || skill < 0 || skill > 1) throw new Error('--skill must be between 0 and 1');
const log = createLog(values.log, (line) => process.stderr.write(line));
const session = new GameSession({
  log,
  skill,
  omniscient: values.omniscient,
  autoVote: values['auto-vote'],
  random: Math.random,
  url: values.url,
  origin: values.origin,
  connect: (url, origin) => new WebSocket(url, { headers: { Origin: origin } }),
  clock: { now: () => Date.now(), setInterval, clearInterval },
});
const server = createMcpServer({
  info: { name: 'calindra-strike', version: '1.0.0' },
  log,
  tools: createTools(session, values.code),
});
log('calindra-strike mcp', `url=${values.url}`, `origin=${values.origin}`, `code=${values.code ? 'on' : 'off'}`, `skill=${skill}`, `omniscient=${values.omniscient}`, `autoVote=${values['auto-vote']}`);
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', (line) => {
  void server
    .handleLine(line)
    .then((reply) => {
      if (reply !== null) process.stdout.write(reply + '\n');
    })
    .catch((e) => (values.log ? log : console.error)('handler error', e));
});
lines.on('close', () => {
  log('stdin closed, leaving the game');
  session.close();
});
process.on('SIGTERM', () => {
  log('shutting down: SIGTERM');
  session.close();
  lines.close();
});
process.on('SIGINT', () => {
  log('shutting down: SIGINT');
  session.close();
  lines.close();
});
