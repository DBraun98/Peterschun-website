/* ============================================================
   peterschun.com – Schwebefeld
   Kleine Striche im Kopfbereich, die sich zum Mauszeiger
   ausrichten und sich um ihn sammeln.

   Einbau:
     <section class="shell hero" data-schwebefeld>...</section>
     <script src="/assets/schwebefeld.js" defer></script>

   Farben lassen sich pro Bereich setzen:
     data-farben="#1D1D1F,#6E6E73,#D2D2D7"

   - Keine Abhaengigkeiten, nichts wird von fremden Servern geladen.
   - Laeuft nur, solange der Bereich sichtbar und der Tab offen ist.
   - Bei "Bewegung reduzieren" wird nur ein ruhiges Bild gezeichnet.
   ============================================================ */
(function () {
  "use strict";

  var E = {
    abstand: 34,        // Rasterabstand der Striche in px
    abstandSchmal: 44,  // dito auf schmalen Geraeten
    maxStriche: 420,    // Obergrenze, damit es fluessig bleibt
    laengeMin: 5,
    laengeMax: 11,
    dicke: 1.4,
    radius: 300,        // Wirkradius um den Zeiger in px
    ring: 68,           // In diesem Abstand sammeln sich die Striche
    zug: 0.55,          // Wie stark der Zeiger zieht (0-1)
    feder: 0.06,        // Wie schnell ein Strich seinem Ziel folgt
    daempfung: 0.82,    // Bremse (kleiner = traeger)
    deckRuhe: 0.07,
    deckNah: 0.78
  };

  var STANDARDFARBEN = "#1D1D1F,#6E6E73,#D2D2D7";
  var reduziert = window.matchMedia("(prefers-reduced-motion: reduce)");

  function starte(host) {
    var farben = (host.getAttribute("data-farben") || STANDARDFARBEN)
      .split(",")
      .map(function (f) { return f.trim(); })
      .filter(Boolean);

    var canvas = document.createElement("canvas");
    canvas.className = "schwebefeld-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var breite = 0, hoehe = 0;
    var striche = [];
    var maus = { x: 0, y: 0, aktiv: false };
    var sichtbar = true;
    var laeuft = false;
    var start = performance.now();

    function zufall(a, b) { return a + Math.random() * (b - a); }

    function baueStriche() {
      var abstand = breite < 700 ? E.abstandSchmal : E.abstand;
      var spalten = Math.ceil(breite / abstand) + 1;
      var zeilen = Math.ceil(hoehe / abstand) + 1;
      var liste = [];

      for (var r = 0; r < zeilen; r++) {
        for (var c = 0; c < spalten; c++) {
          var winkel = zufall(-0.5, 0.5);
          liste.push({
            hx: c * abstand + zufall(-abstand * 0.4, abstand * 0.4),
            hy: r * abstand + zufall(-abstand * 0.4, abstand * 0.4),
            x: 0, y: 0, vx: 0, vy: 0,
            winkel: winkel,
            grundWinkel: winkel,
            laenge: zufall(E.laengeMin, E.laengeMax),
            farbe: farben[Math.floor(Math.random() * farben.length)],
            phase: Math.random() * Math.PI * 2,
            naehe: 0
          });
        }
      }

      while (liste.length > E.maxStriche) {
        liste.splice(Math.floor(Math.random() * liste.length), 1);
      }

      for (var i = 0; i < liste.length; i++) {
        liste[i].x = liste[i].hx;
        liste[i].y = liste[i].hy;
      }
      striche = liste;
    }

    function groesseAnpassen() {
      var kasten = host.getBoundingClientRect();
      breite = Math.max(1, Math.round(kasten.width));
      hoehe = Math.max(1, Math.round(kasten.height));

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(breite * dpr);
      canvas.height = Math.round(hoehe * dpr);
      canvas.style.width = breite + "px";
      canvas.style.height = hoehe + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      baueStriche();
      zeichne(performance.now(), true);
    }

    function winkelAnnaehern(von, nach, anteil) {
      var d = nach - von;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return von + d * anteil;
    }

    function zeichne(jetzt, stillstand) {
      var t = jetzt - start;
      ctx.clearRect(0, 0, breite, hoehe);
      ctx.lineCap = "round";
      ctx.lineWidth = E.dicke;

      for (var i = 0; i < striche.length; i++) {
        var s = striche[i];
        var zx = s.hx, zy = s.hy;
        var zielWinkel = s.grundWinkel;
        var naeheZiel = 0;

        if (!stillstand) {
          zx += Math.sin(t * 0.0006 + s.phase) * 3;
          zy += Math.cos(t * 0.0005 + s.phase) * 3;

          if (maus.aktiv) {
            var dx = s.hx - maus.x;
            var dy = s.hy - maus.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 0.001;

            if (d < E.radius) {
              var staerke = Math.pow(1 - d / E.radius, 2) * E.zug;
              zx += (maus.x + (dx / d) * E.ring - zx) * staerke;
              zy += (maus.y + (dy / d) * E.ring - zy) * staerke;
              zielWinkel = Math.atan2(dy, dx);
              naeheZiel = 1 - d / E.radius;
            }
          }

          s.vx = (s.vx + (zx - s.x) * E.feder) * E.daempfung;
          s.vy = (s.vy + (zy - s.y) * E.feder) * E.daempfung;
          s.x += s.vx;
          s.y += s.vy;
          s.winkel = winkelAnnaehern(s.winkel, zielWinkel, 0.12);
          s.naehe += (naeheZiel - s.naehe) * 0.1;
        }

        var halb = (s.laenge * (1 + s.naehe * 0.6)) / 2;
        var cos = Math.cos(s.winkel) * halb;
        var sin = Math.sin(s.winkel) * halb;

        ctx.globalAlpha = E.deckRuhe + (E.deckNah - E.deckRuhe) * s.naehe;
        ctx.strokeStyle = s.farbe;
        ctx.beginPath();
        ctx.moveTo(s.x - cos, s.y - sin);
        ctx.lineTo(s.x + cos, s.y + sin);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    function schleife(jetzt) {
      if (!laeuft) return;
      zeichne(jetzt, false);
      requestAnimationFrame(schleife);
    }

    function laufPruefen() {
      var soll = sichtbar && !document.hidden && !reduziert.matches;
      if (soll && !laeuft) {
        laeuft = true;
        requestAnimationFrame(schleife);
      } else if (!soll && laeuft) {
        laeuft = false;
        zeichne(performance.now(), true);
      }
    }

    function zeigerMerken(e) {
      var kasten = canvas.getBoundingClientRect();
      maus.x = e.clientX - kasten.left;
      maus.y = e.clientY - kasten.top;
      maus.aktiv = true;
    }

    host.addEventListener("pointermove", zeigerMerken, { passive: true });
    host.addEventListener("pointerdown", zeigerMerken, { passive: true });
    host.addEventListener("pointerleave", function () { maus.aktiv = false; });
    host.addEventListener("pointercancel", function () { maus.aktiv = false; });
    host.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") maus.aktiv = false;
    });

    if (window.ResizeObserver) {
      new ResizeObserver(groesseAnpassen).observe(host);
    } else {
      window.addEventListener("resize", groesseAnpassen);
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (eintraege) {
        sichtbar = eintraege[0].isIntersecting;
        laufPruefen();
      }).observe(host);
    }

    document.addEventListener("visibilitychange", laufPruefen);
    if (reduziert.addEventListener) {
      reduziert.addEventListener("change", laufPruefen);
    }

    groesseAnpassen();
    laufPruefen();
  }

  function init() {
    var felder = document.querySelectorAll("[data-schwebefeld]");
    for (var i = 0; i < felder.length; i++) starte(felder[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
