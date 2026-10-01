/* ============================================================
   kampagne.js — Betriebs-ID aus dem Brief festhalten
   Liegt auf peterschun.com unter /assets/kampagne.js

   Aufgabe:
   1. Liest die Betriebs-ID (bid) und die Herkunft (source) aus der
      Adresszeile. Beides steckt im QR-Code des Briefes.
   2. Merkt sich die Werte in der sessionStorage, damit sie beim
      Klicken auf andere Seiten nicht verloren gehen.
   3. Schreibt sie als versteckte Felder in jedes Formular der Seite,
      damit sie in Brevo ankommen.
   4. Haengt sie an interne Links an, damit sie auch beim
      Seitenwechsel in der Adresszeile stehen bleiben.

   Erwartete Adressen:
     peterschun.com/maler/?bid=MA-04.twistringen&source=brief
     peterschun.com/maler/#MA-04.twistringen     (Kurzform, Notfall)

   In Brevo muessen diese Attribute als Typ Text angelegt sein,
   sonst verwirft Brevo die Werte ohne Fehlermeldung:
     BETRIEBS_ID, GEWERK, HERKUNFT
   ============================================================ */
(function () {
  "use strict";

  var SPEICHER = "peterschun_kampagne";
  var ERLAUBT = /^[A-Za-z0-9._-]{1,40}$/;
  /* Kurzform hinter # nur, wenn es wie ein Code aussieht (MA-04.twistringen).
     Sonst waeren Sprungziele wie #paket oder #kontakt ein falscher Code. */
  var KURZFORM = /^[A-Za-z]{2,4}-[0-9]{1,3}(\.[A-Za-z0-9-]+)?$/;

  /* ---------- Hilfen ---------- */

  function sauber(wert) {
    if (!wert) return "";
    wert = String(wert).trim();
    return ERLAUBT.test(wert) ? wert : "";
  }

  function lesen() {
    try {
      var roh = window.sessionStorage.getItem(SPEICHER);
      return roh ? JSON.parse(roh) : {};
    } catch (e) {
      return {};
    }
  }

  function merken(daten) {
    try {
      window.sessionStorage.setItem(SPEICHER, JSON.stringify(daten));
    } catch (e) {
      /* Privates Fenster oder Speicher aus: dann gilt nur diese Seite. */
    }
  }

  /* ---------- Werte aus der Adresszeile ---------- */

  function ausAdresse() {
    var werte = {};
    var roh = window.location.search.replace(/^\?/, "");
    var nurCode = false;

    if (!roh) {
      roh = window.location.hash.replace(/^#/, "");
      nurCode = roh.indexOf("=") === -1;
    }
    if (!roh) return werte;

    /* Kurzform: hinter dem # steht nur der Code selbst. */
    if (nurCode) {
      werte.bid = KURZFORM.test(roh) ? sauber(roh) : "";
      if (werte.bid) werte.source = "brief";
      return werte;
    }

    roh.split("&").forEach(function (paar) {
      var teile = paar.split("=");
      if (teile.length < 2) return;
      var name = decodeURIComponent(teile[0]).toLowerCase();
      var wert = decodeURIComponent(teile.slice(1).join("=")).replace(/\+/g, " ");
      if (name === "bid" || name === "source" || name === "gewerk") {
        wert = sauber(wert);
        if (wert) werte[name] = wert;
      }
    });
    return werte;
  }

  /* ---------- Zusammenfuehren: Adresszeile schlaegt Speicher ---------- */

  var gemerkt = lesen();
  var neu = ausAdresse();

  var daten = {
    bid: neu.bid || gemerkt.bid || "",
    source: neu.source || gemerkt.source || "",
    gewerk: neu.gewerk || gemerkt.gewerk || sauber(document.body.getAttribute("data-gewerk")) || ""
  };

  if (daten.bid) merken(daten);
  if (!daten.bid) return; /* Normaler Besucher ohne Brief: nichts tun. */

  /* Ort steckt hinten im Code: MA-04.twistringen */
  var ort = "";
  if (daten.bid.indexOf(".") > -1) {
    ort = daten.bid.split(".").pop().replace(/-/g, " ");
  }

  /* ---------- Versteckte Felder in die Formulare ---------- */

  function feldSetzen(form, name, wert) {
    if (!wert) return;
    var feld = form.querySelector('input[name="' + name + '"]');
    if (!feld) {
      feld = document.createElement("input");
      feld.type = "hidden";
      feld.name = name;
      form.appendChild(feld);
    }
    feld.type = "hidden";
    feld.value = wert;
  }

  function formulareFuellen() {
    var herkunft = "Brief";
    if (daten.gewerk) herkunft += " " + daten.gewerk;
    herkunft += " · " + daten.bid;

    Array.prototype.forEach.call(document.querySelectorAll("form"), function (form) {
      feldSetzen(form, "BETRIEBS_ID", daten.bid);
      feldSetzen(form, "GEWERK", daten.gewerk);
      feldSetzen(form, "HERKUNFT", herkunft);
    });
  }

  /* ---------- Code und Ort auf der Seite anzeigen ---------- */

  function seiteBeschriften() {
    Array.prototype.forEach.call(document.querySelectorAll(".js-code"), function (el) {
      el.textContent = daten.bid;
    });

    if (!ort) return;
    var gross = ort.charAt(0).toUpperCase() + ort.slice(1);
    Array.prototype.forEach.call(document.querySelectorAll(".js-ort"), function (el) {
      el.textContent = gross;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-ort-hinweis]"), function (el) {
      el.removeAttribute("hidden");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-ort]"), function (el) {
      if (el.getAttribute("data-ort").toLowerCase() === ort.toLowerCase()) {
        el.classList.add("is-mine");
      }
    });
  }

  /* ---------- Interne Links mitnehmen ---------- */

  function linkeMitnehmen() {
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var ziel = a.getAttribute("href");
      if (!ziel) return;
      if (/^(mailto:|tel:|#|javascript:)/i.test(ziel)) return;

      var url;
      try {
        url = new URL(a.href, window.location.href);
      } catch (e) {
        return;
      }
      if (url.host !== window.location.host) return;
      if (url.searchParams.get("bid")) return;

      url.searchParams.set("bid", daten.bid);
      if (daten.source) url.searchParams.set("source", daten.source);
      a.setAttribute("href", url.pathname + url.search + url.hash);
    });
  }

  function los() {
    formulareFuellen();
    seiteBeschriften();
    linkeMitnehmen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", los);
  } else {
    los();
  }
})();
