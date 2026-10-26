/* Fills ad slots from ADS_CONFIG, runs the floating video ad and the interstitial. */
(function () {
  "use strict";

  var config = window.ADS_CONFIG || {};
  var pub = (config.publisherId || "").trim();
  var slots = config.slots || {};

  function loadAdSense() {
    if (!pub || document.querySelector('script[src*="adsbygoogle.js"]')) return;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(pub);
    document.head.appendChild(s);
  }

  function placeholder(box, text) {
    var p = document.createElement("div");
    p.className = "ad-placeholder";
    p.textContent = text;
    box.replaceChildren(p);
  }

  // Inserts ad-tag HTML so that its <script> tags actually run.
  function injectHtml(box, html) {
    box.replaceChildren(document.createRange().createContextualFragment(html));
  }

  function fillAdSense(box, slotId, fixed) {
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.setAttribute("data-ad-client", pub);
    ins.setAttribute("data-ad-slot", slotId);
    if (fixed) {
      ins.style.display = "inline-block";
      ins.style.width = box.clientWidth + "px";
      ins.style.height = box.clientHeight + "px";
    } else {
      ins.style.display = "block";
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
    }
    box.replaceChildren(ins);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  function fillSlots() {
    document.querySelectorAll("[data-ad-key]").forEach(function (box) {
      // Skip slots hidden by the layout (e.g. rails on phones): AdSense errors on 0-width slots.
      if (!box.offsetParent || box.clientWidth === 0) return;
      if (box.dataset.filled) return;
      box.dataset.filled = "1";

      var key = box.dataset.adKey;
      var slotId = (slots[key] || "").trim();
      if (pub && slotId) {
        fillAdSense(box, slotId, box.dataset.adFormat === "fixed");
      } else {
        var size = box.dataset.adFormat === "fixed" ? box.clientWidth + "×" + box.clientHeight : "responsive";
        placeholder(box, "Ad space " + size);
      }
    });
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
  }

  function setupVideoAd() {
    var opts = config.videoAd || {};
    var el = document.getElementById("video-ad");
    if (!el || !opts.enabled) return;
    if (storageGet("fcc-video-closed") === sessionKey()) return;

    window.setTimeout(function () {
      var box = el.querySelector(".video-ad__slot");
      if (opts.html) injectHtml(box, opts.html);
      else placeholder(box, "Video ad space 16:9");
      el.hidden = false;
    }, (opts.showAfterSeconds || 0) * 1000);

    el.querySelector("[data-close]").addEventListener("click", function () {
      el.hidden = true;
      el.querySelector(".video-ad__slot").replaceChildren();
      storageSet("fcc-video-closed", sessionKey());
    });
  }

  // One value per browser tab session, so a closed video stays closed while browsing.
  function sessionKey() {
    try {
      var k = window.sessionStorage.getItem("fcc-session");
      if (!k) {
        k = String(Date.now());
        window.sessionStorage.setItem("fcc-session", k);
      }
      return k;
    } catch (e) {
      return "none";
    }
  }

  function setupInterstitial() {
    var opts = config.interstitial || {};
    var dialog = document.getElementById("interstitial");
    if (!dialog || !opts.enabled || typeof dialog.showModal !== "function") return;

    var last = Number(storageGet("fcc-interstitial-at") || 0);
    var gap = (opts.onceEveryHours || 24) * 3600 * 1000;
    if (Date.now() - last < gap) return;

    var closeBtn = dialog.querySelector(".interstitial__close");
    var canClose = false;

    function close() {
      if (!canClose) return;
      dialog.close();
      dialog.querySelector(".interstitial__slot").replaceChildren();
    }

    closeBtn.addEventListener("click", close);
    dialog.addEventListener("cancel", function (e) {
      // Esc closes only after the countdown.
      if (!canClose) e.preventDefault();
    });

    window.setTimeout(function () {
      if (document.querySelector("dialog[open]")) return;
      var box = dialog.querySelector(".interstitial__slot");
      if (opts.html) injectHtml(box, opts.html);
      else placeholder(box, "Full-screen ad space");

      var remaining = opts.closeAfterSeconds || 0;
      closeBtn.disabled = remaining > 0;
      closeBtn.textContent = remaining > 0 ? "Close in " + remaining : "Close ad";
      dialog.showModal();
      storageSet("fcc-interstitial-at", String(Date.now()));

      var timer = window.setInterval(function () {
        remaining -= 1;
        if (remaining > 0) {
          closeBtn.textContent = "Close in " + remaining;
          return;
        }
        window.clearInterval(timer);
        canClose = true;
        closeBtn.disabled = false;
        closeBtn.textContent = "Close ad";
        closeBtn.focus();
      }, 1000);
      if (remaining <= 0) canClose = true;
    }, (opts.showAfterSeconds || 0) * 1000);
  }

  function init() {
    loadAdSense();
    fillSlots();
    setupVideoAd();
    setupInterstitial();
    // Rails appear when a window is widened; fill them then.
    var t;
    window.addEventListener("resize", function () {
      window.clearTimeout(t);
      t = window.setTimeout(fillSlots, 300);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
