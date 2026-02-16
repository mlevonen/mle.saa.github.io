export async function fetchLatestObservationByFmisid(fmisid) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::simple",
    fmisid
  });

  const res = await fetch(`https://opendata.fmi.fi/wfs/fin?${params}`);

  if (!res.ok) {
    const text = await res.text();
    console.error("FMI error response:", text);
    throw new Error("Observation fetch failed");
  }

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const elements = [...xml.getElementsByTagName("BsWfs:BsWfsElement")];

  const obs = {};
  let latestTime = null;

  elements.forEach(el => {

    const timeNode = el.getElementsByTagName("BsWfs:Time")[0];
    const nameNode = el.getElementsByTagName("BsWfs:ParameterName")[0];
    const valueNode = el.getElementsByTagName("BsWfs:ParameterValue")[0];

    if (!timeNode || !nameNode || !valueNode) return;

    const time = timeNode.textContent;
    const name = nameNode.textContent;
    const value = Number(valueNode.textContent);

    latestTime = time;

    if (name === "t2m") obs.temperature = value;
    if (name === "ws_10min") obs.windspeedms = value;
    if (name === "wg_10min") obs.windgust = value;
    if (name === "wd_10min") obs.winddirection = value;
    if (name === "pressure") obs.pressure = value;
  });

  obs.time = latestTime;

  return obs;
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

  let obsWindSpeed = null;
  let obsTemp = null;
  let obsPressure = null;

  if (weatherFmisid) {

    const latestObservation =
      await fetchLatestObservationByFmisid(weatherFmisid);

    if (latestObservation) {

      obsWindSpeed = [{
        utctime: latestObservation.time,
        windspeedms: latestObservation.windspeedms,
        winddirection: latestObservation.winddirection,
        windgust: latestObservation.windgust
      }];

      obsTemp = [{
        utctime: latestObservation.time,
        temperature: latestObservation.temperature
      }];

      obsPressure = [{
        utctime: latestObservation.time,
        pressurehpa: latestObservation.pressure
      }];
    }
  }

  const sunTimes = await fetchSunTimes(lat, lon);

  let seaLevel = null;

  if (seaLevelFmisid) {
    try {
      seaLevel = await fetchSeaLevel(seaLevelFmisid);
    } catch (e) {
      seaLevel = null;
    }
  }

  const data = {
    obsTemp,
    obsWindSpeed,
    obsPressure,
    seaLevel,
    sunTimes
  };

  popupCache[cacheKey] = data;
  return data;
}
