/*
 * Ad settings — the only file you need to edit to turn ads on.
 *
 * 1. Put your AdSense publisher ID in `publisherId` (looks like "ca-pub-1234567890123456").
 * 2. In AdSense, create one display ad unit per slot below and paste its
 *    data-ad-slot number. Empty slots show a grey placeholder instead.
 * 3. Update /ads.txt with the same publisher ID.
 *
 * The floating video and the full-screen pop-up take raw ad-tag HTML from a
 * video/interstitial ad network. Google AdSense does NOT allow its ad code
 * inside pop-ups or floating boxes; for AdSense, turn on "Vignette ads" and
 * "Anchor ads" under Auto ads in your AdSense dashboard instead, and set
 * `enabled: false` on the sections below.
 */
window.ADS_CONFIG = {
  publisherId: "",

  slots: {
    topBanner: "",      // 728×90 leaderboard (320×100 on phones)
    leftRail: "",       // 160×600 wide skyscraper, wide screens only
    rightRail: "",      // 300×600 half page, laptops and up
    inContent: "",      // responsive, below the calculator
    tile1: "",          // 300×250 medium rectangles
    tile2: "",
    tile3: "",
    tile4: "",
    tile5: "",
    tile6: "",
    bottomBanner: ""    // 970×90 (320×100 on phones)
  },

  videoAd: {
    enabled: true,
    html: "",           // ad tag from your video ad network
    showAfterSeconds: 4
  },

  interstitial: {
    enabled: true,
    html: "",           // ad tag from your interstitial ad network
    showAfterSeconds: 25,
    closeAfterSeconds: 5,
    onceEveryHours: 24
  }
};
