import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import gplay from "@mradex77/google-play-scraper";
import { chromium } from "playwright";

const ROOT = process.cwd();
const SITE_DIR = path.join(ROOT, "site");
const IMAGES_DIR = path.join(SITE_DIR, "images");
const MANIFEST_FILE = path.join(SITE_DIR, "manifest.json");

const config = JSON.parse(
  await fs.readFile(path.join(ROOT, "config.json"), "utf8")
);

const {
  searchTerm = "captions",
  country = "us",
  lang = "en",
  numApps = 19,
  maxScreenshots = 10,
  delayMs = 800
} = config;

const today = new Date().toISOString().slice(0, 10);

const googleLanguage =
  lang.toLowerCase() === "en" ? "en-US" : lang;

const googleCountry = country.toUpperCase();

await fs.mkdir(IMAGES_DIR, {
  recursive: true
});

let previousManifest = {
  apps: []
};

try {
  previousManifest = JSON.parse(
    await fs.readFile(MANIFEST_FILE, "utf8")
  );
} catch {
  console.log("No previous manifest. First run.");
}

const previousApps = new Map(
  (previousManifest.apps || []).map(app => [
    app.appId,
    app
  ])
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getExtension(contentType = "") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (
    contentType.includes("jpeg") ||
    contentType.includes("jpg")
  ) {
    return "jpg";
  }

  return "jpg";
}

function normalizeGoogleImageUrl(url) {
  if (!url) return "";

  if (
    !url.startsWith(
      "https://play-lh.googleusercontent.com/"
    )
  ) {
    return url;
  }

  let clean = url.split("?")[0];

  const domainEnd =
    clean.indexOf("googleusercontent.com/") +
    "googleusercontent.com/".length;

  const lastEqual = clean.lastIndexOf("=");

  if (lastEqual > domainEnd) {
    clean = clean.slice(0, lastEqual);
  }

  return `${clean}=s0`;
}

async function downloadScreenshot(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/140.0.0.0 Safari/537.36",

      "Accept-Language":
        "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Image download failed: ${response.status}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  return {
    buffer,
    hash: sha256(buffer),
    extension: getExtension(
      response.headers.get("content-type") || ""
    )
  };
}

async function acceptGoogleConsent(page) {
  const buttonNames = [
    /Accept all/i,
    /I agree/i,
    /Agree/i
  ];

  for (const name of buttonNames) {
    try {
      const button = page
        .getByRole("button", { name })
        .first();

      if (await button.isVisible()) {
        await button.click();

        await page.waitForTimeout(800);

        return;
      }
    } catch {
      // No consent button.
    }
  }
}

async function openAppThroughGooglePlaySearch(
  page,
  app
) {
  const searchUrl =
    "https://play.google.com/store/search" +
    `?q=${encodeURIComponent(app.title)}` +
    "&c=apps" +
    `&hl=${encodeURIComponent(googleLanguage)}` +
    `&gl=${encodeURIComponent(googleCountry)}`;

  console.log(
    `Searching in real browser: ${app.title}`
  );

  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await acceptGoogleConsent(page);

  await page.waitForTimeout(1500);

  const appLink = page
    .locator(
      `a[href*="/store/apps/details"]` +
      `[href*="${app.appId}"]:visible`
    )
    .first();

  let openedFromSearch = false;

  try {
    if (await appLink.count()) {
      await appLink.click({
        timeout: 15000
      });

      openedFromSearch = true;

      await page.waitForLoadState(
        "domcontentloaded",
        {
          timeout: 30000
        }
      ).catch(() => {});
    }
  } catch (error) {
    console.log(
      `Search click failed: ${error.message}`
    );
  }

  if (!openedFromSearch) {
    console.log(
      "App link not found in search. Using direct fallback."
    );

    const directUrl =
      "https://play.google.com/store/apps/details" +
      `?id=${encodeURIComponent(app.appId)}` +
      `&hl=${encodeURIComponent(googleLanguage)}` +
      `&gl=${encodeURIComponent(googleCountry)}`;

    await page.goto(directUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
  }

  await acceptGoogleConsent(page);

  await page.waitForTimeout(1800);
}

async function collectVisibleScreenshotUrls(page) {
  const urls = [];

  /*
   * Google Play currently labels store screenshots
   * as "Screenshot image".
   *
   * We use the rendered browser DOM instead of
   * scraper detail.screenshots.
   */

  const screenshotImages = page.locator(
    'img[alt="Screenshot image"]'
  );

  const count = await screenshotImages.count();

  console.log(
    `Screenshot image elements found: ${count}`
  );

  for (let i = 0; i < count; i++) {
    const image = screenshotImages.nth(i);

    try {
      if (!(await image.isVisible())) {
        continue;
      }

      await image
        .scrollIntoViewIfNeeded()
        .catch(() => {});

      await page.waitForTimeout(80);

      const src = await image.evaluate(
        element =>
          element.currentSrc ||
          element.src ||
          ""
      );

      if (
        src &&
        src.includes(
          "play-lh.googleusercontent.com"
        )
      ) {
        urls.push(
          normalizeGoogleImageUrl(src)
        );
      }
    } catch {
      // Ignore individual image failure.
    }
  }

  /*
   * Fallback:
   * If Google changes the alt text,
   * select large visible Google Play images.
   */

  if (!urls.length) {
    console.log(
      "Primary selector found no screenshots. Running fallback."
    );

    const googleImages = page.locator(
      'img[src*="play-lh.googleusercontent.com"]'
    );

    const fallbackCount =
      await googleImages.count();

    for (
      let i = 0;
      i < fallbackCount;
      i++
    ) {
      const image = googleImages.nth(i);

      try {
        if (!(await image.isVisible())) {
          continue;
        }

        const box =
          await image.boundingBox();

        if (
          !box ||
          box.width < 150 ||
          box.height < 150
        ) {
          continue;
        }

        await image
          .scrollIntoViewIfNeeded()
          .catch(() => {});

        const src = await image.evaluate(
          element =>
            element.currentSrc ||
            element.src ||
            ""
        );

        if (
          src &&
          src.includes(
            "play-lh.googleusercontent.com"
          )
        ) {
          urls.push(
            normalizeGoogleImageUrl(src)
          );
        }
      } catch {
        // Ignore.
      }
    }
  }

  const uniqueUrls = [];

  const seen = new Set();

  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    uniqueUrls.push(url);
  }

  console.log(
    `Visible unique screenshots: ${uniqueUrls.length}`
  );

  return uniqueUrls.slice(
    0,
    maxScreenshots
  );
}

