import gplay from "google-play-scraper";
import fs from "node:fs/promises";

/* ==============================
   读取配置
============================== */

async function readConfig() {
  const content = await fs.readFile("./config.json", "utf8");
  return JSON.parse(content);
}

/* ==============================
   基础工具
============================== */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseAppId(value = "") {
  const input = String(value).trim();

  if (!input) {
    throw new Error("没有填写 Google Play 链接或 appId");
  }

  /*
    支持完整 Google Play 链接：
    https://play.google.com/store/apps/details?id=com.example.app
  */
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const url = new URL(input);
    const appId = url.searchParams.get("id");

    if (!appId) {
      throw new Error(`链接中没有找到 id 参数：${input}`);
    }

    return appId;
  }

  /*
    同时支持直接填写：
    com.example.app
  */
  return input;
}

function normalizeImageUrl(url = "") {
  const value = String(url).trim();

  if (!value) {
    return "";
  }

  /*
    Google Play 返回的截图链接可能没有尺寸参数。
    添加较大尺寸，确保放大后清晰。
  */
  if (value.includes("=")) {
    return value;
  }

  return `${value}=w1800`;
}

/* ==============================
   生成单个应用 HTML
============================== */

function createAppHtml(app) {
  const screenshots = Array.isArray(app.screenshots)
    ? app.screenshots
        .map(normalizeImageUrl)
        .filter(Boolean)
    : [];

  const screenshotsHtml = screenshots.length
    ? screenshots
        .map((url, index) => {
          return `
            <button
              class="screenshot-item"
              type="button"
              data-app-name="${escapeHtml(app.title)}"
              data-image-index="${index}"
              aria-label="查看 ${escapeHtml(app.title)} 第 ${index + 1} 张截图"
            >
              <img
                src="${escapeHtml(url)}"
                alt="${escapeHtml(app.title)} 截图 ${index + 1}"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
              />

              <span class="zoom-hint">点击放大</span>
            </button>
          `;
        })
        .join("")
    : `
        <div class="empty-state">
          没有获取到该应用的商店截图
        </div>
      `;

  const appScreenshotsJson = escapeHtml(
    JSON.stringify(screenshots)
  );

  return `
    <section
      class="app-card"
      data-app-name="${escapeHtml(app.title)}"
      data-screenshots="${appScreenshotsJson}"
    >
      <div class="app-header">
        <div class="rank">
          #${escapeHtml(app.customRank)}
        </div>

        ${
          app.icon
            ? `
              <img
                class="app-icon"
                src="${escapeHtml(app.icon)}"
                alt="${escapeHtml(app.title)} 图标"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            `
            : ""
        }

        <div class="app-info">
          <h2 class="app-title">
            <a
              href="${escapeHtml(app.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(app.title)}
            </a>
          </h2>

          <div class="app-meta">
            ${
              app.developer
                ? `<span>${escapeHtml(app.developer)}</span>`
                : ""
            }

            ${
              app.score
                ? `<span>评分 ${escapeHtml(app.score)}</span>`
                : ""
            }

            ${
              app.installs
                ? `<span>${escapeHtml(app.installs)}</span>`
                : ""
            }

            <span>${screenshots.length} 张截图</span>
          </div>
        </div>
      </div>

      <div class="screenshots-container">
        ${screenshotsHtml}
      </div>
    </section>
  `;
}

/* ==============================
   生成完整网页
============================== */

