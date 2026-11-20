const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOT_FILE = path.join(DATA_DIR, 'boot.json');

// --- Test de persistance disque : compteur de démarrages ---
let boot = { count: 0, first: new Date().toISOString() };
let diskOk = true;
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(BOOT_FILE)) boot = JSON.parse(fs.readFileSync(BOOT_FILE, 'utf8'));
} catch (e) {
  console.error('Lecture disque impossible :', e.message);
  diskOk = false;
}
boot.count += 1;
boot.last = new Date().toISOString();
try {
  fs.writeFileSync(BOOT_FILE, JSON.stringify(boot));
} catch (e) {
  console.error('Ecriture disque impossible :', e.message);
  diskOk = false;
}

// --- Serveur HTTP (page + petite API) ---
const server = http.createServer((req, res) => {
  if (req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ node: process.version, port: PORT, diskOk, boot }));
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  }
  res.writeHead(404);
  res.end('Not found');
});

// --- WebSocket : tout message est renvoyé à tous les clients connectés ---
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  broadcast({ type: 'info', text: `Un client est connecté (${wss.clients.size} en ligne)` });
  ws.on('message', (data) => {
    broadcast({ type: 'msg', text: data.toString().slice(0, 500), online: wss.clients.size });
  });
  ws.on('close', () => {
    broadcast({ type: 'info', text: `Un client est parti (${wss.clients.size} en ligne)` });
  });
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur de test lancé sur le port ${PORT} (démarrage n°${boot.count})`);
});
