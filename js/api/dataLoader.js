export async function fetchObservationSeriesByFmisid(fmisid) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::timevaluepair",
    fmisid,
    parameters: "ws_10min,t2m,smartsymbol,pressure,wd_10min,wg_10min"
  });

  const url = `https://opendata.fmi.fi/wfs/fin?${params}`;

  const res = await fetch(url);
  const text = await res.text();

  return parseTimeValuePairSeries(text);
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

import { fetchWindGustObservations } 
  from "../api/fetchWindGustObservations.js";


const popupCache = {};

//LOADPOPUPDATA

export async function loadPopupData({
  lat,
  lon,
  weatherPlace,
  weatherFmisid,
  seaLevelFmisid
}) {


  const obsWindGust =
  await fetchWindGustObservations(weatherFmisid);


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

      obsWindSpeed = series.map(p => ({
      utctime: p.utctime,
      windspeedms: p.windspeedms,
      winddirection: p.winddirection,
      windgust: p.windgust,
      smartsymbol: p.smartsymbol   // ← LISÄÄ TÄMÄ
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
    fcWindGust,
    obsWindGust

  };

}
// ======================================================
// PARSE TIMEVALUEPAIR SERIES
// ======================================================

function parseTimeValuePairSeries(xmlText) {

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");

  const seriesNodes =
    xml.getElementsByTagNameNS("*", "MeasurementTimeseries");

  const combined = {};

  for (let s of seriesNodes) {

    const id = s.getAttributeNS("*", "id");
    if (!id) continue;

    let name = null;

    if (id.includes("ws_10min")) name = "windspeedms";
    else if (id.includes("wd_10min")) name = "winddirection";
    else if (id.includes("wg_10min")) name = "windgust";
    else if (id.includes("t2m")) name = "temperature";
    else if (id.includes("pressure")) name = "pressure";
    else if (id.includes("smartsymbol")) name = "smartsymbol";

    if (!name) continue;

    const points =
      s.getElementsByTagNameNS("*", "MeasurementTVP");

    for (let p of points) {

      const time =
        p.getElementsByTagNameNS("*", "time")[0]?.textContent;

      const value =
        p.getElementsByTagNameNS("*", "value")[0]?.textContent;

      if (!time) continue;

      if (!combined[time]) {
        combined[time] = { utctime: time };
      }

      combined[time][name] =
        value === "NaN" ? null : Number(value);
    }
  }

  return Object.values(combined)
    .sort((a, b) =>
      new Date(a.utctime) - new Date(b.utctime)
    );
}