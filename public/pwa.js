/* Campus Gouda CRM — app-functies: installeren en bijwerken.
 * Staat los van de rest van de app: twee kleine meldingen rechtsonder.
 *  - "Installeren als app" zodra de browser dat aanbiedt (Edge/Chrome) en de app nog niet geïnstalleerd is.
 *  - "Nieuwe versie beschikbaar" zodra er een update klaarstaat; met "Herladen" wordt die actief.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  const OPSLAG = 'cg-pwa-installeren-later';
  const geinstalleerd = () => matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: window-controls-overlay)').matches;

  // ---------- kleine melding ----------
  let vak = null;
  function vakje() {
    if (vak) return vak;
    vak = document.createElement('div');
    vak.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end print:hidden';
    document.body.appendChild(vak);
    return vak;
  }
  function melding(id, tekst, knoppen) {
    weg(id);
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    el.className = 'flex items-center gap-3 bg-white border border-brandlight shadow-lg rounded-xl pl-4 pr-2 py-2 text-sm text-ink max-w-sm';
    const t = document.createElement('span');
    t.textContent = tekst;
    el.appendChild(t);
    for (const k of knoppen) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = k.tekst;
      b.className = k.hoofd
        ? 'shrink-0 rounded-lg bg-brand hover:bg-branddark text-white font-semibold px-3 py-1.5'
        : 'shrink-0 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 px-2 py-1.5';
      b.addEventListener('click', k.doe);
      el.appendChild(b);
    }
    vakje().appendChild(el);
  }
  function weg(id) { const el = document.getElementById(id); if (el) el.remove(); }

  // ---------- installeren ----------
  let aanbod = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aanbod = e;
    let later = 0;
    try { later = Number(localStorage.getItem(OPSLAG) || 0); } catch (x) {}
    if (geinstalleerd() || Date.now() - later < 14 * 864e5) return;
    melding('cg-installeren', 'Campus Gouda CRM als app installeren?', [
      { tekst: 'Installeren', hoofd: true, doe: async () => { weg('cg-installeren'); aanbod.prompt(); await aanbod.userChoice; aanbod = null; } },
      { tekst: 'Later', doe: () => { weg('cg-installeren'); try { localStorage.setItem(OPSLAG, String(Date.now())); } catch (x) {} } },
    ]);
  });
  window.addEventListener('appinstalled', () => weg('cg-installeren'));
  // voor wie het later toch wil: CG_PWA.installeer() vanuit de console of een knop
  window.CG_PWA = {
    versie: (document.querySelector('meta[name="cg-versie"]') || {}).content || '',
    kanInstalleren: () => !!aanbod,
    installeer: async () => { if (aanbod) { aanbod.prompt(); await aanbod.userChoice; aanbod = null; } },
  };

  // ---------- bijwerken ----------
  let herladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (herladen) return;
    herladen = true;
    location.reload();
  });
  function toonUpdate(wachtend) {
    melding('cg-update', 'Er is een nieuwe versie van het CRM.', [
      { tekst: 'Herladen', hoofd: true, doe: () => { weg('cg-update'); wachtend.postMessage('nu-bijwerken'); } },
      { tekst: 'Straks', doe: () => weg('cg-update') },
    ]);
  }
  window.addEventListener('load', async () => {
    if (window.CG_WEERGAVE) window.CG_WEERGAVE.pasToe(); // grafieken (Chart.js) in de goede kleuren
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      if (reg.waiting && navigator.serviceWorker.controller) toonUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nieuw = reg.installing;
        if (!nieuw) return;
        nieuw.addEventListener('statechange', () => {
          // alleen melden als er al een versie draaide (niet bij de allereerste keer)
          if (nieuw.state === 'installed' && navigator.serviceWorker.controller) toonUpdate(nieuw);
        });
      });
      // een geïnstalleerde app blijft vaak dagen open: elk uur even kijken
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) { console.warn('Service worker niet geregistreerd:', e); }
  });
})();
