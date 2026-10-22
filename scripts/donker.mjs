// Maakt de donkere weergave (dist/donker.css) uit de gewone stijl (dist/app.css).
//
// Werkwijze: elke kleurregel uit app.css krijgt een donkere tegenhanger, alleen actief als
// <html data-thema="donker">. Lichte vlakken worden donker (met een blauwe ondertoon van de
// huisstijl), donkere tekst wordt licht, lichte randen worden donker. Verzadigde kleuren
// (het Campus Gouda-groen, knoppen, themakleuren) blijven zoals ze zijn.
// Zo doen nieuwe schermen vanzelf mee; er hoeft niets met de hand bij.

const PREFIX = 'html[data-thema=donker] ';
const KLEUR_EIGENSCHAPPEN = ['background-color', 'color', 'border-color', 'border-left-color', 'border-right-color', 'border-top-color', 'border-bottom-color', 'fill', 'stroke', 'outline-color', 'text-decoration-color', 'caret-color'];

// ---------- kleur rekenen ----------
function naarHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function naarRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const kan = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [kan(h + 1 / 3), kan(h), kan(h - 1 / 3)].map(v => Math.round(v * 255));
}
const BLAUW = 205 / 360; // ondertoon van de huisstijl (ink)

function donkerVlak([h, s, l]) {
  if (l < 0.8) return null; // verzadigde of donkere vlakken (knoppen, banner) blijven
  if (s < 0.15) { h = BLAUW; s = 0.3; } else s = Math.min(s, 0.45) * 0.6;
  return [h, s, 0.12 + (1 - l) * 0.6];
}
function donkerTekst([h, s, l]) {
  if (l >= 0.95) return null; // wit blijft wit (knoppen, banner)
  if (l < 0.6) return [h, s * 0.8, 0.92 - l * 0.5];
  return [h, s * 0.6, 0.5 + (0.95 - l) * 0.3]; // lichtgrijze hulptekst: gedempt maar leesbaar
}
function donkerRand([h, s, l]) {
  if (l < 0.75) return null;
  if (s < 0.5) { if (s < 0.15) { h = BLAUW; s = 0.25; } return [h, s, 0.22 + (1 - l) * 0.5]; }
  return [h, s * 0.6, 0.35];
}

// ---------- kleurwaarden in CSS herkennen en vervangen ----------
function omzetten(waarde, fn) {
  const zet = (r, g, b) => { const n = fn(naarHsl(+r, +g, +b)); return n ? naarRgb(...n) : null; };
  let veranderd = false;
  let uit = waarde
    .replace(/rgb\((\d+) (\d+) (\d+)(\s*\/[^)]*\)|\))/g, (m, r, g, b, rest) => { const n = zet(r, g, b); if (!n) return m; veranderd = true; return `rgb(${n.join(' ')}${rest}`; })
    .replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g, (m, r, g, b, a) => { const n = zet(r, g, b); if (!n) return m; veranderd = true; return `rgba(${n.join(',')},${a})`; })
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (m, hex) => {
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const n = zet(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
      if (!n) return m; veranderd = true; return '#' + n.map(v => v.toString(16).padStart(2, '0')).join('');
    });
  return { uit, veranderd };
}
const FN = { 'background-color': donkerVlak, 'color': donkerTekst, 'caret-color': donkerTekst, 'text-decoration-color': donkerTekst };
const fnVoor = p => FN[p] || (p.startsWith('border') || p === 'outline-color' ? donkerRand : p === 'fill' || p === 'stroke' ? donkerTekst : null);

// ---------- CSS doorlopen (ook binnen @media) ----------
function verwerk(css) {
  let uit = '', i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const kop = css.slice(i, open).trim();
    if (kop.startsWith('@media') || kop.startsWith('@supports')) {
      let diepte = 1, j = open + 1;
      while (j < css.length && diepte) { if (css[j] === '{') diepte++; else if (css[j] === '}') diepte--; j++; }
      const binnen = verwerk(css.slice(open + 1, j - 1));
      if (binnen) uit += `${kop}{${binnen}}`;
      i = j; continue;
    }
    if (kop.startsWith('@')) { // @font-face, @keyframes e.d. overslaan
      let diepte = 1, j = open + 1;
      while (j < css.length && diepte) { if (css[j] === '{') diepte++; else if (css[j] === '}') diepte--; j++; }
      i = j; continue;
    }
    const sluit = css.indexOf('}', open);
    const decls = css.slice(open + 1, sluit).split(';').map(d => d.trim()).filter(Boolean);
    const nieuw = [];
    for (const d of decls) {
      const dp = d.indexOf(':'); if (dp < 0) continue;
      const prop = d.slice(0, dp).trim(), waarde = d.slice(dp + 1).trim();
      if (!KLEUR_EIGENSCHAPPEN.includes(prop)) continue;
      const fn = fnVoor(prop); if (!fn) continue;
      const { uit: w } = omzetten(waarde, fn);
      // ook onveranderde kleuren opnemen: dan winnen ze van de algemene donkere randkleur hieronder
      nieuw.push(`${prop}:${w}`);
    }
    if (nieuw.length && kop && !/^(html|:root|:host)\b/.test(kop)) {
      const sel = kop.split(',').map(x => PREFIX + x.trim()).join(',');
      uit += `${sel}{${nieuw.join(';')}}`;
    }
    i = sluit + 1;
  }
  return uit;
}

export function maakDonker(appCss) {
  const basis = [
    `html[data-thema=donker]{color-scheme:dark}`,
    `${PREFIX}body{background:hsl(205 35% 7%);color:hsl(210 30% 90%)}`,
    `${PREFIX}*,${PREFIX}:after,${PREFIX}:before{border-color:hsl(205 25% 22%)}`,
    `${PREFIX}::-webkit-scrollbar-thumb{background:hsl(205 20% 28%)}`,
    // inline stijlen in de app (koppel-melding): lichte vlakken donker maken
    `${PREFIX}[style*="background: rgb(255, 251, 235)"]{background:hsl(40 40% 14%)!important}`,
    `${PREFIX}[style*="background: rgba(202, 229, 224"]{background:hsl(165 30% 14%)!important}`,
  ].join('\n');
  return '/* Donkere weergave, gemaakt door scripts/donker.mjs uit app.css; niet met de hand aanpassen. */\n' + basis + '\n' + verwerk(appCss) + '\n';
}
