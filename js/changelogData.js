// ==========================
// Muutosloki
//
// Käyttäjille näytettävä lista viimeisimmistä, olennaisista
// muutoksista (ei sisäisiä koodirefaktorointeja). Uusin muutos
// listan alussa. Päivitä tätä tiedostoa aina kun sivustolle tehdään
// käyttäjän huomaama muutos – Muutokset-nappi (changelogControl.js)
// lukee tämän suoraan.
// ==========================

export const CHANGELOG = [
  {
    date: "08.09.2026",
    items: [
      "Uusi Muutokset-nappi, josta näkee tämän listan.",
      "Korjattu popupin koon/sijainnin päivitys niin ettei popupin yläreuna jää enää näytön ulkopuolelle (havaittu mm. Edge/Firefox-selaimissa ja iPadilla).",
      "Isompi, paremmin erottuva sulkupainike popupin oikeaan yläkulmaan.",
      "Aaltopoijun nuoli osoittaa nyt minne aallot ovat menossa (aiemmin mistä ne tulevat).",
      "Tuulihavaintograafiin lisätty selkeä ilmoitus, jos havaintodataa ei juuri sillä hetkellä ole saatavilla."
    ]
  },
  {
    date: "01.09.2026",
    items: [
      "Lisätty kolme uutta sisävesien havaintoasemaa: Pielinen (Lieksa Lampela), Oulujärvi (Kajaani lentoasema) ja Lokan tekojärvi (Sodankylä Lokka)."
    ]
  },
  {
    date: "20.08.2026",
    items: [
      "”Varoitukset”-paneeli poistettu teknisen rajoituksen vuoksi – osa tiedoista näkyy edelleen Säätiedotus merenkulkijoille -paneelissa.",
      "Suosikkilista lisätty mobiiliversioon."
    ]
  },
  {
    date: "18.08.2026",
    items: [
      "Palaute-nappi ja taustakartan vaihtomahdollisuus lisätty."
    ]
  }
];
