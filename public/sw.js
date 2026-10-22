/* Campus Gouda CRM — service worker.
 *
 * Doet één ding: de app-bestanden (code, stijl, lettertype, iconen) bewaren, zodat de app
 * snel en ook zonder internet opent.
 *
 * Gegevens komen hier NOOIT langs: die lopen via de gekoppelde map (OneDrive/SharePoint)
 * en de browseropslag van de app. Alleen de vaste lijst hieronder wordt bewaard; alle andere
 * verzoeken (zoals PDOK) gaan ongemoeid naar het netwerk.
 */
const VERSIE = '__VERSIE__';
const CACHE = 'cg-crm-' + VERSIE;
const BESTANDEN = __BESTANDEN__;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 'reload': altijd vers van de server, niet uit de HTTP-cache
    await c.addAll(BESTANDEN.map(u => new Request(u, { cache: 'reload' })));
  })());
  // geen skipWaiting: de app vraagt eerst of je wilt herladen
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('cg-crm-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'nu-bijwerken') self.skipWaiting();
});

const BASIS = new URL('./', self.location).href;
const IN_LIJST = new Set(BESTANDEN.map(u => new URL(u, BASIS).href));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // PDOK e.d.: niet aankomen
  url.search = ''; url.hash = '';
  // een pagina uit de lijst (zoals handleiding.html) gewoon tonen; elke andere pagina binnen de app → de app zelf
  const sleutel = req.mode === 'navigate' && url.href.startsWith(BASIS) && !IN_LIJST.has(url.href) ? BASIS + 'index.html' : url.href;
  if (!IN_LIJST.has(sleutel) && sleutel !== BASIS + 'index.html') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(sleutel);
    return hit || fetch(req);
  })());
});
