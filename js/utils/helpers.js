import { parseFmiUtc } from "./time.js";

export function getLatestObservation(data, timeKey, valueKey) {
  if (!Array.isArray(data)) return null;

  const now = Date.now();

  const past = data
    .map(d => ({
      t: parseFmiUtc(d[timeKey]),
      v: d[valueKey]
    }))
    .filter(p => p.t && p.t.getTime() <= now && p.v != null);

  return past.length ? past.at(-1) : null;
}
