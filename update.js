import gplay from "google-play-scraper";
import fs from "node:fs/promises";

async function readConfig() {
  const content = await fs.readFile("./config.json", "utf8");
  return JSON.parse(content);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeScreenshotUrl(url) {
  if (!url) {
    return "";
  }

  /*
   * Google Play 返回的截图地址通常不带尺寸。
   * 添加显示尺寸，避免图片过小。
   */
  return url.includes("=") ? url : `${url}=w1200`;
}

function createAppHtml(app, rank) {
  const screenshots = Array.isArray(app.screenshots)
    ? app.screenshots.map(normalizeScreenshotUrl).filter(Boolean)
    : [];

  const screenshotsHtml = screenshots.length
    ? screenshots
        .map(
          (url, index) => `
            <div class="screenshot-item">
              <img
                src="${escapeHtml(url)}"
                alt="${escapeHtml(app.title)} 截图 ${index + 1}"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </div>
          `
        )
        .join("")
    : `<div class="empty">没有获取到截图</div>`;

  return `
    <section class="app-card">
      <div class="app-header">
        <div class="rank">#${rank}</div>

        ${
          app.icon
            ? `
              <img
                class="app-icon"
                src="${escapeHtml(app.icon)}"
                alt=""
                referrerpolicy="no-referrer"
              />
            `
            : ""
        }

        <div class="app-info">
          <h2>
            <a
              href="${escapeHtml(app.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(app.title)}
            </a>
          </h2>

          <div class="app-meta">
            ${escapeHtml(app.developer || "")}
            ${app.score ? ` · 评分 ${escapeHtml(app.score)}` : ""}
            ${app.installs ? ` · ${escapeHtml(app.installs)}` : ""}
          </div>
        </div>
      </div>

      <div class="screenshots-container">
        ${screenshotsHtml}
      </div>
    </section>
  `;
}

function createPage(config, apps) {
  const appCards = apps
    .map((app, index) => createAppHtml(app, index + 1))
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>${escapeHtml(config.title)}</title>

  <style>
    :root {
      --page-bg: #f5f6f8;
      --card-bg: #ffffff;
      --text-main: #202124;
      --text-secondary: #5f6368;
      --border: #e0e3e7;
      --blue: #1a73e8;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: var(--page-bg);
      color: var(--text-main);
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Arial,
        sans-serif;
    }

    .page-header {
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    h1 {
      margin: 0 0 10px;
      font-size: 30px;
    }

    .page-meta {
      color: var(--text-secondary);
      font-size: 15px;
      line-height: 1.7;
    }

    .comparison-list {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .app-card {
      overflow: hidden;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .app-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .rank {
      flex: 0 0 auto;
      color: var(--blue);
      font-size: 26px;
      font-weight: 800;
    }

    .app-icon {
      width: 48px;
      height: 48px;
      flex: 0 0 auto;
      border-radius: 10px;
      object-fit: cover;
    }

    .app-info {
      min-width: 0;
    }

    .app-info h2 {
      margin: 0;
      font-size: 19px;
      line-height: 1.4;
    }

    .app-info h2 a {
      color: var(--text-main);
      text-decoration: none;
    }

    .app-info h2 a:hover {
      color: var(--blue);
      text-decoration: underline;
    }

    .app-meta {
      margin-top: 4px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .screenshots-container {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      overflow-x: auto;
      padding: 22px 16px 16px;
      scroll-behavior: smooth;
    }

    .screenshots-container::-webkit-scrollbar {
      height: 8px;
    }

    .screenshots-container::-webkit-scrollbar-thumb {
      background: #b7bcc3;
      border-radius: 999px;
    }

    .screenshot-item {
      flex: 0 0 auto;
      height: 420px;
      overflow: hidden;
      background: #eef0f2;
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .screenshot-item img {
      display: block;
      width: auto;
      height: 100%;
      object-fit: contain;
    }

    .empty {
      padding: 30px 10px;
      color: #999;
      font-size: 14px;
    }

    @media (max-width: 700px) {
      body {
        padding: 12px;
      }

      h1 {
        font-size: 23px;
      }

      .app-header {
        padding: 14px;
      }

      .rank {
        font-size: 22px;
      }

      .app-info h2 {
        font-size: 17px;
      }

      .screenshot-item {
        height: 330px;
      }
    }
  </style>
</head>

<body>
  <header class="page-header">
    <h1>🎬 ${escapeHtml(config.title)}</h1>

    <div class="page-meta">
      市场：${escapeHtml(config.language.toUpperCase())}-${escapeHtml(
        config.country.toUpperCase()
      )}
      ｜搜索词：“${escapeHtml(config.keyword)}”
      ｜排序：Google Play 搜索结果顺序
      ｜共 ${apps.length} 个应用
    </div>
  </header>

  <main class="comparison-list">
    ${appCards}
  </main>
</body>
</html>`;
}

async function main() {
  const config = await readConfig();

  console.log(`开始搜索：${config.keyword}`);

  const searchResults = await gplay.search({
    term: config.keyword,
    num: config.appCount,
    lang: config.language,
    country: config.country,
    fullDetail: false
  });

  const apps = [];

  for (let index = 0; index < searchResults.length; index += 1) {
    const result = searchResults[index];

    console.log(
      `[${index + 1}/${searchResults.length}] 获取：${result.title}`
    );

    try {
      const detail = await gplay.app({
        appId: result.appId,
        lang: config.language,
        country: config.country
      });

      apps.push(detail);
    } catch (error) {
      console.error(`获取失败：${result.title}`);
      console.error(error.message);
    }
  }

  const html = createPage(config, apps);

  await fs.writeFile("./index.html", html, "utf8");
  await fs.writeFile(
    "./apps-data.json",
    JSON.stringify(apps, null, 2),
    "utf8"
  );

  console.log("index.html 已生成");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
