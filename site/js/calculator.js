/* Trip fuel cost calculator. Everything is converted to kilometres and litres internally. */
(function () {
  "use strict";

  var KM_PER_MILE = 1.609344;
  var L_PER_US_GAL = 3.785411784;
  var L_PER_UK_GAL = 4.54609;
  // kg of CO2 released per litre burned
  var CO2_PER_L = { petrol: 2.31, diesel: 2.68 };

  var SYSTEMS = {
    metric: { distance: "km", economy: "l100", price: "l" },
    us: { distance: "mi", economy: "mpgus", price: "usgal" },
    uk: { distance: "mi", economy: "mpguk", price: "l" }
  };

  // Typical starting values; people overwrite these with their own.
  var DEFAULTS = {
    metric: { distance: 250, economy: 7.5 },
    us: { distance: 150, economy: 28 },
    uk: { distance: 150, economy: 45 }
  };
  var PRICE_HINTS = {
    USD: { usgal: 3.5, l: 0.92, ukgal: 4.2 },
    CAD: { usgal: 6.0, l: 1.6, ukgal: 7.2 },
    GBP: { usgal: 5.5, l: 1.45, ukgal: 6.6 },
    EUR: { usgal: 6.6, l: 1.75, ukgal: 8.0 },
    AUD: { usgal: 7.4, l: 1.95, ukgal: 8.9 },
    INR: { usgal: 390, l: 103, ukgal: 468 },
    PKR: { usgal: 1000, l: 265, ukgal: 1205 },
    AED: { usgal: 11.4, l: 3.0, ukgal: 13.6 },
    SAR: { usgal: 8.2, l: 2.18, ukgal: 9.9 },
    ZAR: { usgal: 82, l: 21.6, ukgal: 98 },
    NGN: { usgal: 4100, l: 1080, ukgal: 4900 },
    JPY: { usgal: 660, l: 175, ukgal: 795 }
  };
  var REGION_DEFAULTS = {
    US: ["us", "USD"], CA: ["metric", "CAD"], GB: ["uk", "GBP"], IE: ["metric", "EUR"],
    AU: ["metric", "AUD"], IN: ["metric", "INR"], PK: ["metric", "PKR"], AE: ["metric", "AED"],
    SA: ["metric", "SAR"], ZA: ["metric", "ZAR"], NG: ["metric", "NGN"], JP: ["metric", "JPY"]
  };

  var form = document.getElementById("calc-form");
  if (!form) return;

  var el = {
    distance: form.elements.distance,
    distanceUnit: form.elements.distanceUnit,
    economy: form.elements.economy,
    economyUnit: form.elements.economyUnit,
    price: form.elements.price,
    priceUnit: form.elements.priceUnit,
    currency: form.elements.currency,
    fuel: form.elements.fuel,
    roundTrip: form.elements.roundTrip,
    people: form.elements.people,
    total: document.getElementById("out-total"),
    volume: document.getElementById("out-volume"),
    volumeLabel: document.getElementById("out-volume-label"),
    unitPrice: document.getElementById("out-price"),
    unitPriceLabel: document.getElementById("out-price-label"),
    perDistance: document.getElementById("out-per-distance"),
    perDistanceLabel: document.getElementById("out-per-distance-label"),
    perHundred: document.getElementById("out-per-hundred"),
    perHundredLabel: document.getElementById("out-per-hundred-label"),
    perPerson: document.getElementById("out-per-person"),
    co2: document.getElementById("out-co2"),
    tripDistance: document.getElementById("out-trip-distance"),
    summary: document.getElementById("calc-summary")
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var shownTotal = 0;
  var animFrame = 0;
  var summaryTimer = 0;

  /* ---------- Seven-segment display ---------- */

  // Segment shapes in a 60×100 cell: a top, b top-right, c bottom-right, d bottom, e bottom-left, f top-left, g middle.
  function hSeg(cy) { return "10," + cy + " 15," + (cy - 5) + " 45," + (cy - 5) + " 50," + cy + " 45," + (cy + 5) + " 15," + (cy + 5); }
  function vSeg(cx, y1, y2) { return cx + "," + y1 + " " + (cx + 5) + "," + (y1 + 5) + " " + (cx + 5) + "," + (y2 - 5) + " " + cx + "," + y2 + " " + (cx - 5) + "," + (y2 - 5) + " " + (cx - 5) + "," + (y1 + 5); }
  var SEGMENTS = {
    a: hSeg(6), g: hSeg(50), d: hSeg(94),
    f: vSeg(6, 8, 49), b: vSeg(54, 8, 49),
    e: vSeg(6, 51, 92), c: vSeg(54, 51, 92)
  };
  var DIGITS = {
    "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
    "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": ""
  };

  function digitSvg(ch, withPoint) {
    var lit = DIGITS[ch] || "";
    var out = '<svg class="seg" viewBox="-2 0 ' + (withPoint ? 80 : 64) + ' 100">';
    Object.keys(SEGMENTS).forEach(function (k) {
      out += '<polygon class="' + (lit.indexOf(k) > -1 ? "on" : "off") + '" points="' + SEGMENTS[k] + '"/>';
    });
    if (withPoint) out += '<rect class="on" x="63" y="87" width="10" height="10" rx="2"/>';
    return out + "</svg>";
  }

  // Draws "18.75" as LED digits, padded on the left with unlit cells so the width stays put.
  function segments(text, minCells) {
    var cells = [];
    for (var i = 0; i < text.length; i++) {
      if (text[i] === ".") { if (cells.length) cells[cells.length - 1].point = true; continue; }
      cells.push({ ch: text[i], point: false });
    }
    while (cells.length < minCells) cells.unshift({ ch: " ", point: false });
    return cells.map(function (c) { return digitSvg(c.ch, c.point); }).join("");
  }

  /* ---------- Formatting ---------- */

  function currencyDigits() {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: el.currency.value }).resolvedOptions().maximumFractionDigits;
    } catch (e) {
      return 2;
    }
  }

  function money(value) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: el.currency.value }).format(value);
    } catch (e) {
      return el.currency.value + " " + value.toFixed(2);
    }
  }

  // The currency symbol as the visitor's locale writes it, and whether it goes before the number.
  function currencySymbol() {
    try {
      var parts = new Intl.NumberFormat(undefined, { style: "currency", currency: el.currency.value }).formatToParts(1);
      var cur = parts.filter(function (p) { return p.type === "currency"; })[0];
      var before = parts.indexOf(cur) < parts.map(function (p) { return p.type; }).indexOf("integer");
      return { text: cur ? cur.value : el.currency.value, before: before };
    } catch (e) {
      return { text: el.currency.value, before: true };
    }
  }

  function fixed(value, digits) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }

  function drawTotal(value) {
    var sym = currencySymbol();
    var symHtml = '<span class="pump__cur">' + sym.text.replace(/[<>&]/g, "") + "</span>";
    var digits = '<span class="seg-row">' + segments(value.toFixed(currencyDigits()), 6) + "</span>";
    el.total.innerHTML = sym.before ? symHtml + digits : digits + symHtml;
  }

  function animateTotal(target) {
    window.cancelAnimationFrame(animFrame);
    if (reduceMotion) {
      shownTotal = target;
      drawTotal(target);
      return;
    }
    var from = shownTotal;
    var start = performance.now();
    function step(now) {
      var t = Math.min(1, (now - start) / 450);
      shownTotal = from + (target - from) * (1 - Math.pow(1 - t, 3));
      drawTotal(shownTotal);
      if (t < 1) animFrame = window.requestAnimationFrame(step);
    }
    animFrame = window.requestAnimationFrame(step);
  }

  /* ---------- Validation ---------- */

  // Accepts "1.75" and "1,75". Returns NaN for anything that isn't a plain number.
  function num(input) {
    var raw = String(input.value).trim().replace(",", ".");
    if (!/^\d*\.?\d+$|^\d+\.$/.test(raw)) return NaN;
    return Number(raw);
  }

  function setError(input, message) {
    var msg = document.getElementById(input.id + "-error");
    msg.textContent = message;
    msg.hidden = !message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function blankResults() {
    window.cancelAnimationFrame(animFrame);
    shownTotal = 0;
    el.total.innerHTML = '<span class="seg-row">' + segments("", 6) + "</span>";
    el.volume.innerHTML = segments("", 5);
    el.unitPrice.innerHTML = segments("", 5);
    el.tripDistance.textContent = "";
    [el.perDistance, el.perHundred, el.perPerson, el.co2].forEach(function (o) { o.textContent = "–"; });
    window.clearTimeout(summaryTimer);
    el.summary.textContent = "";
  }

  /* ---------- Calculation ---------- */

  function litresPerKm(value, unit) {
    switch (unit) {
      case "l100": return value / 100;
      case "kml": return 1 / value;
      case "mpgus": return L_PER_US_GAL / (value * KM_PER_MILE);
      case "mpguk": return L_PER_UK_GAL / (value * KM_PER_MILE);
    }
    return NaN;
  }

  function litresPer(unit) {
    return unit === "usgal" ? L_PER_US_GAL : unit === "ukgal" ? L_PER_UK_GAL : 1;
  }

  function calculate() {
    var distance = num(el.distance);
    var economy = num(el.economy);
    var price = num(el.price);
    var peopleRaw = String(el.people.value).trim();
    var people = /^\d+$/.test(peopleRaw) ? Number(peopleRaw) : NaN;

    var ok = true;
    function check(input, valid, message) {
      setError(input, valid ? "" : message);
      if (!valid) ok = false;
    }
    check(el.distance, distance > 0, "Enter a distance above 0, for example 120.");
    check(el.economy, economy > 0, "Enter your fuel economy as a number above 0, for example 7.5.");
    check(el.price, price >= 0, "Enter the price as a number, for example 1.75.");
    check(el.people, people >= 1, "Enter how many people are sharing, 1 or more.");
    if (!ok) return blankResults();

    var distUnit = el.distanceUnit.value;
    var tripDistance = distance * (el.roundTrip.checked ? 2 : 1);
    var km = distUnit === "mi" ? tripDistance * KM_PER_MILE : tripDistance;
    var litres = km * litresPerKm(economy, el.economyUnit.value);
    var priceUnit = el.priceUnit.value;
    var volume = litres / litresPer(priceUnit);
    var cost = volume * price;
    var volumeName = { l: "Litres", usgal: "US gallons", ukgal: "UK gallons" }[priceUnit];
    var unitName = { l: "litre", usgal: "US gallon", ukgal: "UK gallon" }[priceUnit];
    var distName = distUnit === "mi" ? "mile" : "km";

    animateTotal(cost);
    el.volumeLabel.textContent = volumeName;
    el.volume.innerHTML = segments(volume.toFixed(2), 5);
    el.unitPriceLabel.textContent = "Price per " + unitName;
    el.unitPrice.innerHTML = segments(price.toFixed(price < 10 ? 3 : 2), 5);
    el.tripDistance.textContent = fixed(tripDistance, tripDistance < 100 ? 1 : 0) + " " + distUnit +
      (el.roundTrip.checked ? " round trip" : " one way");

    el.perDistanceLabel.textContent = "Cost per " + distName;
    el.perDistance.textContent = money(cost / tripDistance);
    el.perHundredLabel.textContent = "Cost per 100 " + (distUnit === "mi" ? "miles" : "km");
    el.perHundred.textContent = money((cost / tripDistance) * 100);
    el.perPerson.textContent = people > 1 ? money(cost / people) + " each (" + people + " people)" : money(cost);
    el.co2.textContent = fixed(litres * CO2_PER_L[el.fuel.value], 1) + " kg";

    // Announce once typing pauses, not on every keystroke or animation frame.
    window.clearTimeout(summaryTimer);
    summaryTimer = window.setTimeout(function () {
      el.summary.textContent = "Trip cost " + money(cost) + ". Fuel needed " + fixed(volume, 2) + " " + (priceUnit === "l" ? "litres" : volumeName) + ".";
    }, 800);
  }

  function applySystem(name, keepNumbers) {
    var sys = SYSTEMS[name];
    if (!sys) return;
    el.distanceUnit.value = sys.distance;
    el.economyUnit.value = sys.economy;
    el.priceUnit.value = sys.price;
    if (!keepNumbers) {
      el.distance.value = DEFAULTS[name].distance;
      el.economy.value = DEFAULTS[name].economy;
      setPriceHint();
    }
  }

  function setPriceHint() {
    var hint = PRICE_HINTS[el.currency.value];
    if (hint) el.price.value = hint[el.priceUnit.value];
  }

  function detectRegion() {
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var m = /-([A-Z]{2})\b/i.exec(langs[i] || "");
      if (m && REGION_DEFAULTS[m[1].toUpperCase()]) return REGION_DEFAULTS[m[1].toUpperCase()];
    }
    return ["metric", "EUR"];
  }

  // Wiring
  form.addEventListener("submit", function (e) { e.preventDefault(); calculate(); });
  form.addEventListener("input", calculate);

  form.querySelectorAll('input[name="system"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      applySystem(radio.value, false);
      calculate();
    });
  });
  el.currency.addEventListener("change", function () { setPriceHint(); calculate(); });

  // Changing an individual unit means the system no longer matches a preset.
  [el.distanceUnit, el.economyUnit, el.priceUnit].forEach(function (s) {
    s.addEventListener("change", function () {
      var match = Object.keys(SYSTEMS).filter(function (k) {
        var sys = SYSTEMS[k];
        return sys.distance === el.distanceUnit.value && sys.economy === el.economyUnit.value && sys.price === el.priceUnit.value;
      })[0];
      form.querySelectorAll('input[name="system"]').forEach(function (r) { r.checked = r.value === match; });
      calculate();
    });
  });

  // Initial state from the visitor's locale
  var region = detectRegion();
  el.currency.value = region[1];
  var radio = form.querySelector('input[name="system"][value="' + region[0] + '"]');
  if (radio) radio.checked = true;
  applySystem(region[0], false);
  calculate();
})();
