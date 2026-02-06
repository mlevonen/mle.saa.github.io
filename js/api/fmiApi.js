export async function fetchTimeSeriesREST(lat, lon, params) {
  const now = new Date();
  const past = new Date(now.getTime() - 12 * 3600_000).toISOString();
  const future = new Date(now.getTime() + 36 * 3600_000).toISOString();

  const urlParams = new URLSearchParams({
    latlon: `${Number(lat)},${Number(lon)}`,
    starttime: past,
    endtime: future,
    format: "json",
    ...params
  });

  const res = await fetch(
    `https://opendata.fmi.fi/timeseries?${urlParams}`
  );

  if (!res.ok) throw new Error("FMI REST fetch failed");
  return res.json();
}

export async function fetchForecastREST(lat, lon, params) {
  const now = new Date();
  const future = new Date(now.getTime() + 36 * 3600_000).toISOString();

  const urlParams = new URLSearchParams({
    latlon: `${Number(lat)},${Number(lon)}`,
    starttime: now.toISOString(),
    endtime: future,
    format: "json",
    source: "forecast",
    ...params
  });

  const res = await fetch(
    `https://opendata.fmi.fi/timeseries?${urlParams}`
  );

  if (!res.ok) throw new Error("FMI forecast fetch failed");
  return res.json();
}
