// ==========================
// Muutosloki
//
// Käyttäjille näytettävä lista viimeisimmistä, olennaisista
// muutoksista (ei sisäisiä koodirefaktorointeja). Uusin muutos
// listan alussa. Päivitä tätä tiedostoa aina kun sivustolle tehdään
// käyttäjän huomaama muutos – Muutokset-nappi (changelogControl.js)
// lukee tämän suoraan.
// ==========================

// Pysyvä huomautus, näytetään aina listan yläpuolella (ei liity
// mihinkään yksittäiseen päivämäärään).
export const CHANGELOG_NOTE =
  "Osa muutoksista koskee vain työpöytäversiota, osa vain mobiiliversiota.";

// Pysyvä yhteystieto, näytetään aina listan alapuolella.
export const CHANGELOG_CONTACT_EMAIL = "palaute@merisaa.fi";

export const CHANGELOG = [
  {
    date: "08.09.2026",
    items: [
      "Uusi, kompaktimpi logo mobiilin yläotsikkoon.",
      "Uusi Muutokset-nappi/-rivi, josta näkee tämän listan (työpöytä: oikea alakulma, mobiili: listan viimeinen rivi).",
      "Korjattu popupin koon/sijainnin päivitys niin ettei popupin yläreuna jää enää näytön ulkopuolelle (havaittu mm. Edge/Firefox-selaimissa ja iPadilla).",
      "Isompi, paremmin erottuva sulkupainike popupin oikeaan yläkulmaan (työpöytä).",
      "Aaltopoijun nuoli osoittaa nyt minne aallot ovat menossa (aiemmin mistä ne tulevat).",
      "Tuulihavaintograafiin lisätty selkeä ilmoitus, jos havaintodataa ei juuri sillä hetkellä ole saatavilla.",
      "Havaintoaseman sijainti näkyy nyt punaisella pallolla tuuliennusteanimaation karttataustalla.",
      "Mobiilin asemalista järjestyy nyt merialueen sisällä rannikon suunnan mukaan (ei enää aakkosjärjestyksessä)."
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