/*
 * 1. Use scraper only to discover competitors.
 */

console.log(
  `Finding apps for "${searchTerm}" / ${country} / ${lang}`
);

const searchResults = await gplay.search({
  term: searchTerm,
  num: numApps,
  country,
  lang
});

const targets = searchResults.slice(
  0,
  numApps
);

/*
 * 2. Launch a real Chromium browser.
 */

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  locale: "en-US",

  viewport: {
    width: 1440,
    height: 1200
  },

  extraHTTPHeaders: {
    "Accept-Language":
      "en-US,en;q=0.9"
  }
});

const page = await context.newPage();

page.setDefaultTimeout(20000);

const apps = [];

try {
  for (
    let i = 0;
    i < targets.length;
    i++
  ) {
    const result = targets[i];

    console.log("");
    console.log(
      `[${i + 1}/${targets.length}] ${result.title}`
    );

    try {
      /*
       * Search the real Google Play website
       * using the app title, then enter the app.
       */

      await openAppThroughGooglePlaySearch(
        page,
        result
      );

      /*
       * Read screenshots actually rendered
       * by Google Play.
       */

      const screenshotUrls =
        await collectVisibleScreenshotUrls(
          page
        );

      if (!screenshotUrls.length) {
        throw new Error(
          "No visible Google Play screenshots found"
        );
      }

      console.log(
        `Downloading ${screenshotUrls.length} screenshots`
      );

      const downloads = [];

      for (
        const url of screenshotUrls
      ) {
        downloads.push(
          await downloadScreenshot(url)
        );
      }

      const oldApp =
        previousApps.get(
          result.appId
        );

      const oldHashes =
        oldApp?.screenshots?.map(
          screenshot => screenshot.hash
        ) || [];

      const newHashes =
        downloads.map(
          screenshot => screenshot.hash
        );

      const screenshotsChanged =
        JSON.stringify(oldHashes) !==
        JSON.stringify(newHashes);

      const updatedAt =
        screenshotsChanged || !oldApp
          ? today
          : oldApp.updatedAt;

      if (screenshotsChanged) {
        console.log(
          "Screenshot change detected."
        );
      } else {
        console.log(
          "Screenshots unchanged."
        );
      }

      const appDirectory = path.join(
        IMAGES_DIR,
        result.appId
      );

      /*
       * Only replace old files after
       * all new images download successfully.
       */

      await fs.rm(
        appDirectory,
        {
          recursive: true,
          force: true
        }
      );

      await fs.mkdir(
        appDirectory,
        {
          recursive: true
        }
      );

      const screenshots = [];

      for (
        let j = 0;
        j < downloads.length;
        j++
      ) {
        const item =
          downloads[j];

        const filename =
          `${String(j + 1).padStart(2, "0")}` +
          `.${item.extension}`;

        await fs.writeFile(
          path.join(
            appDirectory,
            filename
          ),
          item.buffer
        );

        screenshots.push({
          path:
            `images/${result.appId}/${filename}`,

          hash: item.hash
        });
      }

      apps.push({
        rank: i + 1,

        appId:
          result.appId,

        title:
          result.title ||
          result.appId,

        icon:
          result.icon || "",

        score:
          result.score ?? null,

        updatedAt,

        screenshots
      });
    } catch (error) {
      console.error(
        `Failed ${result.appId}:`,
        error.message
      );

      /*
       * If today's browser fetch fails,
       * keep yesterday's screenshots.
       */

      const oldApp =
        previousApps.get(
          result.appId
        );

      if (oldApp) {
        apps.push({
          ...oldApp,
          rank: i + 1
        });

        console.log(
          "Keeping previous screenshots."
        );
      }
    }

    await sleep(delayMs);
  }
} finally {
  await browser.close();
}

