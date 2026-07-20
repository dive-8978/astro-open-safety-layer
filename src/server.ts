import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createServer(createApp(config));

server.listen(config.port, () => {
  console.log(`Astro Open Safety Layer listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing HTTP server`);
  server.close(error => process.exit(error ? 1 : 0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
