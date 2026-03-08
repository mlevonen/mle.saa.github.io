export class WeatherMarkerManager {

  constructor(map, markerRegistry) {
    this.map = map
    this.markerRegistry = markerRegistry
    this.previewData = {}
  }

  createMarker(station, preview) {

    const marker = L.marker(
      [station.lat, station.lon],
      {
        icon: L.divIcon({
          className: "weather-marker-wrapper",
          html: this.renderPreview(preview),
          iconSize: [40, 40]
        })
      }
    )

    marker.addTo(this.map)

    this.markerRegistry[station.id] = marker
  }

  updateMarker(stationId, preview) {

    const marker = this.markerRegistry[stationId]
    if (!marker) return

    marker.setIcon(
      L.divIcon({
        className: "weather-marker-wrapper",
        html: this.renderPreview(preview),
        iconSize: [40, 40]
      })
    )
  }

  updatePreview(station, observation) {

    const preview = this.buildPreview(observation)

    this.previewData[station.id] = preview

    if (!this.markerRegistry[station.id]) {
      this.createMarker(station, preview)
    } else {
      this.updateMarker(station.id, preview)
    }
  }

  buildPreview(observation) {

    return {
      symbol: observation.symbol,
      temperature: observation.temperature,
      timestamp: observation.time
    }
  }

  renderPreview(preview) {

    return `
      <div class="weather-marker">
        <img class="weather-icon"
             src="/icons/weather/${preview.symbol}.svg">

        <div class="weather-temp">
          ${Math.round(preview.temperature)}°
        </div>
      </div>
    `
  }
}