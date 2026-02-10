import {
  fetchTimeSeriesREST,
  fetchForecastREST
} from "../api/fmiApi.js";

import { fetchSeaLevel } from "../api/sealevel.js";


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
    console.log("CACHE HIT", cacheKey);
    return popupCache[cacheKey];
  }

  console.log("CACHE MISS", cacheKey);

  const obsTemp = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,temperature,weathercode"
  });

  const fcTemp = await fetchForecastREST(lat, lon, {
    param: "utctime,temperature"
  });

  const obsWindSpeed = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,windspeedms,winddirection,windgust,pressurehpa"
  });

  const obsPressure = await fetchPressureByPlace(null, null, {
  place: weatherPlace,
  param: "utctime,pressurehpa"
  });


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


  console.log("Sea level fmisid", seaLevelFmisid);



  const data = {
    obsTemp,
    fcTemp,
    obsWindSpeed,
    obsPressure,
    fcWindSpeed,
    fcWindDir,
    fcWindGust,
    seaLevel
  };

  popupCache[cacheKey] = data;
  return data;
}
