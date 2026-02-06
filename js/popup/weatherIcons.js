export function weatherCodeToIcon(code) {
  if (code == null) return "cloudy.svg";

  // Selkeää / puolipilvistä
  if (code === 0) return "clear.svg";
  if (code === 1 || code === 2) return "partly-cloudy.svg";

  // Pilvistä
  if (code === 3 || code === 4) return "cloudy.svg";

  // Sumu / usva
  if (code >= 45 && code <= 49) return "fog.svg";

  // Kuurot
  if (code >= 50 && code <= 59)
    return "shovers.svg";

  // Vesisade
  if (code >= 60 && code <= 64)
    return "rain.svg";

  if (code >= 65 && code <= 69)
    return "heavy_rain.svg";

  // Lumisade
  if (code >= 70 && code <= 74)
    return "snow.svg";

  if (code >= 75 && code <= 79)
    return "snow_heavy.svg";

  // Rankat kuurot
  if (code >= 80 && code <= 84)
    return "Partly_sunny_heavy_showers..svg";

  // Ukkonen
  if (code >= 90 && code <= 94)
    return "T-storms.svg";

  if (code >= 95)
    return "heavy_T-storms.svg";

  return "cloudy.svg";
}
