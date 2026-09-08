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

import { CHANGELOG, CHANGELOG_NOTE, CHANGELOG_CONTACT_EMAIL } from "./changelogData.js";

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

      const note = L.DomUtil.create("div", "changelog-note", panel);
      note.textContent = CHANGELOG_NOTE;

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

      const contact = L.DomUtil.create("div", "changelog-contact", panel);
      contact.innerHTML = `Kysyttävää tai palautetta? <a href="mailto:${CHANGELOG_CONTACT_EMAIL}">${CHANGELOG_CONTACT_EMAIL}</a>`;

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
