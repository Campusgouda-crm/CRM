// Maakt de openbare bron (src/) uit de interne versie van het CRM.
//
// Gebruik (vanuit de map pwa/):
//   node scripts/maak_bron.mjs ["../nieuwe versie met taken (NIET DELEN)/index.html"]
//
// Wat het doet:
//  - haalt alles eruit wat niet openbaar mag: namen van collega's, startgegevens,
//    SharePoint-metadata;
//  - splitst het ene HTML-bestand in losse bronbestanden (theme, logic, sync, app);
//  - laat het interne bestand ongewijzigd (alleen lezen).
//
// Elke vervanging moet precies één keer raak zijn. Zo niet, dan stopt het script:
// dan is de interne versie veranderd en moet dit script worden bijgewerkt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PWA = path.resolve(HIER, '..');
const BRON = path.resolve(PWA, process.argv[2] || '../nieuwe versie met taken (NIET DELEN)/index.html');
const SRC = path.join(PWA, 'src');

let html = fs.readFileSync(BRON, 'utf8');

function eenKeer(tekst, zoek, vervang, wat) {
  const delen = tekst.split(zoek);
  if (delen.length !== 2) throw new Error(`"${wat}": ${delen.length - 1} keer gevonden in plaats van 1`);
  return delen.join(vervang);
}
function tussen(tekst, begin, eind, wat) {
  const a = tekst.indexOf(begin);
  if (a < 0) throw new Error(`"${wat}": begin niet gevonden`);
  const b = tekst.indexOf(eind, a + begin.length);
  if (b < 0) throw new Error(`"${wat}": eind niet gevonden`);
  return [a, b];
}

// ---------- 1. de scriptblokken opzoeken ----------
const blokken = [];
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) blokken.push({ attrs: m[1] || '', code: m[2] });
const inline = blokken.filter(b => !/\bsrc=/.test(b.attrs));
if (inline.length !== 4) throw new Error(`verwacht 4 inline scripts, gevonden: ${inline.length}`);
const [themaBlok, logicBlok, syncBlok, appBlok] = inline;
if (!/CG_THEME/.test(themaBlok.code)) throw new Error('blok 1 is niet het thema');
if (!/LOGIC-START/.test(logicBlok.code)) throw new Error('blok 2 is niet de logica');
if (!/SYNC-START/.test(syncBlok.code)) throw new Error('blok 3 is niet de sync-engine');
if (!/text\/babel/.test(appBlok.attrs)) throw new Error('blok 4 is niet de app');

// ---------- 2. thema: CG_THEME blijft, tailwind.config gaat naar een eigen bestand ----------
let thema = themaBlok.code;
const tIdx = thema.indexOf('tailwind.config = ');
if (tIdx < 0) throw new Error('tailwind.config niet gevonden');
const twLiteral = thema.slice(tIdx + 'tailwind.config = '.length).trim().replace(/;\s*$/, '');
thema = thema.slice(0, tIdx).trimEnd() + '\n';
// lange invul-uitleg over het logo is hier niet nodig
thema = thema.replace(/\n\s*\/\/ LOGO INVULLEN:[\s\S]*?\/\/  Laat leeg[^\n]*\n/, '\n');

// ---------- 3. app: gegevens eruit ----------
let app = appBlok.code;

// 3a. namen van collega's: de keuzelijsten komen voortaan uit de gegevens
//     (patroon in plaats van de namen zelf, zodat ook dit script geen namen bevat)
const teamRegels = app.match(/const SENIOREN = \[[^\]]*\];\s*\nconst JUNIOREN = \[[^\]]*\];/g) || [];
if (teamRegels.length !== 1) throw new Error(`"SENIOREN/JUNIOREN": ${teamRegels.length} keer gevonden in plaats van 1`);
app = eenKeer(app,
  teamRegels[0],
  `// Keuzelijsten senior/junior: gevuld uit de gegevens (zie vulTeamLijsten), nooit vaste namen in de code
const SENIOREN = [];
const JUNIOREN = [];
function vulTeamLijsten(trajecten) {
  const uniek = (k) => [...new Set((trajecten || []).map(t => String(t[k] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl'));
  SENIOREN.splice(0, SENIOREN.length, ...uniek('senior'));
  JUNIOREN.splice(0, JUNIOREN.length, ...uniek('junior'));
}`,
  'SENIOREN/JUNIOREN');

