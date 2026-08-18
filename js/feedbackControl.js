// ==========================
// Palaute-kontrolli
//
// Sama visuaalinen tyyli ja pudotuspaneeli-kuvio kuin taustakartan
// ja käyttöoikeuksien napeilla (ks. baseLayerControl.js /
// dataLicenseControl.js). Sivusto on staattinen eikä sillä ole omaa
// palvelinta palautteen käsittelyyn, joten lomake kokoaa viestin ja
// avaa käyttäjän oman sähköpostiohjelman valmiiksi täytetyllä
// mailto-linkillä osoitteeseen palaute@merisaa.fi – ei siis vaadi
// mitään backendia eikä ole altis lomakeroboteille.
// ==========================

const FEEDBACK_EMAIL = "palaute@merisaa.fi";

export function initFeedbackControl(map) {

  const FeedbackControl = L.Control.extend({

    options: { position: "bottomright" },

    onAdd() {

      const container = L.DomUtil.create("div", "feedback-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "feedback-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Anna palautetta";
      toggleBtn.innerHTML = "💬 Palaute";

      const panel = L.DomUtil.create("div", "feedback-panel", container);

      const header = L.DomUtil.create("div", "feedback-panel-header", panel);
      header.textContent = "Palaute";

      const intro = L.DomUtil.create("div", "feedback-panel-intro", panel);
      intro.textContent = "Sivusto on vielä kehitysvaiheessa, joten kaikenlainen palaute on tervetullutta – kiitos avustasi!";

      const form = L.DomUtil.create("form", "feedback-form", panel);

      const messageLabel = L.DomUtil.create("label", "feedback-label", form);
      messageLabel.htmlFor = "feedback-message";
      messageLabel.textContent = "Viesti";

      const messageInput = L.DomUtil.create("textarea", "feedback-textarea", form);
      messageInput.id = "feedback-message";
      messageInput.rows = 4;
      messageInput.placeholder = "Kerro havainnosta, ideasta tai bugista…";
      messageInput.required = true;

      const emailLabel = L.DomUtil.create("label", "feedback-label", form);
      emailLabel.htmlFor = "feedback-email";
      emailLabel.textContent = "Oma sähköposti (valinnainen, jos haluat vastauksen)";

      const emailInput = L.DomUtil.create("input", "feedback-input", form);
      emailInput.id = "feedback-email";
      emailInput.type = "email";
      emailInput.placeholder = "etunimi@esimerkki.fi";

      const submitBtn = L.DomUtil.create("button", "feedback-submit", form);
      submitBtn.type = "submit";
      submitBtn.textContent = "Avaa sähköposti ja lähetä";

      const fallback = L.DomUtil.create("div", "feedback-fallback", panel);
      fallback.innerHTML = `Tai kirjoita suoraan osoitteeseen <a href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a>`;

      L.DomEvent.on(form, "submit", (e) => {
        e.preventDefault();

        const message = messageInput.value.trim();
        if (!message) return;

        const replyEmail = emailInput.value.trim();

        const subject = "Palaute – Merisää";
        const bodyLines = [message];
        if (replyEmail) {
          bodyLines.push("", `Lähettäjän sähköposti: ${replyEmail}`);
        }

        const mailtoUrl =
          `mailto:${FEEDBACK_EMAIL}` +
          `?subject=${encodeURIComponent(subject)}` +
          `&body=${encodeURIComponent(bodyLines.join("\n"))}`;

        window.location.href = mailtoUrl;

      });

      let open = false;

      function openPanel() {
        open = true;
        container.classList.add("open");
      }

      function closePanel() {
        open = false;
        container.classList.remove("open");
      }

      L.DomEvent.on(toggleBtn, "click", () => {
        if (open) {
          closePanel();
        } else {
          openPanel();
        }
      });

      return container;

    }

  });

  map.addControl(new FeedbackControl());

}
