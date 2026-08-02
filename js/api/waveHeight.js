// ==========================
// Aallonkorkeus (Ilmatieteen laitoksen WAM-aaltomalli)
//
// Tämä on malliennuste, ei kiinteä poijuverkosto – Ilmatieteen
// laitoksen avoimessa datassa ei ole erillisiä aaltohavaintoasemia.
// Ennustetta voi kuitenkin hakea miltä tahansa koordinaatilta.
// Tarkin avoimella merellä; aivan rantaviivan tuntumassa tai
// kapeissa salmissa/satama-altaissa arvo voi puuttua tai olla
// epäluotettava, koska aaltomalli ei laske näitä alueita luotettavasti.
// ==========================

const WAVE_URL = "https://opendata.fmi.fi/wfs";

const waveCache = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export async function fetchWaveHeight(lat, lon) {

  const cacheKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  const cached = waveCache[cacheKey];

  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.value;
  }

  try {

    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      storedquery_id: "fmi::forecast::wam::point::simple",
      latlon: `${lat},${lon}`
    });

    const res = await fetch(`${WAVE_URL}?${params}`);

    if (!res.ok) {
      console.warn("Aallonkorkeuden haku epäonnistui:", res.status);
      return null;
    }

    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");

    const elements = xml.querySelectorAll(
      "BsWfs\\:BsWfsElement, BsWfsElement"
    );

    // Elementit ovat aikajärjestyksessä, joten kunkin parametrin
    // ENSIMMÄINEN esiintymä on lähin tuleva ennustetunti.
    let height = null;
    let period = null;
    let direction = null;

    for (const el of elements) {

      const nameNode = el.querySelector(
        "BsWfs\\:ParameterName, ParameterName"
      );
      const valueNode = el.querySelector(
        "BsWfs\\:ParameterValue, ParameterValue"
      );

      if (!nameNode || !valueNode) continue;

      const name = nameNode.textContent.trim();
      const value = Number(valueNode.textContent);
      if (!Number.isFinite(value)) continue;

      if (name === "SigWaveHeight" && height == null) height = value;
      if (name === "WavePeriod" && period == null) period = value;
      if (name === "WaveDirection" && direction == null) direction = value;

      if (height != null && period != null && direction != null) break;

    }

    const result = height != null ? { height, period, direction } : null;

    waveCache[cacheKey] = { time: Date.now(), value: result };
    return result;

  } catch (err) {

    console.warn("Aallonkorkeuden haku epäonnistui:", err);
    return null;

  }

}
