export async function fetchObservationByFmisid(fmisid, parameters) {

  const now = new Date();
  const start = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const end = now.toISOString();

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::timevaluepair",
    fmisid: fmisid,
    parameters: "windspeedms,winddirection",
    starttime: start,
    endtime: end,
    outputFormat: "application/json"
  });

  const res = await fetch(`https://opendata.fmi.fi/wfs/fin?${params}`);

  if (!res.ok) throw new Error("Observation fetch failed");

  return res.json();
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
  
})

{

  const cacheKey = `${lat},${lon}`;

  if (popupCache[cacheKey]) {
      return popupCache[cacheKey];
  }


let obsTemp = null;
let obsWindSpeed = null;
let obsWeather = null;

if (weatherFmisid) {

  const tempData = await fetchObservationByFmisid(
    weatherFmisid,
    "utctime,temperature,weathercode"
  );

  const windData = await fetchObservationByFmisid(
    weatherFmisid,
    "utctime,windspeedms,winddirection,windgust,pressure"
  );

  const weatherData = await fetchObservationByFmisid(
    weatherFmisid,
    "utctime,smartsymbol"
  );

  obsTemp = tempData;
  obsWindSpeed = windData;
  obsWeather = weatherData;

  console.log(data.obsWindSpeed?.at(-1));

}



  
  const fcTemp = await fetchForecastREST(lat, lon, {
    param: "utctime,temperature"
  });


  const obsPressure = weatherFmisid
  ? await fetchPressureByFmisid(weatherFmisid)
  : null;



  const sunTimes = await fetchSunTimes(lat, lon);

  const fcWindSpeed = await fetchForecastREST(lat, lon, {
    param: "utctime,windspeedms"
  });

  const fcWindDir = await fetchForecastREST(lat, lon, {
    param: "winddirection"
  });

  const fcWindGust = await fetchForecastREST(lat, lon, {
    param: "utctime,hourlymaximumgust"
  });

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
    fcTemp,
    obsWindSpeed,
    obsPressure,
    obsWeather,
    fcWindSpeed,
    fcWindDir,
    fcWindGust,
    seaLevel,
    sunTimes
  };

  popupCache[cacheKey] = data;
  return data;
}
