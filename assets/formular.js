/* ============================================================
   formular.js — Versand der Kontaktformulare
   Liegt auf peterschun.com unter /assets/formular.js

   Gilt fuer jedes Formular mit dem Merkmal data-formular.

   Ablauf:
   1. Pflichtfelder pruefen. Fehlt etwas, bleibt die Seite stehen
      und das erste fehlende Feld bekommt den Fokus.
   2. Versand per fetch an die action-URL des Formulars. Brevo
      erlaubt CORS und antwortet mit JSON:
         {"success":true, "message":"..."}
         {"success":false,"errors":{"FELD":"..."}}
      Die Antwort ist also lesbar — anders als frueher, als der
      POST blind in ein verstecktes Iframe ging.
   3. Nur bei success=true geht es weiter auf /danke/. Der
      Brief-Code wird mitgenommen.
   4. Bei Ablehnung, Netzfehler oder Zeitueberschreitung erscheint
      der Hinweis mit Telefonnummer und E-Mail, der Knopf wird
      wieder frei, und der Grund steht in der Browser-Konsole.

   WICHTIG — BETRIEBS_ID
   Im Brevo-Formular ist BETRIEBS_ID ein Pflichtfeld. Ist es leer,
   verwirft Brevo die komplette Anfrage. Jedes Formular hat deshalb
   ein verstecktes Feld mit dem Vorgabewert "ohne-code"; liegt ein
   Brief-Code vor, ueberschreibt ihn /assets/kampagne.js.
   ============================================================ */
(function () {
  "use strict";

  var DANKE    = "/danke/";
  var WARTEN   = 20000;          /* 20 Sekunden bis zum Abbruch */
  var MAIL     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

  function pruefen(form) {
    var fehlend = [];
    var felder = form.querySelectorAll("input[required], textarea[required], select[required]");

    Array.prototype.forEach.call(felder, function (el) {
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

    function scheitern(grund) {
      freigeben();
      anzeigen(panne);
      if (panne) panne.scrollIntoView({ block: "center", behavior: "smooth" });
      if (window.console) window.console.warn("[Formular] Versand nicht erfolgreich:", grund);
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

      /* Abbruch, falls Brevo nicht rechtzeitig antwortet. */
      var abbruch = null;
      var uhr = null;
      if (typeof AbortController === "function") {
        abbruch = new AbortController();
        uhr = window.setTimeout(function () { abbruch.abort(); }, WARTEN);
      }

      var auftrag = {
        method: "POST",
        body: new URLSearchParams(new FormData(form)),
        headers: { "Accept": "application/json" }
      };
      if (abbruch) auftrag.signal = abbruch.signal;

      window.fetch(form.action, auftrag)
        .then(function (antwort) {
          return antwort.text().then(function (text) {
            return { ok: antwort.ok, status: antwort.status, text: text };
          });
        })
        .then(function (a) {
          if (uhr) window.clearTimeout(uhr);

          var daten = null;
          try { daten = JSON.parse(a.text); } catch (e) { /* kein JSON */ }

          if (a.ok && daten && daten.success === true) {
            zurDankeseite();
            return;
          }
          scheitern("HTTP " + a.status + " — " + a.text.slice(0, 300));
        })
        .catch(function (fehler) {
          if (uhr) window.clearTimeout(uhr);
          scheitern(String(fehler));
        });
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
