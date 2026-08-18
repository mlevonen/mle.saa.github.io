// ==========================
// Tietolähteet / käyttöoikeudet -kontrolli
//
// Sama visuaalinen tyyli kuin taustakartan valitsimessa (pieni
// pyöreäkulmainen nappi + pudotuspaneeli). Listaa kaikki sivustolla
// aktiivisesti käytetyt avoimen datan lähteet lisensseineen, jotta
// käyttö avoimen datan ehtojen puitteissa on läpinäkyvää.
// ==========================

const SOURCES = [
  {
    name: "Ilmatieteen laitos",
    use: "Havainnot, ennusteet, vedenkorkeus, aallonkorkeus, säätiedotteet ja varoitukset",
    license: "CC BY 4.0",
    url: "https://www.ilmatieteenlaitos.fi/avoin-data-lisenssi"
  },
  {
    name: "Maanmittauslaitos",
    use: "MML Taustakartta (vaihtoehtoinen karttapohja)",
    license: "CC BY 4.0",
    url: "https://www.maanmittauslaitos.fi/aineistot-palvelut/latauspalvelut/avoimien-aineistojen-tiedostopalvelu"
  },
  {
    name: "OpenStreetMap",
    use: "Taustakartta (oletus)",
    license: "ODbL 1.0 · © OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright"
  },
  {
    name: "Open-Meteo",
    use: "Tuuliennusteanimaatio sekä Ruotsin ja Viron tuulipisteet",
    license: "CC BY 4.0 (ei-kaupallinen käyttö)",
    url: "https://open-meteo.com/en/licence"
  }
];

export function initDataLicenseControl(map) {

  const DataLicenseControl = L.Control.extend({

    options: { position: "bottomright" },

    onAdd() {

      const container = L.DomUtil.create("div", "datalicense-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "datalicense-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Tietolähteet ja käyttöoikeudet";
      toggleBtn.innerHTML = "📄 Käyttöoikeudet";

      const panel = L.DomUtil.create("div", "datalicense-panel", container);

      const header = L.DomUtil.create("div", "datalicense-panel-header", panel);
      header.textContent = "Avoin data";

      const intro = L.DomUtil.create("div", "datalicense-panel-intro", panel);
      intro.textContent = "Sivusto käyttää seuraavia avoimen datan lähteitä niiden omien käyttöehtojen mukaisesti:";

      SOURCES.forEach(source => {

        const item = L.DomUtil.create("div", "datalicense-item", panel);

        const nameRow = L.DomUtil.create("div", "datalicense-item-name", item);
        nameRow.textContent = source.name;

        const useRow = L.DomUtil.create("div", "datalicense-item-use", item);
        useRow.textContent = source.use;

        const licenseRow = L.DomUtil.create("div", "datalicense-item-license", item);

        const badge = L.DomUtil.create("span", "datalicense-badge", licenseRow);
        badge.textContent = source.license;

        const link = L.DomUtil.create("a", "datalicense-link", licenseRow);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Lisätietoa ↗";

      });

      let open = false;

      function openPanel() {
        open = true;
        container.classList.add("open");
      }

      function closePanel() {
        open = false;
        container.classList.remove("open");
      }

      L.DomEvent.on(toggleBtn, "click", () => {
        if (open) {
          closePanel();
        } else {
          openPanel();
        }
      });

      return container;

    }

  });

  map.addControl(new DataLicenseControl());

}
