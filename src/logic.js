/* Campus Gouda CRM — logica (signalen, planning, taken). Gemaakt door scripts/maak_bron.mjs; niet met de hand aanpassen. */
/* LOGIC-START */
/* ============================================================
   PLANNING, SIGNALEN EN TAKEN (rekenlogica, los van de schermen)
   Alle nieuwe gegevens staan in het groep-object zelf
   (momenten, start, duurWeken, taken, verborgen), zodat de oude
   CRM-versie met hetzelfde crm-data.json blijft werken.
   ============================================================ */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  function isoVanDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateVanIso(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function geldigeIso(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }
  function maakIso(y, m, d) { const iso = y + '-' + pad(m) + '-' + pad(d); return geldigeIso(iso) ? iso : ''; }
  function addDays(iso, n) { const d = dateVanIso(iso); d.setDate(d.getDate() + n); return isoVanDate(d); }
  function diffDays(a, b) { return Math.round((dateVanIso(a) - dateVanIso(b)) / 86400000); }
  function vandaagISO() {
    if (root.CGT_VANDAAG && geldigeIso(root.CGT_VANDAAG)) return root.CGT_VANDAAG;
    return isoVanDate(new Date());
  }
  const FMT_KORT = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  const FMT_LANG = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const FMT_DM = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
  const FMT_JAAR = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const zp = s => s.replace(/\./g, '');
  const datumKort = iso => geldigeIso(iso) ? zp(FMT_KORT.format(dateVanIso(iso))) : '';
  const datumLang = iso => geldigeIso(iso) ? FMT_LANG.format(dateVanIso(iso)) : '';
  const datumDM = iso => geldigeIso(iso) ? zp(FMT_DM.format(dateVanIso(iso))) : '';
  const datumJaar = iso => geldigeIso(iso) ? zp(FMT_JAAR.format(dateVanIso(iso))) : '';
  function maandagVan(iso) { const dag = dateVanIso(iso).getDay() || 7; return addDays(iso, 1 - dag); }
  // herinneringen niet in het weekend: zaterdag en zondag schuiven door naar maandag
  function werkdag(iso) { const dag = dateVanIso(iso).getDay(); return dag === 6 ? addDays(iso, 2) : dag === 0 ? addDays(iso, 1) : iso; }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const nieuwId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const over = d => d === 0 ? 'vandaag' : d === 1 ? 'morgen' : d === -1 ? 'gisteren' : d > 0 ? 'over ' + d + ' dagen' : d * -1 + ' dagen geleden';

  // ---------- momenten ----------
  const MOMENTEN = [
    { id: 'kennismaking', naam: 'Kennismaking', oudVeld: '' },
    { id: 'kickoff', naam: 'Kick-off', oudVeld: 'kickoff' },
    { id: 'tussen', naam: 'Tussenpresentatie', oudVeld: 'tussenpresentatie' },
    { id: 'eind', naam: 'Eindpresentatie', oudVeld: 'eindpresentatie' },
  ];
  const MOMENT_STATUS = ['open', 'indicatie', 'gepland', 'nvt'];

  // ---------- vrije tekst → datum (zoals in het Excel-overzicht) ----------
  const MAAND = { jan: 1, januari: 1, feb: 2, februari: 2, mrt: 3, maart: 3, mar: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6,
    jul: 7, juli: 7, aug: 8, augustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, dec: 12, december: 12 };
  const MAAND_RE = '(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|sept|jan|feb|mrt|mar|apr|jun|jul|aug|sep|okt|oct|nov|dec)\\.?';
  function excelSerieel(n) {
    const d = new Date(Math.round((n - 25569) * 86400000));
    const frac = n - Math.floor(n);
    let tijd = '';
    if (frac > 0.0001) { const min = Math.round(frac * 1440); tijd = pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
    return { iso: d.toISOString().slice(0, 10), tijd };
  }
  function kiesJaar(d, m, ref) {
    const y = Number(ref.slice(0, 4));
    let best = '', afstand = Infinity;
    [y - 1, y, y + 1].forEach(j => { const iso = maakIso(j, m, d); if (iso && Math.abs(diffDays(iso, ref)) < afstand) { best = iso; afstand = Math.abs(diffDays(iso, ref)); } });
    return best;
  }
  function vindTijd(s) {
    let m = s.match(/\b(\d{1,2})[:.](\d{2})\b(?:\s*(?:-|–|tot)\s*(\d{1,2})(?:[:.](\d{2}))?\b)?/);
    if (m && Number(m[1]) <= 23 && Number(m[2]) <= 59) {
      const van = pad(m[1]) + ':' + m[2];
      return m[3] && Number(m[3]) <= 23 ? van + '–' + pad(m[3]) + ':' + (m[4] || '00') : van;
    }
    m = s.match(/\bvan\s+(\d{1,2})\s*(?:-|–|tot)\s*(\d{1,2})\b/);
    if (m && Number(m[1]) <= 23 && Number(m[2]) <= 23) return pad(m[1]) + ':00–' + pad(m[2]) + ':00';
    m = s.match(/\b(\d{1,2})\s*u(?:ur)?\b/);
    if (m && Number(m[1]) <= 23) return pad(m[1]) + ':00';
    return '';
  }
  function zoekDatum(s, ref) {
    let onzeker = /\bof\b|\bweek\b|\boptie|\bplannen\b|\binplannen\b|\bnog\b|\brond\b|\bcirca\b|\bca\.|\?|\bvoorlopig|\bonder voorbehoud|\bvermoedelijk|\bwaarschijnlijk/.test(s);
    let datum = '', m = null;
    if ((m = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/))) datum = maakIso(+m[1], +m[2], +m[3]);
    if (!datum) {
      for (const x of s.matchAll(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/g)) {
        const j = x[3].length === 2 ? 2000 + Number(x[3]) : Number(x[3]);
        if (j < 2020 || j > 2040) continue;
        const iso = maakIso(j, Number(x[2]), Number(x[1]));
        if (iso) { datum = iso; m = x; break; }
      }
    }
    if (!datum && (m = s.match(new RegExp('\\b(\\d{1,2})\\s*(?:-|–|t/m|tot|en)\\s*(\\d{1,2})\\s+' + MAAND_RE + '(?:\\s+(20\\d{2}))?')))) {
      datum = m[4] ? maakIso(+m[4], MAAND[m[3]], +m[1]) : kiesJaar(+m[1], MAAND[m[3]], ref);
      onzeker = true;
    }
    if (!datum && (m = s.match(new RegExp('\\b(\\d{1,2})(?:e|ste|de)?\\s*' + MAAND_RE + '(?:\\s+(20\\d{2}))?')))) {
      datum = m[3] ? maakIso(+m[3], MAAND[m[2]], +m[1]) : kiesJaar(+m[1], MAAND[m[2]], ref);
    }
    if (!datum) {
      m = null;
      for (const x of s.matchAll(/\b(\d{1,2})[-\/](\d{1,2})\b(?![-\/.:]\d)/g)) {
        if (/van\s$|tot\s$/.test(s.slice(Math.max(0, x.index - 4), x.index))) continue;
        if (/^\s*u(ur)?\b/.test(s.slice(x.index + x[0].length))) continue;
        const iso = Number(x[2]) <= 12 ? kiesJaar(Number(x[1]), Number(x[2]), ref) : '';
        if (iso) { datum = iso; m = x; break; }
      }
    }
    const rest = m && datum ? s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length) : s;
    return { datum, tijd: datum ? vindTijd(rest) : '', onzeker };
  }
  function parseNLDatum(invoer, ref) {
    ref = geldigeIso(ref) ? ref : vandaagISO();
    const leeg = { datum: '', tijd: '', status: 'open', notitie: '' };
    if (invoer === null || invoer === undefined || invoer === '') return leeg;
    if (typeof invoer === 'number') {
      if (invoer > 20000 && invoer < 80000) { const r = excelSerieel(invoer); return { datum: r.iso, tijd: r.tijd, status: 'gepland', notitie: '' }; }
      return leeg;
    }
    const tekst = String(invoer).replace(/\s+/g, ' ').trim();
    if (!tekst) return leeg;
    if (/^\d{5}(\.\d+)?$/.test(tekst)) { const r = excelSerieel(parseFloat(tekst)); return { datum: r.iso, tijd: r.tijd, status: 'gepland', notitie: '' }; }
    const s = tekst.toLowerCase();
    if (/^(nvt|n\.v\.t\.?|niet van toepassing|vervalt|geen)\b/.test(s)) return { datum: '', tijd: '', status: 'nvt', notitie: '' };
    const verplaatst = s.match(/^(.*?)\(?\s*verplaatst naar\s+(.*)$/);
    let r = verplaatst ? zoekDatum(verplaatst[2], ref) : null, viaOud = false;
    if (!r || !r.datum) { r = zoekDatum(verplaatst ? verplaatst[1] : s, ref); viaOud = !!verplaatst; }
    if (!r.datum) return { datum: '', tijd: '', status: 'open', notitie: tekst };
    const onzeker = r.onzeker || viaOud;
    // een kale ISO-datum (uit de oude import) is gewoon gepland
    return { datum: r.datum, tijd: r.tijd, status: onzeker ? 'indicatie' : 'gepland', notitie: (onzeker || verplaatst) ? tekst : '' };
  }
  function parseDuur(tekst) {
    const m = String(tekst || '').match(/\b(\d{1,2})\s*-?\s*(?:weken|weeks|week|wk)\b/i);
    const n = m ? Number(m[1]) : 0;
    return n > 0 && n < 80 ? n : null;
  }
  function parseSemester(naam) {
    const s = String(naam || '').toLowerCase();
    let m = s.match(/(\d{2,4})\s*[-\/]\s*(\d{2,4})\s*sem(?:ester)?\s*([12])/), jaar1, sem;
    if (m) { jaar1 = Number(m[1]); if (jaar1 < 100) jaar1 += 2000; sem = Number(m[3]); }
    else if ((m = s.match(/(20\d{2})\s*sem(?:ester)?\s*([12])/))) { sem = Number(m[2]); jaar1 = sem === 1 ? Number(m[1]) : Number(m[1]) - 1; }
    else return null;
    const start = sem === 1 ? maakIso(jaar1, 9, 1) : maakIso(jaar1 + 1, 2, 1);
    return { label: `Semester ${sem} ${jaar1}/${jaar1 + 1}`, start, ref: addDays(start, 70) };
  }

  // ---------- groep lezen (met terugval op de oude tekstvelden) ----------
  function momentenVan(g, ref) {
    const uit = {};
    MOMENTEN.forEach(mo => {
      const x = g.momenten && g.momenten[mo.id];
      if (x && MOMENT_STATUS.includes(x.status)) {
        uit[mo.id] = { datum: geldigeIso(x.datum) ? x.datum : '', tijd: x.tijd || '', status: x.status, notitie: x.notitie || '' };
      } else if (mo.oudVeld && g[mo.oudVeld]) {
        uit[mo.id] = parseNLDatum(g[mo.oudVeld], ref);
      } else uit[mo.id] = { datum: '', tijd: '', status: 'open', notitie: '' };
    });
    return uit;
  }
  // tekst voor het oude veld, zodat de oude CRM-versie en de Excel-export iets leesbaars tonen
  function momentTekst(x) {
    if (!x) return '';
    if (x.status === 'nvt') return 'n.v.t.';
    if (x.datum && (x.status === 'gepland' || x.status === 'indicatie'))
      return (x.status === 'indicatie' ? '± ' : '') + datumJaar(x.datum) + (x.tijd ? ' ' + x.tijd : '') + (x.notitie && x.status === 'gepland' ? ' · ' + x.notitie : '');
    return x.notitie || '';
  }
  function duurVan(g) { const n = Number(g.duurWeken); return n > 0 && n < 80 ? Math.round(n) : parseDuur(g.vorm); }
  const vast = (m, id) => m[id] && m[id].status === 'gepland' && m[id].datum ? m[id].datum : '';
  const ruw = (m, id) => m[id] && (m[id].status === 'gepland' || m[id].status === 'indicatie') && m[id].datum ? m[id].datum : '';

  function planning(g, vandaag) {
    vandaag = vandaag || vandaagISO();
    const m = momentenVan(g, vandaag);
    const afgeleid = [vast(m, 'kennismaking'), vast(m, 'kickoff')].filter(Boolean).sort()[0]
      || [ruw(m, 'kennismaking'), ruw(m, 'kickoff')].filter(Boolean).sort()[0] || '';
    const start = geldigeIso(g.start) ? g.start : afgeleid;
    const duur = duurVan(g) || 0;
    const eindBerekend = start && duur ? addDays(start, duur * 7) : '';
    const midden = start && duur ? addDays(start, Math.round(duur * 7 / 2)) : '';
    const kickoff = ruw(m, 'kickoff') || start;
    const tussen = vast(m, 'tussen'), eind = vast(m, 'eind');
    const eindDatum = eind || eindBerekend;
    const week = start ? Math.floor(diffDays(vandaag, start) / 7) + 1 : null;
    let fase = 'onbekend';
    if (start) fase = vandaag < start ? 'nog niet gestart' : (eindDatum && vandaag > eindDatum ? 'afgelopen' : 'loopt');
    return { m, start, startAfgeleid: !geldigeIso(g.start) && !!start, duur, eindBerekend, midden, kickoff, tussen, eind, eindDatum, week, fase };
  }

  // ---------- checklist (CHECKLIST komt uit het CRM zelf; sleutels F{fase}I{punt}) ----------
  let FASES = [];
  // per fase: wanneer moet hij klaar zijn
  const ANKERS = [
    { anker: 'kickoff', na: 0, klaar: 'vóór de kick-off' }, { anker: 'kennismaking', na: 0, klaar: 'bij de kennismaking' },
    { anker: 'kickoff', na: 0, klaar: 'bij de kick-off' }, { anker: 'kickoff', na: 14, klaar: '2 weken na de kick-off' },
    { anker: 'tussen', na: 0, klaar: 'bij de tussenpresentatie' }, { anker: 'tussen', na: 14, klaar: '2 weken na de tussenpresentatie' },
    { anker: 'eind', na: 0, klaar: 'bij de eindpresentatie' }, { anker: 'eind', na: 14, klaar: '2 weken na de eindpresentatie' },
  ];
  function init(checklist) { FASES = checklist || []; }
  const ckey = (fi, ii) => `F${fi}I${ii}`;
  function itemStatus(state, fi, ii) { const v = (state || {})[ckey(fi, ii)]; return v === 'nvt' ? 'nvt' : v ? 'ja' : ''; }
  function faseVoortgang(state, fi) {
    const f = FASES[fi]; let klaar = 0;
    (f ? f.items : []).forEach((_, ii) => { if (itemStatus(state, fi, ii)) klaar++; });
    const totaal = f ? f.items.length : 0;
    return { klaar, open: totaal - klaar, totaal };
  }
  function faseAnker(g, p, fi) {
    const a = ANKERS[fi]; if (!a) return '';
    let d = '';
    if (a.anker === 'kickoff') d = p.kickoff;
    else if (a.anker === 'kennismaking') d = ruw(p.m, 'kennismaking') || p.kickoff;
    else if (a.anker === 'tussen') d = p.m.tussen.status === 'nvt' ? '' : (p.tussen || (p.duur >= 6 ? p.midden : ''));
    else if (a.anker === 'eind') d = p.eind || p.eindBerekend;
    return d ? addDays(d, a.na) : '';
  }
  function openPunten(state, fi) {
    const f = FASES[fi]; if (!f) return [];
    return f.items.map((tekst, ii) => ({ fi, ii, tekst })).filter(x => !itemStatus(state, x.fi, x.ii));
  }

  // ---------- bijzonderheden vanuit de opleiding ----------
  const SCHOOLPRES = [{ id: 'schoolTussen', naam: 'Tussenpresentatie op school' }, { id: 'schoolEind', naam: 'Eindpresentatie op school' }];
  function bijzonderhedenVan(g) {
    const b = g.bijzonderheden || {};
    const pres = x => Object.assign({ heeft: '', datum: '', tijd: '', locatie: '', cg: '', og: '', ogUitgenodigd: false }, x || {});
    return { schoolTussen: pres(b.schoolTussen), schoolEind: pres(b.schoolEind), eisen: Array.isArray(b.eisen) ? b.eisen : [], notities: b.notities || '' };
  }

  // ---------- welke gegevens heb ik (berekend uit de groep zelf) ----------
  function gegevens(g) {
    const st = g.studenten || [];
    const n = st.length;
    const tel = (f) => st.filter(f).length;
    const status = (k, tot) => tot === 0 ? 'nee' : k >= tot ? 'ja' : k > 0 ? 'deels' : 'nee';
    const contact = st.find(s => s.isContact);
    const bz = bijzonderhedenVan(g);
    const bekend = SCHOOLPRES.filter(x => bz[x.id].heeft).length;
    return [
      { id: 'studenten', naam: 'Studenten ingevoerd', status: n ? 'ja' : 'nee', uitleg: n ? n + ' studenten' : 'nog geen studenten' },
      { id: 'mail', naam: 'Mailadressen studenten', status: status(tel(s => s.mail), n), uitleg: `${tel(s => s.mail)} van ${n}` },
      { id: 'woonplaats', naam: 'Woonplaats (KPI regio)', status: status(tel(s => s.woonplaats), n), uitleg: `${tel(s => s.woonplaats)} van ${n}` },
      { id: 'docent', naam: 'Docent en mailadres', status: g.docent && g.docentMail ? 'ja' : g.docent || g.docentMail ? 'deels' : 'nee', uitleg: g.docentMail ? '' : 'mailadres docent ontbreekt' },
      { id: 'noodnummer', naam: 'Contactpersoon met telefoon', status: contact && contact.telefoon ? 'ja' : contact || st.some(s => s.telefoon) ? 'deels' : 'nee',
        uitleg: contact ? (contact.telefoon ? contact.naam : 'telefoonnummer ontbreekt') : 'geen contactpersoon aangewezen' },
      { id: 'school', naam: 'Presentaties op school bekend', status: bekend === 2 ? 'ja' : bekend ? 'deels' : 'nee', uitleg: bekend === 2 ? '' : 'vraag na of ze ook op school presenteren' },
    ];
  }

  // ---------- taken en opvolging ----------
  function takenVan(g) { return Array.isArray(g.taken) ? g.taken : []; }
  // een opvolging die aan een moment hangt, is vanzelf klaar zodra dat moment vaststaat
  function taakKlaar(g, t, m) {
    if (t.status === 'klaar') return { klaar: true, waarom: t.klaarOp ? 'afgerond op ' + datumDM(t.klaarOp) : 'afgerond' };
    if (t.moment && m && m[t.moment] && (vast(m, t.moment) || m[t.moment].status === 'nvt'))
      return { klaar: true, waarom: MOMENTEN.find(x => x.id === t.moment).naam.toLowerCase() + ' staat inmiddels vast' };
    return { klaar: false, waarom: '' };
  }
  function nieuweTaak(velden) {
    return Object.assign({ id: nieuwId(), tekst: '', soort: 'opvolgen', aangemaakt: vandaagISO(), herinnerOp: werkdag(addDays(vandaagISO(), 3)),
      status: 'open', klaarOp: '', moment: '', door: '', notitie: '' }, velden || {});
  }

  // ---------- mailen vanuit Outlook ----------
  const MAILSJABLONEN = [
    { id: 'kickoff', moment: 'kickoff', label: 'Kick-off plannen', onderwerp: 'Planning kick-off', herinner: 3,
      tekst: 'Hoi allemaal,\n\nGraag plannen we de kick-off met de opdrachtgever. Kunnen jullie laten weten welke momenten in de komende twee weken jullie uitkomen?\n\nGroet,' },
    { id: 'tussen', moment: 'tussen', label: 'Tussenpresentatie plannen', onderwerp: 'Planning tussenpresentatie', herinner: 3,
      tekst: 'Hoi allemaal,\n\nJullie zijn bijna halverwege. Graag leggen we de datum voor de tussenpresentatie vast. Kunnen jullie een paar momenten voorstellen waarop jullie, de opdrachtgever en de docent kunnen?\n\nGroet,' },
    { id: 'eind', moment: 'eind', label: 'Eindpresentatie plannen', onderwerp: 'Planning eindpresentatie', herinner: 3,
      tekst: 'Hoi allemaal,\n\nHet einde van jullie project komt in zicht. Graag leggen we de datum voor de eindpresentatie vast. Kunnen jullie een paar momenten voorstellen waarop jullie, de opdrachtgever en de docent kunnen?\n\nGroet,' },
    { id: 'producten', moment: '', label: 'Eindproducten aanleveren', onderwerp: 'Aanleveren eindproducten', herinner: 5,
      tekst: 'Hoi allemaal,\n\nDank voor jullie eindpresentatie! Willen jullie het eindverslag, de presentatie en eventuele andere producten naar mij sturen of in Embrace zetten?\n\nGroet,' },
    { id: 'vrij', moment: '', label: 'Eigen bericht', onderwerp: '', herinner: 3, tekst: '' },
  ];
  function mailAdressen(g) { return (g.studenten || []).map(s => (s.mail || '').trim()).filter(x => /@/.test(x)); }
  function mailtoGroep(g, sjabloon, metDocent) {
    const sj = sjabloon || MAILSJABLONEN[MAILSJABLONEN.length - 1];
    const aan = mailAdressen(g).join(';');
    const params = [];
    if (metDocent && g.docentMail) params.push('cc=' + encodeURIComponent(g.docentMail));
    const titel = [g.groepsnummer, g.titel].filter(Boolean).join(' · ');
    if (sj.onderwerp || titel) params.push('subject=' + encodeURIComponent([sj.onderwerp, titel].filter(Boolean).join(' – ')));
    if (sj.tekst) params.push('body=' + encodeURIComponent(sj.tekst));
    return 'mailto:' + aan + (params.length ? '?' + params.join('&') : '');
  }

  // Outlook op het web (Microsoft 365): opent altijd Outlook, ongeacht het standaard mailprogramma van de computer
  function outlookLink(g, sjabloon, metDocent) {
    const sj = sjabloon || MAILSJABLONEN[MAILSJABLONEN.length - 1];
    const titel = [g.groepsnummer, g.titel].filter(Boolean).join(' · ');
    const delen = ['to=' + encodeURIComponent(mailAdressen(g).join(','))];
    if (metDocent && g.docentMail) delen.push('cc=' + encodeURIComponent(g.docentMail));
    const onderwerp = [sj.onderwerp, titel].filter(Boolean).join(' – ');
    if (onderwerp) delen.push('subject=' + encodeURIComponent(onderwerp));
    if (sj.tekst) delen.push('body=' + encodeURIComponent(sj.tekst.replace(/\n/g, '\r\n')));
    return 'https://outlook.office.com/mail/deeplink/compose?' + delen.join('&');
  }
  // mail openen in Outlook (web) of in het mailprogramma van de computer
  function mailLink(g, sjabloon, metDocent, programma) {
    return programma === 'computer' ? mailtoGroep(g, sjabloon, metDocent) : outlookLink(g, sjabloon, metDocent);
  }

  // ---------- herinnering in de Outlook-agenda (.ics) ----------
  const icsTekst = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  function icsHerinnering(g, t) {
    const dag = (t.herinnerOp || vandaagISO()).replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Campus Gouda//CRM taken//NL', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${t.id}@campusgouda-crm`, `DTSTAMP:${stamp}`, `DTSTART:${dag}T090000`, `DTEND:${dag}T091500`,
      `SUMMARY:${icsTekst('Opvolgen ' + (g.groepsnummer || '') + ': ' + t.tekst)}`,
      `DESCRIPTION:${icsTekst([g.titel, t.notitie].filter(Boolean).join('\n'))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${icsTekst('Opvolgen: ' + t.tekst)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  // ---------- signalen per groep ----------
  const NIVEAUS = [
    { id: 'urgent', naam: 'Urgent' }, { id: 'binnenkort', naam: 'Binnenkort plannen' }, { id: 'dezeweek', naam: 'Deze week' },
    { id: 'afronden', naam: 'Afronden' }, { id: 'checklist', naam: 'Checklist loopt achter' }, { id: 'gegevens', naam: 'Gegevens ontbreken' },
  ];
  const VOLGORDE = Object.fromEntries(NIVEAUS.map((n, i) => [n.id, i]));
  const STANDAARD = { eindWeken: 4, tussenWeken: 2 };
  // checklistfases die je doorloopt vóór een moment (voor "deze week")
  const VOORBEREIDING = { kennismaking: [], kickoff: [0], tussen: [3], eind: [5] };

  function signalen(g, state, vandaag, inst) {
    vandaag = vandaag || vandaagISO();
    inst = Object.assign({}, STANDAARD, inst || {});
    const uit = [];
    if (g.gearchiveerd) return uit;
    const p = planning(g, vandaag), m = p.m, k = datumKort;
    // AVG: een jaar na afloop studentgegevens opschonen (ook als de groep verder geschiedenis is)
    if (p.eindDatum && diffDays(vandaag, p.eindDatum) > 365 && !g.geanonimiseerd && ((g.studenten || []).some(st => st.naam || st.mail || st.telefoon) || (g.aantekeningen || []).length)) {
      uit.push({ id: g.id + ':avg', groepId: g.id, regel: 'avg', niveau: 'gegevens', titel: 'Studentgegevens opschonen (AVG)',
        tekst: `De groep is sinds ${k(p.eindDatum)} klaar, langer dan een jaar. Haal namen en contactgegevens van de studenten weg; de groep zelf blijft bewaard.`,
        actie: { label: 'Gegevens opschonen', soort: 'anonimiseer', bevestig: 'Namen, mailadressen, telefoonnummers en woonplaatsen van de studenten in deze groep weghalen, en alle aantekeningen? Dit kan niet ongedaan worden gemaakt.' } });
    }
    if (p.eindDatum && diffDays(vandaag, p.eindDatum) > 56) { const v = g.verborgen || {}; uit.forEach(x => { x.verborgen = !!(v[x.regel] && v[x.regel] > vandaag); }); return uit; } // ruim voorbij: geschiedenis
    const add = (regel, niveau, titel, tekst, extra) => uit.push(Object.assign({ id: g.id + ':' + regel, groepId: g.id, regel, niveau, titel, tekst }, extra || {}));
    const loopt = !p.eindDatum || vandaag <= p.eindDatum;

    if (!p.start) {
      if (m.kickoff.status !== 'nvt') add('start', 'gegevens', 'Startdatum onbekend', 'Vul de datum van de kick-off of een startdatum in. Dan rekent het CRM uit wanneer de presentaties nodig zijn.');
    } else if (!p.duur) add('duur', 'gegevens', 'Duur onbekend', 'Vul de duur in weken in. Daarmee rekent het CRM het einde en het halverwegepunt uit.');

    if (p.start && loopt && m.kickoff.status === 'open') {
      const d = diffDays(p.start, vandaag);
      if (d <= 14) add('kickoff', 'binnenkort', d >= 0 ? 'Kick-off inplannen' : 'Kick-off niet vastgelegd',
        d >= 0 ? `Het project start ${over(d)} (${k(p.start)}). Er is nog geen kick-off gepland.` : `Het project is rond ${k(p.start)} gestart, maar er staat geen kick-off.`,
        { moment: 'kickoff', sorteer: d });
    } else if (loopt && m.kickoff.status === 'indicatie' && m.kickoff.datum) {
      const d = diffDays(m.kickoff.datum, vandaag);
      if (d >= 0 && d <= 14) add('kickoff', 'binnenkort', 'Kick-off vastzetten', `De kick-off staat rond ${k(m.kickoff.datum)} alleen als indicatie. Spreek een vaste datum af.`, { moment: 'kickoff', sorteer: d });
      else if (d < 0) add('kickoff', 'gegevens', 'Kick-off bevestigen', `De kick-off staat nog als indicatie (${k(m.kickoff.datum)}). Was hij op die dag? Zet hem dan op gepland.`, { actie: { label: '✓ Was op die dag', soort: 'kickoffGepland' } });
    }

    const eindVast = vast(m, 'eind');
    if (m.eind.status !== 'nvt' && !eindVast && p.eindBerekend) {
      const d = diffDays(p.eindBerekend, vandaag);
      const ind = m.eind.notitie ? ` In het overzicht staat: \u201c${m.eind.notitie}\u201d.` : '';
      if (d < 0) add('eind', 'urgent', 'Eindpresentatie niet vastgelegd', `Volgens de planning (${p.duur} weken) is het project rond ${k(p.eindBerekend)} afgelopen, maar er staat geen eindpresentatie.${ind}`, { moment: 'eind', sorteer: d });
      else if (d <= 14) add('eind', 'urgent', 'Eindpresentatie niet vastgelegd', `Het project eindigt ${over(d)} (rond ${k(p.eindBerekend)}). Er is nog geen eindpresentatie gepland.${ind}`, { moment: 'eind', sorteer: d });
      else if (d <= inst.eindWeken * 7) add('eind', 'binnenkort', 'Eindpresentatie inplannen', `Het project eindigt rond ${k(p.eindBerekend)}, over ongeveer ${Math.round(d / 7)} weken. Er is nog geen vaste datum.${ind}`, { moment: 'eind', sorteer: d });
    }
    if (p.duur >= 6 && p.midden && m.tussen.status !== 'nvt' && !vast(m, 'tussen') && loopt) {
      const d = diffDays(p.midden, vandaag);
      if (d < 0) add('tussen', 'binnenkort', 'Tussenpresentatie niet vastgelegd', `Halverwege was rond ${k(p.midden)}, maar er staat geen tussenpresentatie. Al geweest? Vul de datum in, of zet hem op n.v.t.`, { moment: 'tussen', sorteer: d, actie: { label: 'Zet op n.v.t.', soort: 'tussenNvt' } });
      else if (d <= inst.tussenWeken * 7) add('tussen', 'binnenkort', 'Tussenpresentatie inplannen', `Halverwege is ${over(d)} (rond ${k(p.midden)}). Er is nog geen tussenpresentatie gepland.`, { moment: 'tussen', sorteer: d });
    }
    if (eindVast && p.eindBerekend) {
      const d = diffDays(eindVast, p.eindBerekend);
      if (d > 14 || d < -28) add('duurklopt', 'gegevens', 'Klopt de duur?', `De eindpresentatie (${k(eindVast)}) valt ${Math.round(Math.abs(d) / 7)} weken ${d > 0 ? 'na' : 'vóór'} het berekende einde (${k(p.eindBerekend)}). Pas de duur of de startdatum aan als die niet klopt.`);
    }
    MOMENTEN.forEach(mo => {
      const datum = vast(m, mo.id); if (!datum) return;
      const d = diffDays(datum, vandaag); if (d < 0 || d > 7) return;
      const open = VOORBEREIDING[mo.id].flatMap(fi => openPunten(state, fi));
      add('week-' + mo.id, 'dezeweek', `${mo.naam} ${d === 0 ? 'vandaag' : d === 1 ? 'morgen' : k(datum)}${m[mo.id].tijd ? ' om ' + m[mo.id].tijd : ''}`,
        open.length ? `Nog open ter voorbereiding: ${open.slice(0, 3).map(x => x.tekst.charAt(0).toLowerCase() + x.tekst.slice(1)).join('; ')}${open.length > 3 ? ` (en ${open.length - 3} meer)` : ''}.` : 'De voorbereiding op de checklist is rond.',
        { sorteer: d });
    });
    if (eindVast && vandaag > eindVast) {
      const open = [6, 7].reduce((n, fi) => n + faseVoortgang(state, fi).open, 0);
      if (open) add('afronden', 'afronden', 'Afronden na de eindpresentatie', `De eindpresentatie was op ${k(eindVast)}. Nog ${open} ${open === 1 ? 'punt' : 'punten'} open op de checklist, zoals ${openPunten(state, 6).concat(openPunten(state, 7)).slice(0, 2).map(x => x.tekst.charAt(0).toLowerCase() + x.tekst.slice(1)).join(' en ')}.`);
    }
    const achter = [];
    for (let fi = 0; fi < Math.min(6, FASES.length); fi++) {
      const a = faseAnker(g, p, fi);
      if (!a || diffDays(vandaag, a) <= 3) continue;
      const v = faseVoortgang(state, fi);
      if (v.open > 0) achter.push(`${FASES[fi].fase}: ${v.open} open`);
    }
    if (achter.length) add('checklist', 'checklist', 'Checklist loopt achter', achter.join(' · '));
    if (p.kickoff && diffDays(vandaag, p.kickoff) > 14) {
      const mist = gegevens(g).filter(x => x.status !== 'ja');
      if (mist.length) add('gegevens', 'gegevens', `${mist.length} ${mist.length === 1 ? 'gegeven' : 'gegevens'} niet compleet`, mist.map(x => x.naam.charAt(0).toLowerCase() + x.naam.slice(1) + (x.uitleg ? ' (' + x.uitleg + ')' : '')).join(', ').replace(/^./, c => c.toUpperCase()) + '.');
    }
    // contactritme: groepen zonder vaste wekelijkse afspraak niet uit het oog verliezen
    if (p.start && vandaag > p.start && loopt && !String(g.wekelijkseAfspraak || '').trim()) {
      const momentenVoorbij = MOMENTEN.map(mo => vast(m, mo.id)).filter(d => d && d <= vandaag);
      const takenKlaar = takenVan(g).map(t => t.klaarOp).filter(Boolean);
      const laatste = [g.contact && g.contact.laatste, ...momentenVoorbij, ...takenKlaar].filter(geldigeIso).sort().pop() || p.start;
      const d = diffDays(vandaag, laatste);
      if (d > 21) add('contact', 'binnenkort', `Al ${Math.floor(d / 7)} weken geen contact`,
        `Het laatste vastgelegde contact met deze groep was ${k(laatste)}. Er staat geen vaste wekelijkse afspraak. Even bellen of mailen?`,
        { actie: { label: '✓ Contact gehad vandaag', soort: 'contactVandaag' } });
    }
    // evaluatie met de opdrachtgever na afloop
    if (eindVast && vandaag > eindVast && !(g.evaluatie && g.evaluatie.tevredenheid))
      add('evaluatie', 'afronden', 'Evaluatie opdrachtgever vastleggen', 'Vraag de opdrachtgever hoe tevreden die is (1–5) en of er een nieuwe opdracht in zit. Vul het in bij Afronding op de groepspagina.');

    // presentaties op school en eisen vanuit de opleiding
    const bz = bijzonderhedenVan(g);
    SCHOOLPRES.forEach(sp => {
      const x = bz[sp.id];
      if (x.heeft !== 'ja') return;
      if (!x.datum) {
        if (loopt) add(sp.id + '-datum', 'gegevens', sp.naam + ': datum onbekend', 'De studenten presenteren ook op school. Vraag de datum na, dan komt hij in de planning.');
        return;
      }
      const d = diffDays(x.datum, vandaag);
      const wie = [x.cg === 'ja' && 'Campus Gouda', x.og === 'ja' && 'de opdrachtgever'].filter(Boolean);
      const aanwezig = wie.length ? `Aanwezigheid gewenst van ${wie.join(' en ')}.`
        : (x.cg === '' || x.og === '') ? 'Nog niet bekend of Campus Gouda of de opdrachtgever erbij moet zijn.' : 'Campus Gouda en de opdrachtgever hoeven er niet bij te zijn.';
      if (d >= 0 && d <= 7) add(sp.id + '-week', 'dezeweek', `${sp.naam} ${d === 0 ? 'vandaag' : d === 1 ? 'morgen' : k(x.datum)}${x.tijd ? ' om ' + x.tijd : ''}`,
        (x.locatie ? `Locatie: ${x.locatie}. ` : '') + aanwezig, { sorteer: d });
      if (x.og === 'ja' && !x.ogUitgenodigd && d >= 0 && d <= 21) add(sp.id + '-og', 'binnenkort', 'Opdrachtgever uitnodigen: ' + sp.naam.toLowerCase(),
        `De opleiding wil de opdrachtgever erbij hebben op ${k(x.datum)}. Er staat nog niet dat de opdrachtgever is uitgenodigd.`, { sorteer: d, actie: { label: '✓ Uitgenodigd', soort: 'ogUitgenodigd', pres: sp.id } });
      if (d >= 0 && d <= 21 && (x.cg === '' || x.og === '')) add(sp.id + '-wie', 'gegevens', sp.naam + ': wie moet erbij zijn?',
        `Op ${k(x.datum)} presenteren de studenten op school. Vraag de docent of Campus Gouda en de opdrachtgever erbij moeten zijn.`);
    });
    bz.eisen.filter(e => !e.klaar && e.deadline && e.tekst).forEach(e => {
      const d = diffDays(e.deadline, vandaag);
      const voor = e.voor ? 'voor ' + e.voor.toLowerCase() + ', ' : '';
      const actie = { label: '✓ Afgerond', soort: 'eisKlaar', eis: e.id };
      if (d < 0) add('eis-' + e.id, 'urgent', 'Eis opleiding: deadline voorbij', `${e.tekst} (${voor}deadline was ${k(e.deadline)}).`, { sorteer: d, actie });
      else if (d <= 14) add('eis-' + e.id, 'binnenkort', 'Eis opleiding: deadline nadert', `${e.tekst} (${voor}uiterlijk ${k(e.deadline)}, ${over(d)}).`, { sorteer: d, actie });
    });

    const verborgen = g.verborgen || {};
    uit.forEach(s => { s.verborgen = !!(verborgen[s.regel] && verborgen[s.regel] > vandaag); s.verborgenTot = s.verborgen ? verborgen[s.regel] : ''; });
    return uit;
  }

  // een signaal in één klik afhandelen
  function voerActieUit(g, a) {
    if (!a) return g;
    if (a.soort === 'kickoffGepland' || a.soort === 'tussenNvt') {
      const id = a.soort === 'kickoffGepland' ? 'kickoff' : 'tussen';
      const m = momentenVan(g);
      const nw = Object.assign({}, m[id], { status: a.soort === 'kickoffGepland' ? 'gepland' : 'nvt' });
      const mo = MOMENTEN.find(x => x.id === id);
      return Object.assign({}, g, { momenten: Object.assign({}, m, { [id]: nw }), [mo.oudVeld]: momentTekst(nw) });
    }
    const b = bijzonderhedenVan(g);
    if (a.soort === 'ogUitgenodigd') return Object.assign({}, g, { bijzonderheden: Object.assign({}, b, { [a.pres]: Object.assign({}, b[a.pres], { ogUitgenodigd: true }) }) });
    if (a.soort === 'contactVandaag') return Object.assign({}, g, { contact: Object.assign({}, g.contact, { laatste: vandaagISO() }) });
    if (a.soort === 'anonimiseer') return Object.assign({}, g, { geanonimiseerd: vandaagISO(), aantekeningen: [],
      studenten: (g.studenten || []).map((st, i) => Object.assign({}, st, { naam: 'Student ' + (i + 1), mail: '', telefoon: '', priveMail: '', woonplaats: '' })) });
    if (a.soort === 'eisKlaar') return Object.assign({}, g, { bijzonderheden: Object.assign({}, b, { eisen: b.eisen.map(e => e.id === a.eis ? Object.assign({}, e, { klaar: true }) : e) }) });
    return g;
  }
  const opVolgorde = lijst => lijst.slice().sort((a, b) => (VOLGORDE[a.niveau] - VOLGORDE[b.niveau]) || ((a.sorteer ?? 999) - (b.sorteer ?? 999)));

  // ---------- alles wat er moet gebeuren (voor het tabblad Taken) ----------
  function takenOverzicht(groepen, checklist, vandaag, inst) {
    vandaag = vandaag || vandaagISO();
    const opvolgen = [], gepland = [], klaar = [], sigs = [];
    (groepen || []).forEach(g => {
      if (g.gearchiveerd) return;
      const m = momentenVan(g, vandaag);
      takenVan(g).forEach(t => {
        const st = taakKlaar(g, t, m);
        const item = { groep: g, taak: t, klaar: st.klaar, waarom: st.waarom, dagen: diffDays(t.herinnerOp || vandaag, vandaag) };
        if (st.klaar) { if (diffDays(vandaag, t.klaarOp || vandaag) <= 7 || !t.klaarOp) klaar.push(item); }
        else if (!t.herinnerOp || t.herinnerOp <= vandaag) opvolgen.push(item);
        else gepland.push(item);
      });
      signalen(g, (checklist || {})[g.id], vandaag, inst).forEach(s => {
        // een signaal waarvoor al een open opvolging loopt, staat bij "loopt al"
        const loopt = s.moment && takenVan(g).some(t => t.moment === s.moment && !taakKlaar(g, t, m).klaar);
        sigs.push(Object.assign({ groep: g, looptAl: loopt }, s));
      });
    });
    opvolgen.sort((a, b) => a.dagen - b.dagen);
    gepland.sort((a, b) => a.dagen - b.dagen);
    sigs.sort((a, b) => (VOLGORDE[a.niveau] - VOLGORDE[b.niveau]) || ((a.sorteer ?? 999) - (b.sorteer ?? 999)));
    return { opvolgen, gepland, klaar, signalen: sigs };
  }

  // ---------- Excel-tabblad "Checklist projectleiders" ----------
  function zoekPunt(label) {
    const n = norm(label);
    if (n.length < 6) return null;
    for (let fi = 0; fi < FASES.length; fi++) for (let ii = 0; ii < FASES[fi].items.length; ii++) {
      const a = norm(FASES[fi].items[ii]);
      if (a === n || (a.length > 12 && (n.startsWith(a) || a.startsWith(n))) || (n.length > 20 && a.slice(0, 20) === n.slice(0, 20))) return { fi, ii };
    }
    return null;
  }
  function checklistWaarde(v) {
    const s = norm(v);
    if (/^ja\b/.test(s)) return true;
    if (/^(nvt|n v t)\b/.test(s)) return 'nvt';
    return null;
  }
  function themaVan(t) { const n = norm(t); return /^bodem/.test(n) ? 'Bodem' : /^logistiek/.test(n) ? 'Logistiek' : /^zorg/.test(n) ? 'Zorg' : ''; }
  function isChecklistTabblad(aoa) { return (aoa || []).filter(r => r && zoekPunt(r[0])).length >= 5; }
  function parseChecklistTabblad(aoa) {
    const rows = (aoa || []).map(r => (r || []).map(c => c == null ? '' : String(c)));
    let lr = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) if (rows[i].slice(1).filter(c => /^\s*\d+(\.\d+)?[a-z]?\s+\S/i.test(c)).length >= 2) { lr = i; break; }
    if (lr < 0) return [];
    const themaRij = lr > 0 ? rows[lr - 1] : [];
    const kolommen = []; let th = '';
    for (let c = 1; c < rows[lr].length; c++) {
      const t = themaVan(themaRij[c]); if (t) th = t;
      const mm = rows[lr][c].trim().match(/^(\d+(?:\.\d+)?[a-z]?)\s+(.*)$/i);
      if (mm) kolommen.push({ c, thema: th, nummer: mm[1], naam: mm[2].trim(), waarden: {} });
    }
    for (let i = lr + 1; i < rows.length; i++) {
      const p = zoekPunt(rows[i][0]); if (!p) continue;
      kolommen.forEach(k => { const v = checklistWaarde(rows[i][k.c]); if (v) k.waarden[ckey(p.fi, p.ii)] = v; });
    }
    return kolommen;
  }
  const groepNummer = g => norm(g.groepsnummer).replace(/^groep\s*/, '');
  function overlap(a, b) {
    const wa = norm(a).split(' ').filter(w => w.length >= 3), wb = norm(b).split(' ').filter(w => w.length >= 3);
    return wa.filter(x => wb.some(y => y.startsWith(x) || x.startsWith(y))).length;
  }
  function vindGroepVoorKolom(groepen, k) {
    const kand = groepen.filter(g => g.thema === k.thema && groepNummer(g) === norm(k.nummer));
    if (kand.length <= 1) return kand[0] || null;
    return kand.slice().sort((a, b) => overlap(k.naam, b.titel) - overlap(k.naam, a.titel))[0];
  }

  // ---------- import samenvoegen met bestaande groepen ----------
  function voegGroepSamen(oud, nieuw) {
    const uit = Object.assign({}, oud);
    ['titel', 'vorm', 'onderwijsinstelling', 'opleiding', 'contactCG', 'docent', 'docentMail', 'wekelijkseAfspraak', 'kickoff', 'tussenpresentatie', 'eindpresentatie']
      .forEach(v => { if (nieuw[v]) uit[v] = nieuw[v]; });
    if (!oud.trajectId && nieuw.trajectId) uit.trajectId = nieuw.trajectId;
    if (!duurVan(oud) && nieuw.duurWeken) uit.duurWeken = nieuw.duurWeken;
    // momenten: een vaste datum uit Excel wint; wat je in het CRM zelf hebt vastgezet blijft anders staan
    const mo = momentenVan(oud), mn = nieuw.momenten || {};
    const samen = {};
    MOMENTEN.forEach(x => {
      const a = mo[x.id], b = mn[x.id];
      samen[x.id] = !b ? a : (b.status === 'gepland' && (a.datum !== b.datum || a.status !== 'gepland')) ? b : (a.status === 'open' && b.status !== 'open') ? b : a;
    });
    uit.momenten = samen;
    if (Array.isArray(nieuw.studenten) && nieuw.studenten.length) {
      const bestaand = new Map((oud.studenten || []).map(s => [norm(s.naam), s]));
      uit.studenten = nieuw.studenten.map(s => {
        const o = bestaand.get(norm(s.naam));
        if (!o) return s;
        const z = Object.assign({}, o);
        ['woonplaats', 'mail', 'telefoon', 'priveMail'].forEach(v => { if (s[v]) z[v] = s[v]; });
        if (s.isContact) z.isContact = true;
        return z;
      });
    }
    return uit;
  }
  function voegImportSamen(bestaande, nieuwe) {
    const uit = bestaande.slice();
    const sleutel = g => g.thema + '|' + groepNummer(g);
    const index = new Map();
    uit.forEach((g, i) => { const s = sleutel(g); index.set(s, (index.get(s) || []).concat(i)); });
    const gebruikt = new Set();
    let nieuw = 0, bijgewerkt = 0;
    const koppel = new Map(); // nieuw object → id in de uitkomst
    nieuwe.forEach(n => {
      const kand = (index.get(sleutel(n)) || []).filter(i => !gebruikt.has(i));
      let i = kand.length === 1 ? kand[0] : kand.length > 1 ? kand.slice().sort((a, b) => overlap(n.titel, uit[b].titel) - overlap(n.titel, uit[a].titel))[0] : undefined;
      if (i !== undefined) { uit[i] = voegGroepSamen(uit[i], n); gebruikt.add(i); bijgewerkt++; koppel.set(n, uit[i].id); }
      else { uit.push(n); gebruikt.add(uit.length - 1); nieuw++; koppel.set(n, n.id); }
    });
    return { groepen: uit, nieuw, bijgewerkt, koppel };
  }

  const api = { isoVanDate, geldigeIso, addDays, diffDays, vandaagISO, werkdag, datumKort, datumLang, datumDM, datumJaar, maandagVan, norm, over, nieuwId,
    MOMENTEN, MOMENT_STATUS, NIVEAUS, ANKERS, MAILSJABLONEN, init, ckey, itemStatus, faseVoortgang, faseAnker, openPunten,
    SCHOOLPRES, bijzonderhedenVan, voerActieUit, opVolgorde, parseNLDatum, parseDuur, parseSemester, momentenVan, momentTekst, duurVan, planning, gegevens, takenVan, taakKlaar, nieuweTaak,
    mailAdressen, mailtoGroep, outlookLink, mailLink, icsHerinnering, signalen, takenOverzicht, isChecklistTabblad, parseChecklistTabblad, vindGroepVoorKolom,
    groepNummer, themaVan, voegImportSamen };
  root.CGT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* LOGIC-END */
