import {
  fetchTimeSeriesREST,
  fetchForecastREST
} from "../api/fmiApi.js";

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

  const obsTemp = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,temperature,weathercode"
  });

  const fcTemp = await fetchForecastREST(lat, lon, {
    param: "utctime,temperature"
  });

  const obsWindSpeed = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,windspeedms,winddirection,windgust,pressurehpa"
  });

  const obsPressure = weatherFmisid
  ? await fetchPressureByFmisid(weatherFmisid)
  : null;

  const obsWeather = await fetchTimeSeriesREST(lat, lon, {
  param: "utctime,smartsymbol"
  });

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
