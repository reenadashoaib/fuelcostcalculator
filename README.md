# Fuel Cost Calculator

A static fuel cost calculator website with ad spaces built in. Plain HTML, CSS and JavaScript: no build step.

Everything that gets published is in `site/`. The rest of the repo (including `.claude/`) is never deployed.

```
site/
  index.html          calculator, article content and most ad slots
  about.html, contact.html, privacy.html, terms.html, 404.html
  css/styles.css
  js/ads-config.js    ← the file you edit to turn on ads
  js/ads.js           fills ad slots, runs the video ad and full-screen pop-up
  js/calculator.js    the calculator
  ads.txt, robots.txt, _headers, favicon.svg
wrangler.jsonc        Cloudflare config (serves site/ only)
```

## Ad spaces

| Slot key (`ads-config.js`) | Size | Where |
|---|---|---|
| `topBanner` | 728×90, 320×100 on phones | Under the header, every page |
| `leftRail` | 160×600 | Sticky left column, screens 1280px and wider |
| `rightRail` | 300×600 | Sticky right column, screens 1024px and wider, every page |
| `inContent` | Responsive | Below the calculator |
| `tile1` – `tile6` | 300×250, in pairs | Three groups through the article |
| `bottomBanner` | 970×90, 320×100 on phones | Above the footer, every page |
| `videoAd` | 16:9 floating box | Bottom-right corner, home page |
| `interstitial` | Full screen | Pop-up on the home page, once per visitor per 24 hours, closable after 5 seconds |

Empty slots show a grey "Ad space" placeholder, so you can see the layout before ads are live.

## Turning on Google AdSense

1. Deploy the site and apply for AdSense with your domain.
2. For verification, AdSense gives you a `<script>` snippet. Paste it where the comment `AdSense site verification` is, in the `<head>` of each HTML page.
3. In `site/js/ads-config.js`, set `publisherId` to your ID (`ca-pub-…`).
4. In AdSense, create a display ad unit for each slot and paste its `data-ad-slot` number into the matching key in `slots`.
5. In `site/ads.txt`, replace the example line with the line AdSense gives you, and remove the leading `#`.
6. Update the contact email (`hello@example.com`) in `contact.html`, `privacy.html` and `terms.html`.

### Important: AdSense rules for the pop-up and video ad

Google AdSense does **not** allow its ad code inside pop-ups or floating boxes. Doing so can get your account suspended. You have two options:

- **AdSense only:** in AdSense, go to Ads → By site → Auto ads and turn on **Vignette ads** (Google's own full-screen ad) and **Anchor ads** (Google's own sticky ad). Then set `enabled: false` for `videoAd` and `interstitial` in `ads-config.js`.
- **Another ad network:** video and interstitial networks give you an ad tag. Paste it as the `html` value of `videoAd` or `interstitial`; its scripts will run.

Also keep in mind that AdSense reviews sites for having enough real content relative to ads. If approval is slow, adding more articles and pages helps.

## Running it locally

```
cd site
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying to Cloudflare

### Option A: Cloudflare Workers (connect to GitHub)

1. In the Cloudflare dashboard, go to Workers & Pages → Create → Import a repository, and pick this repo.
2. Leave the build command empty. Cloudflare reads `wrangler.jsonc`, which serves the `site/` folder.
3. Deploy, then add your domain under the Worker's Settings → Domains & Routes.

Or from your computer: `npx wrangler deploy`.

### Option B: Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git, and pick this repo.
2. Framework preset: None. Build command: leave empty. Build output directory: `site`.
3. Deploy, then add your domain under Custom domains.

## Before going live

- Add a sitemap: create `site/sitemap.xml` listing your pages with your real domain, and add `Sitemap: https://yourdomain.com/sitemap.xml` to `robots.txt`.
- Visitors in the EEA, UK and Switzerland must be asked for cookie consent before personalised ads. Turn on Google's consent message under Privacy & messaging in AdSense.
