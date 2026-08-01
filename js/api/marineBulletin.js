// ==========================
// Säätiedotus merenkulkijoille
// Ilmatieteen laitoksen oma sivu (ilmatieteenlaitos.fi/saatiedotus-
// merenkulkijoille) hakee sanallisen tiedotteen tältä samalta
// CDN-osoitteelta selaimessa – löydetty selaimen kehittäjätyökalujen
// Network-välilehdeltä. Palauttaa valmiiksi muotoillun HTML-
// fragmentin (ei kokonaista sivua), joka jäsennetään erikseen.
// ==========================

const MARINE_BULLETIN_URL = "https://cdn.fmi.fi/apps/sea-weather-forecasts-texts/day1.php";

export async function fetchMarineBulletinHtml() {

  const res = await fetch(MARINE_BULLETIN_URL);

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }

  return await res.text();

}
