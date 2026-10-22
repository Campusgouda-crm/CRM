// Privacycontrole: de openbare code mag geen enkel persoonsgegeven bevatten.
//
// Gebruik (vanuit de map pwa/):
//   node scripts/privacycontrole.mjs src dist
//
// Twee soorten controle:
//  1. Altijd: patronen (mailadressen, telefoonnummers, SharePoint-metadata, vaste namen van collega's).
//  2. Als het echte crm-data.json op deze computer staat: alle namen, mailadressen en
//     telefoonnummers daaruit. Dat bestand wordt alleen gelezen, nooit aangepast.
//     Pad: ../intern (NIET DELEN)/crm-data.json, of zet CRM_DATA=<pad>.
//
// Gevonden waarden worden afgeschermd getoond (eerste letter + lengte), zodat de uitvoer
// zelf geen persoonsgegevens bevat. Eindigt met code 1 als er iets gevonden is.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PWA = path.resolve(__dirname, '..');
const DATA = process.env.CRM_DATA || path.resolve(PWA, '../intern (NIET DELEN)/crm-data.json');
const mappen = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'dist'];

// bibliotheken van derden en lettertypes slaan we over: die komen ongewijzigd uit npm
const OVERSLAAN = /(^|\/)(node_modules|vendor|fonts)(\/|$)|\.(png|woff2?|ico)$/;

function bestanden(dir) {
  const uit = [];
  if (!fs.existsSync(dir)) return uit;
  if (fs.statSync(dir).isFile()) return [dir];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (OVERSLAAN.test(path.relative(PWA, p))) continue;
    if (e.isDirectory()) uit.push(...bestanden(p)); else uit.push(p);
  }
  return uit;
}

const scherm = (s) => s[0] + '…(' + s.length + ')';

// ---------- zoekwaarden ----------
const zoek = []; // { tekst, soort }
// namen van collega's: uit de interne versie (SENIOREN/JUNIOREN), zodat ze niet in dit script staan
const INTERN = process.env.CRM_INTERN || path.resolve(PWA, '../nieuwe versie met taken (NIET DELEN)/index.html');
let internGelezen = false;
if (fs.existsSync(INTERN)) {
  const t = fs.readFileSync(INTERN, 'utf8');
  for (const lijstNaam of ['SENIOREN', 'JUNIOREN']) {
    const m = t.match(new RegExp('const ' + lijstNaam + ' = \\[([^\\]]*)\\]'));
    if (m) for (const n of m[1].matchAll(/'([^']+)'/g)) { zoek.push({ tekst: n[1], soort: 'collega' }); internGelezen = true; }
  }
}
// extra namen (bijv. het team): één naam per regel in privacy-namen.txt naast de interne versie (niet openbaar)
const EXTRA = process.env.CRM_NAMEN || path.resolve(PWA, '../nieuwe versie met taken (NIET DELEN)/privacy-namen.txt');
if (fs.existsSync(EXTRA)) {
  for (const n of fs.readFileSync(EXTRA, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'))) zoek.push({ tekst: n, soort: 'collega' });
}

let dataGelezen = false;
if (fs.existsSync(DATA)) {
  const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  dataGelezen = true;
  const NAAMVELDEN = new Set(['naam', 'contactpersoon', 'eigenaar', 'ondertekenaar', 'verbondenPersoon', 'interneCollega', 'contactCG', 'docent']);
  const MAILVELDEN = new Set(['email', 'mail', 'docentMail', 'priveMail']);
  const TELVELDEN = new Set(['telefoon']);
  const ALGEMEEN = new Set(['campus gouda', 'gemeente gouda', 'onbekend', 'niet bekend', 'nog niet bekend', 'nvt', 'n.v.t.', 'test', 'overig']);
  const voeg = (tekst, soort) => {
    tekst = String(tekst).trim();
    if (tekst.length < 4 || ALGEMEEN.has(tekst.toLowerCase())) return;
    zoek.push({ tekst, soort });
  };
  (function loop(o) {
    if (Array.isArray(o)) return o.forEach(loop);
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v) {
        if (NAAMVELDEN.has(k)) v.split(/[,;/&]| en /).forEach(x => voeg(x, 'naam'));
        if (MAILVELDEN.has(k)) v.split(/[,;\s]+/).filter(x => x.includes('@')).forEach(x => voeg(x, 'mail'));
        if (TELVELDEN.has(k)) { const cijfers = v.replace(/\D/g, ''); if (cijfers.length >= 9) zoek.push({ tekst: cijfers.slice(-9), soort: 'telefoon', cijfers: true }); }
      } else loop(v);
    }
  })(d);
}
// dubbele eruit
const gezien = new Set();
const lijst = zoek.filter(z => { const k = z.soort + '|' + z.tekst.toLowerCase(); if (gezien.has(k)) return false; gezien.add(k); return true; });

// ---------- patronen ----------
const PATRONEN = [
  { soort: 'mailadres', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mag: (s) => /@(voorbeeld|example)\./i.test(s) },
  { soort: 'telefoonnummer', re: /(?:\+31|0031|\b0)[1-9](?:[ -]?\d){8}\b/g },
  { soort: 'SharePoint-metadata', re: /sharepoint\.com|_dlc_Doc[I]d|mso:CustomDocument[P]roperties/gi },
];

// ---------- zoeken ----------
let treffers = 0;
const bestandenLijst = mappen.flatMap(m => bestanden(path.resolve(PWA, m)));
for (const f of bestandenLijst) {
  const tekst = fs.readFileSync(f, 'utf8');
  const klein = tekst.toLowerCase();
  const alleenCijfers = tekst.replace(/\D/g, '');
  const rel = path.relative(PWA, f);
  const regel = (i) => tekst.slice(0, i).split('\n').length;
  for (const z of lijst) {
    if (z.cijfers) {
      if (alleenCijfers.includes(z.tekst)) {
        // alleen melden als het nummer ook als telefoonnummer-achtig stuk in de tekst staat
        const re = new RegExp(z.tekst.split('').join('[ -]?'));
        const mm = re.exec(tekst);
        if (mm) { treffers++; console.log(`✗ ${rel}:${regel(mm.index)}  telefoon uit gegevens  ${scherm(z.tekst)}`); }
      }
      continue;
    }
    // hele woorden: een naam telt niet als hij midden in een ander woord staat
    const esc = z.tekst.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^a-z0-9à-ÿ])' + esc + '($|[^a-z0-9à-ÿ])', 'g');
    let mm;
    while ((mm = re.exec(klein))) { treffers++; console.log(`✗ ${rel}:${regel(mm.index)}  ${z.soort}  ${scherm(z.tekst)}`); }
  }
  for (const p of PATRONEN) {
    for (const mm of tekst.matchAll(p.re)) {
      if (p.mag && p.mag(mm[0])) continue;
      treffers++; console.log(`✗ ${rel}:${regel(mm.index)}  ${p.soort}  ${scherm(mm[0])}`);
    }
  }
}

console.log('');
console.log(`Gecontroleerd: ${bestandenLijst.length} bestanden in ${mappen.join(', ')}.`);
console.log(dataGelezen
  ? `Vergeleken met ${lijst.length} namen, mailadressen en telefoonnummers uit crm-data.json (alleen gelezen).`
  : 'Let op: crm-data.json niet gevonden, alleen de patronen gecontroleerd.');
if (!internGelezen) console.log('Let op: interne versie niet gevonden, namen van collega\'s niet gecontroleerd.');
if (treffers) { console.log(`✗ ${treffers} treffer(s). Niet publiceren.`); process.exit(1); }
console.log('✓ Geen persoonsgegevens gevonden.');
