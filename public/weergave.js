/* Campus Gouda CRM — weergave: licht, donker of zoals de computer.
 * Wordt in de <head> geladen, zodat de pagina meteen in de goede kleuren verschijnt.
 * De keuze geldt per computer (browseropslag) en wordt niet gedeeld.
 */
(function () {
  var SLEUTEL = 'cgt_weergave';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function keuze() { try { return localStorage.getItem(SLEUTEL) || 'licht'; } catch (e) { return 'licht'; } }
  function isDonker() { var k = keuze(); return k === 'donker' || (k === 'systeem' && !!(mq && mq.matches)); }
  function pasToe() {
    var donker = isDonker();
    document.documentElement.setAttribute('data-thema', donker ? 'donker' : 'licht');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', donker ? '#0b1720' : '#1A7754');
    if (window.Chart && window.Chart.defaults) {
      window.Chart.defaults.color = donker ? '#cbd5e1' : '#666';
      window.Chart.defaults.borderColor = donker ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
    }
  }
  function zet(k) { try { localStorage.setItem(SLEUTEL, k); } catch (e) {} pasToe(); }
  if (mq && mq.addEventListener) mq.addEventListener('change', pasToe);
  window.CG_WEERGAVE = { keuze: keuze, zet: zet, pasToe: pasToe, isDonker: isDonker };
  pasToe();
})();
