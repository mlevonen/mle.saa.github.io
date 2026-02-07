import { fetchTimeSeriesREST, fetchForecastREST } from "./fmiApi.js";

const popupCache = {};

export async function loadPopupData(lat, lon) {
  const key = `${lat},${lon}`;
  if (popupCache[key]) return popupCache[key];

  const data = {
    const obsTemp = await fetchTimeSeriesREST(lat, lon, {
      param: "utctime,temperature,weathercode"}),

    fcTemp: await fetchForecastREST(lat, lon, { param: "utctime,temperature" }),
    obsWindSpeed: await fetchTimeSeriesREST(lat, lon, {
      param: "utctime,windspeedms,winddirection,windgust"
    }),
    fcWindSpeed: await fetchForecastREST(lat, lon, { param: "utctime,windspeedms" }),
    fcWindDir: await fetchForecastREST(lat, lon, { param: "winddirection" }),
    fcWindGust: await fetchForecastREST(lat, lon, {
      param: "utctime,hourlymaximumgust"
    })
  };

  popupCache[key] = data;
  return data;
}
