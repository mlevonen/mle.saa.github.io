// ==========================
// Muutokset-kontrolli
//
// Sama visuaalinen tyyli ja pudotuspaneeli-kuvio kuin taustakartan,
// käyttöoikeuksien ja palautteen napeilla (ks. baseLayerControl.js /
// dataLicenseControl.js / feedbackControl.js). Näyttää käyttäjälle
// listan viimeisimmistä sivustolle tehdyistä muutoksista, jotta
// palaava käyttäjä näkee helposti mikä on muuttunut. Sisältö tulee
// changelogData.js:stä – sitä päivitetään erikseen aina kun tehdään
// käyttäjän huomaama muutos.
// ==========================

import { CHANGELOG } from "./changelogData.js";

export function initChangelogControl(map) {

  const ChangelogControl = L.Control.extend({

    options: { position: "bottomright" },

    onAdd() {

      const container = L.DomUtil.create("div", "changelog-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "changelog-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Näytä viimeisimmät muutokset";
      toggleBtn.innerHTML = "🆕 Muutokset";

      const panel = L.DomUtil.create("div", "changelog-panel", container);

      const header = L.DomUtil.create("div", "changelog-panel-header", panel);
      header.textContent = "Viimeisimmät muutokset";

      const list = L.DomUtil.create("div", "changelog-list", panel);

      for (const entry of CHANGELOG) {
        const entryEl = L.DomUtil.create("div", "changelog-entry", list);

        const dateEl = L.DomUtil.create("div", "changelog-date", entryEl);
        dateEl.textContent = entry.date;

        const itemsEl = L.DomUtil.create("ul", "changelog-items", entryEl);
        for (const item of entry.items) {
          const li = L.DomUtil.create("li", "", itemsEl);
          li.textContent = item;
        }
      }

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

  map.addControl(new ChangelogControl());

}
