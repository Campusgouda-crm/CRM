/* Campus Gouda CRM — de app. Gemaakt door scripts/maak_bron.mjs; niet met de hand aanpassen. */
const { useState, useEffect, useMemo } = React;

/* ============================================================
   CONSTANTEN
   ============================================================ */
const THEME = window.CG_THEME;
// versienummer van de app (alleen in de geïnstalleerde app; de bestandsversie heeft er geen)
const APP_VERSIE = (document.querySelector('meta[name="cg-versie"]') || {}).content || '';
const THEMAS = ['Zorg', 'Bodem', 'Logistiek'];
const STATUSSEN = ['Idee', 'In behandeling', 'Definitief', 'Actief', 'Afgerond'];
// Semesters/startmomenten voor trajecten (een traject kan in meerdere semesters vallen)
const SEMESTERS = [
  'Semester 1 2025/2026', 'Semester 2 2025/2026',
  'Semester 1 2026/2027', 'Semester 2 2026/2027',
  'Semester 1 2027/2028', 'Semester 2 2027/2028',
];
// Themaprefix voor automatische groepsnummering (Zorg 1.x, Logistiek 2.x, Bodem 3.x)
const GROEP_THEMA_PREFIX = { 'Zorg': 1, 'Logistiek': 2, 'Bodem': 3 };
const DEFINITIEF_OPTS = ['ja', 'nee', 'in behandeling'];
const TRAJECT_TYPES = ['Nieuw traject', 'Eerder onderzocht'];
// Interne collega's Campus Gouda — vaste keuzelijsten
// Keuzelijsten senior/junior: gevuld uit de gegevens (zie vulTeamLijsten), nooit vaste namen in de code
const SENIOREN = [];
const JUNIOREN = [];
function vulTeamLijsten(trajecten, team) {
  const uitTeam = (re) => (team || []).filter(p => re.test(String(p.rol || ''))).map(p => String(p.naam || '').trim()).filter(Boolean);
  // staat de rol in het team, dan alleen het team (één schrijfwijze); anders wat er in de trajecten staat
  const uniek = (k, re) => [...new Set(uitTeam(re).length ? uitTeam(re) : (trajecten || []).map(t => String(t[k] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl'));
  SENIOREN.splice(0, SENIOREN.length, ...uniek('senior', /senior/i));
  JUNIOREN.splice(0, JUNIOREN.length, ...uniek('junior', /junior/i));
}
// Team: namen en rollen staan in de gegevens (gedeelde map), niet in de code
const TEAM_ROLLEN = ['Junior projectleider', 'Senior projectleider', 'Programmamanager', 'Office manager', 'Facilitair ondersteuner'];
const TEAM_NAMEN = [];
function vulTeamNamen(team) {
  TEAM_NAMEN.splice(0, TEAM_NAMEN.length, ...[...new Set((team || []).map(p => String(p.naam || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl')));
}
// "naam1, naam2 en naam3" → ['naam1', 'naam2', 'naam3']
function naamLijst(tekst) { return String(tekst || '').split(/[,;/&]| en /).map(x => x.trim()).filter(Boolean); }
function heeftNaam(tekst, naam) { const n = String(naam || '').trim().toLowerCase(); return !!n && naamLijst(tekst).some(x => x.toLowerCase() === n); }
function wisselNaam(tekst, naam) {
  const lijst = naamLijst(tekst);
  return (heeftNaam(tekst, naam) ? lijst.filter(x => x.toLowerCase() !== naam.toLowerCase()) : [...lijst, naam]).join(', ');
}
// alle plekken waar een naam van een collega staat
const normNaam = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
function teamNaamVoor(naam, teamNamen) {
  const k = normNaam(naam); if (!k) return '';
  const exact = (teamNamen || []).find(n => normNaam(n) === k); if (exact) return exact;
  const voor = k.split(' ')[0];
  const opVoornaam = (teamNamen || []).filter(n => normNaam(n).split(' ')[0] === voor);
  return opVoornaam.length === 1 ? opVoornaam[0] : '';
}
// loopt langs elk naamveld; fn(waarde) geeft de nieuwe waarde terug
function overNaamvelden(d, fn) {
  const st = (o, k) => { const oud = o[k]; if (typeof oud !== 'string' || !oud) return o; const nw = fn(oud); return nw === oud ? o : { ...o, [k]: nw }; };
  return {
    trajecten: (d.trajecten || []).map(t => st(st(t, 'senior'), 'junior')),
    groepen: (d.groepen || []).map(g => {
      let x = st(g, 'contactCG');
      if (Array.isArray(x.taken)) x = { ...x, taken: x.taken.map(t => st(t, 'door')) };
      if (Array.isArray(x.aantekeningen)) x = { ...x, aantekeningen: x.aantekeningen.map(a => st(a, 'door')) };
      return x;
    }),
    contacten: (d.contacten || []).map(c => {
      let x = st(c, 'eigenaar');
      if (Array.isArray(x.interacties)) x = { ...x, interacties: x.interacties.map(i => {
        let y = st(i, 'aanwezig');
        if (Array.isArray(y.acties)) y = { ...y, acties: y.acties.map(a => st(a, 'eigenaar')) };
        return y;
      }) };
      return x;
    }),
    uren: (d.uren || []).map(r => st(r, 'interneCollega')),
  };
}
// telt alle namen (per deel, dus "naam1, naam2" telt twee namen)
function namenInGegevens(d) {
  const tel = new Map();
  overNaamvelden(d, v => { naamLijst(v).forEach(n => tel.set(n, (tel.get(n) || 0) + 1)); return v; });
  return tel;
}
// vervangt namen volgens een tabel { 'oude schrijfwijze': 'teamnaam' }
function vervangNamen(v, tabel) {
  const delen = naamLijst(v);
  if (!delen.length) return v;
  const nieuw = delen.map(n => tabel[n] || n);
  if (nieuw.every((n, i) => n === delen[i])) return v;
  return [...new Set(nieuw)].join(', ');
}
function sorteerTeam(team) {
  const plek = (rol) => { const i = TEAM_ROLLEN.findIndex(r => r.toLowerCase() === String(rol || '').trim().toLowerCase()); return i < 0 ? TEAM_ROLLEN.length : i; };
  return [...(team || [])].sort((a, b) => plek(a.rol) - plek(b.rol) || String(a.naam).localeCompare(String(b.naam), 'nl'));
}
const INTERACTIE_TYPES = ['gesprek', 'e-mail', 'meeting', 'telefonisch', 'presentatie'];

// Leadstatus / pipeline-fases voor contacten
const LEADSTATUSSEN = ['Koud', 'Eerste contact', 'Geïnteresseerd', 'Traject in ontwikkeling', 'Definitief', 'Actief', 'Afgerond'];

const STATUS_KLEUR = {
  'Idee':            'bg-slate-100 text-slate-700 border-slate-200',
  'In behandeling':  'bg-amber-100 text-amber-800 border-amber-200',
  'Definitief':      'bg-sky-100 text-sky-800 border-sky-200',
  'Actief':          'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Afgerond':        'bg-slate-200 text-slate-600 border-slate-300',
};
// Leadstatus-kleuren in huisstijl (zacht accent op wit)
const LEAD_KLEUR = {
  'Koud':                     'bg-slate-100 text-slate-600 border-slate-200',
  'Eerste contact':           'bg-regio/10 text-regio border-regio/30',
  'Geïnteresseerd':           'bg-midgroen/25 text-ink border-midgroen',
  'Traject in ontwikkeling':  'bg-themalogistiek/30 text-ink border-themalogistiek',
  'Definitief':               'bg-brandlight text-branddark border-brand/30',
  'Actief':                   'bg-brand/15 text-branddark border-brand',
  'Afgerond':                 'bg-slate-200 text-slate-600 border-slate-300',
};
// Living Lab themakleuren als zacht accent op wit, tekst in donkerblauw
const THEMA_KLEUR = {
  'Zorg':      'bg-themazorg/20 text-ink border-themazorg',
  'Bodem':     'bg-themabodem/25 text-ink border-themabodem',
  'Logistiek': 'bg-themalogistiek/30 text-ink border-themalogistiek',
  'Overig':    'bg-midgroen/25 text-ink border-midgroen',
};

// --- Uren-registratie ---
const UREN_THEMAS = ['Zorg', 'Bodem', 'Logistiek', 'Overig'];
const UREN_TYPES  = ['Werkveld', 'Overheid', 'Onderwijs', 'Overig'];
// Gemeenten in de regio (laatste optie 'Overig' = zelf invoeren)
const GEMEENTEN = ['Gouda', 'Zuidplas', 'Waddinxveen', 'Krimpenerwaard', 'Bodegraven-Reeuwijk', 'Overig'];
// thema-hexkleuren voor de grafieken (consistent met de badges)
const THEMA_HEX = { 'Zorg': '#F0948A', 'Bodem': '#D2B38B', 'Logistiek': '#F3D671', 'Overig': '#7DC3A2' };
// de vijf urencategorieën waaruit het regeltotaal wordt opgeteld
const UREN_CATS = [
  { key: 'urenLLO',        label: 'LLO',            hex: '#1A7754' },
  { key: 'urenTrajecten',  label: 'Trajecten',      hex: '#306095' },
  { key: 'urenChallenge',  label: 'Challenge',      hex: '#7DC3A2' },
  { key: 'urenInnovatie',  label: 'Innovatietafel', hex: '#0E3A5C' },
  { key: 'urenOverig',     label: 'Overig',         hex: '#94A3B8' },
];

const LS_TRAJ = 'cgt_trajecten_v2';
const LS_CONT = 'cgt_contacten_v2';
const LS_UREN = 'cgt_uren_v1';
const LS_TARGETS = 'cgt_uren_targets_v1';
const LS_GROEPEN = 'cgt_groepen_v1';
const LS_CHECKLIST = 'cgt_checklist_v1';
const LS_TEAM = 'cgt_team_v1';
// laatste stand die gelijk was aan de gedeelde map (om wijzigingen van tussendoor niet kwijt te raken)
const LS_SYNC_STAND = 'cgt_sync_stand_v1';
const LS_FEEDBACK = 'cgt_feedback_v1';

// Checklist per traject — fases met items (volgorde = weergavevolgorde)
const CHECKLIST = [
  { fase: 'Acties voorafgaand aan start', items: [
    'Kick-off plannen met kerngroep',
    'Studenten zijn toegewezen',
    'Emailadressen studenten verzameld en toegevoegd',
    'Emailadres docent toegevoegd',
    'Eerste en tweede contactpersoon vanuit ons toewijzen',
    'Oude studentengroepen verwijderen uit Embrace',
    'Map aanmaken op Embrace voor de verschillende groepen',
    'Studenten + kerngroepleden toegevoegd aan Embrace + welkomstbericht',
    'Documentatie delen met studenten via Embrace',
    'Kick-off gepland + studenten uitgenodigd & locatie gedeeld',
    'Afspraken met docent over contact en werkwijze',
    'Basisdocument voor studenten delen met de docent',
  ]},
  { fase: 'Eerste kennismaking', items: [
    'Afspraken maken over hoe vaak en wanneer we elkaar spreken',
    'Nummers voor spoedgevallen uitwisselen',
    'Documentatie van voorgaande groepen bespreken',
    'Opdracht geven om de info van voorgaande groepen door te nemen en te bespreken',
    'Opdracht geven om goed voorbereid naar de kick-off te komen',
    'Afspraak maken pages bij te houden voor voortgangsoverleggen',
  ]},
  { fase: 'Tijdens kick-off met OG', items: [
    'Tussentijdse & eindpresentatie vastleggen',
    'De studenten de inhoudelijke afspraken laten herhalen',
    'Afspraken maken over vorm van contact met opdrachtgever',
  ]},
  { fase: 'Na de kick-off', items: [
    'Bevestiging tussentijdse en eindpresentatie tijdstip + locatie sturen',
    'Dubbel check: staan de check-ins met het groepje in de/hun agenda\'s',
    'Check: bepalen moment tussentijdse presentatie oefenen + feedback',
    'Check: studenten expliciet vragen naar betrokkenheid kerngroepleden tot zover',
  ]},
  { fase: 'Tijdens tussentijdse evaluatie', items: [
    'Expliciet aan kernteam vragen of de richting een go of no go is',
    'Verwachtingen eindproduct uitspreken',
    'Afspraken vastleggen en gezamenlijk vaststellen (o.a. frequentie contact in laatste fase)',
  ]},
  { fase: 'Na tussentijdse evaluatie', items: [
    'Bespreken verwachtingen eindsymposium',
    'Check: bepalen moment eindpresentatie oefenen + feedback',
    'Bespreken hoe en wat ze gaan opleveren + kennis overdragen',
  ]},
  { fase: 'Tijdens de eindpresentatie', items: [
    'Vorm van overdracht van de rapportage en prototype richting opdrachtgever',
    'Afspreken wat we mogen doen met hun eindproducten',
    'Campus Gouda alumninetwerk introduceren',
    'Studenten een bedankje geven namens Campus Gouda',
  ]},
  { fase: 'Na de eindpresentatie', items: [
    'Contact met docent afronden',
    'Uitnodigen studenten mailinglijst alumninetwerk (https://www.campusgouda.nl/alumninetwerk/)',
    'Checken of alle producten compleet zijn opgeleverd',
  ]},
];
const CHECKLIST_TOTAAL = CHECKLIST.reduce((n, f) => n + f.items.length, 0);
CGT.init(CHECKLIST);
// testen met een andere datum: ?vandaag=2026-11-02
(() => { const v = new URLSearchParams(location.search).get('vandaag'); if (v && CGT.geldigeIso(v)) window.CGT_VANDAAG = v; })();

/* ============================================================
   HELPERS
   ============================================================ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// testmodus: ?testmap=<adres>&gebruiker=<naam> — elke testcollega eigen browseropslag
const TEST_PARAMS = new URLSearchParams(location.search);
const TEST_MAP = (['localhost', '127.0.0.1'].includes(location.hostname) && TEST_PARAMS.get('testmap')) || '';
const TEST_GEBRUIKER = TEST_MAP ? (TEST_PARAMS.get('gebruiker') || 'Test') : '';
const LS_VOORVOEGSEL = TEST_MAP ? 'test-' + TEST_GEBRUIKER + ':' : '';
const PEIL_MS = TEST_MAP ? 1500 : 4000;
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_VOORVOEGSEL + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(LS_VOORVOEGSEL + key, JSON.stringify(val)); } catch (e) {}
}

function csvEscape(v) {
  const s = (v == null ? '' : String(v)).replace(/"/g, '""');
  return `"${s}"`;
}
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const STALE_DAGEN = 28; // > 4 weken geen contact = signalering
// Laatste interactiedatum (ISO yyyy-mm-dd) of null
function laatsteInteractie(c) {
  const data = (c.interacties || []).map(i => i.datum).filter(Boolean).sort();
  return data.length ? data[data.length - 1] : null;
}
function dagenGeleden(isoDatum) {
  if (!isoDatum) return null;
  const d = new Date(isoDatum + 'T00:00:00');
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
// true als er nog géén of >4 weken geen contact is geweest
function isStale(c) {
  const last = laatsteInteractie(c);
  if (!last) return true;
  const d = dagenGeleden(last);
  return d != null && d > STALE_DAGEN;
}
function openActiesVan(c) {
  return (c.interacties || []).reduce((n, i) => n + (i.acties || []).filter(a => !a.done).length, 0);
}

/* ---------------- Uren-helpers ---------------- */
// Normaliseer een organisatienaam tot een vergelijkbare sleutel:
// kleine letters, spaties en streepjes verwijderd. Alleen intern voor matchen.
function normaliseerOrg(naam) {
  return (naam == null ? '' : String(naam))
    .toLowerCase()
    .replace(/[\s\-]+/g, '')
    .trim();
}
// true als de regel als dubbel is gemarkeerd (telt niet mee in totalen)
// handmatige dubbel-markering (Excel "Check Dubbel" of via formulier)
function isDubbel(r) {
  return String(r && r.dubbel || '').trim().toUpperCase() === 'DUBBEL';
}
// vingerafdruk van een regel (zonder id/handmatige vlag) om exacte herhalingen te herkennen
function urenSignature(r) {
  return [
    normaliseerOrg(r.organisatie), r.thema || '', r.type || '', (r.gemeente || '').trim().toLowerCase(),
    (r.verbondenPersoon || '').trim().toLowerCase(), r.datum || '',
    (r.interneCollega || '').trim().toLowerCase(), (r.beschrijving || '').trim().toLowerCase(),
    r.ondertekenaar || '', ...UREN_CATS.map(c => parseFloat(r[c.key]) || 0),
  ].join('§');
}
// id's van regels die een exacte herhaling zijn van een eerdere regel (eerste blijft origineel)
function duplicaatIds(uren) {
  const seen = new Set(), dups = new Set();
  (uren || []).forEach(r => {
    if (!normaliseerOrg(r.organisatie) && urenTotaal(r) === 0) return; // lege regels overslaan
    const sig = urenSignature(r);
    if (seen.has(sig)) dups.add(r.id); else seen.add(sig);
  });
  return dups;
}
// een regel telt niet mee als hij handmatig DUBBEL is óf automatisch als duplicaat is herkend
function isUitgesloten(r, dups) {
  return isDubbel(r) || (dups && dups.has(r.id));
}
// regeltotaal = som van de vijf urencategorieën (niet uit een aparte kolom)
function urenTotaal(r) {
  return UREN_CATS.reduce((s, c) => s + (parseFloat(r[c.key]) || 0), 0);
}
// Excel-datum (serienummer of tekst) → ISO yyyy-mm-dd, of '' / origineel bij ongeldige tekst
function parseExcelDatum(v) {
  if (v == null || v === '') return '';
  // Excel-serienummer (dagen sinds 1899-12-30)
  if (typeof v === 'number' && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000); // 25569 = dagen tussen 1899-12-30 en 1970-01-01
    const d = new Date(ms);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd-mm-jjjj of dd/mm/jjjj
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0');
    return `${m[3]}-${mm}-${dd}`;
  }
  // jjjj-mm-dd al goed
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // niet-herkenbare tekst: ongewijzigd laten
  return s;
}
// ---------- uren uit gesprekken ----------
// Gesprekken vanaf deze datum tellen automatisch mee; oudere uren staan in de handmatige urenregistratie.
const UREN_UIT_GESPREKKEN_VANAF = '2026-10-22';
const KANS_NAAR_UREN = { 'Innovatietraject': 'urenTrajecten', 'Challenge': 'urenChallenge', 'LLO': 'urenLLO', 'Innovatietafel': 'urenInnovatie' };
function catUitKansen(kansen) { const k = (kansen || []).find(x => KANS_NAAR_UREN[x]); return k ? KANS_NAAR_UREN[k] : 'urenOverig'; }
function gesprekTeltMee(i) { return !!i && ((i.datum || '') >= UREN_UIT_GESPREKKEN_VANAF || String(i.gemaakt || '').slice(0, 10) >= UREN_UIT_GESPREKKEN_VANAF); }
function gesprekUren(i) { return (Number(i.duur) || 0) * Math.max(1, parseInt(i.aantalExtern, 10) || 1); }
const uurTekst = n => String(n).replace('.', ',') + ' uur';
// regels voor de urenverantwoording, berekend uit de gesprekken bij contacten (worden niet apart opgeslagen)
function urenUitGesprekken(contacten) {
  const uit = [];
  (contacten || []).forEach(c => (c.interacties || []).forEach(i => {
    if (!gesprekTeltMee(i)) return;
    const totaal = gesprekUren(i);
    if (!totaal) return;
    const r = Object.assign(leegUur(), {
      id: 'gesprek-' + i.id, bron: 'gesprek', contactId: c.id,
      organisatie: c.organisatie || '', thema: (c.themas || [])[0] || 'Overig', type: c.typeExtern || 'Overig',
      gemeente: (c.orgAdres && c.orgAdres.gemeente) || '', verbondenPersoon: c.naam || '',
      interneCollega: i.aanwezig || '', datum: i.datum || '', ondertekenaar: 'nee', dubbel: 'OK',
      beschrijving: [i.type, i.samenvatting].filter(Boolean).join(': ').slice(0, 200),
    });
    r[i.urenCat || catUitKansen(i.kansen)] = String(totaal);
    uit.push(r);
  }));
  return uit;
}
function leegUur() {
  return {
    id: uid(), organisatie: '', thema: 'Overig', type: 'Werkveld', ondertekenaar: 'nee',
    gemeente: '', verbondenPersoon: '', urenLLO: '', urenTrajecten: '', urenChallenge: '',
    urenInnovatie: '', urenOverig: '', datum: '', interneCollega: '', beschrijving: '', dubbel: 'OK',
  };
}

/* ---------------- Studentengroep-helpers ---------------- */
function leegStudent() {
  return { id: uid(), naam: '', woonplaats: '', mail: '', telefoon: '', priveMail: '', isContact: false };
}
function leegGroep() {
  return {
    id: uid(), groepsnummer: '', trajectId: '', thema: 'Zorg', titel: '', vorm: '',
    onderwijsinstelling: '', opleiding: '', contactCG: '', docent: '', docentMail: '',
    wekelijkseAfspraak: '', kickoff: '', tussenpresentatie: '', eindpresentatie: '', studenten: [],
  };
}
// volgend automatisch groepsnummer voor een thema (Zorg 1.x, Logistiek 2.x, Bodem 3.x)
function nextGroepsnummer(thema, groepen, excludeId) {
  const prefix = GROEP_THEMA_PREFIX[thema];
  if (!prefix) return '';
  let max = 0;
  (groepen || []).forEach(g => {
    if (g.id === excludeId) return;
    // herkent zowel "1.2" als "Groep 1.2" — pakt het major.minor-nummer aan het eind
    const m = String(g.groepsnummer || '').trim().match(/(\d+)\.(\d+)\s*$/);
    if (m && parseInt(m[1], 10) === prefix) max = Math.max(max, parseInt(m[2], 10));
  });
  return `${prefix}.${max + 1}`;
}
// checklist-itemsleutel (stabiel op basis van fase- en itemindex)
const checklistKey = (fi, ii) => `F${fi}I${ii}`;
function checklistVoortgang(state) {
  const st = state || {};
  let done = 0;
  CHECKLIST.forEach((f, fi) => f.items.forEach((_, ii) => { if (st[checklistKey(fi, ii)]) done++; }));
  return { done, total: CHECKLIST_TOTAAL };
}

/* ============================================================
   INITIËLE DATA (uit Excel)
   ============================================================ */
function leegTraject() {
  return {
    id: uid(), thema: 'Zorg', speerpunt: '', titel: '', lead: '', // 'lead' = aantal studenten (label in UI: "Aantal studenten")
    definitief: 'nee', opleidingen: '', contactpersoon: '', interneCollegaId: '', weken: '',
    contactOnderwijsId: '', contactBedrijfId: '', senior: '', junior: '', semesters: [],
    trajectType: 'Nieuw traject', eerderOnderzocht: '', iteratie: '1', bestanden: [], gearchiveerd: false,
    startdatum: '', jaars: '', partners: '', kernwoorden: '',
    studierichting: '', context: '', hoofdvragen: '', status: 'Idee',
  };
}

// Geen startgegevens in de openbare versie: alles komt uit de gedeelde map.
function seedTrajecten() { return []; }

function seedContacten(trajecten) { return []; }

/* ============================================================
   KLEINE UI-COMPONENTEN
   ============================================================ */
function Badge({ children, className = '' }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{children}</span>;
}

// Detailrij voor een gekoppeld contact: naam (link) + contactgegevens + laatst gesproken
function ContactRow({ label, contact, fallback, laatst, onOpen }) {
  return (
    <div className="py-2 border-b border-slate-100 grid grid-cols-3 gap-2 text-sm">
      <div className="text-slate-500 font-medium">{label}</div>
      <div className="col-span-2">
        {contact ? (
          <div>
            <button onClick={() => onOpen(contact.id)} className="text-brand hover:underline text-left font-medium">{contact.naam}{contact.organisatie ? <span className="text-slate-400 font-normal"> · {contact.organisatie}</span> : ''} →</button>
            {(contact.email || contact.telefoon) && (
              <div className="text-xs text-slate-400">
                {contact.email && <a className="hover:underline" href={'mailto:' + contact.email}>{contact.email}</a>}
                {contact.email && contact.telefoon && ' · '}
                {contact.telefoon}
              </div>
            )}
            {laatst && <div className="text-xs text-slate-400">{laatst(contact)}</div>}
          </div>
        ) : (fallback ? <span className="text-slate-600">{fallback} <span className="text-slate-300">(niet gekoppeld)</span></span> : <span className="text-slate-300">—</span>)}
      </div>
    </div>
  );
}

// Contactkeuze met de mogelijkheid direct een nieuw contact aan te maken (zonder naar de contactpagina)
function ContactKiezer({ label, value, onChange, contacten, onCreateContact }) {
  const [nieuw, setNieuw] = useState(false);
  const [n, setN] = useState({ naam: '', organisatie: '', email: '', telefoon: '' });
  const opties = [...contacten].sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  const maakAan = () => {
    if (!n.naam.trim() || !onCreateContact) return;
    const id = onCreateContact(n);
    onChange(id);
    setNieuw(false); setN({ naam: '', organisatie: '', email: '', telefoon: '' });
  };
  return (
    <Field label={label}>
      {!nieuw ? (
        <div className="flex gap-2">
          <select className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)}>
            <option value="">— geen / kies contact —</option>
            {opties.map(c => <option key={c.id} value={c.id}>{c.naam}{c.organisatie ? ` · ${c.organisatie}` : ''}</option>)}
          </select>
          {onCreateContact && <button type="button" onClick={() => setNieuw(true)} className="px-2 rounded-lg border border-slate-300 text-sm text-slate-500 hover:bg-slate-50 shrink-0" title="Nieuw contact aanmaken">+ nieuw</button>}
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={n.naam} onChange={e=>setN({...n,naam:e.target.value})} placeholder="naam *" />
            <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={n.organisatie} onChange={e=>setN({...n,organisatie:e.target.value})} placeholder="organisatie" />
            <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={n.email} onChange={e=>setN({...n,email:e.target.value})} placeholder="e-mail" />
            <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={n.telefoon} onChange={e=>setN({...n,telefoon:e.target.value})} placeholder="telefoon" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNieuw(false)} className="px-3 py-1 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
            <button type="button" onClick={maakAan} disabled={!n.naam.trim()} className="px-3 py-1 rounded-lg bg-brand text-white text-sm hover:bg-branddark disabled:opacity-40">Aanmaken & koppelen</button>
          </div>
        </div>
      )}
    </Field>
  );
}

// Gemeentekeuze: vaste opties + 'Overig' (zelf invoeren). Geeft de inner control terug (zonder Field-wrapper).
function GemeenteKiezer({ value, onChange }) {
  const known = GEMEENTEN.slice(0, -1); // zonder 'Overig'
  const [overig, setOverig] = useState(value !== '' && value != null && !known.includes(value));
  const selVal = overig ? 'Overig' : (known.includes(value) ? value : '');
  return (
    <div className="flex gap-2">
      <select className={inputCls} value={selVal} onChange={e => {
        if (e.target.value === 'Overig') { setOverig(true); onChange(''); }
        else { setOverig(false); onChange(e.target.value); }
      }}>
        <option value="">— kies gemeente —</option>
        {GEMEENTEN.map(g => <option key={g}>{g}</option>)}
      </select>
      {overig && <input className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="gemeente invoeren" />}
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} my-8`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   TRAJECT-FORMULIER
   ============================================================ */
function TrajectForm({ initial, contacten = [], onCreateContact, onSave, onCancel }) {
  const [f, setF] = useState({ ...initial, bestanden: (initial.bestanden || []).map(b => ({ ...b })) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [linkNaam, setLinkNaam] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const addLink = () => {
    const naam = linkNaam.trim() || linkUrl.trim();
    if (!linkUrl.trim()) return;
    setF(p => ({ ...p, bestanden: [...(p.bestanden || []), { id: uid(), naam, url: linkUrl.trim() }] }));
    setLinkNaam(''); setLinkUrl('');
  };
  const delBestand = (id) => setF(p => ({ ...p, bestanden: (p.bestanden || []).filter(b => b.id !== id) }));
  const uploadBestand = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024 && !confirm(`"${file.name}" is ${(file.size/1048576).toFixed(1)} MB. Grote bestanden vullen de lokale opslag snel — beter een link gebruiken. Toch insluiten?`)) return;
    const reader = new FileReader();
    reader.onload = () => setF(p => ({ ...p, bestanden: [...(p.bestanden || []), { id: uid(), naam: file.name, dataUrl: reader.result, size: file.size }] }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Titel" full>
        <input className={inputCls} value={f.titel} onChange={set('titel')} placeholder="Titel van het traject" />
      </Field>
      <Field label="Thema">
        <select className={inputCls} value={f.thema} onChange={set('thema')}>
          {THEMAS.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Speerpunt">
        <input className={inputCls} value={f.speerpunt} onChange={set('speerpunt')} placeholder="Hoofdcategorie binnen thema" />
      </Field>
      <Field label="Status">
        <select className={inputCls} value={f.status} onChange={set('status')}>
          {STATUSSEN.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Definitief">
        <select className={inputCls} value={f.definitief} onChange={set('definitief')}>
          {DEFINITIEF_OPTS.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Aantal studenten">
        <input className={inputCls} value={f.lead} onChange={set('lead')} placeholder="bijv. 5" />
      </Field>
      <Field label="Aantal weken">
        <input className={inputCls} value={f.weken} onChange={set('weken')} placeholder="bijv. 20 of 7/10" />
      </Field>
      <Field label="Opleiding(en)">
        <input className={inputCls} value={f.opleidingen} onChange={set('opleidingen')} placeholder="bijv. ICT, Projectmanagement" />
      </Field>
      <ContactKiezer label="Contactpersoon onderwijs" value={f.contactOnderwijsId}
        onChange={(id) => setF(p => ({ ...p, contactOnderwijsId: id }))} contacten={contacten} onCreateContact={onCreateContact} />
      <ContactKiezer label="Contactpersoon bedrijf/organisatie" value={f.contactBedrijfId}
        onChange={(id) => setF(p => ({ ...p, contactBedrijfId: id }))} contacten={contacten} onCreateContact={onCreateContact} />
      <Field label="Gekoppelde senior">
        <input className={inputCls} list="cg-senioren" value={f.senior || ''} onChange={set('senior')} placeholder="naam (kies of typ)" />
        <datalist id="cg-senioren">{SENIOREN.map(x => <option key={x} value={x} />)}</datalist>
      </Field>
      <Field label="Gekoppelde junior">
        <input className={inputCls} list="cg-junioren" value={f.junior || ''} onChange={set('junior')} placeholder="naam (kies of typ)" />
        <datalist id="cg-junioren">{JUNIOREN.map(x => <option key={x} value={x} />)}</datalist>
      </Field>
      <Field label="Startdatum">
        <input className={inputCls} value={f.startdatum} onChange={set('startdatum')} placeholder="bijv. september / 31 aug" />
      </Field>
      <Field label="Jaars">
        <input className={inputCls} value={f.jaars} onChange={set('jaars')} placeholder="bijv. 3e / 4e" />
      </Field>
      <Field label="Semester(s) — een traject kan in meerdere semesters vallen" full>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border border-slate-200 rounded-lg p-2">
          {SEMESTERS.map(sem => {
            const checked = (f.semesters || []).includes(sem);
            return (
              <label key={sem} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={checked} className="accent-brand"
                  onChange={() => setF(p => ({ ...p, semesters: checked ? (p.semesters||[]).filter(x=>x!==sem) : [...(p.semesters||[]), sem] }))} />
                {sem}
              </label>
            );
          })}
        </div>
      </Field>
      <Field label="Partnerorganisatie(s)" full>
        <input className={inputCls} value={f.partners} onChange={set('partners')} placeholder="komma-gescheiden" />
      </Field>
      <Field label="Kernwoorden (tags)" full>
        <input className={inputCls} value={f.kernwoorden} onChange={set('kernwoorden')} placeholder="komma-gescheiden" />
      </Field>
      <Field label="Studierichting suggestie" full>
        <input className={inputCls} value={f.studierichting} onChange={set('studierichting')} />
      </Field>
      <Field label="Nieuw of eerder onderzocht?">
        <select className={inputCls} value={f.trajectType || 'Nieuw traject'} onChange={set('trajectType')}>
          {TRAJECT_TYPES.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Iteratie (hoeveelste keer)">
        <input className={inputCls} type="number" min="1" value={f.iteratie || ''} onChange={set('iteratie')} placeholder="bijv. 1" />
      </Field>
      {f.trajectType === 'Eerder onderzocht' && (
        <Field label="Wat is eerder onderzocht?" full>
          <textarea className={inputCls + ' h-20'} value={f.eerderOnderzocht} onChange={set('eerderOnderzocht')} placeholder="Korte samenvatting van eerdere bevindingen / wat al onderzocht is" />
        </Field>
      )}
      <Field label="Context" full>
        <textarea className={inputCls + ' h-24'} value={f.context} onChange={set('context')} />
      </Field>
      <Field label="Hoofdvragen" full>
        <textarea className={inputCls + ' h-24'} value={f.hoofdvragen} onChange={set('hoofdvragen')} />
      </Field>
      <Field label="Gekoppelde bestanden / (eind)producten" full>
        <div className="border border-slate-200 rounded-lg p-2 space-y-2">
          {(f.bestanden || []).length > 0 && (
            <div className="space-y-1">
              {f.bestanden.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{b.url ? '🔗' : '📎'} {b.naam}{b.size ? <span className="text-slate-400"> ({(b.size/1024).toFixed(0)} kB)</span> : ''}</span>
                  <button type="button" onClick={() => delBestand(b.id)} className="text-slate-400 hover:text-rose-600 shrink-0">verwijderen</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-end">
            <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 min-w-[120px]" value={linkNaam} onChange={e=>setLinkNaam(e.target.value)} placeholder="naam (optioneel)" />
            <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 min-w-[160px]" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://… (link, bijv. SharePoint/Embrace)" />
            <button type="button" onClick={addLink} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">+ link</button>
            <label className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 cursor-pointer">
              bestand uploaden<input type="file" onChange={uploadBestand} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-slate-400">Tip: gebruik bij voorkeur een link naar grote (eind)producten; geüploade bestanden worden in de lokale opslag bewaard.</p>
        </div>
      </Field>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={() => onSave(f)} disabled={!f.titel.trim()}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">
          Opslaan
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   TRAJECT-DETAIL
   ============================================================ */
function tagList(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

function TrajectDetail({ traject, contacten, groepen = [], onOpenGroep, onToggleArchief, onEdit, onDelete, onBack, onOpenContact }) {
  const t = traject;
  const gekoppeld = contacten.filter(c => (c.trajectIds || []).includes(t.id));
  const collega = contacten.find(c => c.id === t.interneCollegaId);
  const contactOnderwijs = contacten.find(c => c.id === t.contactOnderwijsId);
  const contactBedrijf = contacten.find(c => c.id === t.contactBedrijfId);
  const groepenVanTraject = groepen.filter(g => g.trajectId === t.id);
  const laatstGesproken = (c) => { const d = laatsteInteractie(c); return d ? `laatst gesproken: ${d} (${dagenGeleden(d)} dagen geleden)` : 'nog niet gesproken'; };
  const Row = ({ label, value }) => (
    <div className="py-2 border-b border-slate-100 grid grid-cols-3 gap-2 text-sm">
      <div className="text-slate-500 font-medium">{label}</div>
      <div className="col-span-2 text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );
  return (
    <div>
      <button onClick={onBack} className="text-sm text-brand hover:underline mb-3">&larr; Terug naar overzicht</button>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={THEMA_KLEUR[t.thema]}>{t.thema}</Badge>
            <Badge className={STATUS_KLEUR[t.status]}>{t.status}</Badge>
            {t.definitief === 'ja' && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Definitief</Badge>}
            <Badge className={t.trajectType === 'Eerder onderzocht' ? 'bg-regio/10 text-regio border-regio/30' : 'bg-brandlight text-branddark border-brand/30'}>{t.trajectType || 'Nieuw traject'}</Badge>
            {t.iteratie && <Badge className="bg-slate-100 text-slate-600 border-slate-200">Iteratie {t.iteratie}</Badge>}
            {t.gearchiveerd && <Badge className="bg-slate-200 text-slate-600 border-slate-300">📦 Gearchiveerd</Badge>}
          </div>
          <h1 className="text-2xl font-light text-ink">{t.titel}</h1>
          {t.speerpunt && <p className="text-slate-500">{t.speerpunt}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm hover:bg-branddark">Bewerken</button>
          <button onClick={() => onToggleArchief && onToggleArchief(t.id)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">{t.gearchiveerd ? 'Herstellen' : 'Archiveren'}</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50">Verwijderen</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <Row label="Aantal studenten" value={t.lead} />
          <Row label="Aantal weken" value={t.weken} />
          <Row label="Startdatum" value={t.startdatum} />
          <Row label="Jaars" value={t.jaars} />
          <Row label="Opleiding(en)" value={t.opleidingen} />
          <ContactRow label="Contactpersoon onderwijs" contact={contactOnderwijs} fallback={t.contactpersoon} laatst={laatstGesproken} onOpen={onOpenContact} />
          <ContactRow label="Contactpersoon bedrijf/organisatie" contact={contactBedrijf} laatst={laatstGesproken} onOpen={onOpenContact} />
          <Row label="Gekoppelde senior" value={t.senior} />
          <Row label="Gekoppelde junior" value={t.junior} />
          <Row label="Partners" value={t.partners} />
          <Row label="Studierichting" value={t.studierichting} />
          <div className="py-2 border-b border-slate-100 grid grid-cols-3 gap-2 text-sm">
            <div className="text-slate-500 font-medium">Semester(s)</div>
            <div className="col-span-2 flex flex-wrap gap-1">
              {(t.semesters||[]).map((s,i)=><Badge key={i} className="bg-regio/10 text-regio border-regio/30">{s}</Badge>)}
              {(t.semesters||[]).length===0 && <span className="text-slate-300">—</span>}
            </div>
          </div>
          <div className="py-2 grid grid-cols-3 gap-2 text-sm">
            <div className="text-slate-500 font-medium">Kernwoorden</div>
            <div className="col-span-2 flex flex-wrap gap-1">
              {tagList(t.kernwoorden).map((k, i) => <Badge key={i} className="bg-brandlight text-branddark border-brand/20">{k}</Badge>)}
              {tagList(t.kernwoorden).length === 0 && <span className="text-slate-300">—</span>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {t.trajectType === 'Eerder onderzocht' && t.eerderOnderzocht && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-ink mb-1 text-sm">Eerder onderzocht</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.eerderOnderzocht}</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-1 text-sm">Context</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.context || <span className="text-slate-300">Nog niet ingevuld</span>}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-1 text-sm">Hoofdvragen</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.hoofdvragen || <span className="text-slate-300">Nog niet ingevuld</span>}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-2 text-sm">Gekoppelde contacten</h3>
            {gekoppeld.length === 0 && <p className="text-sm text-slate-300">Geen contacten gekoppeld</p>}
            <div className="space-y-1">
              {gekoppeld.map(c => (
                <button key={c.id} onClick={() => onOpenContact(c.id)}
                  className="block text-left text-sm text-brand hover:underline">
                  {c.naam} <span className="text-slate-400">· {c.organisatie}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-2 text-sm">Studentengroep(en)</h3>
            {groepenVanTraject.length === 0 && <p className="text-sm text-slate-300">Geen groep gekoppeld</p>}
            <div className="space-y-1">
              {groepenVanTraject.map(g => (
                <button key={g.id} onClick={() => onOpenGroep && onOpenGroep(g.id)}
                  className="block text-left text-sm text-brand hover:underline">
                  {g.groepsnummer} <span className="text-slate-400">· {g.onderwijsinstelling || '—'} · {(g.studenten||[]).length} studenten</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-2 text-sm">Bestanden / (eind)producten</h3>
            {(t.bestanden || []).length === 0 && <p className="text-sm text-slate-300">Geen bestanden gekoppeld</p>}
            <div className="space-y-1">
              {(t.bestanden || []).map(b => (
                <a key={b.id} href={b.url || b.dataUrl} target="_blank" rel="noopener" download={b.dataUrl ? b.naam : undefined}
                  className="block text-sm text-brand hover:underline truncate">
                  {b.url ? '🔗' : '📎'} {b.naam}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TRAJECTEN-TAB
   ============================================================ */
function TrajectenTab({ trajecten, setTrajecten, contacten, groepen = [], onCreateContact, onOpenContact, onOpenGroep, externalDetail, clearExternal }) {
  const [view, setView] = useState('lijst'); // lijst | kanban
  const [detailId, setDetailId] = useState(null);
  const [dragId, setDragId] = useState(null);       // traject dat gesleept wordt
  const [dragOverCol, setDragOverCol] = useState(null);
  const [wervingOpen, setWervingOpen] = useState(false);
  const [wervingSel, setWervingSel] = useState([]);   // geselecteerde traject-ids
  const [wervingPartner, setWervingPartner] = useState('');
  const [wervingIntro, setWervingIntro] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importSemester, setImportSemester] = useState('');
  const [importParsed, setImportParsed] = useState(null); // {trajecten:[...], bestand:'...'}
  const importFileRef = React.useRef(null);

  // open een traject-detail dat vanuit een contact is aangeroepen
  useEffect(() => {
    if (externalDetail) { setDetailId(externalDetail); clearExternal && clearExternal(); }
  }, [externalDetail]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [zoek, setZoek] = useState('');
  const [fThema, setFThema] = useState('');
  const [fOpleiding, setFOpleiding] = useState('');
  const [fContact, setFContact] = useState('');
  const [fDefinitief, setFDefinitief] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fSemester, setFSemester] = useState('');
  const [fArchief, setFArchief] = useState('actief'); // actief | gearchiveerd | alle

  const contactById = useMemo(() => Object.fromEntries(contacten.map(c => [c.id, c])), [contacten]);
  const naamVan = (id) => (contactById[id] || {}).naam || '';
  // namen die bij een traject horen (onderwijs + bedrijf + legacy), voor filter & lijst
  const trajectContactNamen = (t) => [naamVan(t.contactOnderwijsId), naamVan(t.contactBedrijfId), t.contactpersoon].filter(Boolean);
  const contactNaam = (t) => naamVan(t.contactOnderwijsId) || t.contactpersoon || naamVan(t.contactBedrijfId) || '';

  const opleidingen = useMemo(() => {
    const set = new Set();
    trajecten.forEach(t => tagList(t.opleidingen).forEach(o => set.add(o)));
    return [...set].sort();
  }, [trajecten]);
  const contactpersonen = useMemo(() => {
    const set = new Set();
    trajecten.forEach(t => trajectContactNamen(t).forEach(n => set.add(n)));
    return [...set].sort();
  }, [trajecten, contactById]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return trajecten.filter(t => {
      if (fArchief === 'actief' && t.gearchiveerd) return false;
      if (fArchief === 'gearchiveerd' && !t.gearchiveerd) return false;
      if (fThema && t.thema !== fThema) return false;
      if (fStatus && t.status !== fStatus) return false;
      if (fDefinitief && t.definitief !== fDefinitief) return false;
      if (fContact && !trajectContactNamen(t).includes(fContact)) return false;
      if (fOpleiding && !tagList(t.opleidingen).includes(fOpleiding)) return false;
      if (fSemester && !(t.semesters || []).includes(fSemester)) return false;
      if (q) {
        const blob = Object.values(t).join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [trajecten, zoek, fThema, fOpleiding, fContact, fDefinitief, fStatus, fSemester, fArchief, contactById]);

  const detail = trajecten.find(t => t.id === detailId);

  function saveTraject(f) {
    setTrajecten(prev => {
      const exists = prev.some(t => t.id === f.id);
      return exists ? prev.map(t => t.id === f.id ? f : t) : [...prev, f];
    });
    setFormOpen(false); setEditing(null);
    setDetailId(f.id);
  }
  function delTraject(id) {
    if (!confirm('Dit traject verwijderen?')) return;
    setTrajecten(prev => prev.filter(t => t.id !== id));
    setDetailId(null);
  }
  function moveTraject(id, status) {
    setTrajecten(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }
  function toggleArchief(id) {
    setTrajecten(prev => prev.map(t => t.id === id ? { ...t, gearchiveerd: !t.gearchiveerd } : t));
  }
  function exportCSV() {
    const naamVan = (id) => { const c = contacten.find(x => x.id === id); return c ? c.naam : ''; };
    // header + getter in één lijst → kolommen kunnen niet uit de pas lopen
    const columns = [
      ['Titel',          t => t.titel],
      ['Thema',          t => t.thema],
      ['Speerpunt',      t => t.speerpunt],
      ['Aantal studenten', t => t.lead],
      ['Definitief',     t => t.definitief],
      ['Status',         t => t.status],
      ['Opleidingen',    t => t.opleidingen],
      ['Contactpersoon onderwijs', t => naamVan(t.contactOnderwijsId) || t.contactpersoon || ''],
      ['Contactpersoon bedrijf/organisatie', t => naamVan(t.contactBedrijfId)],
      ['Gekoppelde senior', t => t.senior || ''],
      ['Gekoppelde junior', t => t.junior || ''],
      ['Semesters',      t => (t.semesters || []).join(', ')],
      ['Weken',          t => t.weken],
      ['Startdatum',     t => t.startdatum],
      ['Jaars',          t => t.jaars],
      ['Partners',       t => t.partners],
      ['Kernwoorden',    t => t.kernwoorden],
      ['Studierichting', t => t.studierichting],
    ];
    const rows = [columns.map(c => c[0]), ...filtered.map(t => columns.map(c => c[1](t)))];
    downloadCSV(rows, 'campus-gouda-trajecten.csv');
  }
  function resetFilters() {
    setZoek(''); setFThema(''); setFOpleiding(''); setFContact(''); setFDefinitief(''); setFStatus(''); setFSemester(''); setFArchief('actief');
  }

  // Werving-uitdraai openen: standaard alle nu-gefilterde trajecten geselecteerd
  function openWerving() {
    setWervingSel(filtered.map(t => t.id));
    setWervingOpen(true);
  }
  function genereerWerving() {
    const gekozen = trajecten.filter(t => wervingSel.includes(t.id));
    if (!gekozen.length) { alert('Selecteer minimaal één traject.'); return; }
    const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const nl = (s) => esc(s).replace(/\n/g,'<br>');
    const datum = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const kaarten = gekozen.map(t => {
      const hex = THEMA_HEX[t.thema] || '#7DC3A2';
      const tags = tagList(t.kernwoorden).map(k => `<span class="tag">${esc(k)}</span>`).join('');
      const meta = [
        t.weken && `${esc(t.weken)} weken`,
        t.opleidingen && `Opleiding: ${esc(t.opleidingen)}`,
        t.lead && `${esc(t.lead)} studenten`,
        t.jaars && `${esc(t.jaars)} jaars`,
      ].filter(Boolean).join(' &nbsp;·&nbsp; ');
      const iter = `${esc(t.trajectType || 'Nieuw traject')}${t.iteratie ? ` · iteratie ${esc(t.iteratie)}` : ''}`;
      return `
        <div class="kaart">
          <div class="kaart-head" style="border-color:${hex}">
            <span class="thema" style="background:${hex}33;border-color:${hex}">${esc(t.thema)}</span>
            <span class="iter">${iter}</span>
          </div>
          <h2>${esc(t.titel)}</h2>
          ${t.speerpunt ? `<div class="speer">${esc(t.speerpunt)}</div>` : ''}
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          ${t.context ? `<h3>Context</h3><p>${nl(t.context)}</p>` : ''}
          ${t.hoofdvragen ? `<h3>Hoofdvragen</h3><p>${nl(t.hoofdvragen)}</p>` : ''}
          ${t.trajectType === 'Eerder onderzocht' && t.eerderOnderzocht ? `<h3>Eerder onderzocht</h3><p>${nl(t.eerderOnderzocht)}</p>` : ''}
          ${tags ? `<div class="tags">${tags}</div>` : ''}
        </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
      <title>Campus Gouda — Innovatietrajecten</title>
      <style>
        @import url('${new URL('fonts/manrope.css', location.href).href}');
        * { box-sizing: border-box; }
        body { font-family: Manrope, Arial, sans-serif; color: #0E3A5C; margin: 0; padding: 32px; background: #fff; }
        .top { display:flex; align-items:center; gap:14px; border-bottom:3px solid #1A7754; padding-bottom:14px; margin-bottom:18px; }
        .logo { height:44px; width:44px; border-radius:8px; background:#CAE5E0; color:#0E3A5C; display:flex; align-items:center; justify-content:center; font-weight:700; }
        .top h1 { font-size:20px; margin:0; font-weight:700; }
        .top .sub { font-size:12px; color:#306095; }
        .intro { font-size:14px; line-height:1.5; margin-bottom:20px; white-space:pre-wrap; }
        .kaart { border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; margin-bottom:16px; page-break-inside:avoid; }
        .kaart-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
        .thema { font-size:11px; font-weight:600; padding:2px 10px; border-radius:999px; border:1px solid; }
        .iter { font-size:11px; color:#64748b; }
        .kaart h2 { font-size:17px; margin:2px 0 2px; font-weight:600; }
        .speer { font-size:12px; color:#306095; margin-bottom:6px; }
        .meta { font-size:12px; color:#475569; margin-bottom:8px; }
        .kaart h3 { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#1A7754; margin:10px 0 2px; }
        .kaart p { font-size:13px; line-height:1.5; margin:0 0 4px; }
        .tags { margin-top:8px; }
        .tag { display:inline-block; font-size:11px; background:#CAE5E0; color:#0A5256; border-radius:999px; padding:2px 9px; margin:0 4px 4px 0; }
        .foot { margin-top:18px; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; }
        .printbtn { position:fixed; top:16px; right:16px; background:#1A7754; color:#fff; border:none; border-radius:8px; padding:8px 14px; font:inherit; font-size:13px; cursor:pointer; }
        @media print { .printbtn { display:none; } body { padding:0; } }
      </style></head><body>
      <button class="printbtn" onclick="window.print()">Afdrukken / opslaan als PDF</button>
      <div class="top">
        <div class="logo">CG</div>
        <div><h1>Campus Gouda · Innovatietrajecten</h1>
        <div class="sub">Voorstel voor samenwerking${wervingPartner ? ' — ' + esc(wervingPartner) : ''} · ${datum}</div></div>
      </div>
      ${wervingIntro ? `<div class="intro">${nl(wervingIntro)}</div>` : ''}
      ${kaarten}
      <div class="foot">Campus Gouda · ${gekozen.length} traject(en) · ${datum}</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up geblokkeerd — sta pop-ups toe om de uitdraai te openen.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setWervingOpen(false);
  }
  const toggleWerving = (id) => setWervingSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // --- Trajecten importeren uit Excel (Leads-/Overzicht-bestanden) ---
  function parseTrajectenExcel(buf, semester) {
    const wb = window.XLSX.read(buf, { type: 'binary' });
    const sval = (v) => (v == null ? '' : String(v)).trim();
    const join = (a, b) => { const set = new Set([...(a ? a.split(',').map(s=>s.trim()) : []), ...(b ? [b.trim()] : [])].filter(Boolean)); return [...set].join(', '); };
    const out = [];
    let studentenOverzicht = false;
    // kop van de titelkolom: "Titel", of "Traject"/"Trajecten" zoals in de overzichten van Campus Gouda
    const isTitelKop = (v) => /^(titel|traject|trajecten)$/.test(sval(v).toLowerCase());
    wb.SheetNames.forEach(sheetNaam => {
      const thema = THEMAS.find(t => t.toLowerCase() === sheetNaam.trim().toLowerCase()) || '';
      const ws = wb.Sheets[sheetNaam];
      const matrix = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      // headerrij = eerste rij met een cel "Titel", "Traject" of "Trajecten"
      let hi = matrix.findIndex(r => r.some(isTitelKop));
      if (hi < 0) return;
      const heads = matrix[hi].map(c => sval(c).toLowerCase());
      // een blad met studentnamen is een studentenoverzicht: dat hoort bij Studentengroepen, niet hier
      if (heads.some(h => /\b(naam|namen|student)/.test(h))) { studentenOverzicht = true; return; }
      const col = (...pats) => heads.findIndex(h => pats.some(p => h.includes(p)));
      const cSpeer = (() => { const i = col('speerpunt'); return i >= 0 ? i : col('thema'); })();
      const cTitel = (() => { const i = heads.findIndex(h => h === 'titel'); return i >= 0 ? i : heads.findIndex(h => isTitelKop(h)); })(), cLead = col('lead'), cDef = col('defin'), cOpl = col('opleiding'),
            cCon = col('contact'), cWeek = col('weeks', 'weken'), cStart = col('startdatum'), cJaars = col('jaars'),
            cCtx = (() => { let i = col('context'); if (i<0) i = col('wat is de vraag','de vraag'); if (i<0) i = col('omschrijving'); return i; })(),
            cHoofd = (() => { let i = col('hoofdvragen'); if (i<0) i = col('deelvragen'); if (i<0) i = col('onderwerp'); return i; })(),
            cPart = col('partner'), cKern = col('kernwoord'), cStudie = (() => { let i = col('studieri'); if (i<0) i = col('suggestie'); return i; })();
      const g = (r, i) => i >= 0 ? sval(r[i]) : '';
      const defMap = (v) => { const s = v.toLowerCase(); if (/\b(ja|definitief|wel)\b/.test(s)) return 'ja'; if (s.includes('niet') || s.includes('nee')) return 'nee'; return v ? 'in behandeling' : 'nee'; };
      let speer = '', last = null;
      matrix.slice(hi + 1).forEach(r => {
        if (!r.some(c => sval(c) !== '')) return;
        const sp = g(r, cSpeer); if (sp) speer = sp;
        const titel = g(r, cTitel);
        const opl = g(r, cOpl), con = g(r, cCon);
        if (titel) {
          last = { ...leegTraject(), thema: thema || 'Zorg', speerpunt: speer, titel,
            lead: g(r, cLead), definitief: defMap(g(r, cDef)), opleidingen: opl, contactpersoon: con,
            weken: g(r, cWeek), startdatum: g(r, cStart), jaars: g(r, cJaars),
            context: g(r, cCtx), hoofdvragen: g(r, cHoofd), partners: g(r, cPart),
            kernwoorden: g(r, cKern), studierichting: g(r, cStudie),
            semesters: semester ? [semester] : [], status: 'Idee' };
          out.push(last);
        } else if (last && (opl || con)) {
          // vervolgrij: extra opleiding/contactpersoon voor het traject erboven
          last.opleidingen = join(last.opleidingen, opl);
          last.contactpersoon = join(last.contactpersoon, con);
        }
      });
    });
    out.studentenOverzicht = studentenOverzicht;
    return out;
  }
  function onImportFileChosen(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.XLSX) { alert('Excel-bibliotheek nog niet geladen.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseTrajectenExcel(ev.target.result, importSemester);
        if (!parsed.length) {
          alert(parsed.studentenOverzicht
            ? 'Dit lijkt een studentenoverzicht (met namen van studenten). Importeer het bij het tabblad Studentengroepen → Excel-import.'
            : 'Geen trajecten herkend. Controleer of er een kolom "Titel", "Traject" of "Trajecten" is.');
          return;
        }
        setImportParsed({ trajecten: parsed, bestand: file.name });
      } catch (err) { alert('Kon het Excel-bestand niet inlezen: ' + err.message); }
    };
    reader.readAsBinaryString(file);
  }
  // velden die bij samenvoegen worden aangevuld als ze in het bestaande traject leeg zijn
  const MERGE_VELDEN = ['speerpunt','lead','definitief','opleidingen','contactpersoon','weken','startdatum','jaars','context','hoofdvragen','partners','kernwoorden','studierichting'];
  function mergeTraject(bestaand, imp) {
    const out = { ...bestaand };
    MERGE_VELDEN.forEach(k => { if ((!out[k] || out[k] === '') && imp[k]) out[k] = imp[k]; });
    out.semesters = [...new Set([...(out.semesters || []), ...(imp.semesters || [])])];
    // staat het traject weer op de planning voor een semester? dan uit het archief halen
    if (out.gearchiveerd && (imp.semesters || []).length) out.gearchiveerd = false;
    return out;
  }
  function bevestigImport(vervang) {
    if (!importParsed) return;
    const imp = importParsed.trajecten;
    let nieuw = 0, samengevoegd = 0;
    if (vervang) {
      setTrajecten(imp);
    } else {
      setTrajecten(prev => {
        const result = [...prev];
        const idxByKey = new Map(prev.map((t, i) => [normaliseerOrg(t.titel), i]));
        imp.forEach(it => {
          const key = normaliseerOrg(it.titel);
          if (idxByKey.has(key)) { const i = idxByKey.get(key); result[i] = mergeTraject(result[i], it); samengevoegd++; }
          else { idxByKey.set(key, result.length); result.push(it); nieuw++; }
        });
        return result;
      });
    }
    setImportParsed(null); setImportOpen(false);
    alert(vervang ? `${imp.length} traject(en) geïmporteerd (vervangen).` : `${nieuw} nieuw, ${samengevoegd} samengevoegd op titel.`);
  }

  if (detail) {
    return (
      <div>
        <TrajectDetail
          traject={detail} contacten={contacten} groepen={groepen}
          onOpenGroep={onOpenGroep} onToggleArchief={toggleArchief}
          onBack={() => setDetailId(null)}
          onEdit={() => { setEditing(detail); setFormOpen(true); }}
          onDelete={() => delTraject(detail.id)}
          onOpenContact={(cid) => onOpenContact(cid)}
        />
        <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title="Traject bewerken" wide>
          <TrajectForm initial={editing || leegTraject()} contacten={contacten} onCreateContact={onCreateContact} onSave={saveTraject} onCancel={() => { setFormOpen(false); setEditing(null); }} />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <button onClick={() => setView('lijst')} className={`px-3 py-1.5 text-sm ${view==='lijst'?'bg-brand text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>Lijst</button>
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm ${view==='kanban'?'bg-brand text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>Kanban</button>
        </div>
        <input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek in alle velden…"
          className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">CSV-export</button>
        <button onClick={() => { setImportParsed(null); setImportOpen(true); }} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50" title="Importeer trajecten uit een Excel-bestand (Leads/Overzicht)">Excel-import</button>
        <button onClick={openWerving} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50" title="Maak een partner-uitdraai van geselecteerde trajecten">Werving-uitdraai</button>
        <button onClick={() => { setEditing(leegTraject()); setFormOpen(true); }}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">+ Nieuw traject</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={fSemester} onChange={e=>setFSemester(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium text-ink" title="Toon trajecten in dit semester">
          <option value="">Alle semesters</option>{SEMESTERS.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fArchief} onChange={e=>setFArchief(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" title="Toon actieve of gearchiveerde trajecten">
          <option value="actief">Actief</option>
          <option value="gearchiveerd">Gearchiveerd</option>
          <option value="alle">Alle (incl. archief)</option>
        </select>
        <select value={fThema} onChange={e=>setFThema(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle thema's</option>{THEMAS.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle statussen</option>{STATUSSEN.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fOpleiding} onChange={e=>setFOpleiding(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle opleidingen</option>{opleidingen.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fContact} onChange={e=>setFContact(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle contactpersonen</option>{contactpersonen.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fDefinitief} onChange={e=>setFDefinitief(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Definitief: alle</option>{DEFINITIEF_OPTS.map(x=><option key={x}>{x}</option>)}
        </select>
        <button onClick={resetFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">Wissen</button>
        <span className="text-sm text-slate-400 ml-auto">{filtered.length} van {trajecten.length}</span>
      </div>

      {view === 'lijst' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Titel</th>
                <th className="px-3 py-2 font-semibold">Thema</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Studenten</th>
                <th className="px-3 py-2 font-semibold">Opleiding</th>
                <th className="px-3 py-2 font-semibold">Contact</th>
                <th className="px-3 py-2 font-semibold">Weken</th>
                <th className="px-3 py-2 font-semibold">Partner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} onClick={() => setDetailId(t.id)} className="border-t border-slate-100 hover:bg-brandlight/50 cursor-pointer">
                  <td className="px-3 py-2 font-medium text-slate-800">{t.titel}</td>
                  <td className="px-3 py-2"><Badge className={THEMA_KLEUR[t.thema]}>{t.thema}</Badge></td>
                  <td className="px-3 py-2"><Badge className={STATUS_KLEUR[t.status]}>{t.status}</Badge></td>
                  <td className="px-3 py-2">{t.lead || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{t.opleidingen || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{contactNaam(t) || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{t.weken || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{t.partners || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-400">Geen trajecten gevonden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUSSEN.map(st => {
            const items = filtered.filter(t => t.status === st);
            return (
              <div key={st}
                onDragOver={e => { e.preventDefault(); if (dragOverCol !== st) setDragOverCol(st); }}
                onDragLeave={() => setDragOverCol(c => c === st ? null : c)}
                onDrop={e => { e.preventDefault(); if (dragId) moveTraject(dragId, st); setDragId(null); setDragOverCol(null); }}
                className={`rounded-xl p-2 w-72 shrink-0 transition-colors ${dragOverCol===st ? 'bg-brandlight ring-2 ring-brand/40' : 'bg-slate-100'}`}>
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <span className="font-semibold text-sm text-slate-700">{st}</span>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[2rem]">
                  {items.map(t => (
                    <div key={t.id} draggable
                      onDragStart={e => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
                      onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                      onClick={() => setDetailId(t.id)}
                      className={`bg-white rounded-lg border border-slate-200 p-3 cursor-move hover:shadow-sm ${dragId===t.id ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        <Badge className={THEMA_KLEUR[t.thema]}>{t.thema}</Badge>
                        {t.lead && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{t.lead} studenten</Badge>}
                      </div>
                      <div className="font-medium text-sm text-slate-800">{t.titel}</div>
                      <div className="text-xs text-slate-500 mt-1">{t.partners}</div>
                      {contactNaam(t) && <div className="text-xs text-slate-400 mt-1">{contactNaam(t)}</div>}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-xs text-slate-300 px-2 py-3">Sleep hierheen…</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        title={editing && trajecten.some(t=>t.id===editing.id) ? 'Traject bewerken' : 'Nieuw traject'} wide>
        <TrajectForm initial={editing || leegTraject()} contacten={contacten} onCreateContact={onCreateContact} onSave={saveTraject} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      </Modal>

      <Modal open={wervingOpen} onClose={() => setWervingOpen(false)} title="Werving-uitdraai genereren" wide>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Selecteer de trajecten die je naar een partner wilt sturen. Er wordt een nette, printbare uitdraai geopend (afdrukken of opslaan als PDF).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Partner (optioneel)"><input className={inputCls} value={wervingPartner} onChange={e=>setWervingPartner(e.target.value)} placeholder="naam partnerorganisatie" /></Field>
            <div className="flex items-end gap-2 text-sm">
              <button onClick={()=>setWervingSel(filtered.map(t=>t.id))} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Alles (huidige filter)</button>
              <button onClick={()=>setWervingSel([])} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Niets</button>
            </div>
          </div>
          <Field label="Inleidende tekst (optioneel)"><textarea className={inputCls + ' h-20'} value={wervingIntro} onChange={e=>setWervingIntro(e.target.value)} placeholder="Korte introductie boven aan de uitdraai…" /></Field>
          <div className="border border-slate-200 rounded-lg p-2 max-h-72 overflow-y-auto space-y-1">
            {trajecten.map(t => (
              <label key={t.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-slate-50 rounded px-1">
                <input type="checkbox" checked={wervingSel.includes(t.id)} onChange={() => toggleWerving(t.id)} className="accent-brand" />
                <Badge className={THEMA_KLEUR[t.thema] || THEMA_KLEUR['Overig']}>{t.thema}</Badge>
                <span className="flex-1">{t.titel}</span>
                <span className="text-xs text-slate-400">{t.trajectType === 'Eerder onderzocht' ? `iteratie ${t.iteratie||'?'}` : 'nieuw'}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm text-slate-400">{wervingSel.length} geselecteerd</span>
            <div className="flex gap-2">
              <button onClick={() => setWervingOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
              <button onClick={genereerWerving} disabled={!wervingSel.length} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Genereer uitdraai</button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportParsed(null); }} title="Trajecten importeren uit Excel">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Leest alle tabbladen (Zorg/Bodem/Logistiek = thema). Speerpunt, titel, aantal studenten, opleiding, contactpersoon, context, hoofdvragen, partners, kernwoorden en studierichting worden overgenomen. Extra opleidings-/contactregels onder een traject worden bij datzelfde traject gevoegd.</p>
          <Field label="Toewijzen aan semester (optioneel)">
            <select className={inputCls} value={importSemester} onChange={e=>setImportSemester(e.target.value)}>
              <option value="">— geen semester —</option>{SEMESTERS.map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
          {!importParsed ? (
            <div>
              <button onClick={() => importFileRef.current && importFileRef.current.click()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">Excel-bestand kiezen…</button>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={onImportFileChosen} className="hidden" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-brandlight/50 border border-brand/20 rounded-lg p-3 text-sm">
                <strong>{importParsed.trajecten.length} traject(en)</strong> herkend uit "{importParsed.bestand}"{importSemester ? ` · semester: ${importSemester}` : ''}.
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                  {importParsed.trajecten.map((t,i) => (
                    <div key={i} className="text-xs text-slate-600 flex items-center gap-2">
                      <Badge className={THEMA_KLEUR[t.thema] || THEMA_KLEUR['Overig']}>{t.thema}</Badge>
                      <span className="flex-1 truncate">{t.titel}</span>
                      {t.contactpersoon && <span className="text-slate-400 truncate max-w-[40%]">{t.contactpersoon}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => setImportParsed(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Ander bestand</button>
                <button onClick={() => bevestigImport(false)} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark" title="Bestaande trajecten met dezelfde titel worden bijgewerkt i.p.v. dubbel toegevoegd">Samenvoegen op titel</button>
                <button onClick={() => { if (confirm('Alle huidige trajecten vervangen door de import?')) bevestigImport(true); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Vervang alle trajecten</button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   CONTACT-FORMULIER
   ============================================================ */
/* ---------- Kansen, type extern en adressen (fase A) ---------- */
const KANS_STANDAARD = ['Innovatietraject', 'Challenge', 'LLO', 'Innovatietafel'];
const REGIO_MH = ['Gouda', 'Bodegraven-Reeuwijk', 'Krimpenerwaard', 'Waddinxveen', 'Zuidplas'];
// alle kanssoorten: de vaste vier plus wat collega's zelf hebben toegevoegd
function kansSoortenUit(contacten) {
  const eigen = new Set();
  (contacten || []).forEach(c => (c.interacties || []).forEach(i => (i.kansen || []).forEach(k => { if (k && !KANS_STANDAARD.includes(k)) eigen.add(k); })));
  return [...KANS_STANDAARD, ...[...eigen].sort()];
}
// voorstel voor het type op basis van de naam van de organisatie
function stelTypeVoor(org) {
  const n = String(org || '').toLowerCase();
  if (!n.trim()) return '';
  if (/gemeente|provincie|ministerie|waterschap|hoogheemraadschap|rijkswaterstaat|ggd|omgevingsdienst|veiligheidsregio|rijksoverheid|odmh|rvo/.test(n)) return 'Overheid';
  if (/hogeschool|universiteit|\bmbo\b|\broc\b|college|school|lyceum|academie|\bhbo\b|\bhu\b|\bhr\b|\bche\b|saxion|inholland|\btu\b|\bwur\b/.test(n)) return 'Onderwijs';
  return '';
}
const leegAdres = () => ({ postcode: '', huisnummer: '', toevoeging: '', straat: '', plaats: '', gemeente: '', provincie: '', regio: '' });
const heeftAdres = a => !!(a && (a.straat || a.plaats || a.postcode));
function adresTekst(a) {
  if (!heeftAdres(a)) return '';
  return [[a.straat, [a.huisnummer, a.toevoeging].filter(Boolean).join('')].filter(Boolean).join(' '), [a.postcode, a.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
function regioVan(gemeente, provincie) { return REGIO_MH.includes(gemeente) ? 'Midden-Holland' : (provincie || ''); }
// adres opzoeken bij PDOK (Kadaster/overheid); alleen postcode en huisnummer gaan mee
async function zoekAdresOp(postcode, huisnummer, toevoeging) {
  const pc = String(postcode || '').toUpperCase().replace(/\s+/g, '');
  const nr = String(huisnummer || '').trim();
  if (!/^\d{4}[A-Z]{2}$/.test(pc) || !/^\d+$/.test(nr)) throw new Error('Vul een postcode (1234 AB) en een huisnummer in.');
  const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:adres&rows=10&fl=straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,gemeentenaam,provincienaam'
    + '&q=' + encodeURIComponent(`postcode:${pc} and huisnummer:${nr}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error('PDOK is nu niet bereikbaar. Vul het adres zelf in.');
  const docs = ((await r.json()).response || {}).docs || [];
  if (!docs.length) throw new Error('Dit adres is niet gevonden. Controleer postcode en huisnummer.');
  const t = String(toevoeging || '').trim().toLowerCase();
  const d = docs.find(x => String((x.huisletter || '') + (x.huisnummertoevoeging || '')).toLowerCase() === t) || docs[0];
  return { postcode: d.postcode, huisnummer: String(d.huisnummer), toevoeging: (d.huisletter || '') + (d.huisnummertoevoeging ? '-' + d.huisnummertoevoeging : ''),
    straat: d.straatnaam, plaats: d.woonplaatsnaam, gemeente: d.gemeentenaam, provincie: d.provincienaam, regio: regioVan(d.gemeentenaam, d.provincienaam) };
}
// wat collega's bij dezelfde organisatie al hebben (adres en type)
function organisatieInfo(contacten, org, behalveId) {
  const key = normaliseerOrg(org);
  if (!key) return null;
  const collegas = (contacten || []).filter(c => c.id !== behalveId && normaliseerOrg(c.organisatie) === key);
  if (!collegas.length) return null;
  const metAdres = collegas.find(c => heeftAdres(c.orgAdres));
  const metType = collegas.find(c => c.typeExtern);
  return { aantal: collegas.length, orgAdres: metAdres ? metAdres.orgAdres : null, typeExtern: metType ? metType.typeExtern : '' };
}

function AdresVelden({ waarde, onChange, label }) {
  const a = { ...leegAdres(), ...(waarde || {}) };
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const zet = (k, v) => onChange({ ...a, [k]: v });
  const zoek = async () => {
    setFout(''); setBezig(true);
    try { onChange(await zoekAdresOp(a.postcode, a.huisnummer, a.toevoeging)); }
    catch (e) { setFout(e.message || 'Opzoeken is niet gelukt.'); }
    setBezig(false);
  };
  const klein = "border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 min-w-0";
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      {label && <div className="text-xs font-semibold text-slate-600">{label}</div>}
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,5rem)_minmax(0,4rem)_auto] gap-2 items-center">
        <input className={klein} value={a.postcode} onChange={e => zet('postcode', e.target.value)} placeholder="2801 JG" aria-label="Postcode" />
        <input className={klein} value={a.huisnummer} onChange={e => zet('huisnummer', e.target.value)} placeholder="nr" aria-label="Huisnummer"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); zoek(); } }} />
        <input className={klein} value={a.toevoeging} onChange={e => zet('toevoeging', e.target.value)} placeholder="toev." aria-label="Toevoeging" />
        <button type="button" onClick={zoek} disabled={bezig} className="px-3 py-2 rounded-lg bg-brand text-white text-sm hover:bg-branddark disabled:opacity-50 whitespace-nowrap">{bezig ? 'Zoeken…' : 'Adres invullen'}</button>
      </div>
      {fout && <div className="text-xs text-rose-600">{fout}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className={klein} value={a.straat} onChange={e => zet('straat', e.target.value)} placeholder="Straat" aria-label="Straat" />
        <input className={klein} value={a.plaats} onChange={e => zet('plaats', e.target.value)} placeholder="Plaats" aria-label="Plaats" />
        <input className={klein} value={a.gemeente} onChange={e => onChange({ ...a, gemeente: e.target.value, regio: regioVan(e.target.value, a.provincie) })} placeholder="Gemeente" aria-label="Gemeente" />
      </div>
      {a.regio && <div className="text-xs text-slate-500">Regio: <span className={a.regio === 'Midden-Holland' ? 'font-semibold text-branddark' : ''}>{a.regio}</span>{a.provincie && a.regio === 'Midden-Holland' ? ` · ${a.provincie}` : ''}</div>}
    </div>
  );
}

function ContactForm({ initial, trajecten, contacten = [], onSave, onCancel }) {
  const [f, setF] = useState({ ...initial, trajectIds: initial.trajectIds || [], themas: initial.themas || [], typeExtern: initial.typeExtern || '',
    orgAdres: { ...leegAdres(), ...(initial.orgAdres || {}) }, vestiging: initial.vestiging ? { ...leegAdres(), ...initial.vestiging } : null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [overgenomen, setOvergenomen] = useState('');
  // organisatie ingevuld: neem type en adres over van collega's bij dezelfde organisatie
  const neemOrganisatieOver = () => {
    const info = organisatieInfo(contacten, f.organisatie, f.id);
    const voorstel = stelTypeVoor(f.organisatie);
    const uit = { ...f };
    const delen = [];
    if (info && info.typeExtern && !f.typeExtern) { uit.typeExtern = info.typeExtern; delen.push('type'); }
    else if (!f.typeExtern && voorstel) uit.typeExtern = voorstel;
    if (info && info.orgAdres && !heeftAdres(f.orgAdres)) { uit.orgAdres = { ...leegAdres(), ...info.orgAdres }; delen.push('adres'); }
    setOvergenomen(delen.length ? `${delen.join(' en ')} overgenomen van ${info.aantal} ${info.aantal === 1 ? 'collega' : "collega's"} bij ${f.organisatie}` : '');
    setF(uit);
  };
  const collegasBijOrg = organisatieInfo(contacten, f.organisatie, f.id);
  const toggleTraj = (id) => setF(prev => ({
    ...prev,
    trajectIds: prev.trajectIds.includes(id) ? prev.trajectIds.filter(x => x !== id) : [...prev.trajectIds, id],
  }));
  const toggleThema = (th) => setF(prev => ({
    ...prev,
    themas: (prev.themas || []).includes(th) ? prev.themas.filter(x => x !== th) : [...(prev.themas || []), th],
  }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Naam"><input className={inputCls} value={f.naam} onChange={set('naam')} /></Field>
      <Field label="Organisatie">
        <input className={inputCls} value={f.organisatie} onChange={set('organisatie')} onBlur={neemOrganisatieOver} list="cg-organisaties" />
        <datalist id="cg-organisaties">{[...new Set(contacten.map(c => c.organisatie).filter(Boolean))].sort().map(o => <option key={o} value={o} />)}</datalist>
        {overgenomen && <span className="block text-xs text-branddark mt-1">✓ {overgenomen}</span>}
      </Field>
      <Field label="Type extern">
        <select className={inputCls} value={f.typeExtern} onChange={set('typeExtern')}>
          <option value="">Kies…</option>{UREN_TYPES.map(x => <option key={x}>{x}</option>)}
        </select>
        {!f.typeExtern && stelTypeVoor(f.organisatie) && <button type="button" onClick={() => setF(p => ({ ...p, typeExtern: stelTypeVoor(p.organisatie) }))} className="text-xs text-brand hover:underline mt-1">Voorstel: {stelTypeVoor(f.organisatie)}</button>}
      </Field>
      <Field label="Functie"><input className={inputCls} value={f.functie} onChange={set('functie')} /></Field>
      <Field label="E-mail"><input className={inputCls} value={f.email} onChange={set('email')} type="email" /></Field>
      <Field label="Telefoon"><input className={inputCls} value={f.telefoon} onChange={set('telefoon')} /></Field>
      <Field label="Leadstatus">
        <select className={inputCls} value={f.leadstatus || 'Koud'} onChange={set('leadstatus')}>
          {LEADSTATUSSEN.map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Eigenaar (Campus Gouda)">
        <input className={inputCls} list="cg-team" value={f.eigenaar || ''} onChange={set('eigenaar')} placeholder="verantwoordelijk teamlid (kies of typ)" />
      </Field>
      <Field label="Relevant voor thema('s)" full>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border border-slate-200 rounded-lg p-2">
          {THEMAS.map(th => {
            const checked = (f.themas || []).includes(th);
            return (
              <label key={th} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleThema(th)} className="accent-brand" />
                {th}
              </label>
            );
          })}
        </div>
      </Field>
      <Field label="Adres" full>
        <AdresVelden label={`Adres van ${f.organisatie || 'de organisatie'}${collegasBijOrg ? ` (geldt ook voor ${collegasBijOrg.aantal} ${collegasBijOrg.aantal === 1 ? 'collega' : "collega's"})` : ''}`}
          waarde={f.orgAdres} onChange={a => setF(p => ({ ...p, orgAdres: a }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600 mt-2">
          <input type="checkbox" className="accent-brand" checked={!!f.vestiging} onChange={e => setF(p => ({ ...p, vestiging: e.target.checked ? leegAdres() : null }))} />
          Deze persoon werkt op een andere vestiging
        </label>
        {f.vestiging && <div className="mt-2"><AdresVelden label="Vestiging van deze persoon" waarde={f.vestiging} onChange={a => setF(p => ({ ...p, vestiging: a }))} /></div>}
      </Field>
      <Field label="Notities" full><textarea className={inputCls + ' h-24'} value={f.notities} onChange={set('notities')} /></Field>
      <Field label="Gekoppelde trajecten" full>
        <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
          {trajecten.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-slate-50 rounded px-1">
              <input type="checkbox" checked={f.trajectIds.includes(t.id)} onChange={() => toggleTraj(t.id)} className="accent-brand" />
              <span>{t.titel} <span className="text-slate-400">· {t.thema}</span></span>
            </label>
          ))}
        </div>
      </Field>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={() => onSave(f)} disabled={!f.naam.trim()}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Opslaan</button>
      </div>
    </div>
  );
}

/* ============================================================
   CONTACT-DETAIL + LOGBOEK
   ============================================================ */
function ContactDetail({ contact, trajecten, uren = [], kansSoorten = KANS_STANDAARD, onBack, onEdit, onDelete, onUpdate, onOpenTraject, onOpenUrenOrg }) {
  const c = contact;
  const [intOpen, setIntOpen] = useState(false);
  const [nieuw, setNieuw] = useState(null);

  const gekoppeld = trajecten.filter(t => (c.trajectIds || []).includes(t.id));
  const collegaVan = trajecten.filter(t => t.interneCollegaId === c.id);
  // uren van de organisatie van dit contact (genormaliseerde match)
  const orgKey = normaliseerOrg(c.organisatie);
  const urenDups = duplicaatIds(uren);
  const orgUren = orgKey ? uren.filter(r => normaliseerOrg(r.organisatie) === orgKey) : [];
  const orgUrenTotaal = orgUren.filter(r => !isUitgesloten(r, urenDups)).reduce((s, r) => s + urenTotaal(r), 0);

  function leegInteractie() {
    return { id: uid(), datum: new Date().toISOString().slice(0,10), type: 'gesprek', aanwezig: '', samenvatting: '', acties: [], gemaakt: new Date().toISOString(), aantalExtern: 1 };
  }
  function saveInteractie(itx) {
    const exists = (c.interacties || []).some(i => i.id === itx.id);
    const interacties = exists
      ? c.interacties.map(i => i.id === itx.id ? itx : i)
      : [itx, ...(c.interacties || [])];
    onUpdate({ ...c, interacties });
    setIntOpen(false); setNieuw(null);
  }
  function delInteractie(id) {
    if (!confirm('Deze interactie verwijderen?')) return;
    onUpdate({ ...c, interacties: c.interacties.filter(i => i.id !== id) });
  }
  function toggleActie(itxId, actieId) {
    onUpdate({
      ...c,
      interacties: c.interacties.map(i => i.id !== itxId ? i : {
        ...i, acties: i.acties.map(a => a.id !== actieId ? a : { ...a, done: !a.done })
      })
    });
  }

  const sorted = [...(c.interacties || [])].sort((a,b) => (b.datum||'').localeCompare(a.datum||''));

  return (
    <div>
      <button onClick={onBack} className="text-sm text-brand hover:underline mb-3">&larr; Terug naar contacten</button>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={LEAD_KLEUR[c.leadstatus] || LEAD_KLEUR['Koud']}>{c.leadstatus || 'Koud'}</Badge>
            {c.typeExtern && <Badge className="bg-white text-ink border-slate-300">{c.typeExtern}</Badge>}
            {(c.vestiging && c.vestiging.regio || c.orgAdres && c.orgAdres.regio) === 'Midden-Holland' && <Badge className="bg-brandlight text-branddark border-brand/30">Midden-Holland</Badge>}
            {(c.themas || []).map(th => <Badge key={th} className={THEMA_KLEUR[th] || THEMA_KLEUR['Overig']}>{th}</Badge>)}
            {isStale(c) && <Badge className="bg-rose-100 text-rose-700 border-rose-200">⚠ Geen recent contact</Badge>}
          </div>
          <h1 className="text-2xl font-light text-ink">{c.naam}</h1>
          <p className="text-slate-500">{[c.functie, c.organisatie].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm hover:bg-branddark">Bewerken</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50">Verwijderen</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linkerkolom: gegevens */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-2">
            {c.email && <div><span className="text-slate-500">E-mail: </span><a href={'mailto:'+c.email} className="text-brand hover:underline">{c.email}</a></div>}
            {c.telefoon && <div><span className="text-slate-500">Tel: </span>{c.telefoon}</div>}
            <div><span className="text-slate-500">Eigenaar: </span>{c.eigenaar || <span className="text-slate-300">—</span>}</div>
            <div><span className="text-slate-500">Adres organisatie: </span>{adresTekst(c.orgAdres) || <span className="text-slate-300">—</span>}{c.orgAdres && c.orgAdres.gemeente && c.orgAdres.gemeente !== c.orgAdres.plaats ? <span className="text-slate-400"> · gemeente {c.orgAdres.gemeente}</span> : null}</div>
            {c.vestiging && heeftAdres(c.vestiging) && <div><span className="text-slate-500">Vestiging: </span>{adresTekst(c.vestiging)}{c.vestiging.gemeente && c.vestiging.gemeente !== c.vestiging.plaats ? <span className="text-slate-400"> · gemeente {c.vestiging.gemeente}</span> : null}</div>}
            <div><span className="text-slate-500">Laatste contact: </span>{
              laatsteInteractie(c)
                ? <span>{laatsteInteractie(c)} <span className="text-slate-400">({dagenGeleden(laatsteInteractie(c))} dagen geleden)</span></span>
                : <span className="text-slate-300">nog geen</span>
            }</div>
          </div>
          {c.notities && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-ink mb-1 text-sm">Notities</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.notities}</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink mb-2 text-sm">Gekoppelde trajecten</h3>
            {gekoppeld.length === 0 && <p className="text-sm text-slate-300">Geen</p>}
            <div className="space-y-1">
              {gekoppeld.map(t => (
                <button key={t.id} onClick={() => onOpenTraject(t.id)} className="block text-left text-sm text-brand hover:underline">
                  {t.titel} <span className="text-slate-400">· {t.thema}</span>
                </button>
              ))}
            </div>
          </div>
          {collegaVan.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-ink mb-2 text-sm">Interne collega bij</h3>
              <div className="space-y-1">
                {collegaVan.map(t => (
                  <button key={t.id} onClick={() => onOpenTraject(t.id)} className="block text-left text-sm text-brand hover:underline">
                    {t.titel} <span className="text-slate-400">· {t.thema}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Uren van deze organisatie */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-ink text-sm">Uren van deze organisatie</h3>
              {orgUren.length > 0 && <span className="text-sm font-medium text-branddark">{orgUrenTotaal} uur</span>}
            </div>
            {orgUren.length === 0 ? (
              <p className="text-sm text-slate-300">Nog geen uren geregistreerd</p>
            ) : (
              <>
                <div className="space-y-1 mb-2">
                  {orgUren.slice(0, 6).map(r => {
                    const uit = isUitgesloten(r, urenDups);
                    return (
                      <div key={r.id} className={`flex justify-between text-sm ${uit ? 'opacity-50' : ''}`}>
                        <span className="text-slate-600">{r.datum || '—'} · {r.thema}{uit && ' (dubbel)'}</span>
                        <span className="text-ink">{urenTotaal(r)} u</span>
                      </div>
                    );
                  })}
                  {orgUren.length > 6 && <div className="text-xs text-slate-400">+ {orgUren.length - 6} regel(s)</div>}
                </div>
                {onOpenUrenOrg && (
                  <button onClick={() => onOpenUrenOrg(c.organisatie)} className="text-sm text-brand hover:underline">
                    Bekijk in Uren-tab →
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rechterkolom: logboek */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-ink">Logboek ({sorted.length})</h3>
            <button onClick={() => { setNieuw(leegInteractie()); setIntOpen(true); }}
              className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm hover:bg-branddark">+ Nieuwe interactie</button>
          </div>
          <div className="space-y-3">
            {sorted.length === 0 && <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 p-4">Nog geen interacties vastgelegd.</p>}
            {sorted.map(i => (
              <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-brandlight text-branddark border-brand/20">{i.type}</Badge>
                    <span className="text-sm text-slate-500">{i.datum}</span>
                    {(i.kansen || []).map(k => <Badge key={k} className="bg-themalogistiek/30 text-ink border-themalogistiek">kans: {k}</Badge>)}
                    {i.aanwezig && <span className="text-xs text-slate-400">· CG: {i.aanwezig}</span>}
                    {gesprekTeltMee(i) && i.duur !== undefined && i.duur !== '' && <span className="text-xs text-slate-400">· {i.geenUren ? 'geen uren' : uurTekst(gesprekUren(i)) + ' (' + ((UREN_CATS.find(c => c.key === (i.urenCat || catUitKansen(i.kansen))) || {}).label || '') + ')'}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setNieuw(i); setIntOpen(true); }} className="text-xs text-slate-400 hover:text-brand">bewerken</button>
                    <button onClick={() => delInteractie(i.id)} className="text-xs text-slate-400 hover:text-rose-600">verwijderen</button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{i.samenvatting}</p>
                {i.acties && i.acties.length > 0 && (
                  <div className="border-t border-slate-100 pt-2">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Vervolgacties</div>
                    {i.acties.map(a => (
                      <label key={a.id} className="flex items-start gap-2 text-sm py-0.5 cursor-pointer">
                        <input type="checkbox" checked={!!a.done} onChange={() => toggleActie(i.id, a.id)} className="accent-brand mt-0.5" />
                        <span className="flex-1">
                          <span className={a.done ? 'line-through text-slate-400' : 'text-slate-700'}>{a.tekst}</span>
                          {(a.deadline || a.eigenaar) && (
                            <span className="ml-2 text-xs text-slate-400">
                              {a.deadline && <span className={(!a.done && dagenGeleden(a.deadline) > 0) ? 'text-rose-600 font-medium' : ''}>⏱ {a.deadline}</span>}
                              {a.deadline && a.eigenaar && ' · '}
                              {a.eigenaar && <span>{a.eigenaar}</span>}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={intOpen} onClose={() => { setIntOpen(false); setNieuw(null); }} title={nieuw && (c.interacties||[]).some(i=>i.id===nieuw.id) ? 'Interactie bewerken' : 'Nieuwe interactie'}>
        {nieuw && <InteractieForm initial={nieuw} kansSoorten={kansSoorten} onSave={saveInteractie} onCancel={() => { setIntOpen(false); setNieuw(null); }} />}
      </Modal>
    </div>
  );
}

function InteractieForm({ initial, kansSoorten = KANS_STANDAARD, onSave, onCancel }) {
  const [f, setF] = useState({ ...initial, acties: initial.acties ? initial.acties.map(a=>({...a})) : [], kansen: initial.kansen || [] });
  const [soorten, setSoorten] = useState(() => [...new Set([...kansSoorten, ...(initial.kansen || [])])]);
  const [nieuweSoort, setNieuweSoort] = useState('');
  const toggleKans = k => setF(p => ({ ...p, kansen: p.kansen.includes(k) ? p.kansen.filter(x => x !== k) : [...p.kansen, k] }));
  const voegSoortToe = () => {
    const t = nieuweSoort.trim(); if (!t) return;
    if (!soorten.includes(t)) setSoorten(s => [...s, t]);
    if (!f.kansen.includes(t)) toggleKans(t);
    setNieuweSoort('');
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [actieTekst, setActieTekst] = useState('');
  const [vraagUren, setVraagUren] = useState(false);
  const telt = gesprekTeltMee(f);
  const bewaar = () => {
    if (!telt) return onSave(f);
    const leeg = f.duur === '' || f.duur === undefined || f.duur === null;
    if (leeg && !f.geenUren) { setVraagUren(true); return; }
    if (!f.geenUren) {
      const d = Number(f.duur);
      if (!(d >= 0.5) || Math.abs(d * 2 - Math.round(d * 2)) > 1e-9) { alert('Vul de duur in halve uren in, vanaf 0,5 uur (bijv. 0,5 · 1 · 1,5).'); return; }
    }
    onSave({ ...f, duur: f.geenUren ? 0 : Number(f.duur), aantalExtern: Math.max(1, parseInt(f.aantalExtern, 10) || 1) });
  };
  const addActie = () => {
    const t = actieTekst.trim(); if (!t) return;
    setF(p => ({ ...p, acties: [...p.acties, { id: uid(), tekst: t, done: false, deadline: '', eigenaar: '' }] }));
    setActieTekst('');
  };
  const delActie = (id) => setF(p => ({ ...p, acties: p.acties.filter(a => a.id !== id) }));
  const setActie = (id, k, v) => setF(p => ({ ...p, acties: p.acties.map(a => a.id===id ? { ...a, [k]: v } : a) }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Datum"><input type="date" className={inputCls} value={f.datum} onChange={set('datum')} /></Field>
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={set('type')}>{INTERACTIE_TYPES.map(x=><option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Wie van Campus Gouda was erbij?" full>
        {TEAM_NAMEN.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TEAM_NAMEN.map(n => {
              const aan = heeftNaam(f.aanwezig, n);
              return <button key={n} type="button" onClick={() => setF(p => ({ ...p, aanwezig: wisselNaam(p.aanwezig, n) }))}
                className={`text-sm px-3 py-1 rounded-full border ${aan ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600 hover:border-brand'}`}>{aan ? '✓ ' : ''}{n}</button>;
            })}
          </div>
        )}
        <input className={inputCls} list="cg-team" value={f.aanwezig || ''} onChange={set('aanwezig')} placeholder={TEAM_NAMEN.length ? 'of typ hier een andere naam' : 'naam/namen teamlid Campus Gouda (vul het team in via ⚙ Opslag → Team en rollen)'} />
      </Field>
      <Field label="Samenvatting" full><textarea className={inputCls + ' h-28'} value={f.samenvatting} onChange={set('samenvatting')} /></Field>
      <Field label="Kans voor… (meerdere mogelijk)" full>
        <div className="flex flex-wrap gap-1.5">
          {soorten.map(k => (
            <button key={k} type="button" onClick={() => toggleKans(k)}
              className={`text-sm px-3 py-1 rounded-full border ${f.kansen.includes(k) ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600 hover:border-brand'}`}>{f.kansen.includes(k) ? '✓ ' : ''}{k}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input className={inputCls} value={nieuweSoort} onChange={e => setNieuweSoort(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); voegSoortToe(); } }} placeholder="Andere soort kans, bijv. Stage of Afstudeeropdracht" />
          <button type="button" onClick={voegSoortToe} className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 shrink-0">Toevoegen</button>
        </div>
      </Field>
      {telt ? (
        <Field label="Uren partner (urenverantwoording)" full>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-slate-600 mr-1">Duur</span>
            {[0.5, 1, 1.5, 2, 3].map(d => (
              <button key={d} type="button" onClick={() => { setF(p => ({ ...p, duur: d, geenUren: false })); setVraagUren(false); }}
                className={`text-sm px-3 py-1 rounded-full border ${Number(f.duur) === d && !f.geenUren ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600 hover:border-brand'}`}>{String(d).replace('.', ',')}</button>
            ))}
            <input type="number" min="0.5" step="0.5" value={f.geenUren ? '' : (f.duur ?? '')} onChange={e => { setF(p => ({ ...p, duur: e.target.value, geenUren: false })); setVraagUren(false); }}
              className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm" aria-label="Duur in uren" placeholder="uur" />
            <span className="text-sm text-slate-600 ml-2">× externen</span>
            <input type="number" min="1" step="1" value={f.aantalExtern ?? 1} onChange={e => setF(p => ({ ...p, aantalExtern: e.target.value }))}
              className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm" aria-label="Aantal externen" />
            <span className="text-sm text-slate-600">= <strong className="text-ink">{f.geenUren ? '0 uur' : uurTekst(gesprekUren(f))}</strong></span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-slate-600">Telt voor</span>
            <select value={f.urenCat || catUitKansen(f.kansen)} onChange={e => setF(p => ({ ...p, urenCat: e.target.value }))} className="border border-slate-300 rounded-lg px-2 py-1 text-sm" aria-label="Urencategorie">
              {UREN_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {!f.urenCat && <span className="text-xs text-slate-400">automatisch uit "kans voor"</span>}
            {f.urenCat && <button type="button" onClick={() => setF(p => ({ ...p, urenCat: '' }))} className="text-xs text-brand hover:underline">weer automatisch</button>}
          </div>
          <p className="text-xs text-slate-400 mt-1">Alleen de tijd van externen telt: duur × aantal mensen van buiten Campus Gouda. In halve uren.</p>
          {f.geenUren && <p className="text-xs text-slate-500 mt-1">Bevestigd: bij dit gesprek horen geen uren (0).</p>}
          {vraagUren && (
            <div className="mt-2 border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm space-y-2">
              <div className="text-amber-900">Bij dit gesprek zijn geen uren ingevuld. Klopt dat?</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setVraagUren(false); onSave({ ...f, duur: 0, geenUren: true, aantalExtern: Math.max(1, parseInt(f.aantalExtern, 10) || 1) }); }} className="px-3 py-1.5 rounded-lg bg-white border border-amber-400 text-amber-900 hover:bg-amber-100">Ja, geen uren (0)</button>
                <button type="button" onClick={() => setVraagUren(false)} className="px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-branddark">Nee, ik vul de duur in</button>
              </div>
            </div>
          )}
        </Field>
      ) : (
        <p className="sm:col-span-2 text-xs text-slate-400">Gesprek van vóór {CGT.datumDM(UREN_UIT_GESPREKKEN_VANAF)}: de uren hiervan staan in de handmatige urenregistratie.</p>
      )}
      <Field label="Vervolgacties (met deadline en eigenaar)" full>
        <div className="space-y-2 mb-2">
          {f.acties.map(a => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm border border-slate-200 rounded-lg p-2">
              <input type="checkbox" checked={!!a.done} onChange={() => setActie(a.id, 'done', !a.done)} className="accent-brand" />
              <input className="flex-1 min-w-[140px] border border-slate-300 rounded px-2 py-1" value={a.tekst} onChange={e=>setActie(a.id,'tekst',e.target.value)} placeholder="actie" />
              <input type="date" className="border border-slate-300 rounded px-2 py-1" value={a.deadline || ''} onChange={e=>setActie(a.id,'deadline',e.target.value)} title="deadline" />
              <input className="w-32 border border-slate-300 rounded px-2 py-1" list="cg-team" value={a.eigenaar || ''} onChange={e=>setActie(a.id,'eigenaar',e.target.value)} placeholder="eigenaar" />
              <button onClick={() => delActie(a.id)} className="text-slate-400 hover:text-rose-600 px-1">&times;</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={inputCls} value={actieTekst} onChange={e=>setActieTekst(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'){ e.preventDefault(); addActie(); } }} placeholder="Nieuwe actie + Enter" />
          <button onClick={addActie} className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 shrink-0">Toevoegen</button>
        </div>
      </Field>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={bewaar} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">Opslaan</button>
      </div>
    </div>
  );
}

/* ============================================================
   CONTACTEN-TAB
   ============================================================ */
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-2xl font-light mt-1 ${accent || 'text-ink'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function ContactenTab({ contacten, setContacten, trajecten, uren = [], openContactId, setOpenContactId, pendingNewContact, clearPendingNewContact, onOpenTraject, onOpenUrenOrg }) {
  const [detailId, setDetailId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('lijst'); // lijst | pipeline
  const [zoek, setZoek] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fEigenaar, setFEigenaar] = useState('');
  const [fThema, setFThema] = useState('');
  const [fType, setFType] = useState('');
  const [fRegio, setFRegio] = useState('');
  const [fKans, setFKans] = useState('');
  const [fGesprek, setFGesprek] = useState('');
  const kansSoorten = useMemo(() => kansSoortenUit(contacten), [contacten]);
  const regioVanContact = c => (c.vestiging && heeftAdres(c.vestiging) ? c.vestiging.regio : c.orgAdres && c.orgAdres.regio) || '';
  const [dragId, setDragId] = useState(null);       // contact dat gesleept wordt
  const [dragOverCol, setDragOverCol] = useState(null);

  // externe navigatie (vanuit traject-detail)
  useEffect(() => {
    if (openContactId) { setDetailId(openContactId); setOpenContactId(null); }
  }, [openContactId]);
  // nieuw contact voorvullen (vanuit verbonden persoon in Uren-tab)
  useEffect(() => {
    if (pendingNewContact) {
      setDetailId(null);
      setEditing({ ...leegContact(), naam: pendingNewContact.naam || '', organisatie: pendingNewContact.organisatie || '' });
      setFormOpen(true);
      clearPendingNewContact && clearPendingNewContact();
    }
  }, [pendingNewContact]);

  const trajById = useMemo(() => Object.fromEntries(trajecten.map(t => [t.id, t])), [trajecten]);
  // thema's van een contact: expliciet aangevinkt + afgeleid uit gekoppelde trajecten
  const contactThemas = (c) => [...new Set([
    ...(c.themas || []),
    ...(c.trajectIds || []).map(id => trajById[id] && trajById[id].thema).filter(Boolean),
  ])];

  const eigenaren = useMemo(() => [...new Set([...TEAM_NAMEN, ...contacten.map(c=>c.eigenaar).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'nl')), [contacten]);
  // iedereen van Campus Gouda die bij een gesprek was (team + namen uit de gesprekken)
  const gesprekVoerders = useMemo(() => {
    const m = new Map();
    [...TEAM_NAMEN, ...contacten.flatMap(c => (c.interacties || []).flatMap(i => naamLijst(i.aanwezig)))].forEach(n => { const k = n.toLowerCase(); if (!m.has(k)) m.set(k, n); });
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'nl'));
  }, [contacten]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return contacten.filter(c => {
      if (fStatus && (c.leadstatus || 'Koud') !== fStatus) return false;
      if (fEigenaar && c.eigenaar !== fEigenaar) return false;
      if (fThema && !contactThemas(c).includes(fThema)) return false;
      if (fType && (c.typeExtern || '') !== (fType === '(leeg)' ? '' : fType)) return false;
      if (fRegio && (fRegio === 'Midden-Holland' ? regioVanContact(c) !== 'Midden-Holland' : regioVanContact(c) === 'Midden-Holland')) return false;
      if (fKans && !(c.interacties || []).some(i => (i.kansen || []).includes(fKans))) return false;
      if (fGesprek && !(c.interacties || []).some(i => heeftNaam(i.aanwezig, fGesprek))) return false;
      if (q) {
        const blob = [c.naam,c.organisatie,c.functie,c.email,c.telefoon,c.eigenaar,c.leadstatus,c.notities,c.typeExtern,adresTekst(c.orgAdres),c.orgAdres && c.orgAdres.gemeente].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [contacten, zoek, fStatus, fEigenaar, fThema, fType, fRegio, fKans, fGesprek, trajById]);

  // statistieken (over alle contacten)
  const stats = useMemo(() => {
    const perFase = {};
    LEADSTATUSSEN.forEach(s => perFase[s] = 0);
    let acties = 0, stale = 0;
    contacten.forEach(c => {
      perFase[c.leadstatus || 'Koud'] = (perFase[c.leadstatus || 'Koud'] || 0) + 1;
      acties += openActiesVan(c);
      if (isStale(c)) stale++;
    });
    return { totaal: contacten.length, perFase, acties, stale };
  }, [contacten]);

  const detail = contacten.find(c => c.id === detailId);

  function saveContact(f) {
    const key = normaliseerOrg(f.organisatie);
    setContacten(prev => {
      const lijst = prev.some(c=>c.id===f.id) ? prev.map(c=>c.id===f.id?f:c) : [...prev, f];
      if (!key) return lijst;
      // adres en type horen bij de organisatie: ook bij collega's bijwerken
      return lijst.map(c => (c.id === f.id || normaliseerOrg(c.organisatie) !== key) ? c : {
        ...c,
        ...(heeftAdres(f.orgAdres) && JSON.stringify(c.orgAdres) !== JSON.stringify(f.orgAdres) ? { orgAdres: f.orgAdres } : {}),
        ...(f.typeExtern && c.typeExtern !== f.typeExtern ? { typeExtern: f.typeExtern } : {}),
      });
    });
    setFormOpen(false); setEditing(null); setDetailId(f.id);
  }
  function delContact(id) {
    if (!confirm('Dit contact verwijderen?')) return;
    setContacten(prev => prev.filter(c => c.id !== id));
    setDetailId(null);
  }
  function updateContact(c) { setContacten(prev => prev.map(x => x.id === c.id ? c : x)); }
  function moveContact(id, leadstatus) { setContacten(prev => prev.map(c => c.id === id ? { ...c, leadstatus } : c)); }
  function leegContact() {
    return { id: uid(), naam:'', organisatie:'', functie:'', email:'', telefoon:'', leadstatus:'Koud', eigenaar:'', themas:[], trajectIds:[], notities:'', interacties:[] };
  }

  if (detail) {
    return (
      <div>
        <ContactDetail
          contact={detail} trajecten={trajecten} uren={uren} kansSoorten={kansSoortenUit(contacten)}
          onBack={() => setDetailId(null)}
          onEdit={() => { setEditing(detail); setFormOpen(true); }}
          onDelete={() => delContact(detail.id)}
          onUpdate={updateContact}
          onOpenTraject={onOpenTraject}
          onOpenUrenOrg={onOpenUrenOrg}
        />
        <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title="Contact bewerken">
          <ContactForm initial={editing} trajecten={trajecten} contacten={contacten} onSave={saveContact} onCancel={() => { setFormOpen(false); setEditing(null); }} />
        </Modal>
      </div>
    );
  }

  const faseSub = LEADSTATUSSEN.filter(s => stats.perFase[s] > 0).map(s => `${s}: ${stats.perFase[s]}`).join(' · ') || 'geen';

  const ContactKaart = ({ c, compact }) => {
    const acties = openActiesVan(c);
    const last = laatsteInteractie(c);
    return (
      <div draggable
        onDragStart={e => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }}
        onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
        onClick={() => setDetailId(c.id)}
        className={`bg-white rounded-lg border border-slate-200 p-3 cursor-move hover:shadow-sm transition ${dragId===c.id ? 'opacity-40' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-ink leading-tight">{c.naam}</div>
          {isStale(c) && <span title="Geen recent contact (>4 weken)" className="text-rose-500 shrink-0">⚠</span>}
        </div>
        <div className="text-xs text-slate-500">{c.organisatie}</div>
        {!compact && <div className="text-xs text-slate-400 mt-1">{c.functie}</div>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">{last ? `laatst: ${last}` : 'nog geen contact'}</span>
          {acties > 0 && <Badge className="bg-themalogistiek/30 text-ink border-themalogistiek">{acties} open</Badge>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Overzichtskaarten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Totaal contacten" value={stats.totaal} />
        <StatCard label="Contacten per fase" value={LEADSTATUSSEN.filter(s=>stats.perFase[s]>0).length} sub={faseSub} />
        <StatCard label="Openstaande vervolgacties" value={stats.acties} accent={stats.acties>0?'text-branddark':'text-ink'} />
        <StatCard label="Zonder recente follow-up" value={stats.stale} sub=">4 weken geen contact" accent={stats.stale>0?'text-rose-600':'text-ink'} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          <button onClick={() => setView('lijst')} className={`px-3 py-1.5 text-sm ${view==='lijst'?'bg-brand text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>Lijst</button>
          <button onClick={() => setView('pipeline')} className={`px-3 py-1.5 text-sm ${view==='pipeline'?'bg-brand text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>Pipeline</button>
        </div>
        <input value={zoek} onChange={e=>setZoek(e.target.value)} placeholder="Zoek contacten…"
          className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button onClick={() => { setEditing(leegContact()); setFormOpen(true); }}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">+ Nieuw contact</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle leadstatussen</option>{LEADSTATUSSEN.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fEigenaar} onChange={e=>setFEigenaar(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle eigenaren</option>{eigenaren.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fThema} onChange={e=>setFThema(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle thema's</option>{THEMAS.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle typen</option>{UREN_TYPES.map(x=><option key={x}>{x}</option>)}<option value="(leeg)">Type onbekend</option>
        </select>
        <select value={fRegio} onChange={e=>setFRegio(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle regio's</option><option>Midden-Holland</option><option value="Buiten">Buiten Midden-Holland</option>
        </select>
        <select value={fKans} onChange={e=>setFKans(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle kansen</option>{kansSoorten.map(x=><option key={x} value={x}>Kans: {x}</option>)}
        </select>
        <select value={fGesprek} onChange={e=>setFGesprek(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" aria-label="Filter op gesprekken met teamlid">
          <option value="">Alle gesprekken</option>{gesprekVoerders.map(x=><option key={x} value={x}>Gesprek met: {x}</option>)}
        </select>
        <button onClick={() => { setZoek(''); setFStatus(''); setFEigenaar(''); setFThema(''); setFType(''); setFRegio(''); setFKans(''); setFGesprek(''); }} className="text-sm text-slate-500 hover:text-slate-700 underline">Wissen</button>
        <span className="text-sm text-slate-400 ml-auto">{filtered.length} van {contacten.length}</span>
      </div>

      {view === 'lijst' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Naam</th>
                <th className="px-3 py-2 font-semibold">Organisatie</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Leadstatus</th>
                <th className="px-3 py-2 font-semibold">Eigenaar</th>
                <th className="px-3 py-2 font-semibold">Laatste contact</th>
                <th className="px-3 py-2 font-semibold">Open acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const last = laatsteInteractie(c);
                const acties = openActiesVan(c);
                return (
                  <tr key={c.id} onClick={() => setDetailId(c.id)} className="border-t border-slate-100 hover:bg-brandlight/40 cursor-pointer">
                    <td className="px-3 py-2 font-medium text-ink">
                      <span className="flex items-center gap-1 flex-wrap">{c.naam}{isStale(c) && <span title="Geen recent contact (>4 weken)" className="text-rose-500">⚠</span>}
                        {(c.themas || []).map(th => <Badge key={th} className={THEMA_KLEUR[th] || THEMA_KLEUR['Overig']}>{th}</Badge>)}
                      </span>
                      <span className="text-xs text-slate-400">{c.functie}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{c.organisatie || '—'}{regioVanContact(c) && <span className="block text-xs text-slate-400">{(c.vestiging && heeftAdres(c.vestiging) ? c.vestiging : c.orgAdres).plaats}{regioVanContact(c) === 'Midden-Holland' ? ' · Midden-Holland' : ''}</span>}</td>
                    <td className="px-3 py-2 text-slate-600">{c.typeExtern || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2"><Badge className={LEAD_KLEUR[c.leadstatus]||LEAD_KLEUR['Koud']}>{c.leadstatus||'Koud'}</Badge></td>
                    <td className="px-3 py-2 text-slate-600">{c.eigenaar || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{last || <span className="text-slate-300">nog geen</span>}</td>
                    <td className="px-3 py-2">{acties > 0 ? <Badge className="bg-themalogistiek/30 text-ink border-themalogistiek">{acties}</Badge> : <span className="text-slate-300">0</span>}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-400">Geen contacten gevonden.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEADSTATUSSEN.map(st => {
            const items = filtered.filter(c => (c.leadstatus || 'Koud') === st);
            return (
              <div key={st}
                onDragOver={e => { e.preventDefault(); if (dragOverCol !== st) setDragOverCol(st); }}
                onDragLeave={() => setDragOverCol(c => c === st ? null : c)}
                onDrop={e => { e.preventDefault(); if (dragId) moveContact(dragId, st); setDragId(null); setDragOverCol(null); }}
                className={`rounded-xl p-2 w-64 shrink-0 transition-colors ${dragOverCol===st ? 'bg-brandlight ring-2 ring-brand/40' : 'bg-slate-100'}`}>
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <span className="font-semibold text-sm text-ink">{st}</span>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[2rem]">
                  {items.map(c => <ContactKaart key={c.id} c={c} compact />)}
                  {items.length === 0 && <div className="text-xs text-slate-300 px-2 py-3">Sleep hierheen…</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title="Nieuw contact">
        <ContactForm initial={editing || leegContact()} trajecten={trajecten} contacten={contacten} onSave={saveContact} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}

/* ============================================================
   UREN-TAB
   ============================================================ */
// React-wrapper rond Chart.js (UMD-global), beheert aanmaken/opruimen
function ChartCanvas({ type, data, options }) {
  const ref = React.useRef(null);
  const inst = React.useRef(null);
  useEffect(() => {
    if (!ref.current || !window.Chart) return;
    window.Chart.defaults.font.family = 'Manrope, Arial, sans-serif';
    inst.current = new window.Chart(ref.current, { type, data, options });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [type, JSON.stringify(data), JSON.stringify(options)]);
  return <canvas ref={ref} />;
}

function UurForm({ initial, contacten, collegas, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const totaal = urenTotaal(f);
  const numCls = "w-full border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Organisatie" full>
        <input className={inputCls} value={f.organisatie} onChange={set('organisatie')} placeholder="naam partnerorganisatie" list="cg-uren-org"
          onBlur={() => {
            const info = organisatieInfo(contacten, f.organisatie, null);
            if (!info) return;
            setF(p => ({ ...p,
              ...(info.typeExtern ? { type: info.typeExtern } : {}),
              ...(info.orgAdres && info.orgAdres.gemeente && !p.gemeente ? { gemeente: GEMEENTEN.includes(info.orgAdres.gemeente) ? info.orgAdres.gemeente : 'Overig' } : {}) }));
          }} />
        <datalist id="cg-uren-org">{[...new Set((contacten || []).map(c => c.organisatie).filter(Boolean))].sort().map(o => <option key={o} value={o} />)}</datalist>
        {organisatieInfo(contacten, f.organisatie, null) && <span className="block text-xs text-slate-400 mt-1">Type en gemeente worden overgenomen van de contacten bij deze organisatie.</span>}
      </Field>
      <Field label="Thema">
        <select className={inputCls} value={f.thema} onChange={set('thema')}>{UREN_THEMAS.map(x=><option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={set('type')}>{UREN_TYPES.map(x=><option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Ondertekenaar">
        <select className={inputCls} value={f.ondertekenaar} onChange={set('ondertekenaar')}><option>nee</option><option>ja</option></select>
      </Field>
      <Field label="Gemeente gevestigd"><GemeenteKiezer value={f.gemeente} onChange={(v)=>setF(p=>({...p, gemeente:v}))} /></Field>
      <Field label="Verbonden persoon organisatie"><input className={inputCls} value={f.verbondenPersoon} onChange={set('verbondenPersoon')} /></Field>
      <Field label="Interne collega (Campus Gouda)">
        <input className={inputCls} list="cg-collegas" value={f.interneCollega} onChange={set('interneCollega')} />
        <datalist id="cg-collegas">{collegas.map((n,i)=><option key={i} value={n} />)}</datalist>
      </Field>
      <Field label="Datum uurbesteding"><input type="date" className={inputCls} value={/^\d{4}-\d{2}-\d{2}$/.test(f.datum)?f.datum:''} onChange={set('datum')} />
        {f.datum && !/^\d{4}-\d{2}-\d{2}$/.test(f.datum) && <span className="block text-xs text-amber-600 mt-1">Niet-standaard datum: "{f.datum}"</span>}
      </Field>
      <Field label="Dubbele afspraak">
        <div className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
          Wordt <strong>automatisch</strong> gecontroleerd: een afspraak die al eerder is toegevoegd (zelfde organisatie, datum, type, uren en beschrijving) telt niet mee in totalen, grafieken en bijdrage.
        </div>
      </Field>
      <div className="sm:col-span-2">
        <span className="block text-xs font-semibold text-slate-600 mb-1">Uren per categorie</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {UREN_CATS.map(c => (
            <label key={c.key} className="block">
              <span className="block text-[11px] text-slate-500 mb-1">{c.label}</span>
              <input type="number" step="0.5" min="0" className={numCls} value={f[c.key]} onChange={set(c.key)} placeholder="0" />
            </label>
          ))}
        </div>
        <div className="text-sm text-slate-600 mt-2">Totaal deze regel: <strong className="text-ink">{totaal} uur</strong></div>
      </div>
      <Field label="Beschrijving betrokkenheid" full><textarea className={inputCls + ' h-24'} value={f.beschrijving} onChange={set('beschrijving')} /></Field>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={() => onSave(f)} disabled={!f.organisatie.trim()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Opslaan</button>
      </div>
    </div>
  );
}

function TargetsModal({ targets, onSave, onCancel }) {
  const [t, setT] = useState({ ...targets });
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Doelstellingen in uren per thema en totaal. Laat leeg/0 als nog niet bekend.</p>
      <div className="grid grid-cols-2 gap-3">
        {UREN_THEMAS.map(th => (
          <label key={th} className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">Doel {th}</span>
            <input type="number" min="0" step="1" className={inputCls} value={t[th] ?? ''} onChange={set(th)} placeholder="0" />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="block text-xs font-semibold text-slate-600 mb-1">Totaaldoel (alle thema's)</span>
        <input type="number" min="0" step="1" className={inputCls} value={t.totaal ?? ''} onChange={set('totaal')} placeholder="0" />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={() => onSave(t)} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">Opslaan</button>
      </div>
    </div>
  );
}

function UrenTab({ uren, setUren, targets, setTargets, contacten, externalOrg, clearExternalOrg, onOpenPersoon }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const [fOrg, setFOrg] = useState('');     // genormaliseerde sleutel
  const [fThema, setFThema] = useState('');
  const [fType, setFType] = useState('');
  const [fCollega, setFCollega] = useState('');
  const [dVan, setDVan] = useState('');
  const [dTot, setDTot] = useState('');
  const [sortKey, setSortKey] = useState('organisatie');
  const [sortDir, setSortDir] = useState('asc');
  const [bijdrageOpen, setBijdrageOpen] = useState(false);
  // uitdraai/export-modal
  const [exportOpen, setExportOpen] = useState(false);
  const [expOrg, setExpOrg] = useState('');          // '' = alle partners (genormaliseerde sleutel)
  const [expNiveau, setExpNiveau] = useState('samenvatting'); // samenvatting | regels
  const [expVan, setExpVan] = useState('');
  const [expTot, setExpTot] = useState('');
  const [expBedrag, setExpBedrag] = useState(true);
  const [expBeschrijving, setExpBeschrijving] = useState(true);
  const [expCollega, setExpCollega] = useState(false);
  const [expExclDubbel, setExpExclDubbel] = useState(true);
  const fileRef = React.useRef(null);
  const UURTARIEF = 100; // € per uur dat een partner bijdraagt
  const euro = (n) => '€ ' + Math.round(n).toLocaleString('nl-NL');
  // kolommen voor de sorteerbare lijst (alle kolommen uit de Excel)
  const KOLOMMEN = [
    { key: 'organisatie', label: 'Organisatie', type: 't' },
    { key: 'thema', label: 'Thema', type: 't' },
    { key: 'type', label: 'Type', type: 't' },
    { key: 'ondertekenaar', label: 'Ondertekenaar', type: 't' },
    { key: 'gemeente', label: 'Gemeente', type: 't' },
    { key: 'verbondenPersoon', label: 'Verbonden persoon', type: 't' },
    { key: 'urenLLO', label: 'LLO', type: 'n' },
    { key: 'urenTrajecten', label: 'Trajecten', type: 'n' },
    { key: 'urenChallenge', label: 'Challenge', type: 'n' },
    { key: 'urenInnovatie', label: 'Innovatietafel', type: 'n' },
    { key: 'urenOverig', label: 'Overig', type: 'n' },
    { key: '_totaal', label: 'Totaal', type: 'n' },
    { key: '_bedrag', label: '€ (×100)', type: 'n' },
    { key: 'datum', label: 'Datum', type: 't' },
    { key: 'interneCollega', label: 'Collega intern', type: 't' },
  ];
  const sortVal = (r, key) => {
    if (key === '_totaal') return urenTotaal(r);
    if (key === '_bedrag') return urenTotaal(r) * UURTARIEF;
    return r[key];
  };
  function setSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // externe org-filter (vanuit een contact)
  useEffect(() => {
    if (externalOrg) { setFOrg(normaliseerOrg(externalOrg)); clearExternalOrg && clearExternalOrg(); }
  }, [externalOrg]);

  // organisaties (genormaliseerd → nette weergavenaam)
  const orgGroups = useMemo(() => {
    const map = new Map();
    uren.forEach(r => { const k = normaliseerOrg(r.organisatie); if (k && !map.has(k)) map.set(k, r.organisatie); });
    return [...map.entries()].map(([key, display]) => ({ key, display })).sort((a,b)=>a.display.localeCompare(b.display));
  }, [uren]);
  const collegas = useMemo(() => {
    const s = new Set();
    TEAM_NAMEN.forEach(n => s.add(n));
    uren.forEach(r => { if (r.interneCollega) s.add(r.interneCollega); });
    contacten.forEach(c => { if (c.naam) s.add(c.naam); });
    return [...s].sort();
  }, [uren, contacten]);
  const collegaFilters = useMemo(() => [...new Set(uren.map(r=>r.interneCollega).filter(Boolean))].sort(), [uren]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return uren.filter(r => {
      if (fOrg && normaliseerOrg(r.organisatie) !== fOrg) return false;
      if (fThema && r.thema !== fThema) return false;
      if (fType && r.type !== fType) return false;
      if (fCollega && r.interneCollega !== fCollega) return false;
      if (dVan && (!r.datum || r.datum < dVan)) return false;
      if (dTot && (!r.datum || r.datum > dTot)) return false;
      if (q) {
        const blob = [r.organisatie,r.thema,r.type,r.gemeente,r.verbondenPersoon,r.interneCollega,r.beschrijving].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [uren, zoek, fOrg, fThema, fType, fCollega, dVan, dTot]);

  // gesorteerde lijst
  const sorted = useMemo(() => {
    const kol = KOLOMMEN.find(k => k.key === sortKey) || { type: 't' };
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let va = sortVal(a, sortKey), vb = sortVal(b, sortKey);
      if (kol.type === 'n') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; return (va - vb) * dir; }
      return String(va || '').localeCompare(String(vb || ''), 'nl') * dir;
    });
  }, [filtered, sortKey, sortDir]);

  // automatisch herkende duplicaten (exacte herhalingen van een eerdere regel)
  const dups = useMemo(() => duplicaatIds(uren), [uren]);
  const autoDubbelCount = dups.size;

  // dashboard-berekeningen (altijd over ALLE meetellende regels — excl. dubbel & duplicaat)
  const dash = useMemo(() => {
    const actief = uren.filter(r => !isUitgesloten(r, dups));
    const totaal = actief.reduce((s,r)=>s+urenTotaal(r),0);
    const perThema = UREN_THEMAS.map(th => actief.filter(r=>r.thema===th).reduce((s,r)=>s+urenTotaal(r),0));
    const perCat = UREN_CATS.map(c => actief.reduce((s,r)=>s+(parseFloat(r[c.key])||0),0));
    const partners = new Set(actief.filter(r=>urenTotaal(r)>0).map(r=>normaliseerOrg(r.organisatie)).filter(Boolean)).size;
    const maandMap = {};
    actief.forEach(r => { if (/^\d{4}-\d{2}/.test(r.datum)) { const m=r.datum.slice(0,7); maandMap[m]=(maandMap[m]||0)+urenTotaal(r); } });
    const maanden = Object.keys(maandMap).sort();
    const uitgesloten = uren.filter(r => isUitgesloten(r, dups)).length;
    return { totaal, perThema, perCat, partners, maanden, maandData: maanden.map(m=>maandMap[m]), uitgesloten };
  }, [uren, dups]);

  const totaalTarget = parseFloat(targets.totaal) || 0;
  const targetSet = totaalTarget > 0;
  const pct = targetSet ? Math.round((dash.totaal / totaalTarget) * 100) : 0;

  // bijdrage per partner (uren × uurtarief), excl. dubbel/duplicaat
  const perPartner = useMemo(() => {
    const map = new Map();
    uren.filter(r => !isUitgesloten(r, dups)).forEach(r => {
      const k = normaliseerOrg(r.organisatie); if (!k) return;
      if (!map.has(k)) map.set(k, { naam: r.organisatie, uren: 0, cats: {}, entries: [] });
      const p = map.get(k);
      p.uren += urenTotaal(r);
      UREN_CATS.forEach(c => { p.cats[c.key] = (p.cats[c.key] || 0) + (parseFloat(r[c.key]) || 0); });
      if (urenTotaal(r) > 0) p.entries.push({ datum: r.datum, thema: r.thema, type: r.type, uren: urenTotaal(r), beschrijving: r.beschrijving, collega: r.interneCollega });
    });
    return [...map.values()].filter(p => p.uren > 0)
      .map(p => ({ ...p, bedrag: p.uren * UURTARIEF }))
      .sort((a, b) => b.uren - a.uren);
  }, [uren, dups]);
  const totaalBedrag = dash.totaal * UURTARIEF;

  // --- Uitdraai/export op basis van de gekozen opties ---
  function exportSelectie() {
    return uren.filter(r => {
      if (expExclDubbel && isUitgesloten(r, dups)) return false;
      if (expOrg && normaliseerOrg(r.organisatie) !== expOrg) return false;
      if (expVan && (!r.datum || r.datum < expVan)) return false;
      if (expTot && (!r.datum || r.datum > expTot)) return false;
      return true;
    });
  }
  function exportAggregeer(rows) {
    const map = new Map();
    rows.forEach(r => {
      const k = normaliseerOrg(r.organisatie); if (!k) return;
      if (!map.has(k)) map.set(k, { naam: r.organisatie, uren: 0, cats: {}, entries: [] });
      const p = map.get(k);
      p.uren += urenTotaal(r);
      UREN_CATS.forEach(c => { p.cats[c.key] = (p.cats[c.key] || 0) + (parseFloat(r[c.key]) || 0); });
      p.entries.push(r);
    });
    return [...map.values()].sort((a, b) => b.uren - a.uren);
  }
  const exportBestandsnaam = (parts) => (expOrg && parts[0] ? parts[0].naam : 'alle-partners').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  function exportCSVopties() {
    const rows = exportSelectie();
    if (!rows.length) { alert('Geen urenregels in deze selectie.'); return; }
    const parts = exportAggregeer(rows);
    const bedragH = `Bijdrage (€${UURTARIEF}/uur)`;
    let csv;
    if (expNiveau === 'samenvatting') {
      const head = ['Partner', ...UREN_CATS.map(c => 'Uren ' + c.label), 'Totaal uren', ...(expBedrag ? [bedragH] : [])];
      csv = [head, ...parts.map(p => ['' + p.naam, ...UREN_CATS.map(c => p.cats[c.key] || 0), p.uren, ...(expBedrag ? [p.uren * UURTARIEF] : [])])];
      const totU = parts.reduce((s, p) => s + p.uren, 0);
      csv.push(['Totaal', ...UREN_CATS.map(c => parts.reduce((s, p) => s + (p.cats[c.key] || 0), 0)), totU, ...(expBedrag ? [totU * UURTARIEF] : [])]);
    } else {
      const head = ['Organisatie', 'Datum', 'Thema', 'Type', 'Gemeente', 'Verbonden persoon',
        ...UREN_CATS.map(c => c.label), 'Totaal uren',
        ...(expBeschrijving ? ['Beschrijving'] : []), ...(expCollega ? ['Collega intern'] : []), ...(expBedrag ? [bedragH] : [])];
      const data = [...rows].sort((a, b) => (a.organisatie || '').localeCompare(b.organisatie || '') || String(a.datum).localeCompare(String(b.datum)));
      csv = [head, ...data.map(r => [r.organisatie, r.datum, r.thema, r.type, r.gemeente, r.verbondenPersoon,
        ...UREN_CATS.map(c => parseFloat(r[c.key]) || 0), urenTotaal(r),
        ...(expBeschrijving ? [r.beschrijving] : []), ...(expCollega ? [r.interneCollega] : []), ...(expBedrag ? [urenTotaal(r) * UURTARIEF] : [])])];
    }
    downloadCSV(csv, `urenbriefje-${exportBestandsnaam(parts)}.csv`);
    setExportOpen(false);
  }
  // Printbaar urenbriefje (verantwoording), respecteert de gekozen opties
  function urenbriefjeOpties() {
    const rows = exportSelectie();
    const parts = exportAggregeer(rows);
    if (!parts.length) { alert('Geen urenregels in deze selectie.'); return; }
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const datum = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const totU = parts.reduce((s, p) => s + p.uren, 0);
    const periode = (expVan || expTot) ? ` · periode ${expVan || '…'} t/m ${expTot || '…'}` : '';
    const secties = parts.map(p => {
      const catRijen = UREN_CATS.filter(c => (p.cats[c.key] || 0) > 0).map(c => `<tr><td>${esc(c.label)}</td><td class="r">${p.cats[c.key]}</td></tr>`).join('');
      const entryRijen = [...p.entries].sort((a, b) => String(a.datum).localeCompare(String(b.datum))).map(e =>
        `<tr><td>${esc(e.datum)}</td><td>${esc(e.thema)}${e.type ? ' · ' + esc(e.type) : ''}</td>${expBeschrijving ? `<td>${esc(e.beschrijving)}</td>` : ''}${expCollega ? `<td>${esc(e.interneCollega)}</td>` : ''}<td class="r">${urenTotaal(e)}</td></tr>`).join('');
      const cols = 2 + (expBeschrijving ? 1 : 0) + (expCollega ? 1 : 0);
      return `<div class="partner">
        <div class="ph"><h2>${esc(p.naam)}</h2><div class="tot">${p.uren} uur${expBedrag ? ' · <strong>' + euro(p.uren * UURTARIEF) + '</strong>' : ''}</div></div>
        <table class="cat"><thead><tr><th>Categorie</th><th class="r">Uren</th></tr></thead><tbody>${catRijen || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
        <h3>Bestede tijd</h3>
        <table class="entries"><thead><tr><th>Datum</th><th>Thema/type</th>${expBeschrijving ? '<th>Beschrijving</th>' : ''}${expCollega ? '<th>Collega</th>' : ''}<th class="r">Uren</th></tr></thead><tbody>${entryRijen || `<tr><td colspan="${cols}">—</td></tr>`}</tbody></table>
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>Urenbriefje — Campus Gouda</title>
      <style>@import url('${new URL('fonts/manrope.css', location.href).href}');
      *{box-sizing:border-box} body{font-family:Manrope,Arial,sans-serif;color:#0E3A5C;margin:0;padding:28px}
      .top{display:flex;align-items:center;gap:12px;border-bottom:3px solid #1A7754;padding-bottom:12px;margin-bottom:16px}
      .logo{height:40px;width:40px;border-radius:8px;background:#CAE5E0;display:flex;align-items:center;justify-content:center;font-weight:700}
      h1{font-size:19px;margin:0} .sub{font-size:12px;color:#306095}
      .partner{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;page-break-inside:avoid}
      .ph{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #eef2f6;padding-bottom:6px;margin-bottom:8px}
      .ph h2{font-size:16px;margin:0} .tot{font-size:13px;color:#1A7754}
      h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#1A7754;margin:10px 0 4px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
      th{text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:3px 6px}
      td{padding:3px 6px;border-bottom:1px solid #f1f5f9;vertical-align:top} .r{text-align:right}
      .cat{max-width:280px}
      .printbtn{position:fixed;top:14px;right:14px;background:#1A7754;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer}
      @media print{.printbtn{display:none}body{padding:0}}</style></head><body>
      <button class="printbtn" onclick="window.print()">Afdrukken / opslaan als PDF</button>
      <div class="top"><div class="logo">CG</div><div><h1>Campus Gouda · Urenbriefje${expOrg && parts[0] ? ' — ' + esc(parts[0].naam) : ' partners'}</h1>
      <div class="sub">Verantwoording bestede uren · ~${euro(UURTARIEF)}/uur${periode} · ${datum} · totaal ${totU} uur${expBedrag ? ' (' + euro(totU * UURTARIEF) + ')' : ''}</div></div></div>
      ${secties}</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up geblokkeerd — sta pop-ups toe.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setExportOpen(false);
  }

  function saveUur(r) {
    setUren(prev => prev.some(x=>x.id===r.id) ? prev.map(x=>x.id===r.id?r:x) : [...prev, r]);
    setFormOpen(false); setEditing(null);
  }
  function delUur(id) { if (confirm('Deze urenregel verwijderen?')) setUren(prev => prev.filter(r => r.id !== id)); }
  function resetFilters() { setZoek(''); setFOrg(''); setFThema(''); setFType(''); setFCollega(''); setDVan(''); setDTot(''); }

  function handleImportExcel(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.XLSX) { alert('Excel-bibliotheek nog niet geladen, probeer het zo nog eens.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(ev.target.result, { type: 'binary' });
        let sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('overzicht 2026'))
          || wb.SheetNames.find(n => n.toLowerCase().includes('overzicht')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
        if (!rows.length) { alert('Geen rijen in tabblad "' + sheetName + '".'); return; }
        const keys = Object.keys(rows[0]);
        const find = (...pats) => keys.find(k => { const lk = String(k).toLowerCase(); return pats.some(p => lk.includes(p)); });
        const kOrg=find('organisat'), kThema=find('thema'), kType=find('type'), kOnder=find('onderteken'),
              kGem=find('gemeente'), kPers=find('verbonden','persoon'),
              kLLO=find('llo'), kTraj=find('traject'), kChal=find('challenge'),
              kInno=find('innovatie'), kOver=find('overig'),
              kDatum=find('datum'), kColl=find('interne','collega'), kBesch=find('beschrijving','betrokkenheid'),
              kDub=find('dubbel');
        const num = (row,k) => (k && row[k] !== '' && row[k] != null) ? (parseFloat(String(row[k]).replace(',','.')) || 0) : '';
        const matchOpt = (v, opts, fallback) => { const s=String(v||'').trim(); return opts.find(o=>o.toLowerCase()===s.toLowerCase()) || fallback; };
        const mapped = rows.map(row => ({
          id: uid(),
          organisatie: String(row[kOrg]||'').trim(),
          thema: matchOpt(row[kThema], UREN_THEMAS, 'Overig'),
          type: matchOpt(row[kType], UREN_TYPES, 'Werkveld'),
          ondertekenaar: /\b(ja|x|ja\b|true|1)\b/i.test(String(row[kOnder]||'')) ? 'ja' : 'nee',
          gemeente: String(row[kGem]||'').trim(),
          verbondenPersoon: String(row[kPers]||'').trim(),
          urenLLO: num(row,kLLO), urenTrajecten: num(row,kTraj), urenChallenge: num(row,kChal),
          urenInnovatie: num(row,kInno), urenOverig: num(row,kOver),
          datum: parseExcelDatum(row[kDatum]),
          interneCollega: String(row[kColl]||'').trim(),
          beschrijving: String(row[kBesch]||'').trim(),
          dubbel: /dubbel/i.test(String(row[kDub]||'')) ? 'DUBBEL' : 'OK',
        })).filter(r => r.organisatie || urenTotaal(r) > 0);
        if (!mapped.length) { alert('Geen bruikbare urenregels gevonden in "' + sheetName + '".'); return; }
        let next;
        if (uren.length > 0) {
          const vervang = confirm(`Er zijn al ${uren.length} urenregels.\n\nOK = VERVANGEN door de ${mapped.length} geïmporteerde regels.\nAnnuleren = AANVULLEN (toevoegen).`);
          next = vervang ? mapped : [...uren, ...mapped];
        } else { next = mapped; }
        setUren(next);
        alert(`${mapped.length} urenregels geïmporteerd uit "${sheetName}".`);
      } catch (err) { alert('Kon het Excel-bestand niet inlezen: ' + err.message); }
    };
    reader.readAsBinaryString(file);
  }

  // opschoning: organisaties gegroepeerd op genormaliseerde sleutel
  const cleanupGroups = useMemo(() => {
    const map = new Map();
    uren.forEach(r => {
      const k = normaliseerOrg(r.organisatie); if (!k) return;
      if (!map.has(k)) map.set(k, new Map());
      const inner = map.get(k); inner.set(r.organisatie, (inner.get(r.organisatie)||0)+1);
    });
    return [...map.entries()]
      .map(([key, inner]) => ({ key, variants: [...inner.entries()].map(([naam,n])=>({naam,n})) }))
      .sort((a,b) => (b.variants.length - a.variants.length) || a.key.localeCompare(b.key));
  }, [uren]);
  const dubbeleSchrijfwijzen = cleanupGroups.filter(g => g.variants.length > 1).length;

  // grafiek-data
  const themaBar = {
    labels: UREN_THEMAS,
    datasets: [
      { label: 'Besteed', data: dash.perThema, backgroundColor: UREN_THEMAS.map(t=>THEMA_HEX[t]) },
      { label: 'Doel', data: UREN_THEMAS.map(t => parseFloat(targets[t]) || 0), backgroundColor: '#CBD5E1' },
    ],
  };
  const catDonut = {
    labels: UREN_CATS.map(c=>c.label),
    datasets: [{ data: dash.perCat, backgroundColor: UREN_CATS.map(c=>c.hex), borderWidth: 1, borderColor: '#fff' }],
  };
  const tijdLine = {
    labels: dash.maanden,
    datasets: [{ label: 'Uren per maand', data: dash.maandData, borderColor: '#1A7754', backgroundColor: 'rgba(26,119,84,0.12)', fill: true, tension: 0.3 }],
  };
  const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 12 } } } };

  return (
    <div>
      {/* Stat-kaarten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Totaal uren (excl. dubbel)" value={dash.totaal} sub={dash.uitgesloten > 0 ? `${dash.uitgesloten} regel(s) uitgesloten` : null} />
        <StatCard label="Actieve partners" value={dash.partners} sub="organisaties met >0 uur" />
        <StatCard label={`Bijdrage partners (~${euro(UURTARIEF)}/uur)`} value={euro(totaalBedrag)} sub="indicatieve waarde bestede uren" accent="text-branddark" />
        <StatCard label="Voortgang t.o.v. doel"
          value={targetSet ? `${dash.totaal} / ${totaalTarget}` : '—'}
          sub={targetSet ? `${pct}% van het totaaldoel` : 'doel nog niet ingesteld'}
          accent={targetSet ? (pct>=100?'text-brand':'text-ink') : 'text-slate-400'} />
      </div>

      {/* Grafieken */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <h3 className="font-semibold text-ink text-sm mb-2">Uren per thema vs. doel</h3>
          <div style={{height: '240px'}}><ChartCanvas type="bar" data={themaBar} options={baseOpts} /></div>
          {!targetSet && <p className="text-xs text-slate-400 mt-2">Doel nog niet ingesteld — open <strong>Doelen</strong> om targets per thema in te vullen.</p>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-ink text-sm mb-2">Uren per categorie</h3>
          <div style={{height: '240px'}}><ChartCanvas type="doughnut" data={catDonut} options={baseOpts} /></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-3">
          <h3 className="font-semibold text-ink text-sm mb-2">Uren over tijd (per maand)</h3>
          <div style={{height: '220px'}}>
            {dash.maanden.length ? <ChartCanvas type="line" data={tijdLine} options={baseOpts} /> : <p className="text-sm text-slate-400">Nog geen regels met een geldige datum.</p>}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={zoek} onChange={e=>setZoek(e.target.value)} placeholder="Zoek in urenregels…"
          className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button onClick={() => setTargetsOpen(true)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Doelen</button>
        <button onClick={() => setBijdrageOpen(o=>!o)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Bijdrage per partner</button>
        <button onClick={() => setCleanupOpen(o=>!o)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">
          Organisaties opschonen{dubbeleSchrijfwijzen>0 && <span className="ml-1 text-amber-600">({dubbeleSchrijfwijzen})</span>}
        </button>
        <button onClick={() => fileRef.current && fileRef.current.click()} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Excel-import</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
        <button onClick={() => setExportOpen(true)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50" title="Uitdraai/urenbriefje maken met keuzeopties">Uitdraai / export</button>
        <span className="text-xs text-slate-500" title="Vul bij een gesprek in Contacten de duur in; die uren verschijnen hier met het label 'uit gesprek'.">Gesprekken met een duur komen hier vanzelf in.</span>
        <button onClick={() => { setEditing(leegUur()); setFormOpen(true); }} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">+ Nieuwe urenregel</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select value={fOrg} onChange={e=>setFOrg(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm max-w-[220px]">
          <option value="">Alle organisaties</option>{orgGroups.map(o=><option key={o.key} value={o.key}>{o.display}</option>)}
        </select>
        <select value={fThema} onChange={e=>setFThema(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle thema's</option>{UREN_THEMAS.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle types</option>{UREN_TYPES.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fCollega} onChange={e=>setFCollega(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle collega's</option>{collegaFilters.map(x=><option key={x}>{x}</option>)}
        </select>
        <label className="text-xs text-slate-500 flex items-center gap-1">van <input type="date" value={dVan} onChange={e=>setDVan(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm" /></label>
        <label className="text-xs text-slate-500 flex items-center gap-1">tot <input type="date" value={dTot} onChange={e=>setDTot(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm" /></label>
        <button onClick={resetFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">Wissen</button>
        <span className="text-sm text-slate-400 ml-auto">{filtered.length} van {uren.length}</span>
      </div>

      {/* Opschoonpaneel */}
      {cleanupOpen && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-ink text-sm mb-2">Organisaties (gegroepeerd op genormaliseerde naam)</h3>
          <p className="text-xs text-slate-400 mb-3">Groepen met meerdere schrijfwijzen zijn gemarkeerd — pas regels handmatig aan om ze gelijk te trekken.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {cleanupGroups.map(g => (
              <div key={g.key} className={`rounded-lg border p-2 text-sm ${g.variants.length>1 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                <div className="font-mono text-xs text-slate-400">{g.key}</div>
                {g.variants.map((v,i) => (
                  <div key={i} className="flex justify-between"><span className="text-ink">{v.naam}</span><span className="text-slate-400">{v.n}×</span></div>
                ))}
              </div>
            ))}
            {cleanupGroups.length === 0 && <p className="text-sm text-slate-400">Nog geen organisaties.</p>}
          </div>
        </div>
      )}

      {/* Bijdrage per partner */}
      {bijdrageOpen && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold text-ink text-sm">Financiële bijdrage per partner (~{euro(UURTARIEF)}/uur)</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-branddark">totaal {euro(totaalBedrag)} · {dash.totaal} uur</span>
              <button onClick={() => setExportOpen(true)} className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-branddark">Uitdraai / export…</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr>
                <th className="px-3 py-2 font-semibold">Partner</th>
                {UREN_CATS.map(c => <th key={c.key} className="px-3 py-2 font-semibold text-right">{c.label}</th>)}
                <th className="px-3 py-2 font-semibold text-right">Totaal</th>
                <th className="px-3 py-2 font-semibold text-right">Bijdrage (×{UURTARIEF})</th>
              </tr></thead>
              <tbody>
                {perPartner.map((p,i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-ink">{p.naam}</td>
                    {UREN_CATS.map(c => <td key={c.key} className="px-3 py-2 text-right text-slate-600">{p.cats[c.key] || 0}</td>)}
                    <td className="px-3 py-2 text-right font-medium text-ink">{p.uren}</td>
                    <td className="px-3 py-2 text-right font-medium text-branddark">{euro(p.bedrag)}</td>
                  </tr>
                ))}
                {perPartner.length === 0 && <tr><td colSpan={UREN_CATS.length+3} className="px-3 py-4 text-center text-slate-400">Nog geen uren.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">Indicatieve waarde op basis van bestede uren × {euro(UURTARIEF)}. Dubbele/duplicaat-regels tellen niet mee. Het urenbriefje toont per partner ook de losse activiteiten (datum + beschrijving) voor verantwoording.</p>
        </div>
      )}

      {/* Lijst */}
      {autoDubbelCount > 0 && (
        <div className="mb-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {autoDubbelCount} regel(s) automatisch herkend als exacte herhaling en uitgesloten van totalen/grafieken (badge "DUBBEL (auto)").
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              {KOLOMMEN.map(k => (
                <th key={k.key} onClick={() => setSort(k.key)} title="Klik om te sorteren"
                  className={`px-3 py-2 font-semibold cursor-pointer select-none hover:text-ink ${k.type==='n'?'text-right':''}`}>
                  {k.label}{sortKey===k.key ? (sortDir==='asc'?' ▲':' ▼') : ''}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const auto = dups.has(r.id);
              const uit = isUitgesloten(r, dups);
              return (
                <tr key={r.id} className={`border-t border-slate-100 ${uit ? 'opacity-50 bg-slate-50' : 'hover:bg-brandlight/40'}`}>
                  <td className="px-3 py-2 font-medium text-ink">
                    <span className="flex items-center gap-1">{r.organisatie || '—'}
                      {r.bron === 'gesprek' && <Badge className="bg-sky-50 text-regio border-sky-200">uit gesprek</Badge>}
                      {isDubbel(r) && <Badge className="bg-rose-100 text-rose-700 border-rose-200">DUBBEL</Badge>}
                      {auto && !isDubbel(r) && <Badge className="bg-amber-100 text-amber-800 border-amber-200" >DUBBEL (auto)</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.thema ? <Badge className={THEMA_KLEUR[r.thema]||THEMA_KLEUR['Overig']}>{r.thema}</Badge> : '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.type || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ondertekenaar || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.gemeente || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.verbondenPersoon
                      ? (onOpenPersoon ? <button onClick={() => onOpenPersoon(r.verbondenPersoon, r.organisatie)} className="text-brand hover:underline">{r.verbondenPersoon}</button> : r.verbondenPersoon)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{parseFloat(r.urenLLO)||0}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{parseFloat(r.urenTrajecten)||0}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{parseFloat(r.urenChallenge)||0}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{parseFloat(r.urenInnovatie)||0}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{parseFloat(r.urenOverig)||0}</td>
                  <td className="px-3 py-2 text-right font-medium text-ink">{urenTotaal(r)}{uit && <span className="text-xs text-slate-400"> (excl.)</span>}</td>
                  <td className="px-3 py-2 text-right text-branddark">{uit ? '—' : euro(urenTotaal(r)*UURTARIEF)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.datum || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-slate-600">{r.interneCollega || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.bron === 'gesprek'
                      ? <button onClick={() => onOpenPersoon && onOpenPersoon(r.verbondenPersoon, r.organisatie)} className="text-xs text-brand hover:underline" title="Deze uren komen uit een gesprek; pas ze daar aan">naar gesprek</button>
                      : <>
                          <button onClick={() => { setEditing(r); setFormOpen(true); }} className="text-xs text-slate-400 hover:text-brand mr-2">bewerken</button>
                          <button onClick={() => delUur(r.id)} className="text-xs text-slate-400 hover:text-rose-600">verwijderen</button>
                        </>}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={KOLOMMEN.length+1} className="px-3 py-8 text-center text-slate-400">Geen urenregels. Voeg er een toe of importeer het Excel-bestand.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing && uren.some(r=>r.id===editing.id) ? 'Urenregel bewerken' : 'Nieuwe urenregel'} wide>
        <UurForm initial={editing || leegUur()} contacten={contacten} collegas={collegas} onSave={saveUur} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      </Modal>
      <Modal open={targetsOpen} onClose={() => setTargetsOpen(false)} title="Doelstellingen (uren) instellen">
        <TargetsModal targets={targets} onSave={(t) => { setTargets(t); setTargetsOpen(false); }} onCancel={() => setTargetsOpen(false)} />
      </Modal>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Uitdraai / urenbriefje maken">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Organisatie">
              <select className={inputCls} value={expOrg} onChange={e => setExpOrg(e.target.value)}>
                <option value="">Alle partners</option>
                {orgGroups.map(o => <option key={o.key} value={o.key}>{o.display}</option>)}
              </select>
            </Field>
            <Field label="Detailniveau (voor CSV)">
              <select className={inputCls} value={expNiveau} onChange={e => setExpNiveau(e.target.value)}>
                <option value="samenvatting">Samenvatting per categorie (1 rij per partner)</option>
                <option value="regels">Alle losse urenregels</option>
              </select>
            </Field>
            <Field label="Periode van"><input type="date" className={inputCls} value={expVan} onChange={e => setExpVan(e.target.value)} /></Field>
            <Field label="Periode tot"><input type="date" className={inputCls} value={expTot} onChange={e => setExpTot(e.target.value)} /></Field>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-600 mb-1">Opnemen</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border border-slate-200 rounded-lg p-2 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={expBedrag} onChange={e => setExpBedrag(e.target.checked)} className="accent-brand" /> Bijdrage (€{UURTARIEF}/uur)</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={expBeschrijving} onChange={e => setExpBeschrijving(e.target.checked)} className="accent-brand" /> Beschrijving / activiteiten</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={expCollega} onChange={e => setExpCollega(e.target.checked)} className="accent-brand" /> Interne collega</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={expExclDubbel} onChange={e => setExpExclDubbel(e.target.checked)} className="accent-brand" /> Dubbele/duplicaat uitsluiten</label>
            </div>
          </div>
          <p className="text-xs text-slate-400">{exportSelectie().length} urenregel(s) in deze selectie.</p>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button onClick={() => setExportOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
            <button onClick={exportCSVopties} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">CSV downloaden</button>
            <button onClick={urenbriefjeOpties} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">Urenbriefje (afdrukken/PDF)</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   CHECKLIST PER TRAJECT (accordion, alleen in traject-detail)
   ============================================================ */
function TrajectChecklist({ state, onToggle }) {
  const [open, setOpen] = useState(false);
  const [openFases, setOpenFases] = useState({});
  const st = state || {};
  const { done, total } = checklistVoortgang(st);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="font-semibold text-ink text-sm">Checklist begeleiding <span className="text-slate-400 font-normal">({done}/{total})</span></span>
        <span className="text-slate-400 text-sm">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {/* totale voortgangsbalk */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Totale voortgang</span><span>{pct}%</span></div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand" style={{width: pct + '%'}} /></div>
          </div>
          <div className="space-y-2">
            {CHECKLIST.map((f, fi) => {
              const dn = f.items.filter((_, ii) => st[checklistKey(fi, ii)]).length;
              const faseOpen = openFases[fi];
              const compleet = dn === f.items.length;
              return (
                <div key={fi} className="border border-slate-200 rounded-lg">
                  <button onClick={() => setOpenFases(p => ({ ...p, [fi]: !p[fi] }))} className="w-full flex items-center justify-between px-3 py-2 text-left">
                    <span className="text-sm font-medium text-ink">{f.fase}</span>
                    <span className={`text-xs ${compleet ? 'text-brand font-semibold' : 'text-slate-400'}`}>{dn}/{f.items.length}{compleet && ' ✓'} <span className="ml-1">{faseOpen ? '▾' : '▸'}</span></span>
                  </button>
                  {faseOpen && (
                    <div className="px-3 pb-2 space-y-1">
                      {f.items.map((item, ii) => {
                        const k = checklistKey(fi, ii);
                        return (
                          <label key={ii} className="flex items-start gap-2 text-sm py-0.5 cursor-pointer">
                            <input type="checkbox" checked={!!st[k]} onChange={() => onToggle(k)} className="accent-brand mt-0.5" />
                            <span className={st[k] ? 'line-through text-slate-400' : 'text-slate-700'}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAKEN, PLANNING EN OPVOLGING (nieuw in deze versie)
   ============================================================ */
const LS_MIJNNAAM = 'cgt_mijnnaam';
const LS_ALLEENMIJN = 'cgt_alleenmijn';
const NIVEAU_PILL = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
  binnenkort: 'bg-amber-50 text-amber-800 border-amber-200',
  dezeweek: 'bg-sky-50 text-regio border-sky-200',
  afronden: 'bg-brandlight text-branddark border-brand/30',
  checklist: 'bg-slate-100 text-slate-700 border-slate-200',
  gegevens: 'bg-slate-50 text-slate-500 border-slate-200',
};
const NIVEAU_NAAM = Object.fromEntries(CGT.NIVEAUS.map(n => [n.id, n.naam]));
const HOOFDNIVEAUS = ['urgent', 'binnenkort', 'dezeweek', 'afronden'];
const knopKlein = 'px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap';
const knopKleinPrimair = 'px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-branddark whitespace-nowrap';

function NiveauPill({ niveau }) {
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${NIVEAU_PILL[niveau] || ''}`}>{NIVEAU_NAAM[niveau] || niveau}</span>;
}
function Keuze({ opties, waarde, onChange, leeg = '' }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
      {opties.map(([v, label, actief]) => (
        <button key={v} type="button" onClick={() => onChange(waarde === v ? leeg : v)}
          className={`px-2 py-1 text-xs rounded-md transition whitespace-nowrap ${waarde === v ? (actief || 'bg-brand text-white') : 'text-slate-500 hover:text-ink hover:bg-slate-50'}`}>{label}</button>
      ))}
    </div>
  );
}
function groepNaam(g) { return [g.groepsnummer, g.titel].filter(Boolean).join(' · '); }
function bewaarBestand(naam, inhoud, type) {
  const url = URL.createObjectURL(new Blob([inhoud], { type }));
  const a = document.createElement('a'); a.href = url; a.download = naam;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function mijnNaam() { return loadLS(LS_MIJNNAAM, '') || ''; }

/* ---------- opvolging toevoegen (bijv. na het mailen van de groep) ---------- */
function OpvolgModal({ start, groepen, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    groepId: start.groepId || '', tekst: start.tekst || '', moment: start.moment || '',
    herinnerOp: CGT.werkdag(CGT.addDays(CGT.vandaagISO(), start.dagen || 3)), notitie: '', outlook: false,
  }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const g = groepen.find(x => x.id === f.groepId);
  const snel = [['Reactie op mail over de kick-off?', 'kickoff'], ['Reactie op mail over de tussenpresentatie?', 'tussen'],
    ['Reactie op mail over de eindpresentatie?', 'eind'], ['Eindproducten ontvangen?', ''], ['Reactie van de docent?', '']];
  const dagen = [[1, 'morgen'], [2, '2 dagen'], [3, '3 dagen'], [5, '5 dagen'], [7, '1 week'], [14, '2 weken']];
  const opslaan = () => {
    if (!f.groepId || !f.tekst.trim()) return;
    const taak = CGT.nieuweTaak({ tekst: f.tekst.trim(), moment: f.moment, herinnerOp: f.herinnerOp, notitie: f.notitie.trim(), door: mijnNaam() });
    onSave(f.groepId, taak);
    if (f.outlook && g) bewaarBestand(`herinnering-${(g.groepsnummer || 'groep').replace(/\s+/g, '-')}.ics`, CGT.icsHerinnering(g, taak), 'text/calendar;charset=utf-8');
  };
  return (
    <div className="space-y-4">
      {!start.groepId && (
        <Field label="Groep">
          <select className={inputCls} value={f.groepId} onChange={e => set('groepId', e.target.value)}>
            <option value="">Kies een groep</option>
            {groepen.filter(x => !x.gearchiveerd).map(x => <option key={x.id} value={x.id}>{groepNaam(x)}</option>)}
          </select>
        </Field>
      )}
      {start.groepId && g && <div className="text-sm text-slate-600"><span className="font-semibold text-ink">{g.groepsnummer}</span> {g.titel}</div>}
      <Field label="Wat wil je opvolgen?">
        <input className={inputCls} value={f.tekst} onChange={e => set('tekst', e.target.value)} placeholder="Bijvoorbeeld: reactie op mail over de eindpresentatie?" autoFocus />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {snel.map(([t, mo]) => <button key={t} type="button" onClick={() => setF(p => ({ ...p, tekst: t, moment: mo }))} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-brand hover:text-branddark">{t}</button>)}
        </div>
      </Field>
      <Field label="Herinner mij">
        <div className="flex flex-wrap items-center gap-1.5">
          {dagen.map(([n, label]) => {
            const d = CGT.werkdag(CGT.addDays(CGT.vandaagISO(), n));
            return <button key={n} type="button" onClick={() => set('herinnerOp', d)} className={`text-xs px-2.5 py-1 rounded-lg border ${f.herinnerOp === d ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{label}</button>;
          })}
          <input type="date" className="border border-slate-300 rounded-lg px-2 py-1 text-xs" value={f.herinnerOp} onChange={e => e.target.value && set('herinnerOp', e.target.value)} />
        </div>
        <span className="block text-xs text-slate-500 mt-1">Op {CGT.datumLang(f.herinnerOp)} staat dit bovenaan bij Taken.</span>
      </Field>
      <Field label="Hoort bij">
        <select className={inputCls} value={f.moment} onChange={e => set('moment', e.target.value)}>
          <option value="">Geen moment</option>
          {CGT.MOMENTEN.map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}
        </select>
        {f.moment && <span className="block text-xs text-slate-500 mt-1">Deze opvolging vinkt zichzelf af zodra de {CGT.MOMENTEN.find(m => m.id === f.moment).naam.toLowerCase()} een vaste datum heeft.</span>}
      </Field>
      <Field label="Notitie (optioneel)"><input className={inputCls} value={f.notitie} onChange={e => set('notitie', e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-brand" checked={f.outlook} onChange={e => set('outlook', e.target.checked)} />Ook een herinnering in mijn Outlook-agenda zetten (downloadt een .ics-bestand)</label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={opslaan} disabled={!f.groepId || !f.tekst.trim()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Herinnering zetten</button>
      </div>
    </div>
  );
}

/* ---------- mailknop: opent Outlook en vraagt daarna om een herinnering ---------- */
const LS_MAILPROGRAMMA = 'cgt_mailprogramma';
function mailProgramma() { return loadLS(LS_MAILPROGRAMMA, 'outlook') || 'outlook'; }
function openMail(url) {
  if (url.startsWith('mailto:')) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
// losse knop: alle mailadressen van de studenten op het klembord, om in Outlook te plakken
function KopieerAdressenKnop({ groep, klein }) {
  const [klaar, setKlaar] = useState(false);
  const adressen = CGT.mailAdressen(groep);
  if (!adressen.length) return null;
  const kopieer = async () => {
    const tekst = adressen.join('; ');
    try { await navigator.clipboard.writeText(tekst); } catch (e) { window.prompt('Kopieer de adressen:', tekst); }
    setKlaar(true); setTimeout(() => setKlaar(false), 2500);
  };
  return <button onClick={kopieer} title={`Zet ${adressen.length} mailadressen op het klembord, gescheiden door een puntkomma, om in Outlook te plakken`}
    className={klein ? knopKlein : 'px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50'}>{klaar ? `✓ ${adressen.length} adressen gekopieerd` : '📋 Kopieer mailadressen'}</button>;
}
function MailGroepKnop({ groep, voorkeur, onGemaild, klein }) {
  const [open, setOpen] = useState(false);
  const [programma, setProgramma] = useState(mailProgramma);
  const [gekopieerd, setGekopieerd] = useState(false);
  const kiesProgramma = v => { setProgramma(v); saveLS(LS_MAILPROGRAMMA, v); };
  const kopieer = async () => {
    const tekst = CGT.mailAdressen(groep).join('; ');
    try { await navigator.clipboard.writeText(tekst); } catch (e) { window.prompt('Kopieer de adressen:', tekst); }
    setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2000);
  };
  const adressen = CGT.mailAdressen(groep);
  const sjablonen = voorkeur ? [CGT.MAILSJABLONEN.find(s => s.moment === voorkeur), ...CGT.MAILSJABLONEN.filter(s => s.moment !== voorkeur)].filter(Boolean) : CGT.MAILSJABLONEN;
  const mail = (sj) => {
    setOpen(false);
    openMail(CGT.mailLink(groep, sj, true, programma));
    onGemaild && onGemaild(sj);
  };
  if (!adressen.length) return <span className="text-xs text-slate-400" title="Er staan nog geen mailadressen bij de studenten van deze groep">geen mailadressen</span>;
  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} className={klein ? knopKlein : 'px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50'}>✉ Mail groep ▾</button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 text-sm">
          <div className="text-xs text-slate-500 px-2 py-1">Opent {programma === 'computer' ? 'je mailprogramma' : 'Outlook'} met {adressen.length} studenten{groep.docentMail ? ' en de docent in cc' : ''}. Daarna zet je een herinnering.</div>
          {sjablonen.map(sj => <button key={sj.id} onClick={() => mail(sj)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brandlight/40">{sj.label}</button>)}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button onClick={kopieer} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brandlight/40">{gekopieerd ? '✓ Adressen gekopieerd' : 'Alleen de adressen kopiëren'}</button>
            <div className="flex items-center justify-between gap-2 px-2 pt-1 text-xs text-slate-500">
              <span>Openen in</span>
              <Keuze waarde={programma} onChange={v => v && kiesProgramma(v)} opties={[['outlook', 'Outlook', 'bg-brand text-white'], ['computer', 'Mailprogramma', 'bg-slate-200 text-slate-700']]} />
            </div>
          </div>
        </div>
      </>)}
    </span>
  );
}

/* ---------- één regel opvolging ---------- */
function OpvolgRegel({ item, metGroep, onKlaar, onUitstel, onWeg, onOpenGroep, onMail }) {
  const { groep: g, taak: t, dagen, klaar, waarom } = item;
  const sj = t.moment ? CGT.MAILSJABLONEN.find(s => s.moment === t.moment) : null;
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        {metGroep && <button onClick={() => onOpenGroep(g.id)} className="text-left text-xs text-slate-500 hover:underline"><span className="font-semibold text-ink">{g.groepsnummer}</span> {g.titel}</button>}
        <div className={`text-sm ${klaar ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>{t.tekst}</div>
        <div className="text-xs text-slate-500">
          {klaar ? waarom : t.herinnerOp ? (dagen < 0 ? <span className="text-rose-700">herinnering was {CGT.datumKort(t.herinnerOp)} ({CGT.over(dagen)})</span> : dagen === 0 ? <span className="text-amber-700">vandaag opvolgen</span> : `herinnering ${CGT.datumKort(t.herinnerOp)} (${CGT.over(dagen)})`) : ''}
          {t.door ? ` · gezet door ${t.door}` : ''}{t.notitie ? ` · ${t.notitie}` : ''}
        </div>
      </div>
      {!klaar && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button onClick={() => onKlaar(g.id, t.id)} className={knopKleinPrimair} title="Afvinken">✓ Reactie ontvangen</button>
          <button onClick={() => onUitstel(g.id, t.id, 2)} className={knopKlein}>Nog niet: +2 dagen</button>
          <button onClick={() => onUitstel(g.id, t.id, 7)} className={knopKlein}>+1 week</button>
          {onMail && CGT.mailAdressen(g).length > 0 && <button onClick={() => openMail(CGT.mailLink(g, sj, true, mailProgramma()))} className={knopKlein}>✉ Opnieuw mailen</button>}
          {onWeg && <button onClick={() => onWeg(g.id, t.id)} className="text-xs text-slate-400 hover:text-rose-600 px-1" title="Verwijderen">✕</button>}
        </div>
      )}
      {klaar && onWeg && <button onClick={() => onWeg(g.id, t.id)} className="text-xs text-slate-400 hover:text-rose-600 px-1" title="Verwijderen">✕</button>}
    </div>
  );
}

/* ---------- één regel signaal ---------- */
function SignaalRegel({ s, metGroep, onOpenGroep, onLater, onGemaild, onActie, compact }) {
  const g = s.groep;
  return (
    <div className={compact ? 'flex flex-col gap-1 px-3 py-2.5' : 'flex flex-wrap sm:flex-nowrap gap-x-3 gap-y-1 px-4 py-3'}>
      <div className={compact ? '' : 'pt-0.5 w-full sm:w-[124px] shrink-0'}><NiveauPill niveau={s.niveau} /></div>
      <div className="min-w-0 flex-1">
        {metGroep && <button onClick={() => onOpenGroep(g.id)} className="text-left text-xs text-slate-500 hover:underline"><span className="font-semibold text-ink">{g.groepsnummer}</span> {g.titel}{g.contactCG ? ' · ' + g.contactCG : ''}</button>}
        <div className="text-sm font-medium text-slate-800">{s.titel}{s.looptAl && <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-regio border border-sky-200">opvolging loopt</span>}</div>
        <p className="text-sm text-slate-600 leading-relaxed">{s.tekst}</p>
      </div>
      <div className={compact ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0'}>
        {s.actie && onActie && <button onClick={() => { if (!s.actie.bevestig || confirm(s.actie.bevestig)) onActie(g.id, s.actie); }} className={knopKleinPrimair}>{s.actie.label}</button>}
        {s.moment && !s.looptAl && <MailGroepKnop groep={g} voorkeur={s.moment} klein onGemaild={sj => onGemaild(g.id, sj)} />}
        {metGroep && <button onClick={() => onOpenGroep(g.id)} className="text-xs text-brand font-medium hover:underline">Open groep</button>}
        <button onClick={() => onLater(g.id, s.regel)} className="text-xs text-slate-500 hover:text-ink" title="Een week niet tonen">Later</button>
      </div>
    </div>
  );
}

function useGroepActies(setGroepen) {
  const vandaag = CGT.vandaagISO();
  const upd = (gid, fn) => setGroepen(prev => prev.map(g => g.id === gid ? fn(g) : g));
  const zetTaak = (gid, tid, velden) => upd(gid, g => ({ ...g, taken: CGT.takenVan(g).map(t => t.id === tid ? { ...t, ...velden } : t) }));
  return {
    upd,
    voegTaakToe: (gid, taak) => upd(gid, g => ({ ...g, taken: [...CGT.takenVan(g), taak] })),
    klaar: (gid, tid) => zetTaak(gid, tid, { status: 'klaar', klaarOp: vandaag }),
    uitstel: (gid, tid, n) => zetTaak(gid, tid, { herinnerOp: CGT.werkdag(CGT.addDays(vandaag, n)) }),
    weg: (gid, tid) => { if (confirm('Deze opvolging verwijderen?')) upd(gid, g => ({ ...g, taken: CGT.takenVan(g).filter(t => t.id !== tid) })); },
    actie: (gid, a) => upd(gid, g => CGT.voerActieUit(g, a)),
    later: (gid, regel) => upd(gid, g => ({ ...g, verborgen: { ...(g.verborgen || {}), [regel]: CGT.addDays(vandaag, 7) } })),
  };
}

function Lijst({ children }) { return <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">{children}</div>; }
function Kop({ titel, sub, rechts }) {
  return (
    <div className="flex items-end justify-between gap-3 mt-6 mb-2">
      <div><h2 className="text-lg font-semibold text-ink">{titel}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>{rechts}
    </div>
  );
}

/* ============================================================
   TABBLAD TAKEN: wat moet er gebeuren?
   ============================================================ */
function TakenTab({ groepen, setGroepen, checklist, onOpenGroep }) {
  const [naam, setNaam] = useState(() => mijnNaam());
  const [alleenMijn, setAlleenMijn] = useState(() => !!loadLS(LS_ALLEENMIJN, false));
  const [toonOverig, setToonOverig] = useState(false);
  const [toonKlaar, setToonKlaar] = useState(false);
  const [modal, setModal] = useState(null);
  useEffect(() => saveLS(LS_MIJNNAAM, naam), [naam]);
  useEffect(() => saveLS(LS_ALLEENMIJN, alleenMijn), [alleenMijn]);
  const acties = useGroepActies(setGroepen);
  const vandaag = CGT.vandaagISO();
  const mijn = g => !alleenMijn || !naam.trim() || CGT.norm(g.contactCG).includes(CGT.norm(naam));
  const o = useMemo(() => CGT.takenOverzicht(groepen.filter(mijn), checklist, vandaag), [groepen, checklist, alleenMijn, naam]);
  const zichtbaar = o.signalen.filter(s => !s.verborgen);
  const hoofd = zichtbaar.filter(s => HOOFDNIVEAUS.includes(s.niveau));
  const overig = zichtbaar.filter(s => !HOOFDNIVEAUS.includes(s.niveau));
  const tel = id => zichtbaar.filter(s => s.niveau === id).length;
  const gemaild = (gid, sj) => setModal(startNaMail(gid, sj));
  const tegels = [
    ['Opvolgen', o.opvolgen.length, o.opvolgen.some(x => x.dagen < 0) ? 'text-rose-700' : 'text-ink'],
    ['Urgent', tel('urgent'), 'text-rose-700'], ['Binnenkort plannen', tel('binnenkort'), 'text-amber-700'],
    ['Deze week', tel('dezeweek'), 'text-regio'], ['Afronden', tel('afronden'), 'text-branddark'], ['Later gepland', o.gepland.length, 'text-slate-600'],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-light text-ink">Taken</h1>
          <p className="text-sm text-slate-500">{CGT.datumLang(vandaag).replace(/^./, c => c.toUpperCase())} · alles wat er voor de studentengroepen moet gebeuren</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input value={naam} onChange={e => setNaam(e.target.value)} list="cg-team" placeholder="Jouw naam (zoals bij Contact CG)" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56" />
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" className="accent-brand" checked={alleenMijn} onChange={e => setAlleenMijn(e.target.checked)} />Alleen mijn groepen</label>
          <button onClick={() => setModal({})} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">+ Opvolging</button>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {tegels.map(([label, n, kleur]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
            <div className={`text-2xl font-semibold ${n ? kleur : 'text-slate-300'}`}>{n}</div>
          </div>
        ))}
      </div>

      <Kop titel="Opvolgen" sub="Herinneringen die je zelf hebt gezet, bijvoorbeeld na het mailen van een groep." />
      {o.opvolgen.length === 0
        ? <div className="bg-white rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">Niets op te volgen vandaag. Mail je een groep, dan zet je hier met één klik een herinnering.</div>
        : <Lijst>{o.opvolgen.map(it => <OpvolgRegel key={it.taak.id} item={it} metGroep onKlaar={acties.klaar} onUitstel={acties.uitstel} onWeg={acties.weg} onOpenGroep={onOpenGroep} onMail />)}</Lijst>}

      <Kop titel="Wat moet er gebeuren" sub="Berekend uit de planning van elke groep: presentaties die nog niet vastliggen, momenten deze week en afronding." />
      {hoofd.length === 0
        ? <div className="bg-white rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">Er hoeven nu geen kick-offs of presentaties ingepland te worden.</div>
        : <Lijst>{hoofd.map(s => <SignaalRegel key={s.id} s={s} metGroep onOpenGroep={onOpenGroep} onLater={acties.later} onGemaild={gemaild} onActie={acties.actie} />)}</Lijst>}

      {overig.length > 0 && (<>
        <button onClick={() => setToonOverig(v => !v)} className="mt-4 w-full text-left rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 hover:border-slate-400">
          {toonOverig ? 'Checklist en gegevens weer inklappen' : <>Daarnaast: <span className="font-medium text-ink">{tel('checklist')}× checklist loopt achter</span> en <span className="font-medium text-ink">{tel('gegevens')}× gegevens ontbreken</span>. Toon ze</>}
        </button>
        {toonOverig && <div className="mt-2"><Lijst>{overig.map(s => <SignaalRegel key={s.id} s={s} metGroep onOpenGroep={onOpenGroep} onLater={acties.later} onGemaild={gemaild} onActie={acties.actie} />)}</Lijst></div>}
      </>)}

      {o.gepland.length > 0 && (<>
        <Kop titel="Later gepland" sub="Opvolgingen met een herinnering in de toekomst." />
        <Lijst>{o.gepland.map(it => <OpvolgRegel key={it.taak.id} item={it} metGroep onKlaar={acties.klaar} onUitstel={acties.uitstel} onWeg={acties.weg} onOpenGroep={onOpenGroep} />)}</Lijst>
      </>)}

      {o.klaar.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setToonKlaar(v => !v)} className="text-sm text-slate-500 hover:text-ink">{toonKlaar ? '▾' : '▸'} Onlangs afgerond ({o.klaar.length})</button>
          {toonKlaar && <div className="mt-2"><Lijst>{o.klaar.map(it => <OpvolgRegel key={it.taak.id} item={it} metGroep onOpenGroep={onOpenGroep} onWeg={acties.weg} />)}</Lijst></div>}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title="Opvolging toevoegen">
        {modal && <OpvolgModal start={modal} groepen={groepen} onClose={() => setModal(null)} onSave={(gid, t) => { acties.voegTaakToe(gid, t); setModal(null); }} />}
      </Modal>
    </div>
  );
}

/* ============================================================
   GROEPSPAGINA: planning, opvolging, gegevens en checklist
   ============================================================ */
function GroepTijdlijn({ p, g }) {
  const vandaag = CGT.vandaagISO();
  if (!p.start || !p.eindDatum) return <p className="text-sm text-slate-500">Vul de kick-off (of een startdatum) en de duur in. Dan zie je hier de tijdlijn.</p>;
  const punten = [{ label: 'Start', datum: p.start, soort: 'gepland' }];
  CGT.MOMENTEN.forEach(mo => {
    const x = p.m[mo.id];
    if (x.status === 'nvt') return;
    if (x.datum && (x.status === 'gepland' || x.status === 'indicatie')) punten.push({ label: mo.naam, datum: x.datum, soort: x.status });
    else if (mo.id === 'tussen' && p.duur >= 6 && p.midden) punten.push({ label: 'Tussenpresentatie', datum: p.midden, soort: 'berekend' });
    else if (mo.id === 'eind' && p.eindBerekend) punten.push({ label: 'Eindpresentatie', datum: p.eindBerekend, soort: 'berekend' });
  });
  if (g) {
    const bz = CGT.bijzonderhedenVan(g);
    CGT.SCHOOLPRES.forEach(sp => { const x = bz[sp.id]; if (x.heeft === 'ja' && x.datum) punten.push({ label: sp.naam, datum: x.datum, soort: 'school' }); });
  }
  const datums = punten.map(x => x.datum).concat([vandaag]).sort();
  const min = datums[0], span = Math.max(1, CGT.diffDays(datums[datums.length - 1], min));
  const pos = d => Math.max(0, Math.min(100, CGT.diffDays(d, min) / span * 100));
  const stijl = { gepland: 'bg-brand border-brand', indicatie: 'bg-white border-amber-500 border-dashed', berekend: 'bg-white border-rose-400 border-dashed', school: 'bg-regio border-regio' };
  return (
    <div>
      <div className="relative h-8 mx-2">
        <div className="absolute left-0 right-0 top-3.5 h-1.5 rounded-full bg-slate-200" />
        <div className="absolute left-0 top-3.5 h-1.5 rounded-full bg-midgroen" style={{ width: pos(vandaag) + '%' }} />
        {punten.map((x, i) => <div key={i} title={`${x.label} · ${CGT.datumKort(x.datum)}`} className={`absolute top-2 w-4 h-4 -ml-2 rounded-full border-2 ${stijl[x.soort]}`} style={{ left: pos(x.datum) + '%' }} />)}
        <div className="absolute top-0 h-8 w-0.5 bg-ink" style={{ left: pos(vandaag) + '%' }} title="Vandaag" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
        {punten.map((x, i) => <span key={i} className={x.soort === 'berekend' ? 'text-rose-600' : x.soort === 'indicatie' ? 'text-amber-700' : x.soort === 'school' ? 'text-regio' : 'text-slate-600'}>
          <span className="font-medium">{x.label}</span> {CGT.datumKort(x.datum)}{x.soort === 'berekend' && ' (berekend, niet gepland)'}{x.soort === 'indicatie' && ' (indicatie)'}</span>)}
      </div>
    </div>
  );
}

function GroepPlanning({ g, p, onUpdate }) {
  const setMoment = (id, deel) => onUpdate(x => {
    const m = CGT.momentenVan(x);
    const nw = { ...m[id], ...deel };
    if ('datum' in deel && deel.datum && m[id].status === 'open') nw.status = 'gepland';
    const mo = CGT.MOMENTEN.find(y => y.id === id);
    return { ...x, momenten: { ...m, [id]: nw }, ...(mo.oudVeld ? { [mo.oudVeld]: CGT.momentTekst(nw) } : {}) };
  });
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-ink text-sm mb-3">Planning</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Field label="Startdatum">
          <input type="date" className={inputCls} value={g.start || ''} onChange={e => onUpdate(x => ({ ...x, start: e.target.value }))} />
          {p.startAfgeleid && <span className="block text-xs text-slate-400 mt-1">nu: {CGT.datumKort(p.start)}</span>}
        </Field>
        <Field label="Duur (weken)">
          <input type="number" min="1" max="60" className={inputCls} value={g.duurWeken ?? (CGT.duurVan(g) || '')} placeholder="bijv. 10"
            onChange={e => onUpdate(x => ({ ...x, duurWeken: e.target.value === '' ? null : Math.max(1, Math.min(60, Math.round(+e.target.value))) }))} />
        </Field>
        <Field label="Halverwege"><div className="text-sm py-2 text-slate-700">{p.midden ? CGT.datumKort(p.midden) : '—'}</div></Field>
        <Field label="Berekend einde"><div className="text-sm py-2 text-slate-700">{p.eindBerekend ? CGT.datumKort(p.eindBerekend) : '—'}</div></Field>
      </div>
      <GroepTijdlijn p={p} g={g} />
      <div className="mt-4 space-y-2">
        {CGT.MOMENTEN.map(mo => {
          const x = p.m[mo.id];
          return (
            <div key={mo.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm text-ink">{mo.naam}</span>
                <Keuze waarde={x.status} leeg="open" onChange={v => setMoment(mo.id, { status: v })}
                  opties={[['open', 'Open', 'bg-slate-200 text-slate-700'], ['indicatie', 'Indicatie', 'bg-amber-100 text-amber-800'], ['gepland', 'Gepland', 'bg-brand text-white'], ['nvt', 'n.v.t.', 'bg-slate-200 text-slate-700']]} />
              </div>
              {x.status !== 'nvt' && (
                <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2 mt-2">
                  <input type="date" className={inputCls} value={x.datum} onChange={e => setMoment(mo.id, { datum: e.target.value })} aria-label={mo.naam + ' datum'} />
                  <input className={inputCls} value={x.tijd} onChange={e => setMoment(mo.id, { tijd: e.target.value })} placeholder="tijd, bijv. 10:30–12:00" aria-label={mo.naam + ' tijd'} />
                </div>
              )}
              <input value={x.notitie} onChange={e => setMoment(mo.id, { notitie: e.target.value })} placeholder="Locatie of notitie"
                className="mt-2 w-full text-sm text-slate-600 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-brand focus:outline-none px-0 py-1" />
              {x.status === 'gepland' && !x.datum && <div className="text-xs text-amber-700 mt-1">Vul een datum in, anders telt dit moment nog niet als gepland.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroepChecklist({ g, p, state, onZet }) {
  const vandaag = CGT.vandaagISO();
  const st = state || {};
  const [open, setOpen] = useState(() => {
    const o = {};
    CHECKLIST.forEach((f, fi) => { const a = CGT.faseAnker(g, p, fi); o[fi] = CGT.faseVoortgang(st, fi).open > 0 && (!a || CGT.diffDays(a, vandaag) <= 21); });
    return o;
  });
  const totaal = CHECKLIST.reduce((n, f, fi) => n + CGT.faseVoortgang(st, fi).klaar, 0);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink text-sm">Checklist begeleiding</h3>
        <span className="text-xs text-slate-500">{totaal} van {CHECKLIST_TOTAAL} klaar</span>
      </div>
      <div className="space-y-2">
        {CHECKLIST.map((f, fi) => {
          const v = CGT.faseVoortgang(st, fi), a = CGT.faseAnker(g, p, fi);
          const achter = a && v.open > 0 && CGT.diffDays(vandaag, a) > 3;
          return (
            <div key={fi} className={`rounded-lg border ${achter ? 'border-amber-300' : 'border-slate-200'}`}>
              <button onClick={() => setOpen(o => ({ ...o, [fi]: !o[fi] }))} className="w-full flex items-center gap-3 px-3 py-2 text-left">
                <span className="text-slate-400 text-xs w-3">{open[fi] ? '▾' : '▸'}</span>
                <span className="font-medium text-sm text-ink flex-1">{f.fase}</span>
                {a && <span className="text-xs text-slate-500 hidden sm:inline">{CGT.ANKERS[fi].na ? 'uiterlijk ' : ''}{CGT.datumKort(a)}</span>}
                {achter && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">achter</span>}
                {v.open === 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-brandlight text-branddark">klaar</span>}
                {v.open > 0 && <span role="button" tabIndex={0} title="Alle open punten in deze fase afvinken"
                  onClick={e => { e.stopPropagation(); f.items.forEach((_, ii) => { if (!CGT.itemStatus(st, fi, ii)) onZet(CGT.ckey(fi, ii), true); }); }}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-brandlight/40 hover:text-branddark">alles afvinken</span>}
                <span className="text-xs text-slate-500 w-10 text-right">{v.klaar}/{v.totaal}</span>
              </button>
              {open[fi] && (
                <ul className="px-3 pb-2">
                  {f.items.map((item, ii) => {
                    const k = CGT.ckey(fi, ii), s = CGT.itemStatus(st, fi, ii);
                    return (
                      <li key={ii} className="flex items-start gap-2.5 py-1.5 border-t border-slate-100">
                        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand shrink-0" checked={s === 'ja'} onChange={e => onZet(k, e.target.checked ? true : undefined)} />
                        <span className={`flex-1 text-sm ${s ? 'text-slate-400' : 'text-slate-700'} ${s === 'nvt' ? 'line-through' : ''}`}>{item}</span>
                        <button onClick={() => onZet(k, s === 'nvt' ? undefined : 'nvt')} className={`text-[11px] px-1.5 py-0.5 rounded ${s === 'nvt' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-700'}`}>n.v.t.</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroepOpvolging({ g, setGroepen, onNieuw }) {
  const [toonKlaar, setToonKlaar] = useState(false);
  const acties = useGroepActies(setGroepen);
  const vandaag = CGT.vandaagISO();
  const m = CGT.momentenVan(g, vandaag);
  const items = CGT.takenVan(g).map(t => { const k = CGT.taakKlaar(g, t, m); return { groep: g, taak: t, klaar: k.klaar, waarom: k.waarom, dagen: CGT.diffDays(t.herinnerOp || vandaag, vandaag) }; });
  const open = items.filter(x => !x.klaar).sort((a, b) => a.dagen - b.dagen), klaar = items.filter(x => x.klaar);
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3 className="font-semibold text-ink text-sm">Opvolging</h3>
        <div className="flex gap-2">
          <button onClick={() => onNieuw({ groepId: g.id })} className={knopKleinPrimair}>+ Opvolging</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-xs text-slate-500">
        <span>Laatste contact: {g.contact && g.contact.laatste ? CGT.datumKort(g.contact.laatste) : 'niet vastgelegd'}</span>
        <button onClick={() => acties.upd(g.id, x => CGT.voerActieUit(x, { soort: 'contactVandaag' }))} className={knopKlein}>✓ Contact gehad vandaag</button>
      </div>
      {open.length === 0 && <p className="px-4 pb-4 text-sm text-slate-400">Geen open opvolgingen.</p>}
      <div className="divide-y divide-slate-100">{open.map(it => <OpvolgRegel key={it.taak.id} item={it} onKlaar={acties.klaar} onUitstel={acties.uitstel} onWeg={acties.weg} onMail />)}</div>
      {klaar.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100">
          <button onClick={() => setToonKlaar(v => !v)} className="text-xs text-slate-500 hover:text-ink">{toonKlaar ? '▾' : '▸'} Afgerond ({klaar.length})</button>
          {toonKlaar && <div className="divide-y divide-slate-100 -mx-4">{klaar.map(it => <OpvolgRegel key={it.taak.id} item={it} onWeg={acties.weg} />)}</div>}
        </div>
      )}
    </div>
  );
}

// na het mailen: vraag meteen om een herinnering
function startNaMail(gid, sj) {
  return { groepId: gid, moment: sj.moment, dagen: sj.herinner,
    tekst: sj.moment ? `Reactie op mail over de ${CGT.MOMENTEN.find(m => m.id === sj.moment).naam.toLowerCase()}?` : (sj.id === 'vrij' ? '' : `Reactie op mail: ${sj.label.toLowerCase()}?`) };
}

const EIS_VOORBEELDEN = ['Beoordelingsformulier invullen door de opdrachtgever', 'Feedback geven op het conceptverslag', 'Uren of aanwezigheid aftekenen',
  'Tussentijdse beoordeling door de begeleider', 'Eindproduct goedkeuren door de opdrachtgever'];
const EIS_VOOR = ['Campus Gouda', 'Opdrachtgever', 'Studenten', 'Docent'];

function GroepBijzonderheden({ g, onUpdate }) {
  const bz = CGT.bijzonderhedenVan(g);
  const [nieuweEis, setNieuweEis] = useState('');
  const zet = (fn) => onUpdate(x => ({ ...x, bijzonderheden: fn(CGT.bijzonderhedenVan(x)) }));
  const zetPres = (id, deel) => zet(b => ({ ...b, [id]: { ...b[id], ...deel } }));
  const zetEis = (eid, deel) => zet(b => ({ ...b, eisen: b.eisen.map(e => e.id === eid ? { ...e, ...deel } : e) }));
  const voegEisToe = (tekst) => { if (!tekst.trim()) return; zet(b => ({ ...b, eisen: [...b.eisen, { id: CGT.nieuwId(), tekst: tekst.trim(), voor: '', deadline: '', klaar: false }] })); setNieuweEis(''); };
  const jaNee = [['ja', 'Ja', 'bg-brand text-white'], ['nee', 'Nee', 'bg-slate-200 text-slate-700']];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-ink text-sm mb-3">Bijzonderheden opleiding</h3>
      <div className="space-y-3">
        {CGT.SCHOOLPRES.map(sp => {
          const x = bz[sp.id];
          return (
            <div key={sp.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{sp.naam}?</span>
                <Keuze waarde={x.heeft} onChange={v => zetPres(sp.id, { heeft: v })} opties={jaNee} />
              </div>
              {x.heeft === 'ja' && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2">
                    <input type="date" className={inputCls} value={x.datum} onChange={e => zetPres(sp.id, { datum: e.target.value })} aria-label={sp.naam + ' datum'} />
                    <input className={inputCls} value={x.tijd} onChange={e => zetPres(sp.id, { tijd: e.target.value })} placeholder="tijd, bijv. 13:00–15:00" />
                  </div>
                  <input className={inputCls} value={x.locatie} onChange={e => zetPres(sp.id, { locatie: e.target.value })} placeholder="Locatie, bijv. HU Heidelberglaan, lokaal 2.14" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">Campus Gouda aanwezig gewenst?</span>
                    <Keuze waarde={x.cg} onChange={v => zetPres(sp.id, { cg: v })} opties={jaNee} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">Opdrachtgever aanwezig gewenst?</span>
                    <Keuze waarde={x.og} onChange={v => zetPres(sp.id, { og: v })} opties={jaNee} />
                  </div>
                  {x.og === 'ja' && (
                    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-brand" checked={!!x.ogUitgenodigd} onChange={e => zetPres(sp.id, { ogUitgenodigd: e.target.checked })} />Opdrachtgever is uitgenodigd</label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-ink mb-1">Eisen vanuit de opleiding</div>
        {bz.eisen.length === 0 && <p className="text-xs text-slate-400 mb-2">Nog geen eisen. Bijvoorbeeld een beoordelingsformulier dat de opdrachtgever moet invullen.</p>}
        <div className="space-y-2">
          {bz.eisen.map(e => (
            <div key={e.id} className={`rounded-lg border p-2 ${e.klaar ? 'border-slate-100 bg-slate-50' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-1.5 w-4 h-4 accent-brand shrink-0" checked={!!e.klaar} onChange={ev => zetEis(e.id, { klaar: ev.target.checked })} title="Afgerond" />
                <input className={`flex-1 border-0 bg-transparent text-sm px-1 py-1 focus:outline-none focus:ring-1 focus:ring-brand/40 rounded ${e.klaar ? 'line-through text-slate-400' : 'text-slate-800'}`} value={e.tekst} onChange={ev => zetEis(e.id, { tekst: ev.target.value })} />
                <button onClick={() => { if (confirm('Deze eis verwijderen?')) zet(b => ({ ...b, eisen: b.eisen.filter(x => x.id !== e.id) })); }} className="text-xs text-slate-400 hover:text-rose-600 px-1 pt-1.5" title="Verwijderen">✕</button>
              </div>
              {!e.klaar && (
                <div className="flex flex-wrap items-center gap-2 mt-1 ml-6">
                  <select className="border border-slate-300 rounded-lg px-2 py-1 text-xs" value={e.voor} onChange={ev => zetEis(e.id, { voor: ev.target.value })}>
                    <option value="">Voor wie?</option>{EIS_VOOR.map(v => <option key={v}>{v}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">deadline</span>
                  <input type="date" className="border border-slate-300 rounded-lg px-2 py-1 text-xs" value={e.deadline} onChange={ev => zetEis(e.id, { deadline: ev.target.value })} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input className={inputCls} value={nieuweEis} onChange={e => setNieuweEis(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') voegEisToe(nieuweEis); }} placeholder="Nieuwe eis, bijv. opdrachtgever vult beoordelingsformulier in" />
          <button onClick={() => voegEisToe(nieuweEis)} className={knopKleinPrimair}>Toevoegen</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {EIS_VOORBEELDEN.filter(t => !bz.eisen.some(e => e.tekst === t)).map(t => (
            <button key={t} onClick={() => voegEisToe(t)} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-brand hover:text-branddark">+ {t}</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-ink mb-1">Overige bijzonderheden</div>
        <textarea className={inputCls + ' resize-y'} rows="3" value={bz.notities} onChange={e => zet(b => ({ ...b, notities: e.target.value }))}
          placeholder="Bijvoorbeeld: minor met verplichte reflectieverslagen, docent wil maandelijks een update" />
      </div>
    </div>
  );
}

function GroepEvaluatie({ g, p, onUpdate }) {
  const vandaag = CGT.vandaagISO();
  const ev = g.evaluatie || {};
  if (!(p.eind && vandaag > p.eind) && !ev.tevredenheid) return null;
  const zet = deel => onUpdate(x => ({ ...x, evaluatie: { ...(x.evaluatie || {}), ...deel, ingevuldOp: vandaag } }));
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-ink text-sm mb-1">Afronding: evaluatie met de opdrachtgever</h3>
      <p className="text-xs text-slate-500 mb-3">Kort na de eindpresentatie vragen. Zo zie je later welke opdrachtgevers tevreden zijn en terug willen komen.</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
        <span className="text-slate-600">Tevredenheid opdrachtgever</span>
        <Keuze waarde={ev.tevredenheid ? String(ev.tevredenheid) : ''} onChange={v => zet({ tevredenheid: v ? Number(v) : null })}
          opties={[1, 2, 3, 4, 5].map(n => [String(n), String(n), n >= 4 ? 'bg-brand text-white' : n === 3 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'])} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
        <span className="text-slate-600">Wil opnieuw een opdracht?</span>
        <Keuze waarde={ev.opnieuw || ''} onChange={v => zet({ opnieuw: v })} opties={[['ja', 'Ja', 'bg-brand text-white'], ['misschien', 'Misschien', 'bg-amber-100 text-amber-800'], ['nee', 'Nee', 'bg-slate-200 text-slate-700']]} />
      </div>
      <input className={inputCls} value={ev.citaat || ''} onChange={e => zet({ citaat: e.target.value })} placeholder="Citaat of opmerking van de opdrachtgever (optioneel)" />
    </div>
  );
}

function GroepGegevens({ g }) {
  const kleur = { ja: 'bg-brandlight text-branddark', deels: 'bg-amber-50 text-amber-800', nee: 'bg-rose-50 text-rose-700' };
  const label = { ja: 'compleet', deels: 'deels', nee: 'ontbreekt' };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-ink text-sm mb-2">Welke gegevens heb ik?</h3>
      <div className="divide-y divide-slate-100">
        {CGT.gegevens(g).map(x => (
          <div key={x.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-slate-700">{x.naam}{x.uitleg && <span className="text-xs text-slate-400"> · {x.uitleg}</span>}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${kleur[x.status]}`}>{label[x.status]}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2">Berekend uit de studenten en de docent bij deze groep. Aanvullen doe je via Bewerken.</p>
    </div>
  );
}

/* ============================================================
   STUDENTENGROEPEN-TAB
   ============================================================ */
function GroepForm({ initial, trajecten, contacten, groepen = [], onSave, onCancel }) {
  const isNieuw = !String(initial.groepsnummer || '').trim();
  const [f, setF] = useState(() => {
    const base = { ...initial, studenten: (initial.studenten || []).map(s => ({ ...s })) };
    if (isNieuw) base.groepsnummer = nextGroepsnummer(base.thema, groepen, base.id);
    return base;
  });
  const [manualNr, setManualNr] = useState(!isNieuw); // bestaand nummer = handmatig behouden
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const collegas = useMemo(() => TEAM_NAMEN.length ? [...TEAM_NAMEN] : [...new Set(contacten.map(c => c.naam).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl')), [contacten]);

  // bij themawijziging het automatische nummer bijwerken (tenzij handmatig aangepast)
  const setThema = (e) => {
    const thema = e.target.value;
    setF(p => ({ ...p, thema, groepsnummer: manualNr ? p.groepsnummer : nextGroepsnummer(thema, groepen, p.id) }));
  };
  const setGroepsnummer = (e) => { setManualNr(true); setF(p => ({ ...p, groepsnummer: e.target.value })); };
  const autoNummer = () => { setManualNr(false); setF(p => ({ ...p, groepsnummer: nextGroepsnummer(p.thema, groepen, p.id) })); };

  function kiesTraject(e) {
    const tid = e.target.value;
    const tr = trajecten.find(t => t.id === tid);
    setF(p => {
      const thema = tr ? tr.thema : p.thema;
      return { ...p, trajectId: tid, thema, titel: tr ? tr.titel : p.titel,
        groepsnummer: manualNr ? p.groepsnummer : nextGroepsnummer(thema, groepen, p.id) };
    });
  }
  const setStudent = (id, k, v) => setF(p => ({ ...p, studenten: p.studenten.map(s => s.id === id ? { ...s, [k]: v } : s) }));
  const addStudent = () => setF(p => ({ ...p, studenten: [...p.studenten, leegStudent()] }));
  const delStudent = (id) => setF(p => ({ ...p, studenten: p.studenten.filter(s => s.id !== id) }));
  // contactpersoon: max één tegelijk
  const setContact = (id) => setF(p => ({ ...p, studenten: p.studenten.map(s => ({ ...s, isContact: s.id === id ? !s.isContact : false })) }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Groepsnummer">
        <div className="flex gap-2">
          <input className={inputCls} value={f.groepsnummer} onChange={setGroepsnummer} placeholder="bijv. 1.1" />
          <button type="button" onClick={autoNummer} title="Automatisch nummeren op basis van thema" className="px-2 rounded-lg border border-slate-300 text-sm text-slate-500 hover:bg-slate-50 shrink-0">auto</button>
        </div>
        <span className="block text-xs text-slate-400 mt-1">Auto: Zorg 1.x · Logistiek 2.x · Bodem 3.x{!manualNr && ' (volgt thema)'}</span>
      </Field>
      <Field label="Gekoppeld traject">
        <select className={inputCls} value={f.trajectId} onChange={kiesTraject}>
          <option value="">— geen —</option>
          {trajecten.map(t => <option key={t.id} value={t.id}>{t.titel}{t.thema ? ` · ${t.thema}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Thema">
        <select className={inputCls} value={f.thema} onChange={setThema}>{THEMAS.map(x => <option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="Titel/onderwerp traject"><input className={inputCls} value={f.titel} onChange={set('titel')} /></Field>
      <Field label="Vorm traject"><input className={inputCls} value={f.vorm} onChange={set('vorm')} placeholder="bijv. 20 weken / 8 weeks" /></Field>
      <Field label="Onderwijsinstelling"><input className={inputCls} value={f.onderwijsinstelling} onChange={set('onderwijsinstelling')} placeholder="HU / HHS / CHE / HR" /></Field>
      <Field label="Opleiding / minor"><input className={inputCls} value={f.opleiding} onChange={set('opleiding')} /></Field>
      <Field label="Contact Campus Gouda">
        <input className={inputCls} list="cg-collegas-grp" value={f.contactCG} onChange={set('contactCG')} />
        <datalist id="cg-collegas-grp">{collegas.map((n,i)=><option key={i} value={n} />)}</datalist>
      </Field>
      <Field label="Docentbegeleider"><input className={inputCls} value={f.docent} onChange={set('docent')} /></Field>
      <Field label="Mailadres docent"><input className={inputCls} type="email" value={f.docentMail} onChange={set('docentMail')} /></Field>
      <Field label="Wekelijkse afspraak" full><input className={inputCls} value={f.wekelijkseAfspraak} onChange={set('wekelijkseAfspraak')} placeholder="bijv. dinsdag 10:00" /></Field>
      <div className="sm:col-span-2 text-xs text-slate-500 bg-brandlight/40 border border-brand/20 rounded-lg px-3 py-2">
        De datums van kennismaking, kick-off, tussen- en eindpresentatie en de duur zet je op de groepspagina bij <strong>Planning</strong>.
      </div>

      <div className="sm:col-span-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-600">Studenten ({f.studenten.length})</span>
          <button onClick={addStudent} className="text-sm text-brand hover:underline">+ student</button>
        </div>
        <div className="space-y-2">
          {f.studenten.map(s => (
            <div key={s.id} className="border border-slate-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
              <input className="border border-slate-300 rounded px-2 py-1 text-sm sm:col-span-2" value={s.naam} onChange={e=>setStudent(s.id,'naam',e.target.value)} placeholder="naam" />
              <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={s.woonplaats} onChange={e=>setStudent(s.id,'woonplaats',e.target.value)} placeholder="woonplaats" />
              <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={s.mail} onChange={e=>setStudent(s.id,'mail',e.target.value)} placeholder="mail (onderwijs)" />
              <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={s.telefoon} onChange={e=>setStudent(s.id,'telefoon',e.target.value)} placeholder="telefoon" />
              <input className="border border-slate-300 rounded px-2 py-1 text-sm" value={s.priveMail} onChange={e=>setStudent(s.id,'priveMail',e.target.value)} placeholder="privé-mail (optioneel)" />
              <label className="flex items-center gap-1 text-xs text-slate-500 sm:col-span-5"><input type="checkbox" checked={!!s.isContact} onChange={()=>setContact(s.id)} className="accent-brand" /> contactpersoon van de groep</label>
              <button onClick={()=>delStudent(s.id)} className="text-slate-400 hover:text-rose-600 text-sm justify-self-end">verwijderen</button>
            </div>
          ))}
          {f.studenten.length === 0 && <p className="text-sm text-slate-300">Nog geen studenten — voeg er een toe.</p>}
        </div>
      </div>

      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button onClick={() => onSave(f)} disabled={!f.groepsnummer.trim()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Opslaan</button>
      </div>
    </div>
  );
}

// Aantekeningen bij een groep: altijd voor de hele groep, met een vast format per soort bijeenkomst.
// Velden: vink (ja/nee; ref = checklistpunt dat meteen wordt afgevinkt), stoplicht, keuze, tekst, info (berekend).
const AANTEKENING_FORMATS = {
  'Kennismaking': [
    { k: 'frequentie', t: 'vink', label: 'Afgesproken hoe vaak en wanneer we elkaar spreken', ref: ['F1I0'] },
    { k: 'spoed', t: 'vink', label: 'Nummers voor spoedgevallen uitgewisseld', ref: ['F1I1'] },
    { k: 'voorgaand', t: 'vink', label: 'Documentatie van voorgaande groepen besproken', ref: ['F1I2'] },
    { k: 'voorbereiden', t: 'vink', label: 'Opdracht gegeven: info van voorgaande groepen doornemen en voorbereid naar de kick-off komen', ref: ['F1I3', 'F1I4'] },
    { k: 'pages', t: 'vink', label: 'Afgesproken dat ze Pages bijhouden voor de voortgangsgesprekken', ref: ['F1I5'] },
    { k: 'indruk', t: 'tekst', label: 'Eerste indruk van de groep' },
    { k: 'info', t: 'tekst', label: 'Vragen en informatiebehoeften' },
    { k: 'afspraken', t: 'tekst', label: 'Afspraken en vervolgstappen' },
  ],
  'Kick-off': [
    { k: 'presentaties', t: 'info', bron: 'presentaties' },
    { k: 'vastgelegd', t: 'vink', label: 'Tussentijdse en eindpresentatie vastgelegd (datum, tijd en locatie)', ref: ['F2I0'] },
    { k: 'herhaald', t: 'vink', label: 'Studenten hebben de inhoudelijke afspraken herhaald', ref: ['F2I1'] },
    { k: 'contactOG', t: 'vink', label: 'Afgesproken hoe en hoe vaak er contact is met de opdrachtgever', ref: ['F2I2'] },
    { k: 'agenda', t: 'vink', label: 'Check-ins met de groep staan in de agenda\'s', ref: ['F3I1'] },
    { k: 'opdracht', t: 'tekst', label: 'Opdracht en verwachtingen van de opdrachtgever' },
    { k: 'indruk', t: 'tekst', label: 'Indruk van de groep en de samenwerking' },
    { k: 'info', t: 'tekst', label: 'Vragen en informatiebehoeften' },
    { k: 'afspraken', t: 'tekst', label: 'Afspraken en vervolgstappen' },
  ],
  'Voortgangsgesprek': [
    { k: 'checklistStand', t: 'info', bron: 'checklist' },
    { k: 'checklist', t: 'vink', label: 'Checklist helemaal ingevuld en bijgewerkt' },
    { k: 'agenda', t: 'vink', label: 'Alle afspraken staan in de agenda (check-ins, presentaties)', ref: ['F3I1'] },
    { k: 'stand', t: 'stoplicht', label: 'Hoe staan ze ervoor?' },
    { k: 'samenwerking', t: 'tekst', label: 'Hoe gaat de samenwerking in de groep?' },
    { k: 'info', t: 'tekst', label: 'Informatiebehoeften: wat hebben ze nodig van ons, de opdrachtgever of de docent?' },
    { k: 'testTussen', t: 'vink', label: 'Test-tussentijdse presentatie gepland: 1 week vóór de tussentijdse presentatie, tijdens een voortgangsgesprek', ref: ['F3I2'], info: 'testTussen', alleen: 'voorTussen' },
    { k: 'testEind', t: 'vink', label: 'Test-eindpresentatie gepland: 1 week vóór de eindpresentatie', ref: ['F5I1'], info: 'testEind', alleen: 'naTussen' },
    { k: 'kerngroep', t: 'vink', label: 'Betrokkenheid van de kerngroepleden besproken', ref: ['F3I3'] },
    { k: 'afspraken', t: 'tekst', label: 'Afspraken en vervolgstappen' },
  ],
  'Tussenpresentatie': [
    { k: 'go', t: 'keuze', label: 'Go of no-go van het kernteam voor de richting', opties: ['Go', 'No-go', 'Twijfel'], ref: ['F4I0'] },
    { k: 'verwachting', t: 'vink', label: 'Verwachtingen over het eindproduct uitgesproken', ref: ['F4I1'] },
    { k: 'afsprakenLaatste', t: 'vink', label: 'Afspraken vastgelegd, o.a. hoe vaak er contact is in de laatste fase', ref: ['F4I2'] },
    { k: 'testEind', t: 'vink', label: 'Moment om de eindpresentatie te oefenen (met feedback) bepaald', ref: ['F5I1'], info: 'testEind' },
    { k: 'feedback', t: 'tekst', label: 'Feedback van de opdrachtgever en de docent' },
    { k: 'indruk', t: 'tekst', label: 'Hoe ging de presentatie? Indruk van de groep' },
    { k: 'afspraken', t: 'tekst', label: 'Afspraken en vervolgstappen' },
  ],
  'Eindpresentatie': [
    { k: 'overdracht', t: 'vink', label: 'Vorm van overdracht van rapportage en prototype afgesproken', ref: ['F6I0'] },
    { k: 'gebruik', t: 'vink', label: 'Afgesproken wat Campus Gouda met de eindproducten mag doen', ref: ['F6I1'] },
    { k: 'alumni', t: 'vink', label: 'Alumninetwerk van Campus Gouda geïntroduceerd', ref: ['F6I2'] },
    { k: 'bedankje', t: 'vink', label: 'Bedankje gegeven namens Campus Gouda', ref: ['F6I3'] },
    { k: 'compleet', t: 'vink', label: 'Alle producten compleet opgeleverd', ref: ['F7I2'] },
    { k: 'reactie', t: 'tekst', label: 'Reactie van de opdrachtgever op het eindresultaat' },
    { k: 'kansen', t: 'tekst', label: 'Vervolgkansen (nieuw traject, challenge, stage, …)' },
    { k: 'lessen', t: 'tekst', label: 'Lessen voor volgende groepen' },
    { k: 'afspraken', t: 'tekst', label: 'Afspraken en vervolgstappen' },
  ],
  'Overig': [
    { k: 'tekst', t: 'tekst', label: 'Aantekening' },
  ],
};
const AANTEKENING_SOORTEN = Object.keys(AANTEKENING_FORMATS);
const AANTEKENING_KLEUR = {
  'Kennismaking': 'bg-slate-100 text-slate-700 border-slate-200',
  'Kick-off': 'bg-sky-50 text-sky-700 border-sky-200', 'Voortgangsgesprek': 'bg-brandlight text-branddark border-brand/30',
  'Tussenpresentatie': 'bg-amber-50 text-amber-700 border-amber-200', 'Eindpresentatie': 'bg-violet-50 text-violet-700 border-violet-200',
  'Overig': 'bg-slate-100 text-slate-600 border-slate-200',
};
const STOPLICHT = [
  { w: 'goed', label: 'Op koers', kleur: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { w: 'aandacht', label: 'Aandacht nodig', kleur: 'bg-amber-50 text-amber-700 border-amber-300' },
  { w: 'zorgen', label: 'Zorgen', kleur: 'bg-rose-50 text-rose-700 border-rose-300' },
];
// is een veld van het format nu van toepassing? (test-tussen vóór de tussenpresentatie, test-eind daarna)
function veldVanToepassing(v, p, vandaag) {
  if (v.alleen === 'voorTussen') return !(p.tussen && p.tussen < vandaag);
  if (v.alleen === 'naTussen') return !!(p.tussen && p.tussen < vandaag);
  return true;
}
function veldIngevuld(v, w) { return v.t === 'tekst' ? !!String(w || '').trim() : !!w; }

function AantekeningInfo({ bron, g, p, checklistState }) {
  const kader = 'text-xs rounded-lg px-3 py-2 bg-white border border-slate-200 text-slate-600';
  if (bron === 'checklist') {
    const v = checklistVoortgang(checklistState);
    const open = CHECKLIST.map((f, fi) => ({ fase: f.fase, open: f.items.filter((_, ii) => !CGT.itemStatus(checklistState, fi, ii)).length })).filter(x => x.open);
    return <div className={kader}>Checklist: <strong>{v.done} van {v.total}</strong> klaar.{open.length ? ' Nog open: ' + open.slice(0, 3).map(x => x.fase + ' (' + x.open + ')').join(', ') + (open.length > 3 ? ', …' : '') : ' Alles afgevinkt.'}</div>;
  }
  if (bron === 'presentaties') {
    return <div className={kader}>Tussentijdse presentatie: <strong>{p.tussen ? CGT.datumDM(p.tussen) : 'nog niet vastgelegd'}</strong> · Eindpresentatie: <strong>{p.eind ? CGT.datumDM(p.eind) : 'nog niet vastgelegd'}</strong></div>;
  }
  if (bron === 'testTussen') {
    return <div className="text-xs text-slate-500 mt-1">{p.tussen ? <>Tussentijdse presentatie {CGT.datumDM(p.tussen)} → test-presentatie in de week van <strong>{CGT.datumDM(CGT.addDays(p.tussen, -7))}</strong>.</> : 'Leg eerst de datum van de tussentijdse presentatie vast (Planning).'}</div>;
  }
  if (bron === 'testEind') {
    return <div className="text-xs text-slate-500 mt-1">{p.eind ? <>Eindpresentatie {CGT.datumDM(p.eind)} → oefenen in de week van <strong>{CGT.datumDM(CGT.addDays(p.eind, -7))}</strong>.</> : 'Leg eerst de datum van de eindpresentatie vast (Planning).'}</div>;
  }
  return null;
}

function GroepAantekeningen({ g, p, checklistState, onZetChecklist, onUpdate }) {
  const vandaag = CGT.vandaagISO();
  const alle = (g.aantekeningen || []).slice().sort((x, y) => String(y.datum).localeCompare(String(x.datum)) || String(y.gemaakt || '').localeCompare(String(x.gemaakt || '')));
  const [form, setForm] = useState(null); // { soort, datum, door, velden }
  const [bewerkId, setBewerkId] = useState(null);
  const [filter, setFilter] = useState('');
  const start = (soort) => { setBewerkId(null); setForm({ soort, datum: vandaag, door: teamNaamVoor(mijnNaam(), TEAM_NAMEN) || mijnNaam(), velden: {} }); };
  const bewerk = (a) => { setBewerkId(a.id); setForm({ soort: a.soort, datum: a.datum, door: a.door || '', velden: { ...(a.velden || {}), ...(a.tekst && !(a.velden || {}).tekst ? { tekst: a.tekst } : {}) } }); };
  const zetVeld = (k, w) => setForm(f => ({ ...f, velden: { ...f.velden, [k]: w } }));
  const format = form ? (AANTEKENING_FORMATS[form.soort] || AANTEKENING_FORMATS['Overig']) : [];
  const iets = form && format.some(v => veldIngevuld(v, form.velden[v.k]) || (v.t === 'stoplicht' && String(form.velden[v.k + 'Toelichting'] || '').trim()));
  const opslaan = () => {
    if (!iets) return;
    const velden = {};
    format.forEach(v => {
      const w = form.velden[v.k];
      if (v.t !== 'info' && veldIngevuld(v, w)) velden[v.k] = v.t === 'tekst' ? String(w).trim() : w;
      if (v.t === 'stoplicht') { const tl = String(form.velden[v.k + 'Toelichting'] || '').trim(); if (tl) velden[v.k + 'Toelichting'] = tl; }
    });
    const basis = { soort: form.soort, datum: form.datum, door: String(form.door || '').trim(), velden };
    if (bewerkId) onUpdate(x => ({ ...x, aantekeningen: (x.aantekeningen || []).map(a => a.id === bewerkId ? { ...a, ...basis, tekst: '', studentIds: [], gewijzigd: new Date().toISOString() } : a) }));
    else onUpdate(x => ({ ...x, aantekeningen: [...(x.aantekeningen || []), { id: uid(), ...basis, gemaakt: new Date().toISOString() }] }));
    // wat hier met "ja" is afgevinkt en ook in de checklist staat, meteen afvinken
    if (onZetChecklist) format.forEach(v => { if ((v.t === 'vink' && velden[v.k] === 'ja') || (v.t === 'keuze' && velden[v.k])) (v.ref || []).forEach(r => { if (!(checklistState || {})[r]) onZetChecklist(r, true); }); });
    setForm(null); setBewerkId(null);
  };
  const weg = (id) => { if (confirm('Deze aantekening verwijderen?')) onUpdate(x => ({ ...x, aantekeningen: (x.aantekeningen || []).filter(a => a.id !== id) })); };
  const zichtbaar = filter ? alle.filter(a => a.soort === filter) : alle;
  const telSoort = sr => alle.filter(a => a.soort === sr).length;
  const knopCls = (aan, kleur) => 'px-2.5 py-0.5 rounded-full border text-xs ' + (aan ? (kleur || 'bg-brand text-white border-brand') : 'bg-white border-slate-300 text-slate-600 hover:border-brand');
  const alAfgevinkt = v => (v.ref || []).length && (v.ref || []).every(r => (checklistState || {})[r]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-ink text-sm">Aantekeningen ({alle.length})</h3>
        {alle.length > 0 && (
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-600" aria-label="Aantekeningen filteren">
            <option value="">Alle aantekeningen</option>
            {AANTEKENING_SOORTEN.filter(telSoort).map(sr => <option key={sr} value={sr}>{sr} ({telSoort(sr)})</option>)}
          </select>
        )}
      </div>
      {!form && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {AANTEKENING_SOORTEN.map(sr => (
            <button key={sr} type="button" onClick={() => start(sr)} className="px-2.5 py-1 rounded-full border border-slate-300 text-xs text-slate-600 hover:border-brand hover:text-brand">+ {sr}</button>
          ))}
        </div>
      )}
      {form && (
        <div className="border border-brand/30 bg-brandlight/30 rounded-lg p-3 mb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={AANTEKENING_KLEUR[form.soort] || AANTEKENING_KLEUR['Overig']}>{form.soort}</Badge>
            <span className="text-xs text-slate-500">voor de hele groep</span>
            <input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} className="ml-auto border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white" aria-label="Datum" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 mr-1">Gemaakt door:</span>
            {TEAM_NAMEN.map(n => <button key={n} type="button" onClick={() => setForm(f => ({ ...f, door: n }))} className={knopCls(form.door === n)}>{n}</button>)}
            {!TEAM_NAMEN.length && <input value={form.door} onChange={e => setForm(f => ({ ...f, door: e.target.value }))} className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white" placeholder="naam" aria-label="Gemaakt door" />}
          </div>
          {format.filter(v => veldVanToepassing(v, p, vandaag)).map(v => {
            const w = form.velden[v.k];
            if (v.t === 'info') return <AantekeningInfo key={v.k} bron={v.bron} g={g} p={p} checklistState={checklistState} />;
            if (v.t === 'vink' || v.t === 'keuze') return (
              <div key={v.k} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[200px] text-slate-700">{v.label}</span>
                  {(v.t === 'vink' ? [['ja', 'Ja'], ['nee', 'Nee']] : v.opties.map(o => [o, o])).map(([waarde, tekst]) => (
                    <button key={waarde} type="button" onClick={() => zetVeld(v.k, w === waarde ? '' : waarde)}
                      className={knopCls(w === waarde, waarde === 'nee' || waarde === 'No-go' ? 'bg-rose-500 text-white border-rose-500' : waarde === 'Twijfel' ? 'bg-amber-500 text-white border-amber-500' : '')}>{tekst}</button>
                  ))}
                </div>
                {v.info && <AantekeningInfo bron={v.info} g={g} p={p} checklistState={checklistState} />}
                {(v.ref || []).length > 0 && <div className="text-[11px] text-slate-400 mt-0.5">{alAfgevinkt(v) ? '✓ staat al afgevinkt in de checklist' : 'Bij "' + (v.t === 'keuze' ? 'een keuze' : 'Ja') + '" wordt dit ook afgevinkt in de checklist'}</div>}
              </div>
            );
            if (v.t === 'stoplicht') return (
              <div key={v.k} className="text-sm space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[200px] text-slate-700">{v.label}</span>
                  {STOPLICHT.map(o => <button key={o.w} type="button" onClick={() => zetVeld(v.k, w === o.w ? '' : o.w)} className={knopCls(w === o.w, o.kleur)}>{o.label}</button>)}
                </div>
                <textarea value={form.velden[v.k + 'Toelichting'] || ''} onChange={e => zetVeld(v.k + 'Toelichting', e.target.value)} rows={2} placeholder="Toelichting"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40" aria-label={v.label + ' toelichting'} />
              </div>
            );
            return (
              <div key={v.k} className="text-sm">
                <label className="block text-slate-700 mb-1">{v.label}</label>
                <textarea value={w || ''} onChange={e => zetVeld(v.k, e.target.value)} rows={v.k === 'tekst' ? 5 : 2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40" aria-label={v.label} />
              </div>
            );
          })}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(null); setBewerkId(null); }} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white hover:bg-slate-50">Annuleren</button>
            <button type="button" onClick={opslaan} disabled={!iets} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">{bewerkId ? 'Opslaan' : 'Toevoegen'}</button>
          </div>
        </div>
      )}
      {zichtbaar.length === 0 ? (
        !form && <p className="text-sm text-slate-300">{alle.length ? 'Geen aantekeningen met dit filter.' : 'Nog geen aantekeningen. Kies hierboven wat voor bijeenkomst het was.'}</p>
      ) : (
        <div className="space-y-2">
          {zichtbaar.map(a => {
            const fmt = AANTEKENING_FORMATS[a.soort] || AANTEKENING_FORMATS['Overig'];
            const vw = a.velden || {};
            const vinken = fmt.filter(v => (v.t === 'vink' || v.t === 'keuze') && vw[v.k]);
            const licht = fmt.find(v => v.t === 'stoplicht' && (vw[v.k] || vw[v.k + 'Toelichting']));
            const lichtOptie = licht && STOPLICHT.find(o => o.w === vw[licht.k]);
            const teksten = fmt.filter(v => v.t === 'tekst' && vw[v.k]);
            return (
              <div key={a.id} className="border border-slate-100 rounded-lg p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Badge className={AANTEKENING_KLEUR[a.soort] || AANTEKENING_KLEUR['Overig']}>{a.soort}</Badge>
                  <span className="text-xs text-slate-500">{a.datum ? CGT.datumDM(a.datum) : ''}</span>
                  {a.door && <span className="text-xs text-slate-500">· door {a.door}</span>}
                  <span className="ml-auto flex gap-2 text-xs">
                    <button type="button" onClick={() => bewerk(a)} className="text-brand hover:underline">bewerken</button>
                    <button type="button" onClick={() => weg(a.id)} className="text-slate-400 hover:text-rose-600">verwijderen</button>
                  </span>
                </div>
                {licht && (
                  <div className="mb-1.5"><span className="text-xs text-slate-500 mr-1">{licht.label}</span>{lichtOptie && <Badge className={lichtOptie.kleur}>{lichtOptie.label}</Badge>}
                    {vw[licht.k + 'Toelichting'] && <div className="text-slate-700 whitespace-pre-wrap mt-1">{vw[licht.k + 'Toelichting']}</div>}</div>
                )}
                {vinken.length > 0 && (
                  <ul className="mb-1.5 space-y-0.5">
                    {vinken.map(v => {
                      const w = vw[v.k], goed = w === 'ja' || w === 'Go';
                      return <li key={v.k} className={'text-xs ' + (goed ? 'text-emerald-700' : w === 'nee' || w === 'No-go' ? 'text-rose-600' : 'text-amber-700')}>{goed ? '✓' : w === 'nee' || w === 'No-go' ? '✗' : '•'} {v.label}{v.t === 'keuze' ? ': ' + w : ''}</li>;
                    })}
                  </ul>
                )}
                {teksten.map(v => (
                  <div key={v.k} className="mb-1">
                    {v.k !== 'tekst' && <div className="text-xs text-slate-400">{v.label}</div>}
                    <div className="text-slate-700 whitespace-pre-wrap">{vw[v.k]}</div>
                  </div>
                ))}
                {a.tekst && !vw.tekst && <div className="text-slate-700 whitespace-pre-wrap">{a.tekst}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Een lade op de groepspagina: balk met titel en samenvatting, klik om open of dicht te klappen.
// De onderdelen hebben zelf een kaart met titel; in de lade vallen die rand en titel weg.
function Lade({ titel, samenvatting, open, onToggle, children, aandacht }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl">
        <span className={'text-slate-400 text-xs transition-transform ' + (open ? 'rotate-90' : '')} aria-hidden="true">▶</span>
        <span className="font-semibold text-ink text-sm">{titel}</span>
        {aandacht ? <span className="w-2 h-2 rounded-full bg-amber-500" title="Hier is iets nodig" /> : null}
        {samenvatting && <span className="ml-auto text-xs text-slate-500 truncate min-w-0">{samenvatting}</span>}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 [&>div]:border-0 [&>div]:p-0 [&>div]:bg-transparent [&>div]:rounded-none [&>div>h3:first-child]:hidden [&>div>div:first-child>h3]:hidden">
          {children}
        </div>
      )}
    </section>
  );
}
const LS_LADES = 'cgt_lades_groep';

function GroepDetail({ groep, trajecten, checklistState, onZetChecklist, onUpdate, setGroepen, onBack, onEdit, onDelete, onOpenTraject }) {
  const g = groep;
  const vandaag = CGT.vandaagISO();
  const p = CGT.planning(g, vandaag);
  const traject = trajecten.find(t => t.id === g.trajectId);
  const sigs = CGT.opVolgorde(CGT.signalen(g, checklistState, vandaag).filter(x => !x.verborgen));
  const later = (regel) => onUpdate(x => ({ ...x, verborgen: { ...(x.verborgen || {}), [regel]: CGT.addDays(vandaag, 7) } }));
  const [opvolg, setOpvolg] = useState(null);
  const gemaild = (gid, sj) => setOpvolg(startNaMail(g.id, sj));
  // lades: welke open staan, wordt onthouden (per browser)
  const [lades, setLades] = useState(() => loadLS(LS_LADES, { planning: true, aantekeningen: true }) || {});
  const zetLades = (fn) => setLades(prev => { const n = fn(prev); saveLS(LS_LADES, n); return n; });
  const lade = (id) => ({ open: !!lades[id], onToggle: () => zetLades(prev => ({ ...prev, [id]: !prev[id] })) });
  const openLade = (id) => zetLades(prev => ({ ...prev, [id]: true }));
  const studenten = g.studenten || [];
  const cv = checklistVoortgang(checklistState);
  const openTaken = CGT.takenVan(g).filter(t => !CGT.taakKlaar(g, t, p.m).klaar).sort((x, y) => String(x.herinnerOp || '').localeCompare(String(y.herinnerOp || '')));
  const momentDM = (id) => { const x = p.m[id]; return x && x.datum ? CGT.datumDM(x.datum) + (x.status === 'indicatie' ? '?' : '') : '—'; };
  const planSamenvatting = 'kick-off ' + momentDM('kickoff') + ' · tussen ' + momentDM('tussen') + ' · eind ' + momentDM('eind');
  const nietGepland = [{ id: 'kickoff', naam: 'Kick-off' }, { id: 'tussen', naam: 'Tussenpresentatie' }, { id: 'eind', naam: 'Eindpresentatie' }]
    .map(x => ({ ...x, ...(p.m[x.id] || {}) })).filter(x => x.status !== 'gepland' && x.status !== 'nvt');
  const aant = g.aantekeningen || [];
  const laatsteAant = aant.slice().sort((x, y) => String(y.datum).localeCompare(String(x.datum)))[0];
  const aantSamenvatting = aant.length ? aant.length + ' · laatste: ' + laatsteAant.soort + (laatsteAant.datum ? ' ' + CGT.datumDM(laatsteAant.datum) : '') : 'nog geen';
  const Row = ({ label, value }) => (
    <div className="py-2 border-b border-slate-100 grid grid-cols-3 gap-2 text-sm">
      <div className="text-slate-500 font-medium">{label}</div>
      <div className="col-span-2 text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );
  return (
    <div>
      <button onClick={onBack} className="text-sm text-brand hover:underline mb-3">&larr; Terug</button>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {g.thema && <Badge className={THEMA_KLEUR[g.thema] || THEMA_KLEUR['Overig']}>{g.thema}</Badge>}
            {g.onderwijsinstelling && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{g.onderwijsinstelling}</Badge>}
            {p.start && p.duur ? <Badge className="bg-white text-slate-600 border-slate-200">{p.fase === 'nog niet gestart' ? 'start ' + CGT.datumDM(p.start) : p.fase === 'afgelopen' ? 'afgelopen' : p.week > p.duur ? `week ${p.week}, loopt tot ${CGT.datumDM(p.eindDatum)}` : `week ${p.week} van ${p.duur}`}</Badge> : null}
          </div>
          <h1 className="text-2xl font-light text-ink">{g.groepsnummer}</h1>
          {g.titel && <p className="text-slate-500">{g.titel}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm hover:bg-branddark">Bewerken</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50">Verwijderen</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* links: lades */}
        <div className="space-y-3 min-w-0 order-2 lg:order-1">
          <Lade titel="Planning" samenvatting={planSamenvatting} {...lade('planning')}>
            <GroepPlanning g={g} p={p} onUpdate={onUpdate} />
          </Lade>
          <Lade titel="Aantekeningen" samenvatting={aantSamenvatting} {...lade('aantekeningen')}>
            <GroepAantekeningen key={'aant-' + g.id} g={g} p={p} checklistState={checklistState} onZetChecklist={onZetChecklist} onUpdate={onUpdate} />
          </Lade>
          <Lade titel="Opvolging" samenvatting={openTaken.length ? openTaken.length + ' open' : 'niets open'} aandacht={openTaken.some(t => (t.herinnerOp || '') <= vandaag)} {...lade('opvolging')}>
            <GroepOpvolging g={g} setGroepen={setGroepen} onNieuw={setOpvolg} />
          </Lade>
          <Lade titel="Checklist begeleiding" samenvatting={cv.done + ' van ' + cv.total + ' klaar'} {...lade('checklist')}>
            <GroepChecklist key={g.id} g={g} p={p} state={checklistState} onZet={onZetChecklist} />
          </Lade>
          <Lade titel="Bijzonderheden opleiding" {...lade('bijzonderheden')}>
            <GroepBijzonderheden g={g} onUpdate={onUpdate} />
          </Lade>
          <Lade titel="Gegevens van de groep" samenvatting={[g.vorm, g.opleiding, g.docent].filter(Boolean).join(' · ')} {...lade('gegevens')}>
            <div>
              <Row label="Vorm traject" value={g.vorm} />
              <Row label="Opleiding / minor" value={g.opleiding} />
              <Row label="Contact Campus Gouda" value={g.contactCG} />
              <Row label="Docentbegeleider" value={g.docent} />
              <Row label="Mailadres docent" value={g.docentMail ? <a className="text-brand hover:underline" href={'mailto:'+g.docentMail}>{g.docentMail}</a> : ''} />
              <Row label="Wekelijkse afspraak" value={g.wekelijkseAfspraak} />
              <div className="py-2 grid grid-cols-3 gap-2 text-sm border-b border-slate-100">
                <div className="text-slate-500 font-medium">Gekoppeld traject</div>
                <div className="col-span-2">
                  {traject
                    ? <button onClick={() => onOpenTraject(traject.id)} className="text-brand hover:underline text-left">{traject.titel} →</button>
                    : <span className="text-slate-300">—</span>}
                </div>
              </div>
              {studenten.length > 0 && (
                <div className="pt-3">
                  <div className="text-sm text-slate-500 font-medium mb-1">Contactgegevens studenten</div>
                  <div className="space-y-1.5">
                    {studenten.map(st => (
                      <div key={st.id} className="text-sm flex flex-wrap gap-x-3">
                        <span className="font-medium text-ink">{st.naam || '—'}</span>
                        {st.woonplaats && <span className="text-slate-400 text-xs self-center">{st.woonplaats}</span>}
                        {st.mail && <a className="text-brand hover:underline text-xs self-center" href={'mailto:' + st.mail}>{st.mail}</a>}
                        {st.telefoon && <span className="text-xs text-slate-500 self-center">{st.telefoon}</span>}
                        {st.priveMail && <a className="text-brand hover:underline text-xs self-center" href={'mailto:' + st.priveMail}>{st.priveMail} (privé)</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Lade>
          <Lade titel="Afronding: evaluatie met de opdrachtgever" {...lade('evaluatie')}>
            <GroepEvaluatie g={g} p={p} onUpdate={onUpdate} />
          </Lade>
          <Lade titel="Welke gegevens heb ik?" {...lade('welkegegevens')}>
            <GroepGegevens g={g} />
          </Lade>
        </div>

        {/* rechts: altijd zichtbaar */}
        <aside className="space-y-4 min-w-0 order-1 lg:order-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink text-sm mb-2">Studenten ({studenten.length})</h3>
            {studenten.length === 0 ? <p className="text-sm text-slate-400">Nog geen studenten.</p> : (
              <ul className="space-y-1 mb-3">
                {studenten.map(st => (
                  <li key={st.id} className="text-sm flex items-center gap-2 min-w-0">
                    <span className="text-slate-800 truncate">{st.naam || '—'}</span>
                    {st.isContact && <Badge className="bg-brandlight text-branddark border-brand/30">contact</Badge>}
                    {!st.mail && <span className="text-[11px] text-amber-600" title="Geen mailadres bekend">geen mail</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <KopieerAdressenKnop groep={g} />
              <MailGroepKnop groep={g} onGemaild={sj => gemaild(g.id, sj)} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-ink text-sm mb-2">Nog niet gepland</h3>
            {nietGepland.length === 0
              ? <p className="text-sm text-slate-400">Alle momenten staan vast.</p>
              : <div className="space-y-1.5">
                  {nietGepland.map(x => (
                    <div key={x.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-700">{x.naam}</span>
                      <span className="text-xs text-slate-400">{x.datum ? 'indicatie ' + CGT.datumDM(x.datum) : 'geen datum'}</span>
                    </div>
                  ))}
                  <button type="button" onClick={() => openLade('planning')} className="text-xs text-brand font-medium hover:underline">Naar de planning →</button>
                </div>}
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <h3 className="font-semibold text-ink text-sm">Nog te doen</h3>
              <span className="text-xs text-slate-400">{sigs.length + openTaken.length || ''}</span>
            </div>
            {sigs.length === 0 && openTaken.length === 0 && <p className="px-4 pb-3 text-sm text-slate-400">Niets dringends. 👍</p>}
            {sigs.length > 0 && (
              <div className="divide-y divide-slate-100">
                {sigs.map(x => <SignaalRegel key={x.id} compact s={{ ...x, groep: g, looptAl: x.moment && CGT.takenVan(g).some(t => t.moment === x.moment && !CGT.taakKlaar(g, t, p.m).klaar) }}
                  onOpenGroep={() => {}} onLater={(gid, regel) => later(regel)} onGemaild={gemaild} onActie={(gid, a) => onUpdate(x => CGT.voerActieUit(x, a))} />)}
              </div>
            )}
            {openTaken.length > 0 && (
              <div className="border-t border-slate-100 px-3 py-2.5 space-y-1">
                <div className="text-xs font-semibold text-slate-500">Opvolgingen</div>
                {openTaken.slice(0, 5).map(t => (
                  <button key={t.id} type="button" onClick={() => openLade('opvolging')} className="w-full text-left text-sm flex gap-2 hover:text-brand">
                    <span className={'text-xs shrink-0 pt-0.5 ' + ((t.herinnerOp || '') <= vandaag ? 'text-amber-600 font-semibold' : 'text-slate-400')}>{t.herinnerOp ? CGT.datumDM(t.herinnerOp) : ''}</span>
                    <span className="min-w-0">{t.tekst}</span>
                  </button>
                ))}
                {openTaken.length > 5 && <button type="button" onClick={() => openLade('opvolging')} className="text-xs text-brand hover:underline">+ {openTaken.length - 5} meer</button>}
              </div>
            )}
          </div>

        </aside>
      </div>
      <Modal open={!!opvolg} onClose={() => setOpvolg(null)} title="Opvolging toevoegen">
        {opvolg && <OpvolgModal start={opvolg} groepen={[g]} onClose={() => setOpvolg(null)}
          onSave={(gid, taak) => { onUpdate(x => ({ ...x, taken: [...CGT.takenVan(x), taak] })); setOpvolg(null); }} />}
      </Modal>
    </div>
  );
}

function GroepLijstKolommen({ g, state }) {
  const vandaag = CGT.vandaagISO();
  const p = CGT.planning(g, vandaag);
  const sigs = CGT.signalen(g, state, vandaag).filter(x => !x.verborgen);
  const urgent = sigs.filter(x => x.niveau === 'urgent').length, plannen = sigs.filter(x => x.niveau === 'binnenkort').length;
  const opvolgen = CGT.takenVan(g).filter(t => !CGT.taakKlaar(g, t, p.m).klaar && (!t.herinnerOp || t.herinnerOp <= vandaag)).length;
  let volgende = null;
  CGT.MOMENTEN.forEach(mo => { const x = p.m[mo.id]; if (x.status === 'gepland' && x.datum >= vandaag && (!volgende || x.datum < volgende.datum)) volgende = { naam: mo.naam, datum: x.datum }; });
  return (<>
    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{p.start && p.duur ? (p.fase === 'nog niet gestart' ? 'start ' + CGT.datumDM(p.start) : p.fase === 'afgelopen' ? 'afgelopen' : p.week > p.duur ? `week ${p.week}, loopt tot ${CGT.datumDM(p.eindDatum)}` : `week ${p.week} van ${p.duur}`) : <span className="text-slate-300">—</span>}</td>
    <td className="px-3 py-2 text-xs whitespace-nowrap">{volgende ? <><span className="font-medium text-ink">{volgende.naam}</span> <span className="text-slate-500">{CGT.datumKort(volgende.datum)}</span></> : <span className="text-slate-300">niets gepland</span>}</td>
    <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
      {urgent > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">{urgent} urgent</span>}
      {plannen > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{plannen} plannen</span>}
      {opvolgen > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-regio border border-sky-200">{opvolgen} opvolgen</span>}
    </div></td>
  </>);
}

function StudentenGroepenTab({ groepen, setGroepen, trajecten, setTrajecten, contacten, checklist = {}, setChecklist, externalDetail, clearExternalDetail, onOpenTraject, terugNaarTaken }) {
  const [detailId, setDetailId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [zoek, setZoek] = useState('');
  const [fThema, setFThema] = useState('');
  const [fInst, setFInst] = useState('');
  const [fCG, setFCG] = useState('');
  const fileRef = React.useRef(null);
  // import-modal met tabbladkeuze
  const [impOpen, setImpOpen] = useState(false);
  const [impSheets, setImpSheets] = useState([]);
  const [impSheet, setImpSheet] = useState('');
  const [impParsed, setImpParsed] = useState(null);
  const [impChecklist, setImpChecklist] = useState(true);
  const impWbRef = React.useRef(null);
  const impChecklistTab = () => { const wb = impWbRef.current; if (!wb) return ''; return wb.SheetNames.find(n => CGT.isChecklistTabblad(window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }))) || ''; };

  useEffect(() => {
    if (externalDetail) { setDetailId(externalDetail); clearExternalDetail && clearExternalDetail(); }
  }, [externalDetail]);

  const instellingen = useMemo(() => [...new Set(groepen.map(g=>g.onderwijsinstelling).filter(Boolean))].sort(), [groepen]);
  const cgContacten = useMemo(() => [...new Set(groepen.map(g=>g.contactCG).filter(Boolean))].sort(), [groepen]);

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return groepen.filter(g => {
      if (fThema && g.thema !== fThema) return false;
      if (fInst && g.onderwijsinstelling !== fInst) return false;
      if (fCG && g.contactCG !== fCG) return false;
      if (q) {
        const blob = [g.groepsnummer,g.thema,g.titel,g.onderwijsinstelling,g.opleiding,g.contactCG,g.docent,
          ...(g.studenten||[]).map(s=>s.naam)].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [groepen, zoek, fThema, fInst, fCG]);

  const detail = groepen.find(g => g.id === detailId);

  function saveGroep(g) { setGroepen(prev => prev.some(x=>x.id===g.id) ? prev.map(x=>x.id===g.id?g:x) : [...prev, g]); setFormOpen(false); setEditing(null); setDetailId(g.id); }
  function delGroep(id) { if (!confirm('Deze studentengroep verwijderen?')) return; setGroepen(prev => prev.filter(g => g.id !== id)); setDetailId(null); }

  // parse één werkblad → studentengroepen (robuust voor wisselende lay-outs)
  function parseGroepenSheet(sheetNaam) {
    const wb = impWbRef.current; if (!wb) return [];
    const ws = wb.Sheets[sheetNaam];
    const matrix = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    if (!matrix.length) return [];
    // headerrij = eerste rij met 'naam'/'namen' (of anders met 'groep'); de "Groep"-kolom heeft vaak een lege kop
    let hdr = matrix.findIndex(r => r.some(c => /\bnaam|namen/.test(String(c).toLowerCase())));
    if (hdr < 0) hdr = matrix.findIndex(r => r.some(c => String(c).toLowerCase().includes('groep')));
    if (hdr < 0) hdr = 0;
    const heads = matrix[hdr].map(c => String(c).toLowerCase());
    const col = (...pats) => heads.findIndex(h => pats.some(p => h.includes(p)));
    let cGroep = col('groep'); if (cGroep < 0) cGroep = 0; // lege kop → eerste kolom
    const cTitel = col('onderwerp', 'titel', 'traject'), cVorm = col('vorm'),
          cInst = col('instelling', 'onderwijs', 'hogeschool'), cOpl = col('opleiding'),
          cMinor = heads.findIndex((h, i) => h.includes('minor') && i !== cOpl),
          cCG = col('campus gouda', 'contact campus', 'contact cg', 'cg'), cDoc = col('docent'),
          cDocMail = heads.findIndex(h => h.includes('mail') && h.includes('docent')),
          cWeek = col('wekelijk', 'afspraak'), cKick = col('kick'), cTussen = col('tussen'), cEind = col('eind'), cKennis = col('kennismaking'),
          cNaam = col('namen', 'naam', 'student'), cWoon = col('woonplaats'),
          cTel = col('telefoon', 'tel '), cPrive = col('prive', 'privé');
    const cMail = heads.findIndex((h, i) => h.includes('mail') && i !== cDocMail && !h.includes('docent'));
    const themaNamen = ['Zorg', 'Bodem', 'Logistiek'];
    const get = (row, idx) => idx >= 0 ? String(row[idx] == null ? '' : row[idx]).trim() : '';
    const opl = (row) => [get(row, cOpl), get(row, cMinor)].filter(Boolean).join(' / ');
    const themaFallback = THEMAS.find(t => sheetNaam.toLowerCase().includes(t.toLowerCase())) || '';
    const out = []; let huidig = null, huidigThema = themaFallback;
    const sem = CGT.parseSemester(sheetNaam);
    const ref = sem ? sem.ref : CGT.vandaagISO();
    const moment = (row, c) => c >= 0 ? CGT.parseNLDatum(row[c], ref) : { datum: '', tijd: '', status: 'open', notitie: '' };
    for (let i = hdr + 1; i < matrix.length; i++) {
      const row = matrix[i];
      const nonEmpty = row.map(c => String(c == null ? '' : c).trim()).filter(Boolean);
      if (nonEmpty.length === 0) continue;
      if (nonEmpty.length <= 1) { // thema-tussenkop
        const hit = themaNamen.find(t => t.toLowerCase() === nonEmpty[0].toLowerCase());
        if (hit) { huidigThema = hit; continue; }
      }
      const naam = get(row, cNaam);
      const student = naam ? { id: uid(), naam, woonplaats: get(row, cWoon), mail: get(row, cMail), telefoon: get(row, cTel), priveMail: get(row, cPrive), isContact: false } : null;
      const groepVal = get(row, cGroep);
      // alleen regels die op een groepsnummer lijken ("Groep 1.1", "1.4b"); samenvattingen onderaan overslaan
      if (groepVal && !/^(groep\s*)?\d/i.test(groepVal)) { huidig = null; continue; }
      if (groepVal) {
        const titel = get(row, cTitel);
        const tr = trajecten.find(t => t.titel && normaliseerOrg(t.titel) === normaliseerOrg(titel));
        huidig = {
          id: uid(), groepsnummer: groepVal, trajectId: tr ? tr.id : '',
          thema: huidigThema || (tr ? tr.thema : 'Zorg'), titel,
          vorm: get(row, cVorm), onderwijsinstelling: get(row, cInst), opleiding: opl(row),
          contactCG: get(row, cCG), docent: get(row, cDoc), docentMail: get(row, cDocMail),
          wekelijkseAfspraak: get(row, cWeek),
          kickoff: parseExcelDatum(row[cKick]), tussenpresentatie: parseExcelDatum(row[cTussen]), eindpresentatie: parseExcelDatum(row[cEind]),
          studenten: student ? [student] : [],
          momenten: { kennismaking: moment(row, cKennis), kickoff: moment(row, cKick), tussen: moment(row, cTussen), eind: moment(row, cEind) },
          duurWeken: CGT.parseDuur(get(row, cVorm)) || null,
        };
        if (student && student.telefoon) student.isContact = true;
        out.push(huidig);
      } else if (huidig) {
        // de duur staat vaak een regel lager in de kolom Traject ("20 weken")
        if (!huidig.duurWeken) huidig.duurWeken = CGT.parseDuur(get(row, cTitel)) || CGT.parseDuur(get(row, cVorm)) || null;
        if (student) {
          if (student.telefoon && !huidig.studenten.some(x => x.isContact)) student.isContact = true;
          huidig.studenten.push(student);
        }
      }
    }
    return out;
  }
  function handleImportExcel(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.XLSX) { alert('Excel-bibliotheek nog niet geladen, probeer het zo nog eens.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(ev.target.result, { type: 'binary' });
        impWbRef.current = wb;
        setImpSheets(wb.SheetNames);
        // standaard: tabblad met "sem 2" of anders het eerste met "groep" in de naam
        const metSem = wb.SheetNames.map(n => ({ n, s: CGT.parseSemester(n) })).filter(x => x.s).sort((a, b) => b.s.start.localeCompare(a.s.start));
        const def = (metSem[0] && metSem[0].n) || wb.SheetNames.find(n => /sem\s*2/i.test(n)) || wb.SheetNames.find(n => /groep/i.test(n)) || wb.SheetNames[0];
        setImpSheet(def);
        setImpParsed(parseGroepenSheet(def));
        setImpOpen(true);
      } catch (err) { alert('Kon het Excel-bestand niet inlezen: ' + err.message); }
    };
    reader.readAsBinaryString(file);
  }
  function kiesImpSheet(naam) { setImpSheet(naam); try { setImpParsed(parseGroepenSheet(naam)); } catch (e) { setImpParsed([]); } }
  function bevestigGroepImport(vervang, samenvoegen) {
    const g2 = impParsed || [];
    if (!g2.length) return;
    // groepen waarvan het traject (nog) niet bestaat → maak een GEARCHIVEERD traject en koppel
    const bestaand = new Map(trajecten.filter(t => t.titel).map(t => [normaliseerOrg(t.titel), t.id]));
    const nieuweTraj = [];
    g2.forEach(g => {
      if (g.trajectId) return;
      const titel = (g.titel || '').trim();
      if (!titel) return;
      const key = normaliseerOrg(titel);
      if (bestaand.has(key)) { g.trajectId = bestaand.get(key); return; }
      const nt = { ...leegTraject(), titel, thema: THEMAS.includes(g.thema) ? g.thema : 'Zorg', gearchiveerd: true, status: 'Afgerond' };
      bestaand.set(key, nt.id); nieuweTraj.push(nt); g.trajectId = nt.id;
    });
    if (nieuweTraj.length && setTrajecten) setTrajecten(prev => [...prev, ...nieuweTraj]);
    // samenvoegen: bestaande groepen (zelfde thema en nummer) bijwerken, taken en vinkjes blijven staan
    let doel = g2, bericht = '';
    if (samenvoegen) {
      const r = CGT.voegImportSamen(groepen, g2);
      doel = r.groepen.filter(g => [...r.koppel.values()].includes(g.id));
      setGroepen(r.groepen);
      bericht = `${r.bijgewerkt} groep(en) bijgewerkt, ${r.nieuw} nieuw.`;
    } else setGroepen(prev => vervang ? g2 : [...prev, ...g2]);
    // vinkjes uit het tabblad "Checklist projectleiders": alleen lege punten aanvullen
    const tab = impChecklistTab();
    if (impChecklist && tab && setChecklist) {
      const kolommen = CGT.parseChecklistTabblad(window.XLSX.utils.sheet_to_json(impWbRef.current.Sheets[tab], { header: 1, defval: '', raw: true }));
      let n = 0;
      const extra = {};
      kolommen.forEach(k => { const g = CGT.vindGroepVoorKolom(doel, k); if (g) { extra[g.id] = k.waarden; n++; } });
      setChecklist(prev => {
        const uit = { ...prev };
        Object.entries(extra).forEach(([gid, w]) => { uit[gid] = { ...w, ...(uit[gid] || {}) }; });
        return uit;
      });
      bericht += `\nVinkjes uit "${tab}" overgenomen voor ${n} groep(en).`;
    }
    const studn = g2.reduce((n, g) => n + g.studenten.length, 0);
    setImpOpen(false); setImpParsed(null); impWbRef.current = null;
    alert(`${g2.length} groep(en) ingelezen (${studn} studenten). ${bericht}` + (nieuweTraj.length ? `\n${nieuweTraj.length} ontbrekend(e) traject(en) als 'gearchiveerd' toegevoegd en gekoppeld.` : ''));
  }

  const trajTitel = (g) => (trajecten.find(t => t.id === g.trajectId) || {}).titel || g.titel || '';
  const datumStempel = () => new Date().toISOString().slice(0, 10);

  // Schone Power BI-export: één rij per student, groepsgegevens herhaald, aparte Thema-kolom
  function exportExcelSchoon() {
    if (!window.XLSX) { alert('Excel-bibliotheek nog niet geladen.'); return; }
    if (!groepen.length) { alert('Geen studentengroepen om te exporteren.'); return; }
    const headers = ['Thema','Groep','Traject','Vorm traject','Namen','Woonplaats','Mailadressen',
      'Telefoonnummer contactpersoon','Privé mailadressen (op basis van vrijwilligheid)','Onderwijsinstelling',
      'Opleiding / minor','Contact Campus Gouda','Docentbegeleider','Mailadres docent','Wekelijkse afspraak',
      'Kick-off','Tussenpresentatie','Eindpresentatie'];
    const rows = [headers];
    groepen.forEach(g => {
      const tr = trajTitel(g);
      const studs = (g.studenten && g.studenten.length) ? g.studenten : [null];
      studs.forEach(s => {
        rows.push([
          g.thema || '', g.groepsnummer || '', tr, g.vorm || '',
          s ? s.naam : '', s ? s.woonplaats : '', s ? s.mail : '', s ? s.telefoon : '', s ? s.priveMail : '',
          g.onderwijsinstelling || '', g.opleiding || '', g.contactCG || '', g.docent || '', g.docentMail || '',
          g.wekelijkseAfspraak || '', g.kickoff || '', g.tussenpresentatie || '', g.eindpresentatie || '',
        ]);
      });
    });
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Studentengroepen');
    window.XLSX.writeFile(wb, `Studentengroepen_export_${datumStempel()}.xlsx`);
  }

  // Exacte-spiegel-export: originele lay-out (groepsgegevens alleen op eerste rij, thema's als tussenkopjes)
  function exportExcelSpiegel() {
    if (!window.XLSX) { alert('Excel-bibliotheek nog niet geladen.'); return; }
    if (!groepen.length) { alert('Geen studentengroepen om te exporteren.'); return; }
    const headers = ['Groep','Traject','Vorm traject','Namen','Woonplaats','Mailadressen',
      'Telefoonnummer contactpersoon','Privé mailadressen (op basis van vrijwilligheid)','Onderwijsinstelling',
      'Opleiding / minor','Contact Campus Gouda','Docentbegeleider','Mailadres docent','Wekelijkse afspraak',
      'Kick-off','Tussenpresentatie','Eindpresentatie'];
    const rows = [headers];
    const byThema = {};
    groepen.forEach(g => { const th = g.thema || 'Overig'; (byThema[th] = byThema[th] || []).push(g); });
    const themas = [...new Set([...THEMAS, 'Overig', ...Object.keys(byThema)])].filter(th => byThema[th]);
    themas.forEach(th => {
      rows.push([th]); // tussenkopje per thema
      byThema[th].forEach(g => {
        const tr = trajTitel(g);
        const studs = (g.studenten && g.studenten.length) ? g.studenten : [null];
        studs.forEach((s, i) => {
          const first = i === 0;
          rows.push([
            first ? (g.groepsnummer || '') : '', first ? tr : '', first ? (g.vorm || '') : '',
            s ? s.naam : '', s ? s.woonplaats : '', s ? s.mail : '', s ? s.telefoon : '', s ? s.priveMail : '',
            first ? (g.onderwijsinstelling || '') : '', first ? (g.opleiding || '') : '', first ? (g.contactCG || '') : '',
            first ? (g.docent || '') : '', first ? (g.docentMail || '') : '', first ? (g.wekelijkseAfspraak || '') : '',
            first ? (g.kickoff || '') : '', first ? (g.tussenpresentatie || '') : '', first ? (g.eindpresentatie || '') : '',
          ]);
        });
      });
    });
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Studentengroepen');
    window.XLSX.writeFile(wb, `Studentengroepen_export_spiegel_${datumStempel()}.xlsx`);
  }

  if (detail) {
    return (
      <div>
        <GroepDetail groep={detail} trajecten={trajecten}
          checklistState={checklist[detail.id] || {}}
          onZetChecklist={(key, waarde) => setChecklist && setChecklist(prev => {
            const cur = { ...(prev[detail.id] || {}) };
            if (waarde === undefined) delete cur[key]; else cur[key] = waarde;
            return { ...prev, [detail.id]: cur };
          })}
          onUpdate={(fn) => setGroepen(prev => prev.map(x => x.id === detail.id ? fn(x) : x))}
          setGroepen={setGroepen}
          onBack={() => { setDetailId(null); if (terugNaarTaken) terugNaarTaken(); }}
          onEdit={() => { setEditing(detail); setFormOpen(true); }}
          onDelete={() => delGroep(detail.id)}
          onOpenTraject={onOpenTraject} />
        <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title="Studentengroep bewerken" wide>
          <GroepForm initial={editing || leegGroep()} trajecten={trajecten} contacten={contacten} groepen={groepen} onSave={saveGroep} onCancel={() => { setFormOpen(false); setEditing(null); }} />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={zoek} onChange={e=>setZoek(e.target.value)} placeholder="Zoek groepen of studenten…"
          className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button onClick={() => fileRef.current && fileRef.current.click()} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Excel-import</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
        <button onClick={exportExcelSchoon} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50" title="Schone tabel voor Power BI: één rij per student, Thema-kolom">Exporteer naar Excel</button>
        <button onClick={exportExcelSpiegel} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-500 hover:bg-slate-50" title="Originele lay-out: groepsgegevens op eerste rij, thema's als tussenkopjes">Originele lay-out</button>
        <button onClick={() => { setEditing(leegGroep()); setFormOpen(true); }} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">+ Nieuwe groep</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={fThema} onChange={e=>setFThema(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle thema's</option>{THEMAS.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fInst} onChange={e=>setFInst(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle onderwijsinstellingen</option>{instellingen.map(x=><option key={x}>{x}</option>)}
        </select>
        <select value={fCG} onChange={e=>setFCG(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">Alle CG-contacten</option>{cgContacten.map(x=><option key={x}>{x}</option>)}
        </select>
        <button onClick={() => { setZoek(''); setFThema(''); setFInst(''); setFCG(''); }} className="text-sm text-slate-500 hover:text-slate-700 underline">Wissen</button>
        <span className="text-sm text-slate-400 ml-auto">{filtered.length} van {groepen.length}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Groep</th>
              <th className="px-3 py-2 font-semibold">Thema</th>
              <th className="px-3 py-2 font-semibold">Onderwijsinstelling</th>
              <th className="px-3 py-2 font-semibold">Onderwerp</th>
              <th className="px-3 py-2 font-semibold">Contact CG</th>
              <th className="px-3 py-2 font-semibold">Voortgang</th>
              <th className="px-3 py-2 font-semibold">Volgende moment</th>
              <th className="px-3 py-2 font-semibold">Aandacht</th>
              <th className="px-3 py-2 font-semibold text-right">Studenten</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} onClick={() => setDetailId(g.id)} className="border-t border-slate-100 hover:bg-brandlight/40 cursor-pointer">
                <td className="px-3 py-2 font-medium text-ink">{g.groepsnummer}</td>
                <td className="px-3 py-2">{g.thema ? <Badge className={THEMA_KLEUR[g.thema]||THEMA_KLEUR['Overig']}>{g.thema}</Badge> : '—'}</td>
                <td className="px-3 py-2 text-slate-600">{g.onderwijsinstelling || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{g.titel || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{g.contactCG || '—'}</td>
                <GroepLijstKolommen g={g} state={checklist[g.id]} />
                <td className="px-3 py-2 text-right text-slate-600">{(g.studenten||[]).length}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-400">Geen groepen. Voeg er een toe of importeer het Excel-bestand.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing && groepen.some(g=>g.id===editing.id) ? 'Studentengroep bewerken' : 'Nieuwe studentengroep'} wide>
        <GroepForm initial={editing || leegGroep()} trajecten={trajecten} contacten={contacten} groepen={groepen} onSave={saveGroep} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      </Modal>

      <Modal open={impOpen} onClose={() => { setImpOpen(false); setImpParsed(null); impWbRef.current = null; }} title="Studentengroepen importeren">
        <div className="space-y-4">
          <Field label="Welk tabblad importeren?">
            <select className={inputCls} value={impSheet} onChange={e => kiesImpSheet(e.target.value)}>
              {impSheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="bg-brandlight/50 border border-brand/20 rounded-lg p-3 text-sm">
            <strong>{(impParsed || []).length} groep(en)</strong> herkend{impParsed ? ` · ${impParsed.reduce((n,g)=>n+g.studenten.length,0)} studenten` : ''}.
            {(impParsed || []).length > 0 && (
              <div className="mt-2 max-h-44 overflow-y-auto space-y-0.5">
                {impParsed.map((g,i) => (
                  <div key={i} className="text-xs text-slate-600 flex items-center gap-2">
                    <Badge className={THEMA_KLEUR[g.thema] || THEMA_KLEUR['Overig']}>{g.thema}</Badge>
                    <span className="font-medium">{g.groepsnummer}</span>
                    <span className="flex-1 truncate">{g.titel}</span>
                    <span className="text-slate-400">{g.studenten.length} st.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(impParsed || []).length > 0 && (() => {
            const metDatum = impParsed.filter(g => g.momenten && Object.values(g.momenten).some(m => m.status === 'gepland')).length;
            const metDuur = impParsed.filter(g => g.duurWeken).length;
            return <p className="text-xs text-slate-600">Planning herkend: {metDatum} groepen met een vaste datum, {metDuur} met een duur. Wat niet als datum te lezen is, komt bij de notitie van het moment.</p>;
          })()}
          {impChecklistTab() && (
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-brand" checked={impChecklist} onChange={e => setImpChecklist(e.target.checked)} />
              Ook de vinkjes uit “{impChecklistTab()}” overnemen (alleen punten die hier nog leeg zijn)</label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => { setImpOpen(false); setImpParsed(null); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
            <button onClick={() => bevestigGroepImport(false, true)} disabled={!(impParsed||[]).length} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40" title="Bestaande groepen met hetzelfde thema en nummer bijwerken; taken, opvolging en vinkjes blijven staan">Bijwerken en aanvullen</button>
            <button onClick={() => bevestigGroepImport(false)} disabled={!(impParsed||[]).length} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-40">Toevoegen aan bestaande</button>
            <button onClick={() => { if (confirm('Alle huidige groepen vervangen door de import?')) bevestigGroepImport(true); }} disabled={!(impParsed||[]).length} className="px-4 py-2 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50 disabled:opacity-40">Vervang alle groepen</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   BESTANDSSYNCHRONISATIE (File System Access API + SharePoint/OneDrive)
   localStorage blijft offline cache; crm-data.json is leidend.
   ============================================================ */
const FSA_SUPPORTED = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const MAP_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// --- IndexedDB om de (niet-serialiseerbare) FileSystemFileHandle te bewaren ---
const IDB_DB = 'cgt_crm_fs', IDB_STORE = 'handles', IDB_KEY = 'dataFileHandle', IDB_FB_KEY = 'feedbackFileHandle';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

// --- Bundel-helpers (zelfde formaat als exportData) ---
// veilige defaults zodat een onvolledig bestand niet crasht
function coreFromData(d) {
  d = d || {};
  return {
    trajecten: Array.isArray(d.trajecten) ? d.trajecten : [],
    contacten: Array.isArray(d.contacten) ? d.contacten : [],
    uren: Array.isArray(d.uren) ? d.uren : [],
    targets: (d.targets && typeof d.targets === 'object') ? d.targets : {},
    groepen: Array.isArray(d.groepen) ? d.groepen : [],
    checklist: (d.checklist && typeof d.checklist === 'object') ? d.checklist : {},
    team: Array.isArray(d.team) ? d.team : [],
    feedback: Array.isArray(d.feedback) ? d.feedback : [],
  };
}
// stabiele string van de datasets (zónder vluchtige exportedAt) voor wijzigingsdetectie
// feedback zit NIET in de hoofdbundel — die heeft een eigen koppelbaar bestand
function coreString(c) {
  return JSON.stringify([c.trajecten, c.contacten, c.uren, c.targets, c.groepen, c.checklist, c.team || []]);
}
function buildPayload(c) {
  return { app: 'Campus Gouda CRM', version: 4, exportedAt: new Date().toISOString(),
    trajecten: c.trajecten, contacten: c.contacten, uren: c.uren, targets: c.targets, groepen: c.groepen, checklist: c.checklist, team: c.team || [] };
}
// --- los feedbackbestand (crm-feedback.json) ---
function feedbackUitData(d) { return (d && Array.isArray(d.feedback)) ? d.feedback : (Array.isArray(d) ? d : []); }
function mergeFeedback(a, b) {
  const m = new Map();
  [...(a || []), ...(b || [])].forEach(f => { if (f && f.id) m.set(f.id, f); });
  return [...m.values()].sort((x, y) => String(x.datum).localeCompare(String(y.datum)));
}
// Veiligheid: alleen een leeg bestand of een feedbackbestand is goed — nooit crm-data.json of een wijzigingenbestand
function geenFeedbackBestandFout() {
  const e = new Error('Dit is niet het feedbackbestand. Kies crm-feedback.json, of koppel alleen de gedeelde map via ⚙ Opslag: dan gebruikt de app crm-feedback.json in die map vanzelf.');
  e.name = 'GeenFeedbackBestand';
  return e;
}
function isFeedbackInhoud(text) {
  if (!text.trim()) return true;
  let d; try { d = JSON.parse(text); } catch (e) { return false; }
  return Array.isArray(d) || (d && typeof d === 'object' && Array.isArray(d.feedback));
}
async function leesFeedbackBestand(handle) {
  if (/^crm-data/i.test(handle.name || '')) throw geenFeedbackBestandFout();
  const file = await handle.getFile();
  const text = await file.text();
  if (!isFeedbackInhoud(text)) throw geenFeedbackBestandFout();
  return { lijst: text.trim() ? feedbackUitData(JSON.parse(text)) : [], lastModified: file.lastModified };
}
async function schrijfFeedbackBestand(handle, lijst) {
  if (/^crm-data/i.test(handle.name || '') || !isFeedbackInhoud(await (await handle.getFile()).text())) throw geenFeedbackBestandFout();
  const w = await handle.createWritable();
  await w.write(JSON.stringify({ app: 'Campus Gouda CRM feedback', exportedAt: new Date().toISOString(), feedback: lijst }, null, 2));
  await w.close();
  return (await handle.getFile()).lastModified;
}
async function fsaReadBundle(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return { data: null, lastModified: file.lastModified }; // leeg bestand
  return { data: JSON.parse(text), lastModified: file.lastModified };
}
async function fsaWriteBundle(handle, payload) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
  const file = await handle.getFile();
  return file.lastModified;
}

// foutmelding bij koppelen: wat de gebruiker kan controleren, plus de technische melding
function koppelFoutTekst(e) {
  const tech = e ? (e.name + ': ' + e.message) : 'onbekende fout';
  if (e && e.name === 'GeenFeedbackBestand') return e.message;
  if (e && /InvalidModification|NoModificationAllowed|NotReadable|InvalidState/.test(e.name)) {
    return 'Koppelen mislukt: de app kon niet in de map schrijven.\n\nControleer:\n' +
      '• Heb je de MAP gekozen, niet een bestand erin?\n' +
      '• Staat de map echt op je computer? Klik er in de Finder of Verkenner met de rechtermuisknop op en kies "Altijd op dit apparaat bewaren".\n' +
      '• Draait OneDrive (wolkje met groen vinkje)?\n\nTechnisch: ' + tech;
  }
  return 'Koppelen mislukt: ' + tech;
}

// Team en rollen beheren (staat in de gedeelde gegevens, dus iedereen ziet hetzelfde team)
function NamenGelijktrekken({ team, gegevens, onToepassen }) {
  const teamNamen = (team || []).map(p => String(p.naam || '').trim()).filter(Boolean);
  const [rijen, setRijen] = useState(null); // [{ naam, aantal, naar }]
  const zoek = () => {
    const tel = namenInGegevens(gegevens);
    setRijen([...tel].filter(([n]) => !teamNamen.includes(n))
      .map(([naam, aantal]) => ({ naam, aantal, naar: teamNaamVoor(naam, teamNamen) }))
      .sort((a, b) => (b.naar ? 1 : 0) - (a.naar ? 1 : 0) || a.naam.localeCompare(b.naam, 'nl')));
  };
  const tabel = Object.fromEntries((rijen || []).filter(r => r.naar).map(r => [r.naam, r.naar]));
  const aantalTeVervangen = (rijen || []).filter(r => r.naar).reduce((t, r) => t + r.aantal, 0);
  if (!teamNamen.length) return null;
  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="text-sm font-semibold text-ink">Namen gelijktrekken</div>
      <p className="text-xs text-slate-500">Zoekt in trajecten, groepen, contacten, gesprekken en uren naar andere schrijfwijzen van teamnamen, bijvoorbeeld een kleine letter of een achternaam erbij, en zet ze om naar de naam uit het team.</p>
      {!rijen && <button type="button" onClick={zoek} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Zoek andere schrijfwijzen</button>}
      {rijen && rijen.length === 0 && <p className="text-sm text-brand">✓ Alle namen in de gegevens zijn al gelijk aan het team.</p>}
      {rijen && rijen.length > 0 && (
        <>
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            {rijen.map(r => (
              <div key={r.naam} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                <span className="flex-1 min-w-[120px] text-slate-700">{r.naam} <span className="text-xs text-slate-400">({r.aantal}×)</span></span>
                <span className="text-slate-400">→</span>
                <select value={r.naar} onChange={e => setRijen(prev => prev.map(x => x.naam === r.naam ? { ...x, naar: e.target.value } : x))}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm" aria-label={'Teamnaam voor ' + r.naam}>
                  <option value="">laten staan</option>
                  {teamNamen.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!aantalTeVervangen} onClick={() => { const n = onToepassen(tabel); alert(n + ' plek(ken) aangepast. De namen zijn nu overal gelijk aan het team.'); setRijen(null); }}
              className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Toepassen ({aantalTeVervangen})</button>
            <span className="text-xs text-slate-400">Namen van buiten het team (bijv. oud-collega's) kun je laten staan.</span>
          </div>
        </>
      )}
    </div>
  );
}

function TeamBeheer({ team, onSave, onCancel, gegevens, onGelijktrekken }) {
  const [rijen, setRijen] = useState(() => sorteerTeam(team).map(p => ({ ...p })));
  const zet = (id, k, v) => setRijen(prev => prev.map(r => r.id === id ? { ...r, [k]: v } : r));
  const voegToe = () => setRijen(prev => [...prev, { id: uid(), naam: '', rol: '' }]);
  const weg = (id) => setRijen(prev => prev.filter(r => r.id !== id));
  const opslaan = () => onSave(sorteerTeam(rijen.map(r => ({ ...r, naam: String(r.naam || '').trim(), rol: String(r.rol || '').trim() })).filter(r => r.naam)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Wie werkt er bij Campus Gouda, en in welke rol? Deze namen komen in de keuzelijsten: senior, junior, contact Campus Gouda en "jouw naam". Het team staat in de gedeelde map, dus iedereen ziet hetzelfde.</p>
      {rijen.length === 0 && <p className="text-sm text-slate-400 italic">Nog niemand ingevuld. Klik op "+ Persoon toevoegen".</p>}
      <div className="space-y-2">
        {rijen.map(r => (
          <div key={r.id} className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[140px]"><input className={inputCls} value={r.naam} onChange={e => zet(r.id, 'naam', e.target.value)} placeholder="Naam" aria-label="Naam" /></div>
            <div className="flex-1 min-w-[190px]"><input className={inputCls} list="cg-team-rollen" value={r.rol} onChange={e => zet(r.id, 'rol', e.target.value)} placeholder="Rol (kies of typ)" aria-label="Rol" /></div>
            <button type="button" onClick={() => weg(r.id)} className="px-2 py-1 text-slate-400 hover:text-red-600" title="Verwijderen" aria-label={'Verwijder ' + (r.naam || 'persoon')}>✕</button>
          </div>
        ))}
      </div>
      <datalist id="cg-team-rollen">{TEAM_ROLLEN.map(x => <option key={x} value={x} />)}</datalist>
      <button type="button" onClick={voegToe} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">+ Persoon toevoegen</button>
      {gegevens && onGelijktrekken && <NamenGelijktrekken team={team} gegevens={gegevens} onToepassen={onGelijktrekken} />}
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Annuleren</button>
        <button type="button" onClick={opslaan} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark">Opslaan</button>
      </div>
    </div>
  );
}

// Feedback-paneel (in een modal) — opmerking achterlaten + verzamelde opmerkingen
function FeedbackBody({ feedback, status, onAdd, onDelete, onExport, onKoppel, onNieuw, onHeractiveer }) {
  const [naam, setNaam] = useState('');
  const [tekst, setTekst] = useState('');
  const sorted = [...feedback].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const verstuur = () => { if (!tekst.trim()) return; onAdd(naam, tekst); setTekst(''); };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input className={inputCls} value={naam} onChange={e => setNaam(e.target.value)} placeholder="Je naam (optioneel)" />
        <textarea className={inputCls + ' h-24'} value={tekst} onChange={e => setTekst(e.target.value)} placeholder="Je opmerking, idee of verbeterpunt…" />
        <div className="flex justify-end">
          <button onClick={verstuur} disabled={!tekst.trim()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-branddark disabled:opacity-40">Opmerking versturen</button>
        </div>
      </div>

      {/* status van het gedeelde feedbackbestand */}
      <div className="text-xs rounded-lg border p-2 flex flex-wrap items-center gap-2 justify-between"
        style={{ borderColor: status === 'verbonden' ? '#CAE5E0' : '#fde68a', background: status === 'verbonden' ? 'rgba(202,229,224,0.3)' : '#fffbeb' }}>
        <span className={status === 'verbonden' ? 'text-branddark' : 'text-amber-800'}>
          {status === 'unsupported' ? 'Gebruik Edge/Chrome om een gedeeld feedbackbestand te koppelen.'
            : status === 'verbonden' ? '● Gekoppeld aan crm-feedback.json — opmerkingen verzamelen automatisch van alle collega’s.'
            : status === 'prompt' ? 'Toegang tot het feedbackbestand moet opnieuw worden bevestigd.'
            : 'Nog niet gekoppeld — opmerkingen staan alleen lokaal. Koppel de gedeelde map via ⚙ Opslag: dan komen ze vanzelf in crm-feedback.json in die map.'}
        </span>
        {status !== 'unsupported' && (
          <span className="flex gap-2">
            {status === 'prompt' && <button onClick={onHeractiveer} className="px-2 py-1 rounded border border-amber-300 hover:bg-amber-100">Heractiveren</button>}
            <button onClick={onKoppel} className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Koppelen…</button>
            <button onClick={onNieuw} className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Nieuw aanmaken…</button>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-semibold text-slate-600">Verzamelde opmerkingen ({feedback.length})</span>
        {feedback.length > 0 && <button onClick={onExport} className="text-sm text-brand hover:underline">Exporteer als .txt</button>}
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {sorted.map(f => (
          <div key={f.id} className="border border-slate-200 rounded-lg p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{f.naam || 'Anoniem'}</span>
              <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{f.datum}</span>
                <button onClick={() => onDelete(f.id)} className="text-xs text-slate-400 hover:text-rose-600">verwijderen</button></span>
            </div>
            <p className="text-slate-600 whitespace-pre-wrap mt-0.5">{f.tekst}</p>
          </div>
        ))}
        {feedback.length === 0 && <p className="text-sm text-slate-300">Nog geen opmerkingen.</p>}
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
function App() {
  const [tab, setTab] = useState('taken');
  const [trajecten, setTrajecten] = useState(() => {
    const stored = loadLS(LS_TRAJ, null);
    return stored || seedTrajecten();
  });
  const [contacten, setContacten] = useState(() => {
    const stored = loadLS(LS_CONT, null);
    return stored || [];
  });
  const [uren, setUren] = useState(() => loadLS(LS_UREN, []) || []);
  // de urenverantwoording toont handmatige regels én regels uit gesprekken; alleen de handmatige worden opgeslagen
  const urenGesprek = useMemo(() => urenUitGesprekken(contacten), [contacten]);
  const urenAlles = useMemo(() => [...uren, ...urenGesprek], [uren, urenGesprek]);
  const setUrenHandmatig = (upd) => setUren(prev => {
    const vol = typeof upd === 'function' ? upd([...prev, ...urenGesprek]) : upd;
    return (vol || []).filter(r => r.bron !== 'gesprek');
  });
  const [targets, setTargets] = useState(() => loadLS(LS_TARGETS, {}) || {});
  const [groepen, setGroepen] = useState(() => loadLS(LS_GROEPEN, []) || []);
  const [checklist, setChecklist] = useState(() => loadLS(LS_CHECKLIST, {}) || {});
  const [team, setTeam] = useState(() => loadLS(LS_TEAM, []) || []);
  vulTeamNamen(team);
  vulTeamLijsten(trajecten, team);
  const [teamOpen, setTeamOpen] = useState(false);
  const [feedback, setFeedback] = useState(() => loadLS(LS_FEEDBACK, []) || []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(FSA_SUPPORTED ? 'niet-gekoppeld' : 'unsupported'); // niet-gekoppeld | verbonden | prompt | unsupported
  const feedbackHandleRef = React.useRef(null);
  const feedbackMtimeRef = React.useRef(0);
  const feedbackStatusRef = React.useRef('niet-gekoppeld');
  feedbackStatusRef.current = feedbackStatus;
  const [openContactId, setOpenContactId] = useState(null);
  const [pendingTrajectId, setPendingTrajectId] = useState(null);
  const [pendingUrenOrg, setPendingUrenOrg] = useState(null);
  const [pendingNewContact, setPendingNewContact] = useState(null);
  const [pendingGroepId, setPendingGroepId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = React.useRef(null);
  // --- samenwerken via een gedeelde map (SharePoint/OneDrive) ---
  // In de map: crm-data.json (basis) + crm-wijzigingen/<naam>.json (per persoon, alleen die persoon schrijft erin).
  const [syncStatus, setSyncStatus] = useState(TEST_MAP || MAP_SUPPORTED ? 'niet-gekoppeld' : 'unsupported'); // niet-gekoppeld | verbonden | prompt | unsupported
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [savingState, setSavingState] = useState('idle'); // idle | saving | saved
  const [collegas, setCollegas] = useState([]);
  const [mapNaam, setMapNaam] = useState('');
  const conflict = false; // komt niet meer voor: iedereen schrijft in een eigen bestand
  const syncRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const schrijfTimer = React.useRef(null);
  const liveCoreRef = React.useRef(null);
  liveCoreRef.current = { trajecten, contacten, uren, targets, groepen, checklist, team, feedback };
  const nowHHMM = () => new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  // seed contacten op basis van trajecten bij eerste run
  useEffect(() => {
    if (loadLS(LS_CONT, null) === null && contacten.length === 0) {
      setContacten(seedContacten(trajecten));
    }
  }, []);

  // localStorage blijft als offline cache/fallback gevuld worden
  useEffect(() => saveLS(LS_TRAJ, trajecten), [trajecten]);
  useEffect(() => saveLS(LS_CONT, contacten), [contacten]);
  useEffect(() => saveLS(LS_UREN, uren), [uren]);
  useEffect(() => saveLS(LS_TARGETS, targets), [targets]);
  useEffect(() => saveLS(LS_GROEPEN, groepen), [groepen]);
  useEffect(() => saveLS(LS_CHECKLIST, checklist), [checklist]);
  useEffect(() => saveLS(LS_TEAM, team), [team]);
  // "Jouw naam" in dezelfde schrijfwijze als in het team
  useEffect(() => {
    const mijn = loadLS(LS_MIJNNAAM, '');
    const goed = teamNaamVoor(mijn, TEAM_NAMEN);
    if (mijn && goed && goed !== mijn && normNaam(goed) === normNaam(mijn)) saveLS(LS_MIJNNAAM, goed);
  }, [team]);
  useEffect(() => saveLS(LS_FEEDBACK, feedback), [feedback]);

  function applyBundle(data) {
    const c = coreFromData(data);
    setTrajecten(c.trajecten); setContacten(c.contacten); setUren(c.uren);
    setTargets(c.targets); setGroepen(c.groepen); setChecklist(c.checklist); setTeam(c.team);
  }
  function wieBenIk() {
    let id = loadLS('cgt_gebruikerid', '');
    if (!id) { id = uid(); saveLS('cgt_gebruikerid', id); }
    if (TEST_GEBRUIKER && !loadLS(LS_MIJNNAAM, '')) saveLS(LS_MIJNNAAM, TEST_GEBRUIKER);
    let naam = TEST_GEBRUIKER || loadLS(LS_MIJNNAAM, '');
    if (!naam) {
      const antwoord = ((window.prompt('Wat is je naam? Collega\'s zien dan wie wat heeft gewijzigd.' + (TEAM_NAMEN.length ? '\n(Zoals in het team: ' + TEAM_NAMEN.join(', ') + ')' : '')) || '').trim());
      naam = teamNaamVoor(antwoord, TEAM_NAMEN) || antwoord || 'Collega';
      saveLS(LS_MIJNNAAM, naam);
    }
    return { id: TEST_GEBRUIKER ? 'test-' + CGSYNC.veiligeNaam(TEST_GEBRUIKER).toLowerCase() : id, naam };
  }
  function downloadBackup(kern, naam) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(buildPayload(kern), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // verbinden met een gedeelde map
  const syncMapRef = React.useRef('');
  function bewaarSyncStand() {
    const sy = syncRef.current;
    if (sy && sy.s && sy.s.laatsteKern) saveLS(LS_SYNC_STAND, { map: syncMapRef.current, kern: sy.s.laatsteKern });
  }
  async function verbind(adapter, naamMap, eersteKeer) {
    const sync = CGSYNC.maakSync(adapter, wieBenIk());
    let kern = await sync.start();
    const lokaal = CGSYNC.kernUit(liveCoreRef.current);
    const isLeeg = k => !k.groepen.length && !k.trajecten.length && !k.contacten.length && !k.uren.length;
    if (isLeeg(kern) && !sync.collegas().length && !isLeeg(lokaal)) {
      // nieuwe, lege map: de gegevens uit deze browser worden de start
      if (!TEST_MAP && !confirm(`De map "${naamMap}" is nog leeg. Wil je de gegevens uit deze browser als start gebruiken? Collega's koppelen daarna dezelfde map.`)) return false;
      await adapter.schrijfBasis(JSON.stringify(buildPayload(lokaal), null, 2));
      kern = await sync.start();
    } else if (eersteKeer && !isLeeg(lokaal) && JSON.stringify(lokaal) !== JSON.stringify(kern) && !TEST_MAP) {
      if (!confirm('In deze browser staan gegevens die anders zijn dan in de gedeelde map. De gedeelde map is leidend.\n\nVoor de zekerheid wordt eerst een back-up van de gegevens in deze browser gedownload. Doorgaan?')) return false;
      downloadBackup(lokaal, `crm-backup-browser-${new Date().toISOString().slice(0, 10)}.json`);
    }
    // Wijzigingen die in deze browser zijn gedaan terwijl de map niet gekoppeld was (bijv. na een update of
    // herstart, vóór "Toegang heractiveren"), gaan niet verloren: ze worden alsnog als eigen wijziging gedeeld.
    const vorige = loadLS(LS_SYNC_STAND, null);
    const leegDeel = v => Array.isArray(v) ? v.length === 0 : !v || Object.keys(v).length === 0;
    const samen = JSON.parse(JSON.stringify(CGSYNC.kernUit(kern)));
    let tussendoor = 0;
    if (vorige && vorige.kern && vorige.map === naamMap) {
      const ops = CGSYNC.verschil(CGSYNC.kernUit(vorige.kern), lokaal);
      ops.forEach(o => CGSYNC.pasToe(samen, o));
      tussendoor = ops.length;
    } else {
      // eerste keer deze map: wat in de map nog leeg is (bijv. het team), overnemen uit deze browser
      CGSYNC.KERN.forEach(k => { if (leegDeel(samen[k]) && !leegDeel(lokaal[k])) { samen[k] = JSON.parse(JSON.stringify(lokaal[k])); tussendoor++; } });
    }
    if (tussendoor && sync.registreer(samen)) {
      kern = sync.s.laatsteKern;
      try { await sync.schrijf(); } catch (e) { console.warn('Wegschrijven van tussendoor gemaakte wijzigingen mislukt; volgende keer opnieuw.', e); }
    }
    syncMapRef.current = naamMap;
    syncRef.current = sync;
    applyBundle(kern);
    bewaarSyncStand();
    setMapNaam(naamMap); setCollegas(sync.collegas());
    setSyncStatus('verbonden'); setLastSyncTime(nowHHMM());
    return true;
  }

  // opstart: eerder gekoppelde map opnieuw gebruiken
  useEffect(() => {
    (async () => {
      if (TEST_MAP) { try { await verbind(CGSYNC.httpAdapter(TEST_MAP), 'testmap', true); } catch (e) { console.error(e); } return; }
      if (!MAP_SUPPORTED) return;
      try {
        const map = await idbGet(IDB_KEY);
        if (!map || map.kind !== 'directory') { setSyncStatus('niet-gekoppeld'); return; }
        mapRef.current = map;
        const perm = await map.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') { if (await verbind(CGSYNC.fsaAdapter(map), map.name, false)) await feedbackInMap(map); }
        else setSyncStatus('prompt'); // toestemming vragen mag alleen na een klik
      } catch (e) { setSyncStatus('niet-gekoppeld'); }
    })();
    // ook het losse feedbackbestand herstellen
    (async () => {
      if (TEST_MAP) return;
      try {
        const fh = await idbGet(IDB_FB_KEY);
        if (!fh) { setFeedbackStatus('niet-gekoppeld'); return; }
        feedbackHandleRef.current = fh;
        const perm = await fh.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') { const { lijst, lastModified } = await leesFeedbackBestand(fh); feedbackMtimeRef.current = lastModified; setFeedback(prev => mergeFeedback(prev, lijst)); setFeedbackStatus('verbonden'); }
        else setFeedbackStatus('prompt');
      } catch (e) { setFeedbackStatus('niet-gekoppeld'); }
    })();
  }, []);

  // feedback van collega's oppikken uit het feedbackbestand (polling ~7s)
  useEffect(() => {
    if (feedbackStatus !== 'verbonden') return;
    const iv = setInterval(async () => {
      try {
        if (!feedbackHandleRef.current) return;
        const file = await feedbackHandleRef.current.getFile();
        if (file.lastModified <= (feedbackMtimeRef.current || 0)) return;
        feedbackMtimeRef.current = file.lastModified;
        const text = await file.text();
        if (!text.trim()) return;
        setFeedback(prev => mergeFeedback(prev, feedbackUitData(JSON.parse(text))));
      } catch (e) { if (e && e.name === 'NotAllowedError') setFeedbackStatus('prompt'); }
    }, 7000);
    return () => clearInterval(iv);
  }, [feedbackStatus]);

  // eigen bestand bijwerken (kort na een wijziging)
  async function schrijfNu() {
    const sync = syncRef.current; if (!sync) return;
    try {
      await sync.schrijf();
      setSavingState('saved'); setLastSyncTime(nowHHMM());
      setTimeout(() => setSavingState('idle'), 1500);
    } catch (e) {
      setSavingState('idle');
      if (e && e.name === 'NotAllowedError') setSyncStatus('prompt');
    }
  }
  // elke wijziging in de app vastleggen als eigen wijziging
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync || syncStatus !== 'verbonden') return;
    const n = sync.registreer({ trajecten, contacten, uren, targets, groepen, checklist, team });
    if (!n) return;
    bewaarSyncStand();
    setSavingState('saving');
    clearTimeout(schrijfTimer.current);
    schrijfTimer.current = setTimeout(schrijfNu, 700);
  }, [trajecten, contacten, uren, targets, groepen, checklist, team, syncStatus]);

  // wijzigingen van collega's ophalen
  useEffect(() => {
    if (syncStatus !== 'verbonden') return;
    let bezig = false;
    const peil = async () => {
      if (bezig || !syncRef.current) return;
      bezig = true;
      try {
        const nieuw = await syncRef.current.peil();
        if (nieuw) { applyBundle(nieuw); bewaarSyncStand(); }
        if (syncRef.current.s.teSchrijven) await syncRef.current.schrijf(); // bijv. opschonen na vastleggen
        setCollegas(syncRef.current.collegas());
        setLastSyncTime(nowHHMM());
      } catch (e) { if (e && e.name === 'NotAllowedError') setSyncStatus('prompt'); }
      bezig = false;
    };
    const iv = setInterval(peil, PEIL_MS);
    // af en toe laten weten dat je actief bent, en bij weggaan alles wegschrijven
    const hartslag = setInterval(() => { if (!document.hidden && syncRef.current) syncRef.current.schrijf(true).catch(() => {}); }, 60000);
    const bijWeg = () => { if (document.hidden && syncRef.current) syncRef.current.schrijf().catch(() => {}); else peil(); };
    document.addEventListener('visibilitychange', bijWeg);
    window.addEventListener('beforeunload', bijWeg);
    return () => { clearInterval(iv); clearInterval(hartslag); document.removeEventListener('visibilitychange', bijWeg); window.removeEventListener('beforeunload', bijWeg); };
  }, [syncStatus]);

  function conflictLaadHun() {}
  async function conflictBehoudMijn() {}

  // --- opslag-acties (alleen na gebruikersklik) ---
  async function koppelBestand() {
    setMenuOpen(false);
    try {
      const map = await window.showDirectoryPicker({ mode: 'readwrite', id: 'crm-gedeelde-map' });
      mapRef.current = map;
      if (await verbind(CGSYNC.fsaAdapter(map), map.name, true)) { await idbSet(IDB_KEY, map); await feedbackInMap(map); }
    } catch (e) { if (e && e.name !== 'AbortError') alert(koppelFoutTekst(e)); }
  }
  // alles vastleggen in crm-data.json (dan ziet ook het oude CRM de laatste stand, en blijven de wijzigingsbestanden klein)
  async function nieuwBestand() {
    setMenuOpen(false);
    if (!syncRef.current) return;
    if (!confirm('De huidige stand van iedereen vastleggen in crm-data.json? Dat is veilig en kan altijd. Collega\'s hoeven niets te doen.')) return;
    try { applyBundle(await syncRef.current.legVast()); bewaarSyncStand(); setLastSyncTime(nowHHMM()); alert('Vastgelegd in crm-data.json.'); }
    catch (e) { alert('Vastleggen mislukt: ' + (e && e.message ? e.message : e)); }
  }
  // de gekoppelde map bevat ook het feedbackbestand: crm-feedback.json (wordt aangemaakt als het er nog niet is)
  async function feedbackInMap(map) {
    try {
      const fh = await map.getFileHandle('crm-feedback.json', { create: true });
      const { lijst, lastModified } = await leesFeedbackBestand(fh);
      feedbackHandleRef.current = fh; await idbSet(IDB_FB_KEY, fh);
      feedbackMtimeRef.current = lastModified;
      setFeedback(prev => mergeFeedback(prev, lijst)); setFeedbackStatus('verbonden');
    } catch (e) { console.warn('Feedbackbestand in de map niet beschikbaar:', e); }
  }
  async function heractiveerToegang() {
    setMenuOpen(false);
    try {
      const map = mapRef.current || await idbGet(IDB_KEY);
      if (!map) { setSyncStatus('niet-gekoppeld'); return; }
      const perm = await map.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') { mapRef.current = map; if (await verbind(CGSYNC.fsaAdapter(map), map.name, false)) await feedbackInMap(map); }
      else setSyncStatus('prompt');
    } catch (e) { setSyncStatus('prompt'); }
  }
  async function ontkoppelBestand() {
    setMenuOpen(false);
    if (syncRef.current) { try { await syncRef.current.schrijf(); } catch (e) {} }
    try { await idbDel(IDB_KEY); } catch (e) {}
    syncRef.current = null; mapRef.current = null; setMapNaam(''); setCollegas([]);
    setSyncStatus('niet-gekoppeld'); setLastSyncTime('');
  }
  // direct wegschrijven en ophalen
  async function forceerOpslaan() {
    if (!syncRef.current) return;
    setSavingState('saving');
    try {
      await syncRef.current.schrijf(true);
      const nieuw = await syncRef.current.peil();
      if (nieuw) { applyBundle(nieuw); bewaarSyncStand(); }
      setCollegas(syncRef.current.collegas());
      setSavingState('saved'); setLastSyncTime(nowHHMM());
      setTimeout(() => setSavingState('idle'), 1500);
      setMenuOpen(false);
    } catch (e) { setSavingState('idle'); if (e && e.name === 'NotAllowedError') setSyncStatus('prompt'); else alert('Synchroniseren mislukt: ' + (e && e.message ? e.message : e)); }
  }
  // --- feedback van collega's ---
  // schrijf de feedbacklijst naar het gekoppelde bestand, samenvoegend met wat collega's er al in zetten
  async function syncFeedbackNaarBestand(lokaal) {
    if (!feedbackHandleRef.current || feedbackStatusRef.current !== 'verbonden') return lokaal;
    try {
      const { lijst } = await leesFeedbackBestand(feedbackHandleRef.current);
      const merged = mergeFeedback(lijst, lokaal);
      feedbackMtimeRef.current = await schrijfFeedbackBestand(feedbackHandleRef.current, merged);
      setFeedback(merged);
      return merged;
    } catch (e) { if (e && e.name === 'NotAllowedError') setFeedbackStatus('prompt'); return lokaal; }
  }
  async function addFeedback(naam, tekst) {
    const t = (tekst || '').trim(); if (!t) return;
    const datum = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const next = [...feedback, { id: uid(), datum, naam: (naam || '').trim(), tekst: t }];
    setFeedback(next);
    await syncFeedbackNaarBestand(next);
  }
  async function delFeedback(id) {
    const next = feedback.filter(f => f.id !== id);
    setFeedback(next);
    if (feedbackHandleRef.current && feedbackStatusRef.current === 'verbonden') {
      try { feedbackMtimeRef.current = await schrijfFeedbackBestand(feedbackHandleRef.current, next); }
      catch (e) { if (e && e.name === 'NotAllowedError') setFeedbackStatus('prompt'); }
    }
  }
  // feedbackbestand koppelen (inlezen + live opslag), nieuw aanmaken, of toegang heractiveren
  async function koppelFeedbackBestand() {
    setMenuOpen(false);
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Feedbackbestand', accept: { 'application/json': ['.json'] } }] });
      feedbackHandleRef.current = handle; await idbSet(IDB_FB_KEY, handle);
      const { lijst } = await leesFeedbackBestand(handle);
      const merged = mergeFeedback(lijst, feedback);
      feedbackMtimeRef.current = await schrijfFeedbackBestand(handle, merged);
      setFeedback(merged); setFeedbackStatus('verbonden');
    } catch (e) { if (e && e.name !== 'AbortError') alert(koppelFoutTekst(e)); }
  }
  async function nieuwFeedbackBestand() {
    setMenuOpen(false);
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: 'crm-feedback.json', types: [{ description: 'Feedbackbestand', accept: { 'application/json': ['.json'] } }] });
      feedbackHandleRef.current = handle; await idbSet(IDB_FB_KEY, handle);
      feedbackMtimeRef.current = await schrijfFeedbackBestand(handle, feedback);
      setFeedbackStatus('verbonden');
    } catch (e) { if (e && e.name !== 'AbortError') alert('Aanmaken mislukt: ' + e.message); }
  }
  async function heractiveerFeedback() {
    setMenuOpen(false);
    try {
      const handle = feedbackHandleRef.current || await idbGet(IDB_FB_KEY);
      if (!handle) { setFeedbackStatus('niet-gekoppeld'); return; }
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') { feedbackHandleRef.current = handle; const { lijst } = await leesFeedbackBestand(handle); setFeedback(prev => mergeFeedback(prev, lijst)); setFeedbackStatus('verbonden'); }
      else setFeedbackStatus('prompt');
    } catch (e) { setFeedbackStatus('prompt'); }
  }
  function exportFeedbackTxt() {
    if (!feedback.length) { alert('Nog geen feedback om te exporteren.'); return; }
    const blokken = [...feedback].sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
      .map(f => `[${f.datum}] ${f.naam || 'Anoniem'}:\n${f.tekst}`);
    const txt = "Campus Gouda CRM — feedback van collega's\nGeëxporteerd: " + new Date().toLocaleString('nl-NL')
      + `\nAantal opmerkingen: ${feedback.length}\n\n` + blokken.join('\n\n----------------------------------------\n\n') + '\n';
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `feedback-campus-gouda-crm-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportData() {
    const payload = { app: 'Campus Gouda CRM', version: 4, exportedAt: new Date().toISOString(), trajecten, contacten, uren, targets, groepen, checklist };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-gouda-crm-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset zodat hetzelfde bestand later opnieuw gekozen kan worden
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (err) { alert('Kon het bestand niet lezen — is dit een geldig JSON-back-upbestand?'); return; }
      if (!Array.isArray(data.trajecten) || !Array.isArray(data.contacten)) {
        alert('Ongeldig back-upbestand: verwacht velden "trajecten" en "contacten".');
        return;
      }
      const nUren = Array.isArray(data.uren) ? data.uren.length : 0;
      if (!confirm(`Hiermee wordt ALLE huidige data overschreven met de back-up\n(${data.trajecten.length} trajecten, ${data.contacten.length} contacten, ${nUren} urenregels).\n\nDoorgaan?`)) return;
      setTrajecten(data.trajecten);
      setContacten(data.contacten);
      if (Array.isArray(data.uren)) setUren(data.uren);
      if (data.targets && typeof data.targets === 'object') setTargets(data.targets);
      if (Array.isArray(data.groepen)) setGroepen(data.groepen);
      if (data.checklist && typeof data.checklist === 'object') setChecklist(data.checklist);
      if (Array.isArray(data.team)) setTeam(data.team);
      setMenuOpen(false);
      alert('Back-up geïmporteerd.');
    };
    reader.readAsText(file);
  }

  function openContactFromTraject(cid) { setTab('contacten'); setOpenContactId(cid); }
  function openTrajectFromContact(tid) { setTab('trajecten'); setPendingTrajectId(tid); }
  function openUrenForOrg(org) { setTab('uren'); setPendingUrenOrg(org); }
  function openGroepFromTraject(gid) { setTab('groepen'); setPendingGroepId(gid); }
  function openTrajectFromGroep(tid) { setTab('trajecten'); setPendingTrajectId(tid); }
  // klik op verbonden persoon (Uren) → bestaand contact openen, anders nieuw contactformulier voorvullen
  function openContactByName(naam, organisatie) {
    const n = (naam || '').trim().toLowerCase();
    const match = contacten.find(c => (c.naam || '').trim().toLowerCase() === n);
    setTab('contacten');
    if (match) { setOpenContactId(match.id); }
    else { setPendingNewContact({ naam: naam || '', organisatie: organisatie || '' }); }
  }
  // direct een nieuw contact aanmaken (bijv. vanuit een trajectformulier) → geeft het id terug
  function createContact(partial) {
    const c = { id: uid(), naam: '', organisatie: '', functie: '', email: '', telefoon: '',
      leadstatus: 'Koud', eigenaar: '', themas: [], trajectIds: [], notities: '', interacties: [], ...partial };
    setContacten(prev => [...prev, c]);
    return c.id;
  }

  const takenTeller = useMemo(() => {
    const o = CGT.takenOverzicht(groepen, checklist, CGT.vandaagISO());
    return o.opvolgen.length + o.signalen.filter(x => !x.verborgen && (x.niveau === 'urgent' || x.niveau === 'binnenkort')).length;
  }, [groepen, checklist]);
  const [vanTaken, setVanTaken] = useState(false);
  function openGroepFromTaken(gid) { setTab('groepen'); setPendingGroepId(gid); setVanTaken(true); }
  useEffect(() => { if (tab !== 'groepen') setVanTaken(false); }, [tab]);

  const TabBtn = ({ id, children }) => (
    <button onClick={() => setTab(id)}
      className={`px-1 pb-2 -mb-px text-sm font-medium border-b-2 transition ${tab===id?'border-brand text-ink':'border-transparent text-slate-500 hover:text-ink'}`}>
      {children}
    </button>
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 pt-4 flex items-end gap-6">
          <div className="flex items-center gap-3 pb-3">
            {THEME.logoUrl
              ? <img src={THEME.logoUrl} alt={THEME.orgName} className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
              : <div className="h-10 w-10 rounded-lg bg-brandlight text-ink flex items-center justify-center font-bold tracking-tight">CG</div>}
            <div>
              <div className="font-semibold text-ink leading-tight">{THEME.orgName}</div>
              <div className="text-xs text-slate-500 leading-tight">CRM Innovatietrajecten · met taken</div>
            </div>
          </div>
          <nav className="flex gap-6">
            <TabBtn id="taken">Taken{takenTeller > 0 && <span className="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">{takenTeller}</span>}</TabBtn>
            <TabBtn id="trajecten">Trajecten</TabBtn>
            <TabBtn id="contacten">Contacten</TabBtn>
            <TabBtn id="groepen">Studentengroepen</TabBtn>
            <TabBtn id="uren">Urenverantwoording partners</TabBtn>
          </nav>
          {/* Synchronisatiestatus + opslag-menu rechtsboven */}
          <div className="ml-auto pb-2 relative flex items-center gap-3">
            {syncStatus === 'verbonden' && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-branddark">
                {savingState === 'saving'
                  ? <span className="text-slate-400">opslaan…</span>
                  : savingState === 'saved'
                    ? <span className="text-brand">opgeslagen ✓</span>
                    : <><span className="text-brand">●</span> Gedeeld{lastSyncTime ? ` · ${lastSyncTime}` : ''}</>}
              </span>
            )}
            {syncStatus === 'verbonden' && collegas.length > 0 && (() => {
              const actief = collegas.filter(c => Date.now() - c.actief < 15 * 60000);
              return <span className="hidden md:inline text-xs text-slate-500" title={collegas.map(c => c.naam + ': laatst actief ' + new Date(c.actief).toLocaleString('nl-NL')).join('\n')}>
                {actief.length ? 'Ook bezig: ' + actief.map(c => c.naam).join(', ') : `${collegas.length} collega${collegas.length === 1 ? '' : "'s"} in de map`}</span>;
            })()}
            {APP_VERSIE && (
              <a href="handleiding.html" target="_blank" rel="noopener"
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50" title="Handleiding voor collega's: installeren, koppelen en gebruiken">
                ❓ Handleiding
              </a>
            )}
            <button onClick={() => setFeedbackOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50" title="Opmerking / feedback achterlaten">
              💬 Feedback
            </button>
            <button onClick={() => setMenuOpen(o => !o)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">
              ⚙ Opslag
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-3 text-sm" style={{top:'100%'}}>
                  <div className="text-xs font-semibold text-ink mb-1">Gedeelde opslag (SharePoint/OneDrive)</div>
                  {syncStatus === 'unsupported' ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                      Deze browser kan niet met een gedeelde map werken. Gebruik <strong>Microsoft Edge</strong> of <strong>Google Chrome</strong>. Data staat lokaal; maak handmatig een JSON-back-up.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 mb-2">
                        {syncStatus === 'verbonden'
                          ? <>Gekoppeld aan de map <strong>{mapNaam}</strong>{lastSyncTime ? ` · bijgewerkt om ${lastSyncTime}` : ''}. Je wijzigingen staan in je eigen bestand in die map; die van collega's komen vanzelf binnen.</>
                          : syncStatus === 'prompt'
                            ? 'Toegang tot de gedeelde map moet opnieuw worden bevestigd.'
                            : 'Nog niet gekoppeld. Kies de gedeelde SharePoint/OneDrive-map waar crm-data.json in staat (of een lege map om te beginnen).'}
                      </p>
                      {syncStatus === 'prompt' && (
                        <button onClick={heractiveerToegang} className="w-full mb-2 px-3 py-2 rounded-lg bg-brand text-white font-medium hover:bg-branddark">Toegang heractiveren</button>
                      )}
                      {syncStatus === 'verbonden' && (
                        <button onClick={forceerOpslaan} className="w-full mb-2 px-3 py-2 rounded-lg bg-brand text-white font-medium hover:bg-branddark">{savingState === 'saving' ? 'Bezig…' : 'Nu synchroniseren'}</button>
                      )}
                      <button onClick={koppelBestand} className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Gedeelde map koppelen…</button>
                      {syncStatus === 'verbonden' && (
                        <button onClick={nieuwBestand} className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50" title="Schrijft de stand van iedereen in crm-data.json, zodat ook het oude CRM die ziet">Stand vastleggen in crm-data.json</button>
                      )}
                      {syncStatus === 'verbonden' && (
                        <button onClick={ontkoppelBestand} className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50">Ontkoppelen</button>
                      )}
                    </>
                  )}
                  <div className="border-t border-slate-100 my-2"></div>
                  <div className="text-xs font-semibold text-ink mb-1">Team</div>
                  <button onClick={() => { setMenuOpen(false); setTeamOpen(true); }} className="w-full mb-1 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">👥 Team en rollen… {team.length ? `(${team.length})` : ''}</button>
                  <div className="border-t border-slate-100 my-2"></div>
                  <div className="text-xs font-semibold text-ink mb-1">Handmatige back-up</div>
                  <p className="text-xs text-slate-400 mb-2">Een losse momentopname — <strong>niet</strong> de live opslag. Wijzigingen hierna worden niet automatisch in dit bestand bijgewerkt.</p>
                  <button onClick={exportData} className="w-full mb-2 px-3 py-2 rounded-lg bg-brand text-white font-medium hover:bg-branddark">Exporteer momentopname (JSON)</button>
                  <button onClick={() => fileRef.current && fileRef.current.click()} className="w-full px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Importeer momentopname (JSON)</button>
                  <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {syncStatus === 'niet-gekoppeld' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
            <span className="flex-1">⚠️ Nog niet gekoppeld aan de gedeelde map. Je gegevens staan nu alleen in deze browser, collega's zien ze niet.</span>
            <button onClick={koppelBestand} className="shrink-0 px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-branddark">Koppelen</button>
          </div>
        </div>
      )}
      {syncStatus === 'prompt' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
            <span className="flex-1">🔒 Bevestig de toegang tot de gedeelde map om verder te werken met collega's.</span>
            <button onClick={heractiveerToegang} className="shrink-0 px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-branddark">Toegang heractiveren</button>
          </div>
        </div>
      )}
      {syncStatus === 'unsupported' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm">
            ⚠️ Deze browser ondersteunt automatische bestandssynchronisatie niet. Gebruik <strong>Microsoft Edge</strong> of <strong>Google Chrome</strong> voor de gedeelde SharePoint-opslag. Data wordt nu alleen lokaal bewaard — maak regelmatig een handmatige JSON-back-up via <strong>⚙ Opslag</strong>.
          </div>
        </div>
      )}
      {conflict && (
        <div className="bg-rose-50 border-b border-rose-300 text-rose-900">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1 min-w-[240px]">⚠️ <strong>Conflict:</strong> een collega heeft het gedeelde bestand gewijzigd terwijl jij onopgeslagen wijzigingen hebt. Kies welke versie leidend is — automatisch opslaan staat zolang stil.</span>
            <button onClick={conflictLaadHun} className="shrink-0 px-3 py-1 rounded-lg border border-rose-300 text-rose-700 text-xs font-medium hover:bg-rose-100">Hun versie laden (mijn wijzigingen vervallen)</button>
            <button onClick={conflictBehoudMijn} className="shrink-0 px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-branddark">Mijn versie opslaan (overschrijft die van hen)</button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {tab === 'taken' && (
          <TakenTab groepen={groepen} setGroepen={setGroepen} checklist={checklist} onOpenGroep={openGroepFromTaken} />
        )}
        {tab === 'trajecten' && (
          <TrajectenTab
            trajecten={trajecten} setTrajecten={setTrajecten} contacten={contacten}
            groepen={groepen} onCreateContact={createContact}
            onOpenContact={openContactFromTraject} onOpenGroep={openGroepFromTraject}
            externalDetail={pendingTrajectId} clearExternal={() => setPendingTrajectId(null)}
          />
        )}
        {tab === 'groepen' && (
          <StudentenGroepenTab
            groepen={groepen} setGroepen={setGroepen} trajecten={trajecten} setTrajecten={setTrajecten} contacten={contacten}
            checklist={checklist} setChecklist={setChecklist}
            externalDetail={pendingGroepId} clearExternalDetail={() => setPendingGroepId(null)}
            onOpenTraject={openTrajectFromGroep}
            terugNaarTaken={vanTaken ? () => setTab('taken') : null}
          />
        )}
        {tab === 'contacten' && (
          <ContactenTab
            contacten={contacten} setContacten={setContacten} trajecten={trajecten} uren={urenAlles}
            openContactId={openContactId} setOpenContactId={setOpenContactId}
            pendingNewContact={pendingNewContact} clearPendingNewContact={() => setPendingNewContact(null)}
            onOpenTraject={openTrajectFromContact} onOpenUrenOrg={openUrenForOrg}
          />
        )}
        {tab === 'uren' && (
          <UrenTab
            uren={urenAlles} setUren={setUrenHandmatig} targets={targets} setTargets={setTargets} contacten={contacten}
            externalOrg={pendingUrenOrg} clearExternalOrg={() => setPendingUrenOrg(null)}
            onOpenPersoon={openContactByName}
          />
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        {THEME.orgName} · CRM Innovatietrajecten ·{' '}
        {syncStatus === 'verbonden'
          ? <span className="text-brand">gedeeld via de map {mapNaam}{lastSyncTime ? ` · bijgewerkt om ${lastSyncTime}` : ''}</span>
          : <span>data lokaal in deze browser (niet gedeeld)</span>}
        {' '}· <button onClick={exportData} className="underline hover:text-slate-600">back-up exporteren</button>
        {' '}· <button onClick={() => setFeedbackOpen(true)} className="underline hover:text-slate-600">feedback</button>
        {APP_VERSIE && <>{' '}· <span title={'Versie ' + APP_VERSIE}>versie {APP_VERSIE.split('-')[0]}</span></>}
      </footer>

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Team en rollen">
        {teamOpen && <TeamBeheer team={team} onSave={(t) => { setTeam(t); setTeamOpen(false); }} onCancel={() => setTeamOpen(false)}
          gegevens={{ trajecten, groepen, contacten, uren }}
          onGelijktrekken={(tabel) => {
            let n = 0;
            const nieuw = overNaamvelden({ trajecten, groepen, contacten, uren }, v => { const w = vervangNamen(v, tabel); if (w !== v) n++; return w; });
            setTrajecten(nieuw.trajecten); setGroepen(nieuw.groepen); setContacten(nieuw.contacten); setUren(nieuw.uren);
            const mijn = loadLS(LS_MIJNNAAM, ''); if (mijn && tabel[mijn]) saveLS(LS_MIJNNAAM, tabel[mijn]);
            return n;
          }} />}
      </Modal>
      <datalist id="cg-team">{TEAM_NAMEN.map(n => <option key={n} value={n} />)}</datalist>

      <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Feedback van collega's">
        <FeedbackBody feedback={feedback} status={feedbackStatus}
          onAdd={addFeedback} onDelete={delFeedback} onExport={exportFeedbackTxt}
          onKoppel={koppelFeedbackBestand} onNieuw={nieuwFeedbackBestand} onHeractiveer={heractiveerFeedback} />
      </Modal>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
