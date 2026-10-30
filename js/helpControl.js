// ==========================
// "Ohje"-nappi ja ohjevalikko
//
// Aluksi piilotettu: nappi näkyy vain osoitteella ?tuulikartta=1 (ks. HELP_PUBLIC alla).
// Nappi lisätään .info-panels-säiliön loppuun (tuulikartta-napin alle).
// Napista avautuu ikkuna, jossa kerrotaan mitä toimintoja sivustolla on
// ja missä ne sijaitsevat. Tuulikartta-osio näkyy vain silloin, kun
// tuulikartta on käytössä (?tuulikartta=1).
//
// ERISTETTY: tyylit injektoidaan täältä, index.html:ään ei tarvita muutoksia.
// Pois ottaminen: poista import + initHelpControl-kutsu main.js:stä.
// ==========================

const STYLE = `
.btn-icon-help { background: #5c6bc0; color: #fff; font-size: 12px; }

.help-overlay {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(0,0,0,0.45);
  display: none; align-items: center; justify-content: center;
  padding: 16px;
}
.help-overlay.visible { display: flex; }
.help-dialog {
  background: #fff; color: #222;
  width: min(680px, 100%); max-height: min(86vh, 760px);
  border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  display: flex; flex-direction: column;
  font: 14px/1.5 "Helvetica Neue", Arial, Helvetica, sans-serif;
}
.help-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid #e3e3e3;
}
.help-head h2 { margin: 0; font-size: 18px; font-weight: 700; }
.help-close {
  border: none; background: #eceff1; color: #222; cursor: pointer;
  width: 32px; height: 32px; border-radius: 50%; font-size: 20px; line-height: 1;
}
.help-close:hover { background: #cfd8dc; }
.help-body { overflow-y: auto; padding: 8px 18px 16px; }
.help-lead { margin: 8px 0 10px; color: #555; }
.help-body details { border-bottom: 1px solid #eee; padding: 8px 0; }
.help-body summary { cursor: pointer; font-weight: 700; font-size: 15px; padding: 2px 0; }
.help-body details > div { padding: 6px 0 4px 2px; }
.help-body p { margin: 6px 0; }
.help-body ul { margin: 6px 0; padding-left: 20px; }
.help-body li { margin: 3px 0; }
.help-chip {
  display: inline-block; padding: 0 7px; border-radius: 999px;
  font-weight: 700; font-size: 12px; color: #fff;
}
.help-foot { color: #777; font-size: 12px; margin-top: 10px; }
`;

