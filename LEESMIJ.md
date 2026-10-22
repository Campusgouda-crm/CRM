# Campus Gouda CRM (app)

Het CRM van Campus Gouda als app die je kunt installeren, met een eigen icoon en venster. Updates gaan vanzelf.

**Er staan geen gegevens in deze repository.** Alle gegevens blijven in de gedeelde SharePoint-map van Gemeente Gouda: `crm-data.json` en de map `crm-wijzigingen/`. De app leest en schrijft die map via OneDrive op je eigen computer. Gegevens gaan nooit naar GitHub.

## Gebruiken (voor collega's)

1. Open het adres van de app in **Edge** of **Chrome**.
2. Klik rechtsonder op **Installeren** of op het installeer-icoon in de adresbalk. De app staat daarna in het Startmenu of het Dock.
3. Klik in de app op **⚙ Opslag → Gedeelde map koppelen…** en kies de gesynchroniseerde SharePoint-map. Kies bij de vraag van de browser **Altijd toestaan**.

Het samenwerken werkt precies als bij de bestandsversie: iedereen schrijft in een eigen bestand in `crm-wijzigingen/`.

Staat er een nieuwe versie klaar, dan zie je rechtsonder **"Er is een nieuwe versie van het CRM"**. Klik op **Herladen**.

De app werkt ook zonder internet. Zonder internet kun je alleen geen adressen opzoeken.

## Eenmalig opzetten op GitHub

1. **Maak een aparte GitHub-organisatie**, bijvoorbeeld `campusgouda-crm`. Dat is gratis. Doe dit ook als je al een eigen account hebt. De app bewaart een offline kopie van de gegevens in de browser, en die opslag hoort bij het webadres. Met een eigen organisatie heeft de app een eigen adres (`campusgouda-crm.github.io`) en deelt hij die opslag niet met andere projecten.
2. Maak in die organisatie een repository `crm` aan:
   - **Public**: dat kan, want er staan geen gegevens in. GitHub Pages voor een private repository vraagt een betaald abonnement.
   - Zonder README.
3. Zet de code online. Typ in de terminal, in deze map:
   ```bash
   git remote add origin https://github.com/campusgouda-crm/crm.git
   ```
   ```bash
   git push -u origin main
   ```
4. Ga op GitHub naar **Settings → Pages**. Kies bij **Source** voor **GitHub Actions**.
5. Wacht tot er onder **Actions** een groen vinkje staat. De app staat dan op `https://campusgouda-crm.github.io/crm/`.

## Een nieuwe versie maken

De bron van de app is de interne versie (`nieuwe versie met taken (NIET DELEN)/index.html`). Die staat niet in deze repository.

```bash
node scripts/maak_bron.mjs
```
```bash
npm run bouw
```
```bash
git add -A && git commit -m "Nieuwe versie" && git push
```

- `maak_bron.mjs` haalt de namen van collega's, de startgegevens en de SharePoint-metadata uit de interne versie. Daarna splitst het die op in `src/`.
- `npm run bouw` doet vier dingen:
  - de app bouwen naar `dist/`;
  - de stijl maken;
  - de bibliotheken lokaal zetten;
  - de **privacycontrole** draaien.

  Vindt de controle iets, dan stopt het bouwen en wordt er niets gepubliceerd.
- Na `git push` publiceert GitHub de nieuwe versie. Open apps tonen dan de melding om te herladen.

Lokaal bekijken: `node scripts/serveer.mjs` en dan `http://localhost:4530/` openen.

## Privacycontrole

`node scripts/privacycontrole.mjs src public scripts dist`

- **Altijd:** zoeken naar mailadressen, telefoonnummers en SharePoint-metadata.
- **Op een computer met de interne map:** daarnaast zoeken naar alle namen, mailadressen en telefoonnummers uit het echte `crm-data.json`, en naar de namen van collega's uit de interne versie. Die bestanden worden alleen gelezen.

De uitvoer schermt gevonden waarden af. Bij een commit draait de controle ook vanzelf, via de git-hook in `.git/hooks/pre-commit`.

## Wat er in de app zit

| Bestand | Wat |
|---|---|
| `src/` | De bron. Gemaakt door `maak_bron.mjs`, niet met de hand aanpassen. |
| `public/index.html` | De pagina, met een strikte Content-Security-Policy: alleen eigen bestanden, plus PDOK voor adressen. |
| `public/sw.js` | De service worker. Bewaart alleen de app-bestanden voor offline gebruik, nooit gegevens. |
| `public/pwa.js` | De meldingen "Installeren" en "Nieuwe versie". |
| `public/manifest.webmanifest`, `public/icons/` | De naam, het icoon en de kleur van de app. |
| `scripts/` | Bron maken, bouwen, privacycontrole, lokaal serveren, test van de samenwerk-engine. |

Bibliotheken met vaste versies: React 18.3.1, Chart.js 4.4.7, SheetJS 0.20.3 en Manrope (@fontsource). Babel 7 en Tailwind 3 worden alleen bij het bouwen gebruikt.

## Later: telefoon en tablet

Op een telefoon kan een webapp niet bij een OneDrive-map. Daarvoor is een koppeling met Microsoft 365 nodig, via Microsoft Graph. Die koppeling vraagt een app-registratie bij IT. De samenwerk-engine is daarop voorbereid: dan komt er alleen een `graphAdapter` naast de huidige `fsaAdapter`. De gegevens blijven ook dan in SharePoint.
