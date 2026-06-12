import Fastify from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { SERVER_PORT, WS_PATH, type GameEvent } from '@agent-citadel/shared';
import { World } from './world.js';

const demoMode = process.argv.includes('--demo');

const app = Fastify({ logger: { level: 'info' } });
const world = new World();

app.get('/health', async () => ({ ok: true, demo: demoMode }));

// Endpoint hooków Claude Code (typ "http" w ~/.claude/settings.json).
// Etap 6 podłączy payloady do maszyny stanów; do tego czasu tylko 200.
app.post('/hooks', async (request) => {
  app.log.debug({ hook: request.body }, 'hook event');
  return { ok: true };
});

await app.listen({ port: SERVER_PORT, host: '127.0.0.1' });

const wss = new WebSocketServer({ server: app.server, path: WS_PATH });

function send(socket: WebSocket, event: GameEvent): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

wss.on('connection', (socket) => {
  send(socket, { type: 'snapshot', ...world.snapshot() });
});

world.onEvent((event) => {
  for (const socket of wss.clients) send(socket, event);
});

if (demoMode) {
  const { startDemo } = await import('./demo/scenario.js');
  startDemo(world);
  app.log.info('Tryb demo: generator scenariuszy uruchomiony');
}

app.log.info(`Agent Citadel server: http://127.0.0.1:${SERVER_PORT} (ws: ${WS_PATH})`);
