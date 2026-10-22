const S = require('../src/sync.js');
const assert = require('assert');
// gedeelde map in het geheugen, met vertraging: een geschreven bestand is pas na 'lag' rondes zichtbaar voor anderen
function maakMap() {
  const bestanden = new Map(); let basis = { tekst: '', v: 0 }; let ronde = 0;
  return {
    volgende() { ronde++; },
    adapter(wie, lag) {
      const zicht = new Map();
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
const kloon = x => JSON.parse(JSON.stringify(x));
(async () => {
  const map = maakMap();
  map.zetBasis({ trajecten: [{ id: 't1', titel: 'Traject 1' }], contacten: [], uren: [], targets: {}, checklist: {},
    groepen: [{ id: 'g1', groepsnummer: 'Groep 1.1', titel: 'Oud', studenten: [{ id: 's1', naam: 'A' }] }, { id: 'g2', groepsnummer: 'Groep 1.2', titel: 'Twee' }] });
  let klok = 1000000;
  const mensen = ['Tester-A', 'Tester-B', 'Tester-C'].map((naam, i) => {
    const scheef = naam === 'Tester-C' ? -600000 : 0; // Tester-C' klok loopt 10 minuten achter
    const sync = S.maakSync(map.adapter(naam, 2), { id: naam.toLowerCase() + '00000', naam }, { nu: () => klok + scheef });
    return { naam, sync, kern: null };
  });
  for (const m of mensen) m.kern = await m.sync.start();
  const wijzig = (m, fn) => { const k = kloon(m.kern); fn(k); m.kern = k; m.sync.registreer(k); };
  const ronde = async () => { klok += 1000; map.volgende(); for (const m of mensen) { await m.sync.schrijf(); const n = await m.sync.peil(); if (n) m.kern = n; } };

  // 1. gelijktijdig aan dezelfde groep, verschillende velden
  wijzig(mensen[0], k => { k.groepen[0].titel = 'Nieuwe titel (Tester-A)'; });
  wijzig(mensen[1], k => { k.groepen[0].taken = [{ id: 'tk1', tekst: 'Reactie?', status: 'open' }]; });
  wijzig(mensen[2], k => { k.checklist.g1 = { F0I0: true }; k.groepen[0].studenten.push({ id: 's2', naam: 'B' }); });
  for (let i = 0; i < 4; i++) await ronde();
  for (const m of mensen) {
    const g = m.kern.groepen.find(x => x.id === 'g1');
    assert.strictEqual(g.titel, 'Nieuwe titel (Tester-A)', m.naam + ' titel');
    assert.strictEqual(g.taken.length, 1, m.naam + ' taak van Tester-B');
    assert.strictEqual(g.studenten.length, 2, m.naam + ' student van Tester-C');
    assert.strictEqual(m.kern.checklist.g1.F0I0, true, m.naam + ' vinkje van Tester-C');
  }
  console.log('1 ok: drie mensen tegelijk aan één groep, niets kwijt');

  // 2. hetzelfde veld: de laatste wint, iedereen ziet hetzelfde; Tester-C (klok achter) ziet Tester-A's wijziging en past daarna aan → Tester-C wint toch
  wijzig(mensen[0], k => { k.groepen[1].titel = 'Tester-A was eerst'; });
  for (let i = 0; i < 4; i++) await ronde();
  wijzig(mensen[2], k => { k.groepen[1].titel = 'Tester-C kwam daarna'; });
  for (let i = 0; i < 4; i++) await ronde();
  mensen.forEach(m => assert.strictEqual(m.kern.groepen.find(x => x.id === 'g2').titel, 'Tester-C kwam daarna', m.naam + ' klokverschil'));
  console.log('2 ok: latere wijziging wint, ook met een achterlopende klok');

  // 3. echt gelijktijdig hetzelfde veld: iedereen komt op dezelfde waarde uit
  wijzig(mensen[0], k => { k.groepen[1].vorm = 'Tester-A'; });
  wijzig(mensen[1], k => { k.groepen[1].vorm = 'Tester-B'; });
  for (let i = 0; i < 4; i++) await ronde();
  const waarden = mensen.map(m => m.kern.groepen.find(x => x.id === 'g2').vorm);
  assert.ok(waarden.every(v => v === waarden[0]), 'convergentie ' + waarden);
  console.log('3 ok: gelijktijdig hetzelfde veld → iedereen ziet', waarden[0]);

  // 4. verwijderen terwijl een ander bewerkt
  wijzig(mensen[0], k => { k.groepen[0].taken = []; });
  wijzig(mensen[1], k => { k.groepen[0].taken[0].status = 'klaar'; });
  for (let i = 0; i < 4; i++) await ronde();
  const t4 = mensen.map(m => JSON.stringify(m.kern.groepen[0].taken));
  assert.ok(t4.every(v => v === t4[0]), 'convergentie verwijderen');
  console.log('4 ok: verwijderen tegen bewerken komt overal gelijk uit:', t4[0]);

  // 5. nieuw toegevoegde groepen door twee mensen
  wijzig(mensen[1], k => { k.groepen.push({ id: 'g3', groepsnummer: 'Groep 2.1' }); });
  wijzig(mensen[2], k => { k.groepen.push({ id: 'g4', groepsnummer: 'Groep 3.1' }); });
  for (let i = 0; i < 4; i++) await ronde();
  mensen.forEach(m => assert.deepStrictEqual(m.kern.groepen.map(g => g.id).sort(), ['g1', 'g2', 'g3', 'g4']));
  console.log('5 ok: groepen van twee mensen allebei toegevoegd');

  // 6. opnieuw opstarten (pagina herladen): stand komt terug, volgnummers lopen door
  const herstart = S.maakSync(map.adapter('Tester-B', 2), { id: 'tester-b00000', naam: 'Tester-B' }, { nu: () => klok });
  const k6 = await herstart.start();
  assert.ok(JSON.stringify(k6) === JSON.stringify(mensen[1].kern), 'herstart gelijk');
  assert.ok(herstart.s.volgnr >= mensen[1].sync.s.volgnr, 'volgnr loopt door');
  console.log('6 ok: na herladen dezelfde stand');

  // 7. vastleggen in crm-data.json, daarna verder werken; stand blijft gelijk en bestanden krimpen
  const voor = JSON.stringify(mensen[0].kern);
  const opsVoor = mensen[1].sync.s.mijnOps.length;
  mensen[0].kern = await mensen[0].sync.legVast();
  for (let i = 0; i < 4; i++) await ronde();
  mensen.forEach(m => assert.strictEqual(JSON.stringify(m.kern), voor, m.naam + ' na vastleggen'));
  console.log('7 ok: vastgelegd, stand gelijk. Wijzigingen Tester-B:', opsVoor, '→', mensen[1].sync.s.mijnOps.length);
  wijzig(mensen[1], k => { k.groepen[0].titel = 'Na vastleggen'; });
  for (let i = 0; i < 4; i++) await ronde();
  mensen.forEach(m => assert.strictEqual(m.kern.groepen[0].titel, 'Na vastleggen'));
  console.log('7b ok: na vastleggen gewoon verder werken');

  // 8. oude CRM schrijft crm-data.json zonder _basisTot (iemand werkt nog in de oude versie)
  const oud = JSON.parse(JSON.stringify(mensen[0].kern)); oud.trajecten[0].titel = 'Gewijzigd in oude CRM'; delete oud._basisTot;
  await map.adapter('oud', 0).schrijfBasis(JSON.stringify(Object.assign({ app: 'Campus Gouda CRM', version: 4 }, oud)));
  for (let i = 0; i < 4; i++) await ronde();
  mensen.forEach(m => { assert.strictEqual(m.kern.trajecten[0].titel, 'Gewijzigd in oude CRM'); assert.strictEqual(m.kern.groepen[0].titel, 'Na vastleggen'); });
  console.log('8 ok: wijziging uit het oude CRM komt door, nieuwere wijzigingen blijven staan');

  // 8b. precies het scenario uit de browsertest: Tester-B (9) en Tester-C (10) op hetzelfde veld, Tester-C wint; vastleggen;
  //     Tester-B heeft zijn bestand nog niet opgeschoond; daarna schrijft het oude CRM de basis terug zonder vastleginformatie
  wijzig(mensen[1], k => { k.groepen[1].vorm = '9 weken'; });
  for (let i = 0; i < 4; i++) await ronde();
  wijzig(mensen[2], k => { k.groepen[1].vorm = '10 weken'; });
  for (let i = 0; i < 4; i++) await ronde();
  mensen[2].kern = await mensen[2].sync.legVast();
  const b8 = JSON.parse((await map.adapter('oud', 0).leesBasis()).tekst);
  delete b8._basisTot; delete b8._vastlegId; delete b8._vastgelegdDoor; b8.trajecten[0].titel = 'Oude CRM, tweede keer';
  await map.adapter('oud', 0).schrijfBasis(JSON.stringify(b8));
  for (let i = 0; i < 5; i++) await ronde();
  mensen.forEach(m => { assert.strictEqual(m.kern.groepen.find(g => g.id === 'g2').vorm, '10 weken', m.naam + ' 8b vorm'); assert.strictEqual(m.kern.trajecten[0].titel, 'Oude CRM, tweede keer'); });
  console.log('8b ok: oude CRM overschrijft basis na vastleggen; nieuwere waarde (10) blijft staan');

  // 9. willekeurig stresstest: 3 mensen, 200 wijzigingen door elkaar, met vertraging
  for (let i = 0; i < 200; i++) {
    const m = mensen[i % 3];
    wijzig(m, k => {
      const g = k.groepen[Math.floor(Math.random() * k.groepen.length)];
      const r = Math.random();
      if (r < 0.3) g.titel = m.naam + i;
      else if (r < 0.5) { g.taken = g.taken || []; g.taken.push({ id: m.naam + i, tekst: 'taak ' + i }); }
      else if (r < 0.6 && g.taken && g.taken.length) g.taken.splice(0, 1);
      else if (r < 0.8) { k.checklist[g.id] = Object.assign({}, k.checklist[g.id], { ['F1I' + (i % 6)]: true }); }
      else g.momenten = { eind: { datum: '2026-11-' + String(10 + (i % 15)), status: 'gepland' } };
    });
    if (i % 7 === 0) await ronde();
  }
  for (let i = 0; i < 6; i++) await ronde();
  const eind = mensen.map(m => JSON.stringify(m.kern));
  assert.ok(eind.every(v => v === eind[0]), 'stresstest convergentie');
  console.log('9 ok: 200 wijzigingen door elkaar, alle drie exact dezelfde stand (' + eind[0].length + ' tekens)');
  console.log('ALLE TESTS GESLAAGD');
})().catch(e => { console.error('MISLUKT:', e.message); process.exit(1); });
