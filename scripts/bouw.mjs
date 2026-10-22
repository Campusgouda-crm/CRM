// Bouwt de app naar dist/ (dat publiceert GitHub Pages).
//
// Gebruik (vanuit de map pwa/):  npm run bouw
//
// Stappen:
//  1. JSX omzetten met Babel 7 (geen Babel meer in de browser);
//  2. Tailwind-CSS één keer maken (geen Tailwind-CDN meer);
//  3. bibliotheken en lettertype als eigen bestanden meeleveren (geen CDN's);
//  4. service worker vullen met de lijst app-bestanden en het versienummer;
//  5. privacycontrole op het resultaat.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import babel from '@babel/core';

const require = createRequire(import.meta.url);
const PWA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(PWA, 'src');
const PUB = path.join(PWA, 'public');
const DIST = path.join(PWA, 'dist');
const NM = path.join(PWA, 'node_modules');
const pkg = JSON.parse(fs.readFileSync(path.join(PWA, 'package.json'), 'utf8'));

const lees = (p) => fs.readFileSync(p, 'utf8');
const schrijf = (rel, inhoud) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, inhoud); };
const kopieer = (van, rel) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.copyFileSync(van, p); };

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. JSX
const jsx = lees(path.join(SRC, 'app.jsx'));
const app = babel.transformSync(jsx, {
  filename: 'app.jsx', babelrc: false, configFile: false, compact: false, comments: false,
  presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
}).code;
schrijf('app.js', app);
for (const f of ['theme.js', 'logic.js', 'sync.js']) kopieer(path.join(SRC, f), f);
console.log('✓ JSX omgezet');

// 2. CSS
const invoer = path.join(PWA, '.bouw-invoer.css');
fs.writeFileSync(invoer, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + lees(path.join(SRC, 'basis.css')));
try {
  execFileSync(process.execPath, [path.join(NM, 'tailwindcss/lib/cli.js'), '-c', path.join(PWA, 'tailwind.config.cjs'), '-i', invoer, '-o', path.join(DIST, 'app.css'), '--minify'], { cwd: PWA, stdio: ['ignore', 'ignore', 'pipe'] });
} finally { fs.rmSync(invoer, { force: true }); }
console.log('✓ CSS gemaakt');

// 3. bibliotheken + lettertype
kopieer(path.join(NM, 'react/umd/react.production.min.js'), 'vendor/react.production.min.js');
kopieer(path.join(NM, 'react-dom/umd/react-dom.production.min.js'), 'vendor/react-dom.production.min.js');
kopieer(path.join(NM, 'chart.js/dist/chart.umd.js'), 'vendor/chart.umd.js');
kopieer(path.join(NM, 'xlsx/dist/xlsx.full.min.js'), 'vendor/xlsx.full.min.js');
let fontCss = '/* Manrope (SIL Open Font License), via @fontsource/manrope */\n';
for (const gewicht of [300, 400, 500, 600, 700]) {
  for (const subset of ['latin', 'latin-ext']) {
    const bestand = `manrope-${subset}-${gewicht}-normal.woff2`;
    kopieer(path.join(NM, '@fontsource/manrope/files', bestand), 'fonts/' + bestand);
    const bron = lees(path.join(NM, `@fontsource/manrope/${subset}-${gewicht}.css`));
    const range = (bron.match(/unicode-range:[^;]+;/) || [''])[0];
    fontCss += `@font-face{font-family:'Manrope';font-style:normal;font-display:swap;font-weight:${gewicht};src:url(${bestand}) format('woff2');${range}}\n`;
  }
}
schrijf('fonts/manrope.css', fontCss);
kopieer(path.join(NM, '@fontsource/manrope/LICENSE'), 'fonts/LICENSE-Manrope.txt');
console.log('✓ Bibliotheken en lettertype gekopieerd');

// 4. public/ + versie + service worker
function alles(dir, basis = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? alles(p, basis) : [path.relative(basis, p).split(path.sep).join('/')];
  });
}
for (const f of alles(PUB)) if (f !== 'sw.js' && f !== 'index.html') kopieer(path.join(PUB, f), f);
// versie = package.json + korte vingerafdruk van alle app-bestanden (dus elke wijziging = nieuwe versie)
const appBestanden = alles(DIST).filter(f => !f.endsWith('.txt')).sort();
const hash = crypto.createHash('sha256');
for (const f of appBestanden) hash.update(f).update(fs.readFileSync(path.join(DIST, f)));
hash.update(lees(path.join(PUB, 'index.html'))).update(lees(path.join(PUB, 'sw.js')));
const VERSIE = `${pkg.version}-${hash.digest('hex').slice(0, 8)}`;
schrijf('index.html', lees(path.join(PUB, 'index.html')).replaceAll('__VERSIE__', VERSIE));
const precache = ['./', 'index.html', ...appBestanden];
schrijf('sw.js', lees(path.join(PUB, 'sw.js')).replaceAll('__VERSIE__', VERSIE).replace('__BESTANDEN__', JSON.stringify(precache, null, 2)));
// GitHub Pages: geen Jekyll-verwerking
schrijf('.nojekyll', '');
console.log(`✓ Versie ${VERSIE}, ${precache.length} bestanden in de service worker`);

// 5. privacycontrole
try {
  execFileSync(process.execPath, [path.join(PWA, 'scripts/privacycontrole.mjs'), 'dist', 'src', 'public', 'scripts'], { cwd: PWA, stdio: 'inherit' });
} catch (e) {
  console.error('\n✗ Bouwen afgebroken: de privacycontrole vond iets. dist/ is verwijderd.');
  fs.rmSync(DIST, { recursive: true, force: true });
  process.exit(1);
}
const kb = Math.round(alles(DIST).reduce((s, f) => s + fs.statSync(path.join(DIST, f)).size, 0) / 1024);
console.log(`\nKlaar: dist/ (${kb} kB). Lokaal bekijken: node scripts/serveer.mjs`);
