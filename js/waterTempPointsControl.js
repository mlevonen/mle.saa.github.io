// ==========================
// "Vedenlämpö"-kontrolli – näyttää/piilottaa kartalla pallomerkit
// vedenlämpöpisteistä, JOILLA EI ole omaa havaintoasemaa sivustolla
// (ks. js/api/waterTempPoints.js: SYKE:n sisävesiasemat + pk-seudun
// UiRaS-uimapaikat, molemmista suodatettu pois sivuston omien
// asemien läheisyydessä olevat pisteet).
//
// Piilossa oletuksena ja togglataan yhdellä napilla (ei erillistä
// pudotuspaneelia kuten Taustakartta/Käyttöoikeudet/Muutokset-napeissa)
// – käyttäjän oma toive oli nimenomaan yksinkertainen päälle/pois-nappi,
// koska KAIKKIEN vedenlämpöjen näyttäminen kerralla tekisi kartasta
// sekavan, jos se olisi aina päällä.
//
// Pallot rakennetaan L.divIcon-merkkeinä (väri = waterTempColor(),
// sama asteikko kuin asemakorttien Veden lämpötila -kortissa) ja
// pidetään omassa L.layerGroupissa, jotta koko joukon voi lisätä/
// poistaa kartalta yhdellä kertaa ilman, että pitää muistaa yksittäisiä
// markereita.
// ==========================

import { fetchWaterTempPoints } from "./api/waterTempPoints.js";
import { waterTempColor } from "./popup/seaLevelCard.js";

function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sourceLabel(source) {
  return source === "uiras"
    ? "Helsingin kaupunki / Forum Virium Helsinki (UiRaS-avoin data)"
    : "Suomen ympäristökeskus (SYKE), Hydrologiarajapinta";
}

function pointPopupHTML(point) {
  const time = formatTime(point.time);
  return `
    <div class="watertemp-popup">
      <div class="watertemp-popup-title">${point.name}</div>
      <div class="watertemp-popup-value">${point.temp.toFixed(1)} °C</div>
      ${time ? `<div class="watertemp-popup-time">Havaittu: ${time}</div>` : ""}
      <div class="watertemp-popup-source">Lähde: ${sourceLabel(point.source)}</div>
    </div>
  `;
}

function createPointMarker(point) {

  const rounded = Math.round(point.temp);

  const icon = L.divIcon({
    className: "watertemp-marker",
    html: `<div class="watertemp-marker-circle" style="background:${waterTempColor(point.temp)}">${rounded}°</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });

  return L.marker([point.lat, point.lon], { icon })
    .bindPopup(pointPopupHTML(point));

}

export function initWaterTempPointsControl(map) {

  const layerGroup = L.layerGroup();
  let loaded = false;
  let visible = false;

  const WaterTempControl = L.Control.extend({

    options: { position: "bottomleft" },

    onAdd() {

      const container = L.DomUtil.create("div", "watertemp-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "watertemp-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Näytä/piilota vedenlämpöpisteet kartalla";
      toggleBtn.innerHTML = "💧 Vedenlämpö";

      async function showPoints() {

        toggleBtn.classList.add("loading");

        try {

          const points = await fetchWaterTempPoints();

          if (!loaded) {
            points.forEach(p => layerGroup.addLayer(createPointMarker(p)));
            loaded = true;
          }

          layerGroup.addTo(map);
          visible = true;
          toggleBtn.classList.add("active");

        } catch (err) {
          console.warn("Vedenlämpöpisteiden näyttäminen epäonnistui:", err);
        } finally {
          toggleBtn.classList.remove("loading");
        }

      }

      function hidePoints() {
        map.removeLayer(layerGroup);
        visible = false;
        toggleBtn.classList.remove("active");
      }

      L.DomEvent.on(toggleBtn, "click", () => {
        if (visible) {
          hidePoints();
        } else {
          showPoints();
        }
      });

      return container;

    }

  });

  map.addControl(new WaterTempControl());

}
