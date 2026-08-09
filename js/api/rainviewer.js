// ==========================
// RainViewer-sadetutkadata (api.rainviewer.com)
//
// Vaihtoehto Ilmatieteen laitoksen avoimelle WMS-tutkakuvalle:
// RainViewerin tiilet ovat valmiiksi pehmennettyjä (väri-
// interpolointi/blur), joten ne eivät näytä yhtä rasteroituneilta/
// lohkoisilta kuin raaka WMS-tutkakuva.
//
// Rajapinta palauttaa vain menneet/nykyiset kehykset (radar.past,
// n. 2 h historiaa 10 min välein) – ei ennustetta, sama rajoitus
// kuin aiemmassa FMI-toteutuksessa.
//
// Ilmainen käyttö edellyttää RainViewerin mukaan attribuution
// näkymistä sovelluksessa – ks. radarLayerin attribution-optio
// main.js:ssä ("Weather data by RainViewer" + linkki).
// ==========================

const API_URL = "https://api.rainviewer.com/public/weather-maps.json";

export async function fetchRadarFrames() {

  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error("RainViewer-tutkadatan haku epäonnistui");
  }

  const data = await res.json();
  const past = data?.radar?.past ?? [];

  return {
    host: data.host,
    frames: past.map(f => ({
      time: new Date(f.time * 1000),
      path: f.path
    }))
  };

}

// size 256 px, väriskeema 2, pehmennys päällä (1) ja lumi omalla
// värillään (1) – ks. https://www.rainviewer.com/api/color-schemes.html
export function radarTileUrl(host, path) {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}
