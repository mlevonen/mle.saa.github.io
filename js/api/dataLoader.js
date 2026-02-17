export async function fetchObservationSeriesByFmisid(fmisid) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::simple",
    fmisid
  });

  const res = await fetch(`https://opendata.fmi.fi/wfs/fin?${params}`);

  if (!res.ok) throw new Error("Observation fetch failed");

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const elements = [...xml.getElementsByTagName("BsWfs:BsWfsElement")];

  const series = {};

  elements.forEach(el => {

    const timeNode = el.getElementsByTagName("BsWfs:Time")[0];
    const nameNode = el.getElementsByTagName("BsWfs:ParameterName")[0];
    const valueNode = el.getElementsByTagName("BsWfs:ParameterValue")[0];

    if (!timeNode || !nameNode || !valueNode) return;

    const time = timeNode.textContent;
    const name = nameNode.textContent;
    const value = Number(valueNode.textContent);

    if (!series[time]) {
      series[time] = { utctime: time };
    }

    if (name === "t2m") series[time].temperature = value;
    if (name === "ws_10min") series[time].windspeedms = value;
    if (name === "wd_10min") series[time].winddirection = value;
    if (name === "wg_10min") series[time].windgust = value;
    if (name === "pressure") series[time].pressurehpa = value;
  });

  return Object.values(series).sort(
    (a, b) => new Date(a.utctime) - new Date(b.utctime)
  );
}




import {
  fetchTimeSeriesREST,
  fetchForecastREST
} from "../api/fmiApi.js";

import { fetchHarmonieForecastByFmisid } 
  from "../api/fetchHarmonieForecastByFmisid.js";

import { fetchSeaLevel } from "../api/sealevel.js";

import { fetchPressureByFmisid } from "../api/fetchPressureByPlace.js";

import { fetchSunTimes } from "../api/sunApi.js";

const popupCache = {};

//LOADPOPUPDATA

export async function loadPopupData({
  lat,
  lon,
  weatherPlace,
  weatherFmisid,
  seaLevelFmisid
}) {

  const cacheKey = `${lat},${lon}`;

  if (popupCache[cacheKey]) {
    return popupCache[cacheKey];
  }

  let obsTemp = null;
  let obsWindSpeed = null;
  let obsPressure = null;
  let seaLevel = null;

  // ==========================
  // HAVAINNOT
  // ==========================
  if (weatherFmisid) {

    const series =
      await fetchObservationSeriesByFmisid(weatherFmisid);

    if (Array.isArray(series) && series.length) {

      obsTemp = series.map(p => ({
        utctime: p.utctime,
        temperature: p.temperature
      }));

      obsWindSpeed = series.map(p => ({
        utctime: p.utctime,
        windspeedms: p.windspeedms,
        winddirection: p.winddirection,
        windgust: p.windgust
      }));

      obsPressure = series.map(p => ({
        utctime: p.utctime,
        pressurehpa: p.pressure
      }));
    }
  }

  // ==========================
  // ENNUSTEET
  // ==========================

  const harmonie = await fetchHarmonieForecastByFmisid(weatherFmisid);

  const fcTemp = harmonie?.fcTemp ?? [];
  const fcWindSpeed = harmonie?.fcWindSpeed ?? [];
  const fcWindDir = harmonie?.fcWindDir ?? [];
  const fcWindGust = harmonie?.fcWindGust ?? [];

  // ==========================
  // VEDENKORKEUS
  // ==========================
  if (seaLevelFmisid) {
    try {
      seaLevel = await fetchSeaLevel(seaLevelFmisid);
    } catch (e) {
      seaLevel = null;
    }
  }

  // ==========================
  // AURINGON NOUSU / LASKU
  // ==========================
  const sunTimes = await fetchSunTimes(lat, lon);

  // ==========================
  // DATA OBJEKTI
  // ==========================
  const data = {
    obsTemp,
    obsWindSpeed,
    obsPressure,
    seaLevel,
    sunTimes,
    fcTemp,
    fcWindSpeed,
    fcWindDir,
    fcWindGust

  };
  console.log("Forecast sample:", fcWindSpeed?.slice(0,3));

  popupCache[cacheKey] = data;
  return data;
}
