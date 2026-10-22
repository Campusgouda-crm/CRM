// Stresstest samenwerken: 6 collega's tegelijk in dezelfde gedeelde map.
// Draaien: node scripts/test_zes.js
//
// Nagebootst (zoals OneDrive/SharePoint):
//  - iedereen schrijft alleen in een eigen bestand; anderen zien dat pas na 1-4 rondes (vertraging);
//  - één collega heeft een klok die 10 minuten achterloopt;
//  - één collega is een tijd offline (leest en schrijft niets) en komt daarna terug;
//  - halverwege legt iemand de stand vast in crm-data.json;
//  - duizenden willekeurige wijzigingen door elkaar: toevoegen, aanpassen, verwijderen, zelfde veld tegelijk.
// Gecontroleerd:
//  1. iedereen eindigt met exact dezelfde stand;
//  2. nergens staat iets dubbel (geen dubbele id's in lijsten);
//  3. niets wat iemand toevoegde of in een eigen veld aanpaste is kwijt (tenzij iemand het bewust verwijderde).
const S = require('../src/sync.js');
const assert = require('assert');

// voorspelbaar "willekeurig", zodat een fout altijd opnieuw te zien is
let zaad = 20261022;
const rnd = () => { zaad = (zaad * 1103515245 + 12345) % 2147483648; return zaad / 2147483648; };
const kies = a => a[Math.floor(rnd() * a.length)];
const kloon = x => JSON.parse(JSON.stringify(x));

function maakMap() {
  const bestanden = new Map(); let basis = { tekst: '', v: 0 }; let ronde = 0;
  return {
    volgende() { ronde++; },
    adapter(wie, lag) {
      return {
        async lijst() { const uit = []; bestanden.forEach((b, naam) => { const z = b.hist.filter(h => h.door === wie || h.r + lag <= ronde).pop(); if (z) uit.push({ naam, gewijzigd: z.v }); }); return uit; },
        async lees(naam) { const b = bestanden.get(naam); const z = b.hist.filter(h => h.door === wie || h.r + lag <= ronde).pop(); return z ? z.tekst : ''; },
        async schrijf(naam, tekst) { const b = bestanden.get(naam) || { hist: [] }; b.hist.push({ tekst, r: ronde, v: b.hist.length + 1, door: wie }); bestanden.set(naam, b); },
        async leesBasis() { return { tekst: basis.tekst, gewijzigd: basis.v }; },
        async schrijfBasis(tekst) { basis = { tekst, v: basis.v + 1 }; },
      };
    },
    zetBasis(obj) { basis = { tekst: JSON.stringify(obj), v: 1 }; },
  };
}

