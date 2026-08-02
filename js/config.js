// ==========================
// Asetukset / API-avaimet
//
// Maanmittauslaitoksen avoin Karttakuvapalvelu (WMTS) vaatii
// käyttäjäkohtaisen API-avaimen. Avain luodaan MML:n OmaTili-
// palvelussa (rekisteröinti on tehtävä itse, sitä ei voi tehdä
// puolesta):
//
//   1. https://omatili.maanmittauslaitos.fi/user/new/avoimet-rajapintapalvelut
//   2. Kirjaudu ja luo API-avain "Karttakuvapalvelu (WMTS)" -rajapintaan.
//   3. Liitä avain alle.
//
// Jos kenttä jätetään tyhjäksi, MML-taustakartta ei toimi, mutta
// sivu toimii silti normaalisti OpenStreetMap-taustalla.
// ==========================

export const MML_API_KEY = "180acaa6-d5df-417e-b4a3-5e25d965a5f0";