/*
 * Remove folders for apps
 * that are no longer in the ranking.
 */

const keepAppIds = new Set(
  apps.map(app => app.appId)
);

try {
  const folders = await fs.readdir(
    IMAGES_DIR,
    {
      withFileTypes: true
    }
  );

  for (const folder of folders) {
    if (
      folder.isDirectory() &&
      !keepAppIds.has(folder.name)
    ) {
      await fs.rm(
        path.join(
          IMAGES_DIR,
          folder.name
        ),
        {
          recursive: true,
          force: true
        }
      );
    }
  }
} catch {
  // Ignore.
}

/*
 * Save manifest.
 */

const manifest = {
  searchTerm,
  country,
  lang,
  source: "Google Play browser",
  apps
};

await fs.writeFile(
  MANIFEST_FILE,
  JSON.stringify(
    manifest,
    null,
    2
  )
);

/*
 * Generate website.
 */

const cards = apps
  .map(app => {
    const screenshotHtml =
      app.screenshots
        .map(
          screenshot => `
            <img
              src="${escapeHtml(
                screenshot.path
              )}"
              loading="lazy"
              alt="${escapeHtml(
                app.title
              )} screenshot"
            />
          `
        )
        .join("");

    return `
      <section class="app-card">

        <div class="app-header">

          <div class="rank">
            ${app.rank}
          </div>

          ${
            app.icon
              ? `
                <img
                  class="icon"
                  src="${escapeHtml(
                    app.icon
                  )}"
                  alt=""
                />
              `
              : ""
          }

          <div class="info">

            <h2>
              ${escapeHtml(
                app.title
              )}
            </h2>

            <div class="meta">

              ${escapeHtml(
                app.appId
              )}

              ${
                app.score
                  ? ` · ★ ${app.score}`
                  : ""
              }

              · Screenshot updated:
              ${escapeHtml(
                app.updatedAt
              )}

            </div>

          </div>

          <a
            class="store-link"
            href="https://play.google.com/store/apps/details?id=${encodeURIComponent(
              app.appId
            )}&hl=${encodeURIComponent(
              googleLanguage
            )}&gl=${encodeURIComponent(
              googleCountry
            )}"
            target="_blank"
          >
            Google Play
          </a>

        </div>

        <div class="screenshots">
          ${screenshotHtml}
        </div>

      </section>
    `;
  })
  .join("");

const html = `<!doctype html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Google Play Competitor Screenshots
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f5f6f8;
  color: #171717;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.container {
  width:
    min(
      1500px,
      calc(100% - 48px)
    );

  margin: 0 auto;

  padding:
    40px 0 80px;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  margin: 0 0 8px;

  font-size: 30px;
}

.page-header p {
  margin: 0;

  color: #737373;
}

.app-card {
  background: white;

  border:
    1px solid #e7e7e7;

  border-radius: 16px;

  margin-bottom: 24px;

  overflow: hidden;
}

.app-header {
  display: flex;

  align-items: center;

  gap: 14px;

  padding:
    18px 20px;

  border-bottom:
    1px solid #eeeeee;
}

.rank {
  width: 30px;

  font-size: 16px;

  font-weight: 700;

  color: #999;

  text-align: center;
}

.icon {
  width: 52px;
  height: 52px;

  border-radius: 12px;

  object-fit: cover;
}

.info {
  flex: 1;

  min-width: 0;
}

.info h2 {
  margin: 0 0 6px;

  font-size: 17px;
}

.meta {
  color: #888;

  font-size: 13px;
}

.store-link {
  text-decoration: none;

  color: #1769e0;

  font-size: 14px;
}

.screenshots {
  display: flex;

  gap: 14px;

  overflow-x: auto;

  padding: 20px;
}

.screenshots img {
  height: 430px;

  width: auto;

  border-radius: 10px;

  border:
    1px solid #eeeeee;

  flex: none;
}

@media (max-width: 700px) {

  .container {
    width:
      calc(100% - 24px);
  }

  .screenshots img {
    height: 360px;
  }

  .store-link {
    display: none;
  }

}

</style>

</head>

<body>

<div class="container">

  <header class="page-header">

    <h1>
      Google Play Competitor Screenshots
    </h1>

    <p>
      Keyword:
      <strong>
        ${escapeHtml(
          searchTerm
        )}
      </strong>

      · Market:
      ${escapeHtml(
        googleCountry
      )}

      · Screenshot source:
      Real Google Play browser
    </p>

  </header>

  ${cards}

</div>

</body>

</html>`;

await fs.writeFile(
  path.join(
    SITE_DIR,
    "index.html"
  ),
  html
);

await fs.writeFile(
  path.join(
    SITE_DIR,
    ".nojekyll"
  ),
  ""
);

console.log("");
console.log(
  `Done. ${apps.length} apps processed.`
);
