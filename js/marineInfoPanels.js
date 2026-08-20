// ==========================
// Säätiedotus merenkulkijoille
// Avattava/piilotettava infopaneeli kartan vasempaan yläkulmaan.
// Sisältö ladataan vasta kun käyttäjä avaa paneelin ensimmäisen
// kerran, jotta kartan alkulataus ei hidastu turhaan.
//
// Säätiedotus merenkulkijoille haetaan valmiiksi muotoiltuna HTML-
// fragmenttina cdn.fmi.fi:stä (sama osoite jota ilmatieteenlaitos.fi
// itse käyttää sivullaan) ja jäsennetään tekstiksi – ks.
// popup/marineBulletinParser.js. Tiedote päivittyy FMI:llä n. 6
// kertaa vuorokaudessa; koska tarkkoja julkaisukellonaikoja ei
// voitu luotettavasti varmistaa, haetaan tuore tiedote paneelin
// avatessa ja sen jälkeen kerran tunnissa niin kauan kuin sivu on
// auki – tämä poimii jokaisen päivityksen viimeistään tunnin sisällä.
//
// HUOM: Erillinen "Varoitukset"-paneeli (alerts.fmi.fi:n CAP-RSS-
// syöte) poistettiin 2026-08, koska alerts.fmi.fi ei lähetä
// Access-Control-Allow-Origin-headeria eikä RSS:ää siksi voi lukea
// suoraan selaimesta muulta verkkotunnukselta (varmistettu: no-cors-
// tilassa palvelin vastaa normaalisti, mutta tavallinen fetch epäonnistuu
// aina "Failed to fetch" -virheeseen). Korjaus vaatisi palvelinpuolen
// proxyn, mikä ei tässä vaiheessa ole tarpeen – osa varoituksista näkyy
// jo tässä säätiedotuksessa merenkulkijoille.
// ==========================

import { fetchMarineBulletinHtml } from "./api/marineBulletin.js";
import {
  parseMarineBulletinHtml,
  renderMarineBulletinHtml
} from "./popup/marineBulletinParser.js";

const MARINE_BULLETIN_PAGE_URL = "https://www.ilmatieteenlaitos.fi/saatiedotus-merenkulkijoille";
const MARINE_BULLETIN_REFRESH_MS = 60 * 60 * 1000; // 1 h

function setupPanel(panelEl, { onFirstOpen } = {}) {

  const header = panelEl.querySelector(".info-panel-header");
  if (!header) return;

  let loaded = false;

  header.addEventListener("click", () => {

    const isOpen = panelEl.classList.toggle("open");
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");

    if (isOpen && !loaded) {
      loaded = true;
      onFirstOpen?.();
    }

  });

}

function renderMarineBulletinError(contentEl, message) {

  contentEl.innerHTML = `
    <div class="info-panel-error">
      ${message}
      <br>
      <a href="${MARINE_BULLETIN_PAGE_URL}" target="_blank" rel="noopener">
        Avaa säätiedotus ilmatieteenlaitos.fi:ssä ↗
      </a>
    </div>
  `;

}

async function loadMarineBulletin(contentEl, { showLoading = true } = {}) {

  if (showLoading) {
    contentEl.innerHTML = `<div class="info-panel-loading">Ladataan…</div>`;
  }

  try {

    const html = await fetchMarineBulletinHtml();
    const bulletin = parseMarineBulletinHtml(html);

    contentEl.innerHTML = renderMarineBulletinHtml(bulletin);

  } catch (err) {

    console.warn("Säätiedotuksen haku epäonnistui:", err);
    renderMarineBulletinError(
      contentEl,
      "Säätiedotuksen haku ei onnistunut juuri nyt."
    );

  }

}

export function initMarineInfoPanels() {

  const marinePanel = document.getElementById("marine-bulletin-panel");

  if (marinePanel) {

    const contentEl = marinePanel.querySelector(".marine-bulletin-content");

    setupPanel(marinePanel, {
      onFirstOpen: () => {
        loadMarineBulletin(contentEl);

        // Tiedote päivittyy FMI:llä n. 6 kertaa vuorokaudessa – haetaan
        // tuore versio kerran tunnissa niin kauan kuin sivu on auki.
        setInterval(
          () => loadMarineBulletin(contentEl, { showLoading: false }),
          MARINE_BULLETIN_REFRESH_MS
        );
      }
    });

  }

}