function createPage(config, apps) {
  const cardsHtml = apps
    .map(createAppHtml)
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
      --border: #dfe3e8;
      --primary: #1a73e8;
      --hover-bg: #f3f7fd;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-width: 320px;
      padding: 24px;
      color: var(--text-main);
      background: var(--page-bg);
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        "Helvetica Neue",
        Arial,
        sans-serif;
    }

    button,
    img {
      -webkit-tap-highlight-color: transparent;
    }

    /* ==============================
       页面头部
    ============================== */

    .page-header {
      margin-bottom: 26px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .page-header h1 {
      margin: 0 0 10px;
      font-size: 32px;
      line-height: 1.3;
      letter-spacing: -0.5px;
    }

    .page-meta {
      color: var(--text-secondary);
      font-size: 15px;
      line-height: 1.8;
    }

    /* ==============================
       应用列表
    ============================== */

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
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.04),
        0 3px 10px rgba(0, 0, 0, 0.03);
    }

    .app-header {
      display: flex;
      align-items: center;
      gap: 15px;
      min-height: 80px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .rank {
      flex: 0 0 auto;
      min-width: 48px;
      color: var(--primary);
      font-size: 28px;
      line-height: 1;
      font-weight: 800;
    }

    .app-icon {
      width: 52px;
      height: 52px;
      flex: 0 0 auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      object-fit: cover;
    }

    .app-info {
      min-width: 0;
    }

    .app-title {
      margin: 0;
      font-size: 20px;
      line-height: 1.45;
    }

    .app-title a {
      color: var(--text-main);
      text-decoration: none;
    }

    .app-title a:hover {
      color: var(--primary);
      text-decoration: underline;
    }

    .app-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin-top: 5px;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.6;
    }

    /* ==============================
       截图横向区域
    ============================== */

    .screenshots-container {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 24px 16px 16px;
      scroll-behavior: smooth;
      scroll-snap-type: x proximity;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      scrollbar-color: #adb3bb transparent;
    }

    .screenshots-container::-webkit-scrollbar {
      height: 9px;
    }

    .screenshots-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .screenshots-container::-webkit-scrollbar-thumb {
      background: #adb3bb;
      border: 2px solid white;
      border-radius: 999px;
    }

    /*
      关键：
      不设置固定宽度。
      每张截图按自身比例决定宽度。

      竖屏图会比较窄；
      横屏图会比较宽；
      所有图片都完整显示，不裁切。
    */

    .screenshot-item {
      position: relative;
      flex: 0 0 auto;
      display: block;
      height: 420px;
      overflow: hidden;
      padding: 0;
      background: #eef1f4;
      border: 1px solid var(--border);
      border-radius: 7px;
      scroll-snap-align: start;
      cursor: zoom-in;
    }

    .screenshot-item img {
      display: block;
      width: auto;
      height: 100%;
      max-width: none;
      object-fit: contain;
      background: #eef1f4;
      transition:
        transform 0.2s ease,
        opacity 0.2s ease;
    }

    .screenshot-item:hover img {
      transform: scale(1.012);
      opacity: 0.95;
    }

    .zoom-hint {
      position: absolute;
      right: 10px;
      bottom: 10px;
      padding: 5px 9px;
      color: #fff;
      font-size: 12px;
      line-height: 1;
      background: rgba(0, 0, 0, 0.62);
      border-radius: 999px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }

    .screenshot-item:hover .zoom-hint {
      opacity: 1;
    }

    .empty-state {
      padding: 34px 12px;
      color: #92979d;
      font-size: 14px;
    }

    /* ==============================
       大图预览
    ============================== */

    .lightbox {
      position: fixed;
      z-index: 9999;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 32px 84px;
      background: rgba(11, 13, 16, 0.92);
      backdrop-filter: blur(5px);
    }

    .lightbox.is-open {
      display: flex;
    }

    .lightbox-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      max-height: 100%;
    }

    .lightbox-image {
      display: block;
      max-width: calc(100vw - 180px);
      max-height: calc(100vh - 120px);
      object-fit: contain;
      border-radius: 7px;
      box-shadow: 0 18px 70px rgba(0, 0, 0, 0.5);
    }

    .lightbox-caption {
      margin-top: 14px;
      color: rgba(255, 255, 255, 0.88);
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
    }

    .lightbox-close {
      position: fixed;
      top: 18px;
      right: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 46px;
      height: 46px;
      padding: 0;
      color: #fff;
      font-size: 31px;
      line-height: 1;
      background: rgba(255, 255, 255, 0.12);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .lightbox-arrow {
      position: fixed;
      top: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 64px;
      padding: 0;
      color: #fff;
      font-size: 40px;
      line-height: 1;
      background: rgba(255, 255, 255, 0.1);
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      transform: translateY(-50%);
    }

    .lightbox-arrow:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .lightbox-arrow:disabled {
      visibility: hidden;
    }

    .lightbox-previous {
      left: 18px;
    }

    .lightbox-next {
      right: 18px;
    }

    /* ==============================
       手机适配
    ============================== */

    @media (max-width: 720px) {
      body {
        padding: 12px;
      }

      .page-header h1 {
        font-size: 24px;
      }

      .page-meta {
        font-size: 13px;
      }

      .app-header {
        gap: 10px;
        min-height: 68px;
        padding: 13px 14px;
      }

      .rank {
        min-width: 38px;
        font-size: 22px;
      }

      .app-icon {
        width: 43px;
        height: 43px;
        border-radius: 10px;
      }

      .app-title {
        font-size: 17px;
      }

      .app-meta {
        font-size: 12px;
      }

      .screenshots-container {
        gap: 10px;
        padding: 16px 10px 12px;
      }

      .screenshot-item {
        height: 330px;
      }

      .lightbox {
        padding: 64px 12px 70px;
      }

      .lightbox-image {
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 150px);
      }

      .lightbox-arrow {
        top: auto;
        bottom: 12px;
        width: 52px;
        height: 44px;
        transform: none;
      }

      .lightbox-previous {
        left: calc(50% - 62px);
      }

      .lightbox-next {
        right: calc(50% - 62px);
      }
    }
  </style>
</head>

