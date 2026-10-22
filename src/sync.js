/* Campus Gouda CRM — samenwerken in de gedeelde map. Gemaakt door scripts/maak_bron.mjs; niet met de hand aanpassen. */
/* SYNC-START */
/* ============================================================
   SAMENWERKEN IN EEN GEDEELDE MAP (SharePoint/OneDrive)
   - crm-data.json = de basis (zelfde formaat als het oude CRM)
   - crm-wijzigingen/<naam>.json = per persoon een eigen bestand
     met wijzigingen. Alleen jij schrijft in jouw bestand, dus
     OneDrive kan nooit botsen of conflictkopieën maken.
   - Iedereen leest alle bestanden en voegt ze samen per veld
     (de laatste wijziging wint), in een vaste volgorde, zodat
     iedereen exact dezelfde stand ziet.
   ============================================================ */
(function (root) {
  'use strict';
  const KERN = ['trajecten', 'contacten', 'uren', 'targets', 'groepen', 'checklist'];
  const MAP_WIJZIGINGEN = 'crm-wijzigingen';
  const BASIS = 'crm-data.json';
  const VASTGELEGD = '_vastgelegd.json'; // in de map met wijzigingen; het oude CRM komt hier nooit aan
  const kloon = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isIdLijst = a => Array.isArray(a) && a.length > 0 && a.every(x => isObj(x) && typeof x.id === 'string' && x.id);

  function kernUit(d) {
    d = d || {};
    return {
      trajecten: Array.isArray(d.trajecten) ? d.trajecten : [], contacten: Array.isArray(d.contacten) ? d.contacten : [],
      uren: Array.isArray(d.uren) ? d.uren : [], targets: isObj(d.targets) ? d.targets : {},
      groepen: Array.isArray(d.groepen) ? d.groepen : [], checklist: isObj(d.checklist) ? d.checklist : {},
    };
  }

  // ---------- verschil tussen twee standen als losse wijzigingen per pad ----------
  function verschil(oud, nieuw, pad, uit) {
    uit = uit || []; pad = pad || [];
    if (gelijk(oud, nieuw)) return uit;
    if (isObj(oud) && isObj(nieuw)) {
      new Set([...Object.keys(oud), ...Object.keys(nieuw)]).forEach(k => {
        if (!(k in nieuw) || nieuw[k] === undefined) { if (k in oud && oud[k] !== undefined) uit.push({ p: pad.concat(k), d: 1 }); }
        else if (!(k in oud) || oud[k] === undefined) uit.push({ p: pad.concat(k), v: kloon(nieuw[k]) });
        else verschil(oud[k], nieuw[k], pad.concat(k), uit);
      });
      return uit;
    }
    const idOud = isIdLijst(oud) || (Array.isArray(oud) && oud.length === 0 && isIdLijst(nieuw));
    const idNieuw = isIdLijst(nieuw) || (Array.isArray(nieuw) && nieuw.length === 0 && isIdLijst(oud));
    if (idOud && idNieuw) {
      const mo = new Map(oud.map(x => [x.id, x])), mn = new Map(nieuw.map(x => [x.id, x]));
      mo.forEach((x, id) => { if (!mn.has(id)) uit.push({ p: pad.concat('#' + id), d: 1 }); });
      mn.forEach((x, id) => {
        if (!mo.has(id)) uit.push({ p: pad.concat('#' + id), v: kloon(x) });
        else verschil(mo.get(id), x, pad.concat('#' + id), uit);
      });
      return uit;
    }
    uit.push({ p: pad, v: kloon(nieuw) });
    return uit;
  }

  // ---------- één wijziging toepassen ----------
  function pasToe(stand, op) {
    const p = op.p;
    if (!p.length) return;
    let cur = stand;
    for (let i = 0; i < p.length - 1; i++) {
      const seg = p[i], volgende = p[i + 1];
      const leeg = () => (String(volgende).startsWith('#') ? [] : {});
      if (String(seg).startsWith('#')) {
        if (!Array.isArray(cur)) return;
        const el = cur.find(x => isObj(x) && x.id === seg.slice(1));
        if (!el) return; // ouder bestaat niet (meer): wijziging vervalt
        cur = el;
      } else {
        if (!isObj(cur)) return;
        if (cur[seg] === undefined || cur[seg] === null) { if (op.d) return; cur[seg] = leeg(); }
        cur = cur[seg];
      }
    }
    const laatste = p[p.length - 1];
    if (String(laatste).startsWith('#')) {
      if (!Array.isArray(cur)) return;
      const id = laatste.slice(1), i = cur.findIndex(x => isObj(x) && x.id === id);
      if (op.d) { if (i >= 0) cur.splice(i, 1); }
      else if (i >= 0) cur[i] = kloon(op.v); else cur.push(kloon(op.v));
    } else {
      if (!isObj(cur)) return;
      if (op.d) delete cur[laatste]; else cur[laatste] = kloon(op.v);
    }
  }

  // vaste volgorde: tijd, dan wie, dan volgnummer → iedereen komt op dezelfde stand
  const volgorde = (a, b) => (a.t - b.t) || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0) || (a.n - b.n);

  // basis + alle wijzigingen van iedereen → de gedeelde stand
  // De basis die het nieuwe CRM vastlegt, vermeldt zelf welke wijzigingen erin zitten. Heeft het oude CRM de basis
  // overschreven (zonder die vermelding), dan geldt het losse vastlegbestand: het oude CRM begon met de vastgelegde stand.
  function basisTot(basis, marker) {
    if (basis && isObj(basis._basisTot)) return basis._basisTot;
    if (marker && isObj(marker.tot)) return marker.tot;
    return {};
  }
  function vouw(basis, bestanden, marker) {
    const stand = kernUit(kloon(basis || {}));
    const tot = basisTot(basis, marker);
    const ops = [];
    let maxT = 0;
    (bestanden || []).forEach(b => (b.ops || []).forEach(o => {
      maxT = Math.max(maxT, o.t || 0);
      if (tot[o.w] !== undefined && o.n <= tot[o.w]) return; // zit al in de basis
      ops.push(o);
    }));
    ops.sort(volgorde).forEach(o => pasToe(stand, o));
    return { stand, maxT };
  }

  // per pad alleen de nieuwste eigen wijziging bewaren; wat al in de basis zit mag weg
  function comprimeer(ops, basisTot, wie) {
    const tot = basisTot && basisTot[wie] !== undefined ? basisTot[wie] : -1;
    const perPad = new Map();
    ops.forEach(o => { if (o.n <= tot) return; const k = JSON.stringify(o.p); const x = perPad.get(k); if (!x || volgorde(o, x) > 0) perPad.set(k, o); });
    let lijst = [...perPad.values()].sort(volgorde);
    // een latere wijziging van een heel object maakt eerdere wijzigingen daarbinnen overbodig
    lijst = lijst.filter(o => !lijst.some(s => s !== o && s.p.length < o.p.length && volgorde(s, o) > 0 && s.p.every((seg, i) => seg === o.p[i])));
    return lijst;
  }

  const veiligeNaam = s => String(s || 'collega').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'collega';

  // ---------- de koppeling met de gedeelde map ----------
  // adapter: { lijst() → [{naam, gewijzigd}], lees(naam) → tekst, schrijf(naam, tekst), leesBasis() → {tekst, gewijzigd}, schrijfBasis(tekst) }
  function maakSync(adapter, ik, opties) {
    opties = opties || {};
    const nu = opties.nu || (() => Date.now());
    const bestandsnaam = veiligeNaam(ik.naam) + '-' + ik.id.slice(0, 6) + '.json';
    const s = {
      ik, bestandsnaam,
      basis: null, basisGewijzigd: 0,
      bestanden: new Map(),   // naam → { gewijzigd, data }
      marker: null,
      mijnOps: [], volgnr: 0, maxT: 0,
      laatsteKern: null, teSchrijven: false,
    };
    function stempel() { s.maxT = Math.max(nu(), s.maxT + 1); return s.maxT; }
    function alleBestanden() {
      const lijst = [];
      s.bestanden.forEach((b, naam) => { if (naam !== bestandsnaam && naam !== VASTGELEGD && b.data) lijst.push(b.data); });
      lijst.push({ ops: s.mijnOps });
      return lijst;
    }
    function bereken() {
      const r = vouw(s.basis, alleBestanden(), s.marker);
      s.maxT = Math.max(s.maxT, r.maxT);
      return r.stand;
    }
    async function leesAlles(alleenGewijzigd) {
      let veranderd = false;
      try {
        const b = await adapter.leesBasis();
        if (!alleenGewijzigd || b.gewijzigd !== s.basisGewijzigd) {
          const nieuw = b.tekst && b.tekst.trim() ? JSON.parse(b.tekst) : {};
          if (!s.basis || !gelijk(nieuw, s.basis)) veranderd = true;
          s.basis = nieuw; s.basisGewijzigd = b.gewijzigd;
        }
      } catch (e) { if (!s.basis) s.basis = {}; }
      const lijst = await adapter.lijst();
      for (const f of lijst) {
        if (!/\.json$/i.test(f.naam)) continue;
        const oud = s.bestanden.get(f.naam);
        if (alleenGewijzigd && oud && oud.gewijzigd === f.gewijzigd) continue;
        try {
          const tekst = await adapter.lees(f.naam);
          const data = tekst && tekst.trim() ? JSON.parse(tekst) : null;
          if (!oud || !gelijk(oud.data, data)) veranderd = true;
          if (f.naam === VASTGELEGD) s.marker = data;
          else s.bestanden.set(f.naam, { gewijzigd: f.gewijzigd, data });
        } catch (e) { /* half geschreven of nog niet gesynchroniseerd: volgende keer opnieuw */ }
      }
      return veranderd;
    }
    const api = {
      s,
      // eerste keer: alles inlezen, eigen eerdere wijzigingen terugzetten
      async start() {
        await leesAlles(false);
        const eigen = s.bestanden.get(bestandsnaam);
        if (eigen && eigen.data && Array.isArray(eigen.data.ops)) {
          s.mijnOps = eigen.data.ops;
          s.volgnr = Math.max(eigen.data.volgnr || 0, ...s.mijnOps.map(o => o.n));
        }
        s.laatsteKern = bereken();
        return s.laatsteKern;
      },
      // de app is veranderd: leg de verschillen vast als eigen wijzigingen
      registreer(kern) {
        if (!s.laatsteKern) return 0;
        const ops = verschil(kernUit(s.laatsteKern), kernUit(kern));
        if (!ops.length) return 0;
        ops.forEach(o => { o.t = stempel(); o.w = ik.id; o.n = ++s.volgnr; s.mijnOps.push(o); });
        s.laatsteKern = kloon(kernUit(kern));
        s.teSchrijven = true;
        return ops.length;
      },
      // eigen bestand wegschrijven (alleen jij schrijft hierin)
      async schrijf(forceer) {
        if (!s.teSchrijven && !forceer) return false;
        s.mijnOps = comprimeer(s.mijnOps, basisTot(s.basis, s.marker), ik.id);
        const data = { app: 'Campus Gouda CRM wijzigingen', versie: 1, gebruiker: { id: ik.id, naam: ik.naam }, actief: nu(), volgnr: s.volgnr, ops: s.mijnOps };
        s.teSchrijven = false;
        await adapter.schrijf(bestandsnaam, JSON.stringify(data));
        s.bestanden.set(bestandsnaam, { gewijzigd: -1, data });
        return true;
      },
      // kijken of collega's iets hebben veranderd; geeft de nieuwe stand terug of null
      async peil() {
        const veranderd = await leesAlles(true);
        if (!veranderd) return null;
        // is er vastgelegd? dan mag het eigen bestand kleiner worden
        const tot = basisTot(s.basis, s.marker);
        if (tot[ik.id] !== undefined && s.mijnOps.some(o => o.n <= tot[ik.id])) s.teSchrijven = true;
        const stand = bereken();
        if (gelijk(stand, s.laatsteKern)) return null;
        s.laatsteKern = stand;
        return stand;
      },
      // stand opnieuw berekenen (bijv. na eigen schrijfactie of direct na registreren)
      stand() { return bereken(); },
      collegas() {
        const uit = [];
        s.bestanden.forEach((b, naam) => { if (naam !== bestandsnaam && naam !== VASTGELEGD && b.data && b.data.gebruiker) uit.push({ naam: b.data.gebruiker.naam, actief: b.data.actief || 0, wijzigingen: (b.data.ops || []).length }); });
        return uit.sort((a, b) => b.actief - a.actief);
      },
      // alles vastleggen in crm-data.json (ook leesbaar voor het oude CRM); wijzigingsbestanden worden daarna kleiner
      async legVast() {
        await leesAlles(true);
        const stand = bereken();
        const tot = Object.assign({}, basisTot(s.basis, s.marker));
        alleBestanden().forEach(b => (b.ops || []).forEach(o => { tot[o.w] = Math.max(tot[o.w] === undefined ? -1 : tot[o.w], o.n); }));
        const id = ik.id.slice(0, 6) + '-' + nu();
        const basis = Object.assign({ app: 'Campus Gouda CRM', version: 4, exportedAt: new Date(nu()).toISOString() }, stand, { _basisTot: tot, _vastlegId: id, _vastgelegdDoor: ik.naam });
        await adapter.schrijfBasis(JSON.stringify(basis, null, 2));
        const marker = { id, tot, door: ik.naam, op: nu() };
        await adapter.schrijf(VASTGELEGD, JSON.stringify(marker));
        s.basis = basis; s.marker = marker;
        s.mijnOps = comprimeer(s.mijnOps, tot, ik.id);
        s.teSchrijven = true;
        await api.schrijf(true);
        s.laatsteKern = bereken();
        return s.laatsteKern;
      },
    };
    return api;
  }

  // ---------- adapters ----------
  function fsaAdapter(mapHandle) {
    let sub = null;
    const wijzigingenMap = async () => sub || (sub = await mapHandle.getDirectoryHandle(MAP_WIJZIGINGEN, { create: true }));
    const schrijfNaar = async (fh, tekst) => { const w = await fh.createWritable(); await w.write(tekst); await w.close(); };
    return {
      async lijst() {
        const d = await wijzigingenMap(), uit = [];
        for await (const [naam, h] of d.entries()) { if (h.kind === 'file') { const f = await h.getFile(); uit.push({ naam, gewijzigd: f.lastModified + ':' + f.size }); } }
        return uit;
      },
      async lees(naam) { const d = await wijzigingenMap(); const f = await (await d.getFileHandle(naam)).getFile(); return f.text(); },
      async schrijf(naam, tekst) { const d = await wijzigingenMap(); await schrijfNaar(await d.getFileHandle(naam, { create: true }), tekst); },
      async leesBasis() {
        try { const f = await (await mapHandle.getFileHandle(BASIS)).getFile(); return { tekst: await f.text(), gewijzigd: f.lastModified + ':' + f.size }; }
        catch (e) { return { tekst: '', gewijzigd: 'geen' }; }
      },
      async schrijfBasis(tekst) { await schrijfNaar(await mapHandle.getFileHandle(BASIS, { create: true }), tekst); },
    };
  }
  // alleen voor testen: een "gedeelde map" achter een lokale testserver
  function httpAdapter(url) {
    const u = url.replace(/\/$/, '');
    return {
      async lijst() { return (await fetch(u + '/lijst')).json(); },
      async lees(naam) { const r = await fetch(u + '/bestand/' + encodeURIComponent(naam)); return r.ok ? r.text() : ''; },
      async schrijf(naam, tekst) { await fetch(u + '/bestand/' + encodeURIComponent(naam), { method: 'PUT', body: tekst }); },
      async leesBasis() { const r = await fetch(u + '/basis'); return r.ok ? { tekst: await r.text(), gewijzigd: r.headers.get('x-gewijzigd') || '' } : { tekst: '', gewijzigd: 'geen' }; },
      async schrijfBasis(tekst) { await fetch(u + '/basis', { method: 'PUT', body: tekst }); },
    };
  }

  const api = { KERN, MAP_WIJZIGINGEN, BASIS, VASTGELEGD, basisTot, kernUit, verschil, pasToe, vouw, comprimeer, maakSync, fsaAdapter, httpAdapter, veiligeNaam };
  root.CGSYNC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* SYNC-END */
