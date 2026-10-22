/* Campus Gouda CRM — zoekbare keuzemenu's.
 * Werkt voor ALLE keuzemenu's (<select>) in de app, ook voor nieuwe: klik erop of begin te typen,
 * dan opent een zoekvenster. Typ een deel van wat je zoekt (ergens in de tekst, hoofdletters en
 * accenten maken niet uit) en kies met pijltjes + Enter of met de muis. Esc sluit.
 * Korte lijsten (≤ 6 keuzes) en aanraakschermen houden het gewone menu.
 * De keuze gaat via het oorspronkelijke menu, dus de app merkt geen verschil.
 */
(function () {
  var MIN_OPTIES = 7;
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

  var paneel = null, actief = null, opties = [], gefilterd = [], plek = 0;
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  function geschikt(sel) {
    return sel && sel.tagName === 'SELECT' && !sel.multiple && !sel.disabled && sel.options.length >= MIN_OPTIES && !sel.hasAttribute('data-gewoon');
  }

  function sluit(terugFocus) {
    if (!paneel) return;
    paneel.remove(); paneel = null;
    document.removeEventListener('mousedown', buitenKlik, true);
    window.removeEventListener('resize', sluitZonderFocus);
    window.removeEventListener('scroll', herpositioneer, true);
    if (terugFocus && actief) actief.focus();
    actief = null;
  }
  function sluitZonderFocus() { sluit(false); }
  function buitenKlik(e) { if (paneel && !paneel.contains(e.target) && e.target !== actief) sluit(false); }

  function kies(o) {
    var sel = actief;
    if (!sel || !o) return;
    var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, o.waarde);
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sluit(true);
  }

  function herpositioneer() {
    if (!paneel || !actief) return;
    var r = actief.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { sluit(false); return; }
    var breedte = Math.max(r.width, 260);
    var links = Math.min(r.left, window.innerWidth - breedte - 8);
    var ruimteOnder = window.innerHeight - r.bottom;
    paneel.style.left = Math.max(8, links) + 'px';
    paneel.style.width = breedte + 'px';
    if (ruimteOnder < 240 && r.top > ruimteOnder) { paneel.style.top = ''; paneel.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    else { paneel.style.bottom = ''; paneel.style.top = (r.bottom + 4) + 'px'; }
  }

  function teken(zoek) {
    var lijst = paneel.querySelector('[data-lijst]');
    var teller = paneel.querySelector('[data-teller]');
    var z = norm(zoek).trim();
    var delen = z.split(/\s+/).filter(Boolean);
    // score: 0 = begint ermee, 1 = elk getypt woord is het begin van een woord, 2 = alle stukjes komen ergens voor
    var score = function (o) {
      if (!delen.length) return 1;
      if (o.zoek.indexOf(z) === 0) return 0;
      var woorden = o.zoek.split(/[^a-z0-9]+/).filter(Boolean);
      if (delen.every(function (d) { return woorden.some(function (w) { return w.indexOf(d) === 0; }); })) return 1;
      if (delen.every(function (d) { return o.zoek.indexOf(d) >= 0; })) return 2;
      return 9;
    };
    gefilterd = opties.map(function (o, i) { return { o: o, s: score(o), i: i }; })
      .filter(function (x) { return x.s < 9; })
      .sort(function (a, b) { return delen.length ? (a.s - b.s) || (a.i - b.i) : a.i - b.i; })
      .map(function (x) { return x.o; });
    if (delen.length) gefilterd.forEach(function (o) { o._sterk = score(o) <= 1; });
    if (plek >= gefilterd.length) plek = Math.max(0, gefilterd.length - 1);
    lijst.innerHTML = '';
    var vorigeGroep = null;
    gefilterd.forEach(function (o, i) {
      if (o.groep && o.groep !== vorigeGroep) {
        var kop = document.createElement('div');
        kop.className = 'px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400';
        kop.textContent = o.groep; lijst.appendChild(kop); vorigeGroep = o.groep;
      }
      var rij = document.createElement('div');
      rij.setAttribute('role', 'option');
      rij.setAttribute('aria-selected', i === plek ? 'true' : 'false');
      rij.className = 'px-3 py-1.5 text-sm cursor-pointer truncate ' + (i === plek ? 'bg-brand text-white' : (o.huidig ? 'text-branddark font-semibold hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100'));
      rij.textContent = (o.huidig ? '✓ ' : '') + (o.tekst || '—');
      rij.title = o.tekst;
      rij.addEventListener('mousedown', function (e) { e.preventDefault(); kies(o); });
      rij.addEventListener('mousemove', function () { if (plek !== i) { plek = i; teken(paneel.querySelector('input').value); } });
      lijst.appendChild(rij);
    });
    if (!gefilterd.length) {
      var leeg = document.createElement('div');
      leeg.className = 'px-3 py-2 text-sm text-slate-400';
      leeg.textContent = 'Niets gevonden voor "' + zoek + '"';
      lijst.appendChild(leeg);
    }
    teller.textContent = gefilterd.length + ' van ' + opties.length;
    var gekozen = lijst.querySelector('[aria-selected="true"]');
    if (gekozen) gekozen.scrollIntoView({ block: 'nearest' });
  }

  function open(sel, beginTekst) {
    sluit(false);
    actief = sel;
    opties = [].slice.call(sel.options).map(function (op) {
      var g = op.parentElement && op.parentElement.tagName === 'OPTGROUP' ? op.parentElement.label : '';
      return { waarde: op.value, tekst: op.textContent.trim(), groep: g, zoek: norm(op.textContent + ' ' + g), huidig: op.value === sel.value, uit: op.disabled };
    }).filter(function (o) { return !o.uit; });
    plek = Math.max(0, opties.findIndex(function (o) { return o.huidig; }));

    paneel = document.createElement('div');
    paneel.className = 'fixed z-[10000] bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden';
    paneel.setAttribute('role', 'dialog');
    paneel.innerHTML =
      '<div class="flex items-center gap-2 px-3 py-2 border-b border-slate-100">' +
        '<span aria-hidden="true" class="text-slate-400">🔍</span>' +
        '<input type="text" class="flex-1 min-w-0 text-sm bg-transparent outline-none text-ink" placeholder="Typ om te zoeken…" aria-label="Zoek in de keuzes" autocomplete="off" />' +
        '<span data-teller class="text-[11px] text-slate-400 whitespace-nowrap"></span>' +
      '</div>' +
      '<div data-lijst role="listbox" class="max-h-72 overflow-y-auto py-1"></div>';
    document.body.appendChild(paneel);
    herpositioneer();

    var invoer = paneel.querySelector('input');
    invoer.value = beginTekst || '';
    invoer.addEventListener('input', function () { plek = 0; teken(invoer.value); });
    invoer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); plek = Math.min(gefilterd.length - 1, plek + 1); teken(invoer.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); plek = Math.max(0, plek - 1); teken(invoer.value); }
      else if (e.key === 'Enter') { e.preventDefault(); kies(gefilterd[plek]); }
      else if (e.key === 'Escape') { e.preventDefault(); sluit(true); }
      else if (e.key === 'Tab') { sluit(false); }
    });
    if (beginTekst) plek = 0;
    teken(invoer.value);
    setTimeout(function () { invoer.focus(); }, 0);
    document.addEventListener('mousedown', buitenKlik, true);
    window.addEventListener('resize', sluitZonderFocus);
    window.addEventListener('scroll', herpositioneer, true);
  }

  // klik op een keuzemenu: zoekvenster in plaats van de lange lijst
  document.addEventListener('mousedown', function (e) {
    var sel = e.target && e.target.closest ? e.target.closest('select') : null;
    if (!geschikt(sel) || e.button !== 0) return;
    e.preventDefault();
    sel.focus();
    if (actief === sel && paneel) { sluit(true); return; }
    open(sel, '');
  }, true);

  // typen of pijltje omlaag in een geselecteerd keuzemenu: zoekvenster met die letter
  document.addEventListener('keydown', function (e) {
    var sel = e.target;
    if (!geschikt(sel) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 && e.key !== ' ') { e.preventDefault(); open(sel, e.key); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(sel, ''); }
  }, true);
})();
