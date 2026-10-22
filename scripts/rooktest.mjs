// Rooktest: opent de gebouwde app (dist/) in een schone headless Chrome, klikt alle tabbladen
// langs (licht en donker) en meldt elke fout in de pagina. Lokaal draaien na `npm run bouw`:
//   node --experimental-websocket scripts/rooktest.mjs
// Vereist Google Chrome op deze computer. Raakt geen gegevens aan (lege browser, geen gedeelde map).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const slaap = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, path.normalize(p));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => server.on('listening', r));
const poort = server.address().port;

const profiel = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-rooktest-'));
const POORT_CDP = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${POORT_CDP}`, `--user-data-dir=${profiel}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let lijst = null;
for (let i = 0; i < 50 && !lijst; i++) { try { lijst = await (await fetch(`http://127.0.0.1:${POORT_CDP}/json/list`)).json(); } catch (e) { await slaap(200); } }
const ws = new WebSocket(lijst.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const wacht = new Map(); const fouten = [];
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data);
  if (d.id && wacht.has(d.id)) { wacht.get(d.id)(d); wacht.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') fouten.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') fouten.push(d.params.args.map(a => a.value ?? a.description).join(' '));
});
const stuur = (method, params = {}) => new Promise(r => { const i = ++id; wacht.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async expr => (await stuur('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await stuur('Runtime.enable'); await stuur('Page.enable');

const resultaat = [];
for (const thema of ['licht', 'donker']) {
  await stuur('Page.navigate', { url: `http://127.0.0.1:${poort}/index.html` }); await slaap(1500);
  await js(`localStorage.setItem('cgt_weergave', '${thema}'); location.reload(); 1`); await slaap(2000);
  const tabs = await js(`[...document.querySelectorAll('nav button, header button')].map(b => b.innerText.trim().replace(/\\s+\\d+$/, '')).filter(t => ['Taken','Trajecten','Contacten','Studentengroepen','Cijfers'].includes(t))`) || [];
  for (const t of tabs) {
    await js(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().replace(/\\s+\\d+$/, '') === ${JSON.stringify(t)}).click(); 1`); await slaap(500);
    const leeg = await js(`document.getElementById('root').innerText.trim().length < 20`);
    resultaat.push(`${thema} · ${t}: ${leeg ? 'LEEG' : 'ok'}`);
  }
  if (!tabs.length) resultaat.push(`${thema}: GEEN TABBLADEN (app niet gestart)`);
}
ws.close(); server.close();
const dicht = new Promise(r => chrome.on('exit', r)); chrome.kill(); await Promise.race([dicht, slaap(3000)]);
try { fs.rmSync(profiel, { recursive: true, force: true }); } catch (e) { /* tijdelijke map; macOS ruimt die later zelf op */ }

const echteFouten = fouten.filter(f => !/service ?worker|Failed to load resource/i.test(f));
resultaat.forEach(r => console.log('  ' + r));
if (echteFouten.length || resultaat.some(r => /LEEG|GEEN/.test(r))) {
  console.error('✗ Rooktest mislukt:\n  ' + [...new Set(echteFouten)].slice(0, 5).join('\n  '));
  process.exit(1);
}
console.log('✓ Rooktest: alle tabbladen openen zonder fouten (licht en donker)');
process.exit(0);