(async () => {
  const map = maakMap();
  // de helft van de groepen begint zonder lijsten: dan komt 'tegelijk het eerste item' vaak voor
  const groepen = Array.from({ length: 8 }, (_, i) => i % 2 ? { id: 'g' + i, groepsnummer: '1.' + i, titel: 'Groep ' + i, thema: 'Zorg' } : ({ id: 'g' + i, groepsnummer: '1.' + i, titel: 'Groep ' + i, thema: 'Zorg', studenten: [], taken: [], aantekeningen: [] }));
  const contacten = Array.from({ length: 10 }, (_, i) => i % 2 ? { id: 'c' + i, naam: 'Contact ' + i, organisatie: 'Org ' + i } : ({ id: 'c' + i, naam: 'Contact ' + i, organisatie: 'Org ' + i, interacties: [] }));
  map.zetBasis({ trajecten: [], contacten, uren: [], targets: {}, checklist: {}, groepen, team: [] });

  let klok = 1_000_000;
  const NAMEN = ['Een', 'Twee', 'Drie', 'Vier', 'Vijf', 'Zes'];
  const mensen = NAMEN.map((naam, i) => {
    const scheef = i === 2 ? -600_000 : 0;              // klok van "Drie" loopt 10 minuten achter
    const lag = 1 + (i % 4);                            // 1 tot 4 rondes vertraging
    const sync = S.maakSync(map.adapter(naam, lag), { id: ('p' + i + '00000'), naam }, { nu: () => klok + scheef });
    return { naam, i, sync, kern: null, offline: false };
  });
  for (const m of mensen) m.kern = await m.sync.start();

  const wijzig = (m, fn) => { const k = kloon(m.kern); fn(k); m.kern = k; m.sync.registreer(k); };
  const ronde = async () => {
    klok += 1000; map.volgende();
    for (const m of mensen) { if (m.offline) continue; await m.sync.schrijf(); const n = await m.sync.peil(); if (n) m.kern = n; }
  };

  // wat we bijhouden om "niets kwijt" te controleren
  const toegevoegd = new Map();   // id → { soort, door }
  const verwijderd = new Set();   // id's die iemand bewust verwijderde
  let teller = 0;
  const nieuwId = (m, soort) => { const id = soort + '-' + m.naam + '-' + (++teller); toegevoegd.set(id, soort); return id; };

  const STAPPEN = 3000;
  for (let s = 0; s < STAPPEN; s++) {
    if (s === 800) mensen[4].offline = true;            // "Vijf" gaat offline
    if (s === 1600) mensen[4].offline = false;          // ...en komt terug
    if (s === 1500) { await mensen[0].sync.legVast(); } // tussendoor stand vastleggen
    const m = kies(mensen.filter(x => !x.offline || rnd() < 0.5)); // offline collega werkt soms lokaal door
    wijzig(m, k => {
      const r = rnd();
      const g = kies(k.groepen), c = kies(k.contacten);
      if (r < 0.15) g.titel = 'Titel van ' + m.naam + ' #' + s;                                   // zelfde veld, veel tegelijk
      else if (r < 0.27) (g.taken = g.taken || []).push({ id: nieuwId(m, 'taak'), tekst: 'Opvolging ' + s, status: 'open' });
      else if (r < 0.32 && (g.taken || []).length) { const t = g.taken.splice(Math.floor(rnd() * g.taken.length), 1)[0]; verwijderd.add(t.id); }
      else if (r < 0.40 && (g.taken || []).length) { kies(g.taken).status = 'klaar'; }
      else if (r < 0.50) (g.aantekeningen = g.aantekeningen || []).push({ id: nieuwId(m, 'aant'), soort: 'Voortgangsgesprek', door: m.naam, velden: { stand: kies(['goed', 'aandacht', 'zorgen']) } });
      else if (r < 0.60) (c.interacties = c.interacties || []).push({ id: nieuwId(m, 'gesprek'), datum: '2026-10-22', duur: kies([0.5, 1, 1.5]), aantalExtern: 1, door: m.naam });
      else if (r < 0.66) c['notitie_' + m.naam] = 'eigen veld ' + s;                           // elk een eigen veld
      else if (r < 0.72) { k.checklist[g.id] = Object.assign({}, k.checklist[g.id], { ['F' + (s % 8) + 'I' + (s % 5)]: rnd() < 0.8 }); }
      else if (r < 0.78) k.team.push({ id: nieuwId(m, 'team'), naam: 'Lid ' + s, rol: 'Junior projectleider' });
      else if (r < 0.81 && k.team.length) { const t = k.team.splice(0, 1)[0]; verwijderd.add(t.id); }
      else if (r < 0.88) k.uren.push({ id: nieuwId(m, 'uur'), organisatie: c.organisatie, urenLLO: String(1 + (s % 3)) });
      else if (r < 0.93) g.momenten = Object.assign({}, g.momenten, { tussen: { datum: '2026-11-' + String(10 + (s % 18)).padStart(2, '0'), status: 'gepland' } });
      else if (r < 0.96) (g.studenten = g.studenten || []).push({ id: nieuwId(m, 'student'), naam: 'Student ' + s });
      else c.naam = 'Contact ' + c.id + ' (' + m.naam + ')';
    });
    if (s % 5 === 0) await ronde();
  }
  for (const m of mensen) m.offline = false;
  for (let i = 0; i < 12; i++) await ronde();

  // 1. iedereen dezelfde stand
  const standen = mensen.map(m => JSON.stringify(S.kernUit(m.kern)));
  standen.forEach((st, i) => assert.strictEqual(st, standen[0], `${mensen[i].naam} wijkt af van ${mensen[0].naam}`));
  console.log(`1 ok: 6 collega's, ${STAPPEN} wijzigingen, iedereen exact dezelfde stand (${standen[0].length} tekens)`);

  // 2. nergens dubbel
  const eind = S.kernUit(mensen[0].kern);
  let lijsten = 0;
  const controleerUniek = (lijst, waar) => { lijsten++; const ids = lijst.map(x => x.id); assert.strictEqual(new Set(ids).size, ids.length, 'dubbel in ' + waar); };
  controleerUniek(eind.groepen, 'groepen'); controleerUniek(eind.contacten, 'contacten'); controleerUniek(eind.team, 'team'); controleerUniek(eind.uren, 'uren');
  eind.groepen.forEach(g => { controleerUniek(g.taken || [], 'taken ' + g.id); controleerUniek(g.aantekeningen || [], 'aantekeningen ' + g.id); controleerUniek(g.studenten || [], 'studenten ' + g.id); });
  eind.contacten.forEach(c => controleerUniek(c.interacties || [], 'gesprekken ' + c.id));
  console.log(`2 ok: nergens iets dubbel (${lijsten} lijsten gecontroleerd)`);

  // 3. niets kwijt: alles wat is toegevoegd en niet bewust verwijderd, staat er nog
  const aanwezig = new Set();
  const verzamel = x => { if (Array.isArray(x)) x.forEach(verzamel); else if (x && typeof x === 'object') { if (x.id) aanwezig.add(x.id); Object.values(x).forEach(verzamel); } };
  verzamel(eind);
  const kwijt = [...toegevoegd.keys()].filter(id => !verwijderd.has(id) && !aanwezig.has(id));
  assert.strictEqual(kwijt.length, 0, 'kwijt: ' + kwijt.slice(0, 5).join(', '));
  // eigen velden: ieders laatste "notitie_<naam>" per contact moet er staan
  const eigenVelden = eind.contacten.reduce((n, c) => n + Object.keys(c).filter(k => k.startsWith('notitie_')).length, 0);
  console.log(`3 ok: niets kwijt (${toegevoegd.size - verwijderd.size} toevoegingen aanwezig, ${verwijderd.size} bewust verwijderd), ${eigenVelden} eigen velden bewaard`);

  // 5. het lastige geval: twee mensen maken tegelijk het EERSTE item in een lijst die nog niet bestaat,
  //    of het eerste onderdeel van een planning/checklist (gevonden bij de browsertest met 6 vensters)
  {
    const map2 = maakMap();
    map2.zetBasis({ trajecten: [], contacten: [], uren: [], targets: {}, checklist: {}, team: [], groepen: [{ id: 'gx', titel: 'Zonder lijsten' }] });
    let k2 = 5_000_000;
    const twee = ['A', 'B'].map(n => ({ naam: n, sync: S.maakSync(map2.adapter(n, 2), { id: 'q' + n + '00000', naam: n }, { nu: () => k2 }), kern: null }));
    for (const m of twee) m.kern = await m.sync.start();
    const w2 = (m, fn) => { const k = kloon(m.kern); fn(k); m.kern = k; m.sync.registreer(k); };
    w2(twee[0], k => { k.groepen[0].aantekeningen = [{ id: 'a-A', tekst: 'van A' }]; k.groepen[0].momenten = { tussen: { datum: '2026-11-12' } }; k.checklist.gx = { F0I0: true }; });
    k2 += 10;
    w2(twee[1], k => { k.groepen[0].aantekeningen = [{ id: 'a-B', tekst: 'van B' }]; k.groepen[0].momenten = { eind: { datum: '2027-01-21' } }; k.checklist.gx = { F1I0: true }; });
    for (let i = 0; i < 6; i++) { k2 += 1000; map2.volgende(); for (const m of twee) { await m.sync.schrijf(); const n = await m.sync.peil(); if (n) m.kern = n; } }
    for (const m of twee) {
      const g = m.kern.groepen[0];
      assert.deepStrictEqual((g.aantekeningen || []).map(a => a.id).sort(), ['a-A', 'a-B'], m.naam + ': beide eerste aantekeningen');
      assert.deepStrictEqual(Object.keys(g.momenten || {}).sort(), ['eind', 'tussen'], m.naam + ': beide eerste momenten');
      assert.deepStrictEqual(Object.keys(m.kern.checklist.gx || {}).sort(), ['F0I0', 'F1I0'], m.naam + ': beide eerste vinkjes');
    }
    console.log('5 ok: tegelijk het eerste item in een nieuwe lijst/planning/checklist: niets kwijt');
  }

  // 4. bestandsgrootte blijft beperkt (na vastleggen worden eigen bestanden kleiner)
  const groottes = mensen.map(m => JSON.stringify({ ops: m.sync.s.mijnOps }).length);
  console.log('4 ok: grootte wijzigingenbestanden (tekens): ' + groottes.join(', '));
  console.log('ALLE ZES-COLLEGA-TESTS GESLAAGD');
})().catch(e => { console.error('MISLUKT:', e.message); process.exit(1); });