function sections(windMapOn) {
  const list = [
    {
      title: "Kartta ja merkit",
      open: true,
      html: `
        <p>Kartalla näkyy Ilmatieteen laitoksen havaintoasemia sekä ennustepisteitä. Kartta toimii kuten tavallinen verkkokartta: vedä siirtääksesi, rullaa tai käytä +/- -painikkeita zoomataksesi.</p>
        <ul>
          <li><b>Tuulinuoli ja lukema:</b> nuoli osoittaa suuntaan, jonne tuuli puhaltaa, ja lukema kertoo tuulen nopeuden (m/s, suluissa puuska). Väri kertoo voimakkuuden:
            <span class="help-chip" style="background:#028b09">alle 5</span>
            <span class="help-chip" style="background:#025981">5–10</span>
            <span class="help-chip" style="background:#b67e06">10–15</span>
            <span class="help-chip" style="background:#E53935">yli 15 m/s</span></li>
          <li><b>Pyöreä aaltomerkki:</b> aaltopoiju. Luvussa on aallonkorkeus metreinä ja pieni piikki osoittaa suuntaan, jonne aallot ovat menossa.</li>
          <li><b>Pieni väripiste:</b> asema tai ennustepiste. Klikkaamalla aukeaa sen tiedot.</li>
        </ul>`
    },
    {
      title: "Aseman tiedot (klikkaa merkkiä)",
      html: `
        <p>Merkkiä klikkaamalla aukeaa ikkuna, jossa on aseman tämänhetkiset olosuhteet ja ennuste:</p>
        <ul>
          <li><b>Tietokortti:</b> tuuli, lämpötila ja aurinko, vedenkorkeus ja aallokko sekä veden lämpötila ja näkyvyys (sen mukaan, mitä asemalla mitataan).</li>
          <li><b>Tuulikaaviot:</b> havaittu tuuli ja tuuliennuste graafina nuolineen.</li>
          <li><b>Tuuliennusteanimaatio:</b> liukusäätimellä tai toistopainikkeella voit katsoa, miten tuuli muuttuu lähitunteina asemaa ympäröivällä alueella.</li>
        </ul>
        <p>Ikkunan saa kiinni oikean yläkulman rastista.</p>`
    },
    {
      title: "Valikot ja napit",
      html: `
        <ul>
          <li><b>Säätiedotus merenkulkijoille:</b> avaa Ilmatieteen laitoksen merenkulkijoiden säätiedotuksen suoraan sivulle. Napista voi myös avata alkuperäisen sivun.</li>
          <li><b>Vedenlämpö:</b> näyttää/piilottaa vedenlämpöpallot kartalla. Pallossa on vedenlämpötila, ja värit kertovat lämpötilan. Mukana myös sisävesiasemia ja uimarantoja, joilla ei ole omaa havaintoasemaa.</li>
          <li><b>Merivaroitukset:</b> näyttää Traficomin voimassa olevat merivaroitukset kartalla (keltainen huutomerkki). Merkkiä klikkaamalla näet varoituksen tekstin. Nappiin ilmestyy varoitusten lukumäärä.</li>
          <li><b>Taustakartta:</b> vaihtaa taustan OpenStreetMapin ja Maanmittauslaitoksen kartan välillä.</li>
          <li><b>Sadetutka:</b> avaa sadetutkan, jossa on aikajana ja toistopainike.</li>
          <li><b>Käyttöoikeudet:</b> tietolähteet ja niiden lisenssit.</li>
          <li><b>Palaute:</b> lähetä palautetta sähköpostilla.</li>
          <li><b>Muutokset:</b> lista sivustolle viimeksi tehdyistä muutoksista.</li>
        </ul>`
    }
  ];

  if (windMapOn) {
    list.push({
      title: "Tuulikartta (testi)",
      html: `
        <p>Tuulikartta-napista kartta siirtyy näkymään, jossa näkyy Itämeri Gotlannista Perämerelle, ja päälle ilmestyy elävä tuuliennuste (Ilmatieteen laitoksen Harmonie-malli, 10 m tuuli, 48 tuntia).</p>
        <ul>
          <li><b>Aikajana:</b> toistopainike ja liukusäädin alareunassa. Painamalla toistoa ennuste etenee tunti kerrallaan.</li>
          <li><b>Väriskaala:</b> tuulen nopeus 0–25 m/s (sininen: tyyni, punainen ja violetti: kova tuuli).</li>
          <li><b>Uloszoomattuna</b> näkyy värikenttä ja harvat liikkuvat viivat. <b>Lähemmäs zoomattaessa</b> kartta tummenee ja liikkuvat tuuliviivat tihenevät.</li>
          <li><b>Hiiren vieressä</b> näkyy osoitetun kohdan tuulen nopeus ja suunta.</li>
          <li><b>Klikkaa karttaa:</b> avautuu ikkuna, jossa on valitun paikan 48 tunnin tuuliennuste kaaviona. Klikkaamalla palkkia kartta siirtyy kyseiseen tuntiin.</li>
          <li>Tuulikartan ollessa auki havaintopisteiden merkit on piilotettu. Sulje tuulikartta painamalla nappia uudelleen.</li>
        </ul>
        <p class="help-foot">Hilatiedon tarkkuus on noin 5–10 km. Tieto ei kata puuskia, aallokkoa eikä paikallisia ilmiöitä.</p>`
    });
  }

  list.push({
    title: "Tietolähteet ja rajoitukset",
    html: `
      <p>Sivusto käyttää avointa dataa: Ilmatieteen laitos (havainnot, ennusteet, aallokko, vedenkorkeus, sadetutka), Traficom (merivaroitukset), SYKE ja Forum Virium Helsinki (vedenlämpötilat) sekä OpenStreetMap ja Maanmittauslaitos (kartat). Tarkat lisenssit löytyvät Käyttöoikeudet-napista.</p>
      <p class="help-foot">Merisää ei ole virallinen varoituspalvelu. Älä käytä sivustoa ainoana tietolähteenä navigoinnin tai turvallisuuden kannalta tärkeissä päätöksissä.</p>`
  });
  return list;
}

// Julkaisu: kun Ohje halutaan kaikille käyttäjille, aseta HELP_PUBLIC = true.
// Siihen asti nappi näkyy vain osoitteella ?tuulikartta=1.
const HELP_PUBLIC = true;

export function initHelpControl(map) {
  const windMapParam = new URLSearchParams(location.search).has("tuulikartta");
  if (!HELP_PUBLIC && !windMapParam) return;

  const panelsEl = document.querySelector(".info-panels");
  if (!panelsEl) return;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  const windMapOn = true; // tuulikartta on julkinen -> kuvataan ohjeessa

  const wrap = document.createElement("div");
  wrap.className = "info-panel";
  wrap.innerHTML = `
    <button type="button" class="info-panel-header help-toggle-btn" id="help-toggle-btn" title="Ohje" aria-label="Ohje">
      <span class="btn-icon-label">
        <span class="btn-icon btn-icon-help">?</span>
        <span>Ohje</span>
      </span>
    </button>`;
  panelsEl.appendChild(wrap);
  const btn = wrap.querySelector("button");

  const overlay = document.createElement("div");
  overlay.className = "help-overlay";
  overlay.innerHTML = `
    <div class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="help-head">
        <h2 id="help-title">Merisää – ohje</h2>
        <button type="button" class="help-close" aria-label="Sulje ohje">×</button>
      </div>
      <div class="help-body">
        <p class="help-lead">Tämä sivu näyttää tuulen, aallokon, vedenkorkeuden ja muut merellä tarvittavat säätiedot kartalla. Alla on lyhyesti, mitä toimintoja on ja missä.</p>
        ${sections(windMapOn).map(s => `
          <details${s.open ? " open" : ""}>
            <summary>${s.title}</summary>
            <div>${s.html}</div>
          </details>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector(".help-close");
  function open() { overlay.classList.add("visible"); closeBtn.focus(); }
  function close() { overlay.classList.remove("visible"); btn.focus(); }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("visible")) close();
  });
}
