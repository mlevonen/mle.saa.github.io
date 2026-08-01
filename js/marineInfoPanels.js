// ==========================
// Säätiedotus merenkulkijoille + Varoitukset
// Kaksi avattavaa/piilotettavaa infopaneelia kartan vasempaan
// yläkulmaan. Sisältö ladataan vasta kun käyttäjä avaa paneelin
// ensimmäisen kerran, jotta kartan alkulataus ei hidastu turhaan.
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
// Varoitukset julkaistaan koneluettavana RSS-syötteenä, joten ne
// haetaan ja jäsennetään suoraan.
// ==========================

import { fetchMarineBulletinHtml } from "./api/marineBulletin.js";
import {
  parseMarineBulletinHtml,
  renderMarineBulletinHtml
} from "./popup/marineBulletinParser.js";

const WARNINGS_RSS_URL = "https://alerts.fmi.fi/cap/feed/rss_fi-FI.rss";
const MARINE_BULLETIN_PAGE_URL = "https://www.ilmatieteenlaitos.fi/saatiedotus-merenkulkijoille";
const WARNINGS_PAGE_URL = "https://www.ilmatieteenlaitos.fi/varoitukset";
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

function renderWarningsError(listEl, message) {

  listEl.innerHTML = `
    <div class="info-panel-error">
      ${message}
      <br>
      <a href="${WARNINGS_PAGE_URL}" target="_blank" rel="noopener">
        Avaa varoitukset ilmatieteenlaitos.fi:ssä ↗
      </a>
    </div>
  `;

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

function formatWarningDate(pubDate) {

  if (!pubDate) return "";

  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

}

async function loadWarnings(listEl) {

  listEl.innerHTML = `<div class="info-panel-loading">Ladataan…</div>`;

  try {

    const res = await fetch(WARNINGS_RSS_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");

    if (xml.querySelector("parsererror")) {
      throw new Error("RSS-jäsennys epäonnistui");
    }

    const items = Array.from(xml.querySelectorAll("item"));

    if (!items.length) {
      listEl.innerHTML = `<div class="info-panel-empty">Ei tällä hetkellä voimassa olevia varoituksia.</div>`;
      return;
    }

    listEl.innerHTML = items.slice(0, 15).map(item => {

      const title = item.querySelector("title")?.textContent?.trim() || "Varoitus";
      const link = item.querySelector("link")?.textContent?.trim() || WARNINGS_PAGE_URL;
      const dateLabel = formatWarningDate(item.querySelector("pubDate")?.textContent?.trim());
      const description = item.querySelector("description")?.textContent?.trim();

      return `
        <a class="warning-item" href="${link}" target="_blank" rel="noopener">
          <div class="warning-item-title">⚠️ ${title}</div>
          ${dateLabel ? `<div class="warning-item-date">${dateLabel}</div>` : ""}
          ${description ? `<div class="warning-item-desc">${description}</div>` : ""}
        </a>
      `;

    }).join("");

  } catch (err) {

    console.warn("Varoitusten RSS-haku epäonnistui:", err);
    renderWarningsError(
      listEl,
      "Varoitusten haku ei onnistunut juuri nyt."
    );

  }

}

export function initMarineInfoPanels() {

  const marinePanel = document.getElementById("marine-bulletin-panel");
  const warningsPanel = document.getElementById("warnings-panel");

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

  if (warningsPanel) {

    const listEl = warningsPanel.querySelector(".warnings-list");

    setupPanel(warningsPanel, {
      onFirstOpen: () => loadWarnings(listEl)
    });

  }

}
