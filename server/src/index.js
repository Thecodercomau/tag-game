import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { PROTOCOL_VERSION } from '../../shared/constants.js';
import { SERVER_EVENTS } from '../../shared/events.js';
import { LobbyManager } from './LobbyManager.js';
import { MatchManager } from './MatchManager.js';
import { NetworkGateway } from './NetworkGateway.js';
import { PlayerManager } from './PlayerManager.js';
import { Security } from './Security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const distPath = path.join(projectRoot, 'dist');

function parseOrigins(value) {
  if (!value || value.trim() === '*') return '*';
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function lanAddresses(port) {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push({ name, address: entry.address, url: `http://${entry.address}:${port}` });
      }
    }
  }
  return addresses;
}

function boolEnv(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export async function createTagServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const origins = options.origins ?? parseOrigins(process.env.ALLOWED_ORIGINS || '*');
  const lanOnly = options.lanOnly ?? boolEnv(process.env.LAN_ONLY, false);
  const maxLobbies = options.maxLobbies ?? Number(process.env.MAX_LOBBIES || 100);
  const publicUrl = options.publicUrl ?? process.env.PUBLIC_URL ?? '';
  const corsOptions = {
    origin: origins === '*' ? true : origins,
    methods: ['GET', 'POST'],
    credentials: false
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '8kb' }));

  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: corsOptions,
    maxHttpBufferSize: 12000,
    pingInterval: 10000,
    pingTimeout: 15000,
    transports: ['websocket', 'polling'],
    serveClient: false
  });

  const security = new Security();
  const players = new PlayerManager();
  const lobbies = new LobbyManager(io, { lanOnly, maxLobbies });
  const matches = new MatchManager(io, lobbies);
  const gateway = new NetworkGateway({ io, players, lobbies, matches, security, config: { origins, lanOnly } });
  gateway.register();

  const infoFor = (actualPort = port) => {
    const urls = lanAddresses(actualPort);
    return {
      name: 'TAG',
      protocol: PROTOCOL_VERSION,
      uptime: Math.round(process.uptime()),
      lanOnly,
      serverTime: Date.now(),
      publicUrl: publicUrl || null,
      localUrl: `http://localhost:${actualPort}`,
      lanUrls: urls,
      staticClient: fs.existsSync(path.join(distPath, 'index.html')),
      maxPlayers: 12,
      maxLobbies
    };
  };

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), activeLobbies: lobbies.lobbies.size, activeMatches: matches.matches.size });
  });

  app.get('/api/server-info', (req, res) => {
    const address = httpServer.address();
    const actualPort = address && typeof address === 'object' ? address.port : port;
    res.json(infoFor(actualPort));
  });

  app.get('/api/stats', (req, res) => {
    res.json({
      lobbies: lobbies.listPublic(),
      activeMatches: matches.matches.size,
      recentMatches: matches.history.slice(0, 5).map((result) => ({
        modeId: result.modeId,
        mapId: result.mapId,
        winners: result.winners,
        duration: result.duration
      }))
    });
  });

  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.type('text/plain').send('TAG server is running. Start the Vite client with `npm run dev:client`, or run `npm run build && npm start` for a LAN-ready build.');
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, req, res, next) => {
    console.error('HTTP error', error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Internal server error' });
  });

  async function listen() {
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, host, () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
    const address = httpServer.address();
    return typeof address === 'object' ? address.port : port;
  }

  async function close() {
    matches.shutdown();
    security.close();
    players.close();
    await new Promise((resolve) => io.close(resolve));
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  }

  return { app, httpServer, io, players, lobbies, matches, security, gateway, listen, close, infoFor, config: { port, host, origins, lanOnly, maxLobbies, publicUrl } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const runtime = await createTagServer();
  const port = await runtime.listen();
  const info = runtime.infoFor(port);
  console.log(`\n  TAG server listening on ${info.localUrl}`);
  if (info.lanUrls.length) {
    console.log('  LAN addresses:');
    for (const entry of info.lanUrls) console.log(`   ${entry.url}  (${entry.name})`);
  }
  console.log(`  Public lobbies: ${runtime.lobbies.lobbies.size}  |  Protocol: ${PROTOCOL_VERSION}`);
  if (!info.staticClient) console.log('  No production build found. Run `npm run build` to serve the game from this server.');
  console.log('  Press Ctrl+C to stop.\n');

  const shutdown = async () => {
    console.log('\nShutting down TAG server...');
    await runtime.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