app = eenKeer(app,
  `<select className={inputCls} value={f.senior || ''} onChange={set('senior')}>
          <option value="">— geen —</option>{SENIOREN.map(x => <option key={x}>{x}</option>)}
        </select>`,
  `<input className={inputCls} list="cg-senioren" value={f.senior || ''} onChange={set('senior')} placeholder="naam (kies of typ)" />
        <datalist id="cg-senioren">{SENIOREN.map(x => <option key={x} value={x} />)}</datalist>`,
  'keuzelijst senior');
app = eenKeer(app,
  `<select className={inputCls} value={f.junior || ''} onChange={set('junior')}>
          <option value="">— geen —</option>{JUNIOREN.map(x => <option key={x}>{x}</option>)}
        </select>`,
  `<input className={inputCls} list="cg-junioren" value={f.junior || ''} onChange={set('junior')} placeholder="naam (kies of typ)" />
        <datalist id="cg-junioren">{JUNIOREN.map(x => <option key={x} value={x} />)}</datalist>`,
  'keuzelijst junior');

app = eenKeer(app,
  `  const [contacten, setContacten] = useState(() => {`,
  `  vulTeamLijsten(trajecten);
  const [contacten, setContacten] = useState(() => {`,
  'vulTeamLijsten in App');

// 3b. startgegevens eruit: de app start leeg en laadt alles uit de gedeelde map
{
  const [a] = tussen(app, 'function seedTrajecten() {', '\n}\n', 'seedTrajecten');
  const [c] = tussen(app, 'function seedContacten(trajecten) {', '\n}\n', 'seedContacten');
  const eind = app.indexOf('\n}\n', c) + 3;
  if (c < a) throw new Error('seed-volgorde onverwacht');
  app = app.slice(0, a)
    + '// Geen startgegevens in de openbare versie: alles komt uit de gedeelde map.\n'
    + 'function seedTrajecten() { return []; }\n\n'
    + 'function seedContacten(trajecten) { return []; }\n'
    + app.slice(eind);
}

// 3c. testmodus alleen op deze computer (localhost)
app = eenKeer(app,
  "const TEST_MAP = TEST_PARAMS.get('testmap') || '';",
  "const TEST_MAP = (['localhost', '127.0.0.1'].includes(location.hostname) && TEST_PARAMS.get('testmap')) || '';",
  'testmap alleen lokaal');

// 3d. lettertype in printvensters: eigen bestand in plaats van Google Fonts
const fontImports = app.match(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?[^']*'\);/g) || [];
if (fontImports.length !== 2) throw new Error(`verwacht 2 font-imports in printvensters, gevonden: ${fontImports.length}`);
for (const f of fontImports) {
  app = app.replace(f, "@import url('${new URL('fonts/manrope.css', location.href).href}');");
}

// ---------- 4. basis-CSS ----------
const stijl = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
if (!stijl) throw new Error('<style>-blok niet gevonden');

// ---------- 5. wegschrijven ----------
fs.mkdirSync(SRC, { recursive: true });
const kop = (wat) => `/* Campus Gouda CRM — ${wat}. Gemaakt door scripts/maak_bron.mjs; niet met de hand aanpassen. */\n`;
fs.writeFileSync(path.join(SRC, 'theme.js'), kop('huisstijl') + thema.trim() + '\n');
fs.writeFileSync(path.join(SRC, 'tailwind.thema.cjs'), kop('Tailwind-thema') + 'module.exports = ' + twLiteral + ';\n');
fs.writeFileSync(path.join(SRC, 'logic.js'), kop('logica (signalen, planning, taken)') + logicBlok.code.trim() + '\n');
fs.writeFileSync(path.join(SRC, 'sync.js'), kop('samenwerken in de gedeelde map') + syncBlok.code.trim() + '\n');
fs.writeFileSync(path.join(SRC, 'app.jsx'), kop('de app') + app.trim() + '\n');
fs.writeFileSync(path.join(SRC, 'basis.css'), kop('basisstijl') + stijl.trim().replace(/^ {4}/gm, '') + '\n');

console.log('Bron gemaakt in src/: theme.js, tailwind.thema.cjs, logic.js, sync.js, app.jsx, basis.css');
console.log('Draai nu de privacycontrole: node scripts/privacycontrole.mjs src');