<body>
  <header class="page-header">
    <h1>🎬 ${escapeHtml(config.title)}</h1>

    <div class="page-meta">
      ${escapeHtml(config.description || "")}
      ｜市场：${escapeHtml(config.language.toUpperCase())}-${escapeHtml(
        config.country.toUpperCase()
      )}
      ｜顺序：自定义竞品顺序
      ｜共 ${apps.length} 个应用
    </div>
  </header>

  <main class="comparison-list">
    ${cardsHtml}
  </main>

  <div
    class="lightbox"
    id="lightbox"
    aria-hidden="true"
  >
    <button
      class="lightbox-close"
      id="lightboxClose"
      type="button"
      aria-label="关闭预览"
    >
      ×
    </button>

    <button
      class="lightbox-arrow lightbox-previous"
      id="lightboxPrevious"
      type="button"
      aria-label="上一张"
    >
      ‹
    </button>

    <div class="lightbox-content">
      <img
        class="lightbox-image"
        id="lightboxImage"
        src=""
        alt=""
      />

      <div
        class="lightbox-caption"
        id="lightboxCaption"
      ></div>
    </div>

    <button
      class="lightbox-arrow lightbox-next"
      id="lightboxNext"
      type="button"
      aria-label="下一张"
    >
      ›
    </button>
  </div>

  <script>
    const lightbox = document.getElementById("lightbox");
    const lightboxImage =
      document.getElementById("lightboxImage");
    const lightboxCaption =
      document.getElementById("lightboxCaption");
    const lightboxClose =
      document.getElementById("lightboxClose");
    const lightboxPrevious =
      document.getElementById("lightboxPrevious");
    const lightboxNext =
      document.getElementById("lightboxNext");

    let activeScreenshots = [];
    let activeImageIndex = 0;
    let activeAppName = "";

    function decodeHtml(value) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = value;
      return textarea.value;
    }

    function updateLightbox() {
      const imageUrl = activeScreenshots[activeImageIndex];

      if (!imageUrl) {
        return;
      }

      lightboxImage.src = imageUrl;
      lightboxImage.alt =
        activeAppName + " 截图 " + (activeImageIndex + 1);

      lightboxCaption.textContent =
        activeAppName +
        " · " +
        (activeImageIndex + 1) +
        " / " +
        activeScreenshots.length;

      lightboxPrevious.disabled =
        activeImageIndex <= 0;

      lightboxNext.disabled =
        activeImageIndex >= activeScreenshots.length - 1;
    }

    function openLightbox(card, index) {
      const encodedScreenshots =
        card.dataset.screenshots || "[]";

      try {
        activeScreenshots = JSON.parse(
          decodeHtml(encodedScreenshots)
        );
      } catch (error) {
        console.error("截图数据解析失败", error);
        activeScreenshots = [];
      }

      activeAppName = card.dataset.appName || "";
      activeImageIndex = index;

      updateLightbox();

      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      lightboxImage.src = "";
      document.body.style.overflow = "";
    }

    function showPreviousImage() {
      if (activeImageIndex > 0) {
        activeImageIndex -= 1;
        updateLightbox();
      }
    }

    function showNextImage() {
      if (
        activeImageIndex <
        activeScreenshots.length - 1
      ) {
        activeImageIndex += 1;
        updateLightbox();
      }
    }

    document
      .querySelectorAll(".screenshot-item")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const card = button.closest(".app-card");
          const index = Number(
            button.dataset.imageIndex || 0
          );

          openLightbox(card, index);
        });
      });

    lightboxClose.addEventListener(
      "click",
      closeLightbox
    );

    lightboxPrevious.addEventListener(
      "click",
      showPreviousImage
    );

    lightboxNext.addEventListener(
      "click",
      showNextImage
    );

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!lightbox.classList.contains("is-open")) {
        return;
      }

      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft") {
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        showNextImage();
      }
    });
  </script>
</body>
</html>`;
}

/* ==============================
   根据配置获取指定竞品
============================== */

async function fetchConfiguredApps(config) {
  if (!Array.isArray(config.apps)) {
    throw new Error(
      "config.json 中没有找到 apps 数组"
    );
  }

  const sortedApps = [...config.apps].sort(
    (a, b) => Number(a.rank) - Number(b.rank)
  );

  const results = [];

  for (let index = 0; index < sortedApps.length; index += 1) {
    const configuredApp = sortedApps[index];

    try {
      const appId = parseAppId(
        configuredApp.url || configuredApp.appId
      );

      console.log(
        `[${index + 1}/${sortedApps.length}] 获取：` +
        `${configuredApp.name || appId}`
      );

      const detail = await gplay.app({
        appId,
        lang: config.language,
        country: config.country
      });

      results.push({
        ...detail,
        customRank: configuredApp.rank,
        configuredName: configuredApp.name || ""
      });

      console.log(
        `获取成功：${detail.title}，` +
        `${detail.screenshots?.length || 0} 张截图`
      );
    } catch (error) {
      console.error(
        `获取失败：${configuredApp.name || "未知应用"}`
      );

      console.error(error.message);
    }
  }

  return results;
}

/* ==============================
   主程序
============================== */

async function main() {
  const config = await readConfig();

  console.log("开始读取指定竞品");

  const apps = await fetchConfiguredApps(config);

  const html = createPage(config, apps);

  await fs.writeFile(
    "./index.html",
    html,
    "utf8"
  );

  await fs.writeFile(
    "./apps-data.json",
    JSON.stringify(apps, null, 2),
    "utf8"
  );

  console.log("");
  console.log("更新完成");
  console.log(`共生成 ${apps.length} 个竞品`);
  console.log("index.html 已更新");
}

main().catch((error) => {
  console.error("程序执行失败：");
  console.error(error);
  process.exit(1);
});
