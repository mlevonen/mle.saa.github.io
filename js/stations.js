const stations = [

  /*
   * =========================
   * SÄÄASEMAT (kaupunkipisteet)
   * =========================
   */

  {
    type: "weather",
    id: "helsinki-weather",
    name: "Helsinki",
    fmisid: 100971,
    lat: 60.17,
    lon: 24.95
  },

  {
    type: "weather",
    id: "porvoo-weather",
    name: "Porvoo",
    fmisid: 101004,
    lat: 60.39,
    lon: 25.66
  },

    {
    type: "weather",
    id: "asikkala-pulkkilanharju-weather",
    name: "Asikkala Pulkkilanharju",
    fmisid: 101185,
    lat: 61.27,
    lon: 25.52
  },

  {
    type: "weather",
    id: "luhanka-judinsalo-weather",
    name: "Luhanka Judinsalo",
    fmisid: 101362,
    lat: 61.7,
    lon: 25.51
  },

  {
    type: "weather",
    id: "tampere-siilinkari-weather",
    name: "Tampere Siilinkari",
    fmisid: 101311,
    lat: 61.52,
    lon: 23.75
  },

  {
    type: "weather",
    id: "lappeenranta-hiekkapakka-weather",
    name: "Lappeenranta Hiekkapakka",
    fmisid: 101252,
    lat: 61.2,
    lon: 28.47
  },

  {
    type: "weather",
    id: "rantasalmi-rukkasluoto-weather",
    name: "Rantasalmi Rukkasluoto",
    fmisid: 101436,
    lat: 62.06,
    lon: 28.57
  },

  {
    type: "weather",
    id: "liperi-tuiskavanluoto-weather",
    name: "Liperi Tuiskavanluoto",
    fmisid: 101628,
    lat: 62.55,
    lon: 29.67
  },

  {
    type: "weather",
    id: "kuopio-ritoniemi-weather",
    name: "Kuopio Ritoniemi",
    fmisid: 101580,
    lat: 62.8,
    lon: 27.9
  },

  {
    type: "weather",
    id: "inari-seitalaassa-weather",
    name: "Inari Seitalaassa",
    fmisid: 129963,
    lat: 69.05,
    lon: 27.76
  },

  {
    type: "weather",
    id: "kumlinge-kirkonkylä-weather",
    name: "Kumlinge kirkonkylä",
    fmisid: 100928,
    lat: 60.26,
    lon: 20.75
  },

  /*
   * =========================
   * VEDENKORKEUSASEMAT
   * =========================
   */

   {
    type: "sealevel",
    id: "föglö-sea",
    name: "Föglö Degerby",
    fmisid: 134252,
    lat: 60.00,
    lon: 20.40
  },

  {
    type: "sealevel",
    id: "hamina-sea",
    name: "Hamina Pitäjänsaari",
    fmisid: 134254,
    lat: 60.60,
    lon: 27.20
  },

  {
    type: "sealevel",
    id: "hanko-sea",
    name: "Hanko Pikku Kolalahti",
    fmisid: 134253,
    lat: 59.80,
    lon: 23.00
  },

  {
    type: "sealevel",
    id: "helsinki-sea",
    name: "Helsinki Kaivopuisto",
    fmisid: 132310,
    lat: 60.20,
    lon: 25.00
  },

  {
    type: "sealevel",
    id: "kaskinen-sea",
    name: "Kaskinen Ådskär",
    fmisid: 134251,
    lat: 62.30,
    lon: 21.20
  },

  {
    type: "sealevel",
    id: "kemi-sea",
    name: "Kemi Ajos",
    fmisid: 100539,
    lat: 65.70,
    lon: 24.50
  },

  {
    type: "sealevel",
    id: "oulu-sea",
    name: "Oulu Toppila",
    fmisid: 134248,
    lat: 65.00,
    lon: 25.40
  },

  {
    type: "sealevel",
    id: "pietarsaari-sea",
    name: "Pietarsaari Leppäluoto",
    fmisid: 134250,
    lat: 63.70,
    lon: 22.70
  },

  {
    type: "sealevel",
    id: "pori-sea",
    name: "Pori Mäntyluoto Kallo",
    fmisid: 134266,
    lat: 61.60,
    lon: 21.50
  },

  {
    type: "sealevel",
    id: "porvoo-sea",
    name: "Porvoo Emäsalo Vaarlahti",
    fmisid: 100669,
    lat: 60.20,
    lon: 25.60
  },

  {
    type: "sealevel",
    id: "raahe-sea",
    name: "Raahe Lapaluoto",
    fmisid: 100540,
    lat: 64.70,
    lon: 24.40
  },

  {
    type: "sealevel",
    id: "rauma-sea",
    name: "Rauma Petäjäs",
    fmisid: 134224,
    lat: 61.10,
    lon: 21.40
  },

  {
    type: "sealevel",
    id: "turku-sea",
    name: "Turku Ruissalo Saaronniemi",
    fmisid: 134225,
    lat: 60.40,
    lon: 22.10
  },

  {
    type: "sealevel",
    id: "vaasa-sea",
    name: "Vaasa Vaskiluoto",
    fmisid: 134223,
    lat: 63.10,
    lon: 21.60
  },

  /*
   * =========================
   * RANNIKKOASEMAT
   * =========================
   */

  {
    type: "coastal",
    id: "kotka-haapasaari",
    name: "Kotka Haapasaari",
    fmisid: 101042,
    lat: 60.29,
    lon: 27.18
  },

  {
    type: "coastal",
    id: "kotka-rankki",
    name: "Kotka Rankki",
    fmisid: 101030,
    lat: 60.38,
    lon: 26.96
  },

  {
    type: "coastal",
    id: "loviisa-orrengrund",
    name: "Loviisa Orrengrund",
    fmisid: 101039,
    lat: 60.27,
    lon: 26.45
  },

  {
    type: "coastal",
    id: "porvoo-kilpilahti-satama",
    name: "Porvoo Kilpilahti satama",
    fmisid: 100683,
    lat: 60.3,
    lon: 25.55
  },

  {
    type: "coastal",
    id: "porvoo-emäsalo",
    name: "Porvoo Emäsalo",
    fmisid: 101023,
    lat: 60.2,
    lon: 25.63
  },

  {
    type: "coastal",
    id: "porvoo-kalbådagrund",
    name: "Porvoo Kalbådagrund",
    fmisid: 101022,
    lat: 59.99,
    lon: 25.6
  },

  {
    type: "coastal",
    id: "helsinki-vuosaari-satama",
    name: "Helsinki Vuosaari satama",
    fmisid: 151028,
    lat: 60.21,
    lon: 25.2
  },

  {
    type: "coastal",
    id: "sipoo-itätoukki",
    name: "Sipoo Itätoukki",
    fmisid: 105392,
    lat: 60.1,
    lon: 25.19
  },

  {
    type: "coastal",
    id: "helsinki-harmaja",
    name: "Helsinki Harmaja",
    fmisid: 100996,
    lat: 60.11,
    lon: 24.98
  },

  {
    type: "coastal",
    id: "helsinki-helsingin-majakka",
    name: "Helsinki Helsingin majakka",
    fmisid: 101003,
    lat: 59.95,
    lon: 24.93
  },

  {
    type: "coastal",
    id: "kirkkonummi-mäkiluoto",
    name: "Kirkkonummi Mäkiluoto",
    fmisid: 100997,
    lat: 59.92,
    lon: 24.35
  },

  {
    type: "coastal",
    id: "inkoo-bågaskär",
    name: "Inkoo Bågaskär",
    fmisid: 100969,
    lat: 59.93,
    lon: 24.01
  },

  {
    type: "coastal",
    id: "raasepori-jussarö",
    name: "Raasepori Jussarö",
    fmisid: 100965,
    lat: 59.82,
    lon: 23.57
  },

  {
    type: "coastal",
    id: "hanko-tulliniemi",
    name: "Hanko Tulliniemi",
    fmisid: 100946,
    lat: 59.81,
    lon: 22.91
  },

  {
    type: "coastal",
    id: "hanko-russarö",
    name: "Hanko Russarö",
    fmisid: 100932,
    lat: 59.77,
    lon: 22.95
  },

  {
    type: "coastal",
    id: "kemiönsaari-vänö",
    name: "Kemiönsaari Vänö",
    fmisid: 100945,
    lat: 59.87,
    lon: 22.19
  },

  {
    type: "coastal",
    id: "parainen-utö",
    name: "Parainen Utö",
    fmisid: 100908,
    lat: 59.78,
    lon: 21.37
  },

  {
    type: "coastal",
    id: "kökar-bogskär",
    name: "Kökar Bogskär",
    fmisid: 100921,
    lat: 59.5,
    lon: 20.35
  },

  {
    type: "coastal",
    id: "turku-rajakari",
    name: "Turku Rajakari",
    fmisid: 100947,
    lat: 60.38,
    lon: 22.1
  },

  {
    type: "coastal",
    id: "parainen-fagerholm",
    name: "Parainen Fagerholm",
    fmisid: 100924,
    lat: 60.11,
    lon: 21.7
  },


  {
    type: "coastal",
    id: "lumparland-långnäs-satama",
    name: "Lumparland Långnäs satama",
    fmisid: 151048,
    lat: 60.12,
    lon: 20.3
  },

  {
    type: "coastal",
    id: "maarianhamina-länsisatama",
    name: "Maarianhamina Länsisatama",
    fmisid: 151029,
    lat: 60.09,
    lon: 19.93
  },

  {
    type: "coastal",
    id: "maarianhamina-lotsberget",
    name: "Maarianhamina Lotsberget",
    fmisid: 107383,
    lat: 60.09,
    lon: 19.94
  },

  {
    type: "coastal",
    id: "lemland-nyhamn",
    name: "Lemland Nyhamn",
    fmisid: 100909,
    lat: 59.96,
    lon: 19.95
  },

  {
    type: "coastal",
    id: "hammarland-märket",
    name: "Hammarland Märket",
    fmisid: 100919,
    lat: 60.3,
    lon: 19.13
  },

  {
    type: "coastal",
    id: "kustavi-isokari",
    name: "Kustavi Isokari",
    fmisid: 101059,
    lat: 60.72,
    lon: 21.03
  },

  {
    type: "coastal",
    id: "rauma-kylmäpihlaja",
    name: "Rauma Kylmäpihlaja",
    fmisid: 101061,
    lat: 61.14,
    lon: 21.3
  },

  {
    type: "coastal",
    id: "pori-tahkoluoto-satama",
    name: "Pori Tahkoluoto satama",
    fmisid: 101267,
    lat: 61.63,
    lon: 21.38
  },

  {
    type: "coastal",
    id: "kristiinankaupunki-majakka",
    name: "Kristiinankaupunki Majakka",
    fmisid: 101268,
    lat: 62.2,
    lon: 21.17
  },

  {
    type: "coastal",
    id: "kaskinen-sälgrund",
    name: "Kaskinen Sälgrund",
    fmisid: 101256,
    lat: 62.33,
    lon: 21.19
  },

  {
    type: "coastal",
    id: "korsnäs-bredskäret",
    name: "Korsnäs Bredskäret",
    fmisid: 101479,
    lat: 62.93,
    lon: 21.18
  },

  {
    type: "coastal",
    id: "maalahti-strömmingsbådan",
    name: "Maalahti Strömmingsbådan",
    fmisid: 101481,
    lat: 62.98,
    lon: 20.74
  },

  {
    type: "coastal",
    id: "mustasaari-valassaaret",
    name: "Mustasaari Valassaaret",
    fmisid: 101464,
    lat: 63.44,
    lon: 21.07
  },

  {
    type: "coastal",
    id: "pietarsaari-kallan",
    name: "Pietarsaari Kallan",
    fmisid: 101660,
    lat: 63.75,
    lon: 22.52
  },

  {
    type: "coastal",
    id: "kokkola-tankar",
    name: "Kokkola Tankar",
    fmisid: 101661,
    lat: 63.95,
    lon: 22.85
  },

  {
    type: "coastal",
    id: "kalajoki-ulkokalla",
    name: "Kalajoki Ulkokalla",
    fmisid: 101673,
    lat: 64.33,
    lon: 23.45
  },

  {
    type: "coastal",
    id: "raahe-nahkiainen",
    name: "Raahe Nahkiainen",
    fmisid: 101775,
    lat: 64.61,
    lon: 23.9
  },

  {
    type: "coastal",
    id: "oulu-vihreäsaari-satama",
    name: "Oulu Vihreäsaari satama",
    fmisid: 101794,
    lat: 65.01,
    lon: 25.39
  },

  {
    type: "coastal",
    id: "hailuoto-marjaniemi",
    name: "Hailuoto Marjaniemi",
    fmisid: 101784,
    lat: 65.04,
    lon: 24.56
  },

  {
    type: "coastal",
    id: "kemi-i-majakka",
    name: "Kemi I majakka",
    fmisid: 101783,
    lat: 65.39,
    lon: 24.1
  },

  {
    type: "coastal",
    id: "kemi-ajos",
    name: "Kemi Ajos",
    fmisid: 101846,
    lat: 65.67,
    lon: 24.52
  },


];
