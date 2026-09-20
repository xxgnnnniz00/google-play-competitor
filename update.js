import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import gplay from "@mradex77/google-play-scraper";

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

await fs.mkdir(IMAGES_DIR, { recursive: true });

let previousManifest = { apps: [] };

try {
  previousManifest = JSON.parse(
    await fs.readFile(MANIFEST_FILE, "utf8")
  );
} catch {
  // First run
}

const previousApps = new Map(
  (previousManifest.apps || []).map(app => [app.appId, app])
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

function getExtension(contentType = "") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("jpg")) return "jpg";
  return "jpg";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function downloadScreenshot(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
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

  const extension = getExtension(
    response.headers.get("content-type") || ""
  );

  return {
    buffer,
    extension,
    hash: sha256(buffer)
  };
}

console.log(
  `Searching Google Play: "${searchTerm}", ${country}, ${lang}`
);

const searchResults = await gplay.search({
  term: searchTerm,
  num: numApps,
  country,
  lang
});

const targets = searchResults.slice(0, numApps);

const apps = [];

for (let i = 0; i < targets.length; i++) {
  const result = targets[i];

  console.log(
    `[${i + 1}/${targets.length}] ${result.title}`
  );

  try {
    const detail = await gplay.app({
      appId: result.appId,
      country,
      lang
    });

    const screenshotUrls = Array.isArray(detail.screenshots)
      ? detail.screenshots.slice(0, maxScreenshots)
      : [];

    if (!screenshotUrls.length) {
      throw new Error("No screenshots returned");
    }

    const downloads = [];

    for (const url of screenshotUrls) {
      downloads.push(
        await downloadScreenshot(url)
      );
    }

    const oldApp = previousApps.get(result.appId);

    const oldHashes =
      oldApp?.screenshots?.map(item => item.hash) || [];

    const newHashes =
      downloads.map(item => item.hash);

    const screenshotsChanged =
      JSON.stringify(oldHashes) !==
      JSON.stringify(newHashes);

    const updatedAt =
      screenshotsChanged || !oldApp
        ? today
        : oldApp.updatedAt;

    const appDirectory = path.join(
      IMAGES_DIR,
      result.appId
    );

    await fs.rm(appDirectory, {
      recursive: true,
      force: true
    });

    await fs.mkdir(appDirectory, {
      recursive: true
    });

    const screenshots = [];

    for (let j = 0; j < downloads.length; j++) {
      const item = downloads[j];

      const filename =
        `${String(j + 1).padStart(2, "0")}.${item.extension}`;

      const absolutePath = path.join(
        appDirectory,
        filename
      );

      await fs.writeFile(
        absolutePath,
        item.buffer
      );

      screenshots.push({
        path: `images/${result.appId}/${filename}`,
        hash: item.hash
      });
    }

    apps.push({
      rank: i + 1,
      appId: result.appId,
      title: detail.title || result.title,
      icon: detail.icon || result.icon || "",
      score: detail.score ?? null,
      updatedAt,
      screenshots
    });
  } catch (error) {
    console.error(
      `Failed: ${result.appId}`,
      error.message
    );

    const oldApp = previousApps.get(
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

/* Remove apps that are no longer in current results */

const keepAppIds = new Set(
  apps.map(app => app.appId)
);

try {
  const folders = await fs.readdir(
    IMAGES_DIR,
    { withFileTypes: true }
  );

  for (const folder of folders) {
    if (
      folder.isDirectory() &&
      !keepAppIds.has(folder.name)
    ) {
      await fs.rm(
        path.join(IMAGES_DIR, folder.name),
        {
          recursive: true,
          force: true
        }
      );
    }
  }
} catch {}

/* Save manifest */

const manifest = {
  searchTerm,
  country,
  lang,
  apps
};

await fs.writeFile(
  MANIFEST_FILE,
  JSON.stringify(manifest, null, 2)
);

/* Generate website */

const latestUpdate =
  apps
    .map(app => app.updatedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] || "—";

const cards = apps
  .map(app => {
    const screenshotHtml = app.screenshots
      .map(
        item => `
          <img
            src="${escapeHtml(item.path)}"
            loading="lazy"
            alt="${escapeHtml(app.title)} screenshot"
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
                  src="${escapeHtml(app.icon)}"
                  alt=""
                />
              `
              : ""
          }

          <div class="info">
            <h2>
              ${escapeHtml(app.title)}
            </h2>

            <div class="meta">
              ${escapeHtml(app.appId)}
              ${
                app.score
                  ? ` · ★ ${app.score}`
                  : ""
              }
              · Screenshot updated:
              ${escapeHtml(app.updatedAt)}
            </div>
          </div>

          <a
            class="store-link"
            href="https://play.google.com/store/apps/details?id=${encodeURIComponent(app.appId)}&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(country.toUpperCase())}"
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

<title>Google Play Competitor Screenshots</title>

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
  width: min(1500px, calc(100% - 48px));
  margin: 0 auto;
  padding: 40px 0 80px;
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
  border: 1px solid #e7e7e7;
  border-radius: 16px;
  margin-bottom: 24px;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid #eeeeee;
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
  border: 1px solid #eeeeee;
  flex: none;
}

@media (max-width: 700px) {

  .container {
    width: calc(100% - 24px);
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
      <strong>${escapeHtml(searchTerm)}</strong>
      · Market:
      ${escapeHtml(country.toUpperCase())}
      · Latest screenshot change:
      ${escapeHtml(latestUpdate)}
    </p>

  </header>

  ${cards}

</div>

</body>

</html>`;

await fs.writeFile(
  path.join(SITE_DIR, "index.html"),
  html
);

await fs.writeFile(
  path.join(SITE_DIR, ".nojekyll"),
  ""
);

console.log(
  `Done. ${apps.length} apps processed.`
);
