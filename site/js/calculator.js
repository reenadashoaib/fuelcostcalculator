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
    perDistance: document.getElementById("out-per-distance"),
    perDistanceLabel: document.getElementById("out-per-distance-label"),
    perHundred: document.getElementById("out-per-hundred"),
    perHundredLabel: document.getElementById("out-per-hundred-label"),
    perPerson: document.getElementById("out-per-person"),
    co2: document.getElementById("out-co2"),
    tripDistance: document.getElementById("out-trip-distance"),
    error: document.getElementById("calc-error"),
    note: document.getElementById("out-note")
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var shownTotal = 0;
  var animFrame = 0;

  function num(input) {
    var v = parseFloat(String(input.value).replace(",", "."));
    return isFinite(v) ? v : NaN;
  }

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

  function money(value) {
    var code = el.currency.value;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: value < 10 ? 2 : value < 100000 ? 2 : 0
      }).format(value);
    } catch (e) {
      return code + " " + value.toFixed(2);
    }
  }

  function fixed(value, digits) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }

  function animateTotal(target) {
    window.cancelAnimationFrame(animFrame);
    if (reduceMotion || !isFinite(shownTotal)) {
      shownTotal = target;
      el.total.textContent = money(target);
      return;
    }
    var from = shownTotal;
    var start = performance.now();
    var duration = 450;
    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      shownTotal = from + (target - from) * eased;
      el.total.textContent = money(shownTotal);
      if (t < 1) animFrame = window.requestAnimationFrame(step);
    }
    animFrame = window.requestAnimationFrame(step);
  }

  function showError(message) {
    el.error.textContent = message;
    el.error.hidden = !message;
    if (!message) return;
    // Don't leave a stale result next to an invalid input.
    window.cancelAnimationFrame(animFrame);
    shownTotal = 0;
    [el.total, el.volume, el.perDistance, el.perHundred, el.perPerson, el.co2, el.tripDistance].forEach(function (o) {
      o.textContent = "–";
    });
  }

  function calculate() {
    var distance = num(el.distance);
    var economy = num(el.economy);
    var price = num(el.price);
    var people = Math.max(1, Math.floor(num(el.people)) || 1);

    if (!(distance > 0)) return showError("Enter a trip distance greater than 0.");
    if (!(economy > 0)) return showError("Enter your car's fuel economy, greater than 0.");
    if (!(price >= 0)) return showError("Enter the fuel price, 0 or more.");
    showError("");

    var distUnit = el.distanceUnit.value;
    var tripDistance = distance * (el.roundTrip.checked ? 2 : 1);
    var km = distUnit === "mi" ? tripDistance * KM_PER_MILE : tripDistance;
    var litres = km * litresPerKm(economy, el.economyUnit.value);
    var priceUnit = el.priceUnit.value;
    var cost = (litres / litresPer(priceUnit)) * price;

    var volumeLabel = { l: "litres", usgal: "US gallons", ukgal: "UK gallons" }[priceUnit];
    var volume = litres / litresPer(priceUnit);

    animateTotal(cost);
    el.volume.textContent = fixed(volume, 2) + " " + volumeLabel;
    el.tripDistance.textContent = fixed(tripDistance, tripDistance < 100 ? 1 : 0) + " " + distUnit +
      (el.roundTrip.checked ? " round trip" : " one way");
    el.perDistanceLabel.textContent = "Cost per " + (distUnit === "mi" ? "mile" : "km");
    el.perDistance.textContent = money(cost / tripDistance);
    el.perHundredLabel.textContent = "Cost per 100 " + (distUnit === "mi" ? "miles" : "km");
    el.perHundred.textContent = money((cost / tripDistance) * 100);
    el.perPerson.textContent = people > 1 ? money(cost / people) + " × " + people : money(cost);
    el.co2.textContent = fixed(litres * CO2_PER_L[el.fuel.value], 1) + " kg";
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
  shownTotal = 0;
  calculate();
})();
