/* ============================================================
   formular.js — Versand der Kontaktformulare
   Liegt auf peterschun.com unter /assets/formular.js

   Gilt fuer jedes Formular mit dem Merkmal data-formular.
   Ersetzt die frueheren Inline-Skripte der einzelnen Seiten.

   Ablauf:
   1. Pflichtfelder pruefen. Fehlt etwas, bleibt die Seite stehen
      und das erste fehlende Feld bekommt den Fokus.
   2. Nativer POST in das versteckte Iframe, das im target des
      Formulars steht. Umgeht CORS, Besucher bleibt auf der Seite.
   3. Sobald das Iframe eine Antwort geladen hat, geht es weiter
      auf die Dankeseite. Der Brief-Code wird mitgenommen.
   4. Kommt binnen WARTEN keine Antwort, erscheint der Hinweis
      mit Telefonnummer und E-Mail. Der Knopf wird wieder frei.

   WICHTIGE EINSCHRAENKUNG
   Die Antwort des Iframes liegt auf einer fremden Domain und ist
   aus Sicherheitsgruenden nicht auslesbar. Erkannt wird deshalb
   nur, DASS geantwortet wurde, nicht WAS. Weist der Dienst eine
   Einsendung ab, sieht der Besucher trotzdem die Dankeseite.
   Vollstaendig loesen laesst sich das nur mit einem Dienst, der
   eine lesbare Antwort zurueckgibt (CORS/JSON).
   ============================================================ */
(function () {
  "use strict";

  var DANKE  = "/danke/";
  var WARTEN = 15000;           /* 15 Sekunden auf die Antwort */
  var MAIL   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var SPEICHER = "peterschun_kampagne";

  /* ---------- Brief-Code fuer die Dankeseite ---------- */

  function briefCode() {
    try {
      var ausAdresse = new URLSearchParams(window.location.search).get("bid");
      if (ausAdresse) return ausAdresse;

      var roh = window.sessionStorage.getItem(SPEICHER);
      if (roh) {
        var daten = JSON.parse(roh);
        if (daten && daten.bid) return daten.bid;
      }
    } catch (e) {
      /* Privates Fenster oder Speicher aus: dann ohne Code. */
    }
    return "";
  }

  function zurDankeseite() {
    var ziel = DANKE;
    var code = briefCode();
    if (code) ziel += "?bid=" + encodeURIComponent(code);
    window.location.assign(ziel);
  }

  /* ---------- Pflichtfelder ---------- */

  function pflichtfelder(form) {
    return Array.prototype.slice.call(
      form.querySelectorAll("input[required], textarea[required], select[required]")
    );
  }

  function pruefen(form) {
    var fehlend = [];

    pflichtfelder(form).forEach(function (el) {
      var leer = el.type === "checkbox" ? !el.checked : !el.value.trim();
      var mailFalsch = el.type === "email" && el.value.trim() && !MAIL.test(el.value.trim());

      if (leer || mailFalsch) {
        fehlend.push(el);
        el.setAttribute("aria-invalid", "true");
      } else {
        el.removeAttribute("aria-invalid");
      }
    });

    return fehlend;
  }

  /* ---------- Ein Formular einrichten ---------- */

  function einrichten(form) {
    var hinweis = form.querySelector(".form-error");
    var panne   = form.querySelector(".form-fail");
    var knopf   = form.querySelector('button[type="submit"]');
    var rahmen  = null;

    var zielName = form.getAttribute("target");
    if (zielName) rahmen = document.querySelector('iframe[name="' + zielName + '"]');

    var knopfText = knopf ? knopf.textContent : "";
    var laeuft = false;

    function anzeigen(el) { if (el) el.classList.add("on"); }
    function verbergen(el) { if (el) el.classList.remove("on"); }

    function freigeben() {
      laeuft = false;
      if (knopf) {
        knopf.disabled = false;
        knopf.textContent = knopfText;
      }
    }

    function abbrechen() {
      freigeben();
      anzeigen(panne);
      if (panne) panne.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (laeuft) return;

      var fehlend = pruefen(form);
      if (fehlend.length) {
        anzeigen(hinweis);
        fehlend[0].focus();
        return;
      }
      verbergen(hinweis);
      verbergen(panne);

      laeuft = true;
      if (knopf) {
        knopf.disabled = true;
        knopf.textContent = "Wird gesendet …";
      }

      var uhr = window.setTimeout(abbrechen, WARTEN);

      if (rahmen) {
        rahmen.addEventListener("load", function () {
          window.clearTimeout(uhr);
          zurDankeseite();
        }, { once: true });
      } else {
        /* Kein Iframe gefunden: nach kurzer Pause trotzdem weiter,
           damit der Besucher nicht haengen bleibt. */
        window.clearTimeout(uhr);
        window.setTimeout(zurDankeseite, 1200);
      }

      /* Nativer POST. Loest kein weiteres submit-Event aus. */
      form.submit();
    });

    form.addEventListener("input", function (e) {
      if (e.target.hasAttribute("aria-invalid")) pruefen(form);
    });

    form.addEventListener("change", function (e) {
      if (e.target.type === "checkbox" && e.target.hasAttribute("aria-invalid")) pruefen(form);
    });
  }

  function los() {
    Array.prototype.forEach.call(
      document.querySelectorAll("form[data-formular]"),
      einrichten
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", los);
  } else {
    los();
  }
})();
