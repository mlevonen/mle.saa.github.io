import { updateWeatherPreview } from "./weatherPreview.js";
import { fetchSmartSymbolsByFmisid } from "../services/fetchSmartSymbolsByFmisid.js";

export async function fetchObservationSeriesByFmisid(fmisid) {
console.log("Using FMISID:", fmisid);
  if (!fmisid) return [];

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

  const parsed = parseTimeValuePairSeries(text);
  console.log("PARSED SERIES:", parsed.slice(0,5));

  return parsed;
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

  const series = await fetchObservationSeriesByFmisid(weatherFmisid);

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
  const smartSymbols = await fetchSmartSymbolsByFmisid(weatherFmisid);
  let fcTemp = harmonie?.fcTemp ?? [];
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

console.log("fcTemp", fcTemp.length);
console.log("symbols", smartSymbols);

function attachSymbols(fcTemp, symbols) {

  if (!symbols?.length) return fcTemp;

  return fcTemp.map(p => {

    const t = new Date(p.utctime).getTime();

    let closest = null;
    let diff = Infinity;

    for (const s of symbols) {

      const d = Math.abs(s.time.getTime() - t);

      if (d < diff) {
        diff = d;
        closest = s;
      }

    }

    return {
      ...p,
      symbol: closest?.symbol ?? null
    };

  });

}



  // ==========================
  // AURINGON NOUSU / LASKU
  // ==========================
  const sunTimes = await fetchSunTimes(lat, lon);
  fcTemp = attachSymbols(fcTemp, smartSymbols);

  console.log("symbols sample", smartSymbols.slice(0,5));

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
  popupCache[cacheKey] = data;
  return data;
}
// ======================================================
// PARSE TIMEVALUEPAIR SERIES
// ======================================================

function parseTimeValuePairSeries(xmlText) {

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");

  const combined = {};

  const seriesNodes = xml.querySelectorAll("*|MeasurementTimeseries");

  seriesNodes.forEach(series => {

    const id = series.getAttribute("gml:id") || "";
    if (!id) return;

    let key = null;

    if (id.includes("ws_10min")) key = "windspeedms";
    else if (id.includes("wd_10min")) key = "winddirection";
    else if (id.includes("wg_10min")) key = "windgust";
    else if (id.includes("t2m")) key = "temperature";
    else if (id.includes("pressure")) key = "pressure";
    else if (id.includes("smartsymbol")) key = "smartsymbol";

    if (!key) return;

    const points = series.querySelectorAll("*|MeasurementTVP");

    points.forEach(point => {

      const timeNode = point.querySelector("*|time");
      const valueNode = point.querySelector("*|value");

      if (!timeNode || !valueNode) return;

      const time = timeNode.textContent;
      const value = valueNode.textContent;

      if (!combined[time]) {
        combined[time] = { utctime: time };
      }

      combined[time][key] =
        value === "NaN" ? null : Number(value);
    });
  });

  const result = Object.values(combined)
    .sort((a, b) =>
      new Date(a.utctime) - new Date(b.utctime)
    );

  return result;
}