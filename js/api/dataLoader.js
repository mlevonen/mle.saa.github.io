import {
  fetchTimeSeriesREST,
  fetchForecastREST
} from "../api/fmiApi.js";

const popupCache = {};

export async function loadPopupData(lat, lon) {
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

  const obsPressure = await fetchTimeSeriesREST(lat, lon, {
  param: "utctime,pressurehpa"
  });

  const fcPressure = await fetchForecastREST(lat, lon, {
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




  const data = {
    obsTemp,
    fcTemp,
    obsWindSpeed,
    obsPressure,
    fcPressure, 
    fcWindSpeed,
    fcWindDir,
    fcWindGust
  };

  popupCache[cacheKey] = data;
  return data;
}
