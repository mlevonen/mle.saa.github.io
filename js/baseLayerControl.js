// ==========================
// Taustakartan valitsin (OSM / MML)
//
// Korvaa Leafletin oletusarvoisen "layers"-kontrollin (pino-ikoni)
// pienellä pyöreäkulmaisella "Taustakartta"-napilla, joka avaa
// samantyylisen pudotusvalikon kuin muut kartan omat kontrollit
// (ks. radarPanel.js).
// ==========================

export function initBaseLayerControl(map, layers) {
  // layers: [{ name: "OpenStreetMap", layer: osmLayer }, ...]

  const BaseLayerControl = L.Control.extend({

    options: { position: "bottomright" },

    onAdd() {

      const container = L.DomUtil.create("div", "baselayer-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "baselayer-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Taustakartta";
      toggleBtn.innerHTML = "🗺️ Taustakartta";

      const panel = L.DomUtil.create("div", "baselayer-panel", container);

      let open = false;

      function openPanel() {
        open = true;
        container.classList.add("open");
      }

      function closePanel() {
        open = false;
        container.classList.remove("open");
      }

      layers.forEach((entry, i) => {

        const optionId = `baselayer-option-${i}`;

        const label = L.DomUtil.create("label", "baselayer-option", panel);
        label.htmlFor = optionId;

        const radio = L.DomUtil.create("input", "", label);
        radio.type = "radio";
        radio.name = "baselayer";
        radio.id = optionId;
        radio.checked = map.hasLayer(entry.layer);

        const span = L.DomUtil.create("span", "", label);
        span.textContent = entry.name;

        L.DomEvent.on(radio, "change", () => {
          layers.forEach(other => {
            if (map.hasLayer(other.layer)) map.removeLayer(other.layer);
          });
          map.addLayer(entry.layer);
          closePanel();
        });

      });

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

  map.addControl(new BaseLayerControl());

}
