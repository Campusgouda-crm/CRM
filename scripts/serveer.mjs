// Bekijk de gebouwde app op deze computer: http://localhost:4530/
// Gebruik (vanuit de map pwa/):  node scripts/serveer.mjs [poort]
// Service workers en "installeren" werken op localhost net als op GitHub Pages.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const POORT = Number(process.argv[2] || 4530);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const bestand = path.join(DIST, path.normalize(p));
  if (!bestand.startsWith(DIST) || !fs.existsSync(bestand) || fs.statSync(bestand).isDirectory()) {
    res.writeHead(404); return res.end('niet gevonden');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(bestand)] || 'application/octet-stream',
    'Cache-Control': 'max-age=600', // zoals GitHub Pages
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(bestand).pipe(res);
}).listen(POORT, '127.0.0.1', () => console.log(`Campus Gouda CRM: http://localhost:${POORT}/`));
