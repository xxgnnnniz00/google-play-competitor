import gplay from "google-play-scraper";
import fs from "node:fs/promises";

/* =========================
   读取配置
========================= */

async function readConfig() {
  const text = await fs.readFile("./config.json", "utf8");
  return JSON.parse(text);
}

/* =========================
   工具函数
========================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeImageUrl(url = "") {
  const value = String(url).trim();

  if (!value) {
    return "";
  }

  if (value.includes("=")) {
    return value;
  }

  return `${value}=w1800`;
}

/* =========================
   单个 App HTML
========================= */

function createAppHtml(app, rank) {
  const screenshots = Array.isArray(app.screenshots)
    ? app.screenshots.map(normalizeImageUrl).filter(Boolean)
    : [];

  const screenshotButtons = screenshots.length
    ? screenshots
        .map(
          (url, index) => `
          <button
            class="screenshot-item"
            type="button"
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
          </button>
        `
        )
        .join("")
    : `
        <div class="empty">
          没有获取到截图
        </div>
      `;

  return `
    <section
      class="app-card"
      data-app-name="${escapeHtml(app.title)}"
      data-screenshots='${escapeHtml(JSON.stringify(screenshots))}'
    >
      <div class="app-header">

        <div class="rank">
          #${rank}
        </div>

        ${
          app.icon
            ? `
              <img
                class="app-icon"
                src="${escapeHtml(app.icon)}"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            `
            : ""
        }

        <div class="app-info">

          <h2 class="app-title">
            <a
              href="${escapeHtml(app.url || "")}"
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

            <span>${screenshots.length} 张截图</span>

          </div>

        </div>

      </div>

      <div class="screenshots-container">
        ${screenshotButtons}
      </div>

    </section>
  `;
}

/* =========================
   生成页面
========================= */

function createPage(config, apps) {
  const appCards = apps
    .map((app, index) => createAppHtml(app, index + 1))
    .join("");

  const generatedTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${escapeHtml(config.title)}</title>

<style>

:root {
  --page-bg: #f5f6f8;
  --card-bg: #ffffff;
  --text-main: #202124;
  --text-sub: #666b72;
  --border: #e0e3e7;
  --blue: #1a73e8;
}

/* =========================
   全局
========================= */

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;

  /*
    原来 18px 20px 32px
    现在压缩顶部空间
  */
  padding: 10px 16px 24px;

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

/* =========================
   顶部
========================= */

.page-header {

  /*
    原来：
    margin-bottom: 16px;
    padding-bottom: 13px;

    现在明显压缩
  */

  margin-bottom: 8px;
  padding-bottom: 7px;

  border-bottom: 1px solid var(--border);
}

.page-header h1 {
  margin: 0 0 3px;

  font-size: 24px;
  line-height: 1.2;
}

.page-meta {
  color: var(--text-sub);

  font-size: 12px;
  line-height: 1.35;
}

/* =========================
   App 列表
========================= */

.comparison-list {
  display: flex;
  flex-direction: column;

  /*
    原来 12px
    改成 8px
  */
  gap: 8px;
}

.app-card {
  overflow: hidden;

  background: var(--card-bg);

  border: 1px solid var(--border);
  border-radius: 8px;

  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.035);
}

/* =========================
   App 标题区
========================= */

.app-header {
  display: flex;
  align-items: center;

  /*
    原来 gap 10px
  */
  gap: 8px;

  /*
    原来：
    min-height: 54px;
    padding: 8px 12px;

    现在压缩
  */

  min-height: 42px;
  padding: 4px 10px;

  border-bottom: 1px solid var(--border);
}

.rank {
  flex: 0 0 auto;

  min-width: 34px;

  color: var(--blue);

  font-size: 19px;
  line-height: 1;
  font-weight: 800;
}

.app-icon {

  /*
    原来 36px
    改成 30px
  */

  width: 30px;
  height: 30px;

  flex: 0 0 auto;

  border-radius: 7px;

  object-fit: cover;
}

.app-info {
  min-width: 0;
}

.app-title {
  margin: 0;

  font-size: 15px;
  line-height: 1.2;
}

.app-title a {
  color: var(--text-main);
  text-decoration: none;
}

.app-title a:hover {
  color: var(--blue);
  text-decoration: underline;
}

.app-meta {
  display: flex;
  flex-wrap: wrap;

  gap: 1px 9px;

  margin-top: 1px;

  color: var(--text-sub);

  font-size: 10px;
  line-height: 1.25;
}

/* =========================
   截图区
========================= */

.screenshots-container {
  display: flex;
  align-items: center;

  gap: 8px;

  overflow-x: auto;
  overflow-y: hidden;

  /*
    原来 10px 10px 9px
    现在压缩截图和标题栏之间的空隙
  */

  padding: 7px 10px 8px;

  scroll-behavior: smooth;

  scrollbar-width: thin;
  scrollbar-color: #b5bac1 transparent;
}

.screenshots-container::-webkit-scrollbar {
  height: 6px;
}

.screenshots-container::-webkit-scrollbar-thumb {
  background: #b5bac1;
  border-radius: 999px;
}

/*
  截图尺寸不动
  继续保持 310px
*/

.screenshot-item {
  position: relative;

  display: block;

  flex: 0 0 auto;

  height: 310px;

  overflow: hidden;

  padding: 0;

  background: #eef0f2;

  border: 1px solid var(--border);
  border-radius: 5px;

  cursor: zoom-in;
}

.screenshot-item img {
  display: block;

  width: auto;
  height: 100%;

  max-width: none;

  object-fit: contain;

  background: #eef0f2;

  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}

.screenshot-item:hover img {
  transform: scale(1.012);
  opacity: 0.96;
}

.empty {
  padding: 28px;
  color: #999;
  font-size: 12px;
}

/* =========================
   图片放大
========================= */

.lightbox {
  position: fixed;

  z-index: 9999;

  inset: 0;

  display: none;

  align-items: center;
  justify-content: center;

  padding: 26px 76px;

  background: rgba(8, 10, 13, 0.93);

  backdrop-filter: blur(5px);

  cursor: zoom-out;
}

.lightbox.open {
  display: flex;
}

.lightbox-main {
  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  max-width: 100%;
  max-height: 100%;
}

.lightbox-image {
  display: block;

  max-width: calc(100vw - 170px);
  max-height: calc(100vh - 90px);

  object-fit: contain;

  border-radius: 6px;

  box-shadow:
    0 18px 70px rgba(0, 0, 0, 0.5);

  cursor: zoom-out;
}

.lightbox-caption {
  margin-top: 9px;

  color: rgba(255, 255, 255, 0.82);

  font-size: 13px;

  text-align: center;
}

/* =========================
   左右箭头
========================= */

.lightbox-arrow {
  position: fixed;

  top: 50%;

  display: flex;
  align-items: center;
  justify-content: center;

  width: 44px;
  height: 60px;

  padding: 0;

  color: white;

  font-size: 35px;

  border: 0;

  border-radius: 8px;

  background:
    rgba(255, 255, 255, 0.10);

  cursor: pointer;

  transform: translateY(-50%);
}

.lightbox-arrow:hover {
  background:
    rgba(255, 255, 255, 0.20);
}

.lightbox-arrow:disabled {
  opacity: 0.2;
  cursor: default;
}

.previous {
  left: 15px;
}

.next {
  right: 15px;
}

/* =========================
   关闭按钮
========================= */

.close {
  position: fixed;

  top: 14px;
  right: 16px;

  width: 40px;
  height: 40px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  color: white;

  font-size: 27px;

  border: 0;
  border-radius: 50%;

  background:
    rgba(255, 255, 255, 0.12);

  cursor: pointer;
}

/* =========================
   手机适配
========================= */

@media (max-width: 720px) {

  body {
    padding: 8px;
  }

  .page-header h1 {
    font-size: 20px;
  }

  .app-header {
    padding: 4px 7px;
  }

  .rank {
    min-width: 30px;
    font-size: 17px;
  }

  .app-icon {
    width: 28px;
    height: 28px;
  }

  .app-title {
    font-size: 14px;
  }

  .screenshot-item {
    height: 215px;
  }

  .screenshots-container {
    padding: 6px;
    gap: 6px;
  }

  .lightbox {
    padding: 55px 10px;
  }

  .lightbox-image {
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 130px);
  }

}

</style>

</head>

<body>

<header class="page-header">

  <h1>
    🎬 ${escapeHtml(config.title)}
  </h1>

  <div class="page-meta">

    市场：
    ${escapeHtml(config.language.toUpperCase())}-${escapeHtml(
      config.country.toUpperCase()
    )}

    ｜搜索词：
    “${escapeHtml(config.keyword)}”

    ｜展示：
    Google Play 搜索前 ${apps.length} 名

    ｜最后更新：
    ${escapeHtml(generatedTime)}

  </div>

</header>

<main class="comparison-list">

${appCards}

</main>

<!-- =========================
     放大查看
========================= -->

<div
  class="lightbox"
  id="lightbox"
>

  <button
    class="close"
    id="close"
    type="button"
  >
    ×
  </button>

  <button
    class="lightbox-arrow previous"
    id="previous"
    type="button"
  >
    ‹
  </button>

  <div class="lightbox-main">

    <img
      class="lightbox-image"
      id="lightboxImage"
      src=""
      alt=""
    >

    <div
      class="lightbox-caption"
      id="lightboxCaption"
    ></div>

  </div>

  <button
    class="lightbox-arrow next"
    id="next"
    type="button"
  >
    ›
  </button>

</div>

<script>

/* =========================
   Lightbox 状态
========================= */

const lightbox =
  document.getElementById("lightbox");

const lightboxImage =
  document.getElementById("lightboxImage");

const lightboxCaption =
  document.getElementById("lightboxCaption");

const previousButton =
  document.getElementById("previous");

const nextButton =
  document.getElementById("next");

const closeButton =
  document.getElementById("close");

let activeImages = [];
let activeIndex = 0;
let activeAppName = "";

/* =========================
   HTML entity 解码
========================= */

function decodeHtml(value) {
  const textarea =
    document.createElement("textarea");

  textarea.innerHTML = value;

  return textarea.value;
}

/* =========================
   更新放大图片
========================= */

function updateLightbox() {
  if (!activeImages.length) {
    return;
  }

  lightboxImage.src =
    activeImages[activeIndex];

  lightboxImage.alt =
    activeAppName +
    " 截图 " +
    (activeIndex + 1);

  lightboxCaption.textContent =
    activeAppName +
    " · " +
    (activeIndex + 1) +
    " / " +
    activeImages.length;

  previousButton.disabled =
    activeIndex === 0;

  nextButton.disabled =
    activeIndex === activeImages.length - 1;
}

/* =========================
   打开放大
========================= */

function openLightbox(card, index) {
  try {
    activeImages =
      JSON.parse(
        decodeHtml(
          card.dataset.screenshots || "[]"
        )
      );
  } catch (error) {
    console.error(
      "截图数据解析失败",
      error
    );

    activeImages = [];
  }

  activeAppName =
    card.dataset.appName || "";

  activeIndex = index;

  updateLightbox();

  lightbox.classList.add("open");

  document.body.style.overflow =
    "hidden";
}

/* =========================
   关闭放大
========================= */

function closeLightbox() {
  lightbox.classList.remove("open");

  lightboxImage.src = "";

  document.body.style.overflow =
    "";
}

/* =========================
   上一张
========================= */

function previousImage() {
  if (activeIndex > 0) {
    activeIndex -= 1;
    updateLightbox();
  }
}

/* =========================
   下一张
========================= */

function nextImage() {
  if (
    activeIndex <
    activeImages.length - 1
  ) {
    activeIndex += 1;
    updateLightbox();
  }
}

/* =========================
   点击普通截图 → 放大
========================= */

document
  .querySelectorAll(".screenshot-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const card =
          button.closest(".app-card");

        const index =
          Number(
            button.dataset.imageIndex || 0
          );

        openLightbox(
          card,
          index
        );
      }
    );

  });

/* =========================
   再次点击大图 → 关闭
========================= */

lightboxImage.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    closeLightbox();

  }
);

/* =========================
   点击黑色背景 → 关闭
========================= */

lightbox.addEventListener(
  "click",
  event => {

    if (event.target === lightbox) {
      closeLightbox();
    }

  }
);

/* =========================
   X 关闭
========================= */

closeButton.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    closeLightbox();

  }
);

/* =========================
   左右按钮
========================= */

previousButton.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    previousImage();

  }
);

nextButton.addEventListener(
  "click",
  event => {

    event.stopPropagation();

    nextImage();

  }
);

/* =========================
   键盘控制
========================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      !lightbox.classList.contains("open")
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      previousImage();
    }

    if (event.key === "ArrowRight") {
      nextImage();
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

  }
);

</script>

</body>

</html>`;
}

/* =========================
   搜索 Google Play 前 N 名
========================= */

async function fetchTopApps(config) {
  console.log(
    "开始搜索：",
    config.keyword
  );

  const searchResults =
    await gplay.search({
      term: config.keyword,
      num: config.appCount,
      lang: config.language,
      country: config.country,
      fullDetail: false
    });

  const topResults =
    searchResults.slice(
      0,
      config.appCount
    );

  const apps = [];

  for (
    let index = 0;
    index < topResults.length;
    index += 1
  ) {

    const result =
      topResults[index];

    console.log(
      `[${index + 1}/${topResults.length}] ` +
      result.title
    );

    try {
      const detail =
        await gplay.app({
          appId: result.appId,
          lang: config.language,
          country: config.country
        });

      apps.push(detail);

      console.log(
        "成功：",
        detail.title,
        detail.screenshots?.length || 0,
        "张截图"
      );

    } catch (error) {

      console.error(
        "读取失败：",
        result.title,
        error.message
      );

      apps.push({
        ...result,
        title:
          result.title ||
          result.appId,
        screenshots: []
      });

    }

  }

  return apps;
}

/* =========================
   主程序
========================= */

async function main() {
  const config =
    await readConfig();

  const apps =
    await fetchTopApps(config);

  const html =
    createPage(
      config,
      apps
    );

  await fs.writeFile(
    "./index.html",
    html,
    "utf8"
  );

  await fs.writeFile(
    "./apps-data.json",
    JSON.stringify(
      apps,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log("更新完成");
  console.log(
    `当前页面共 ${apps.length} 个应用`
  );
}

main().catch(error => {
  console.error(
    "程序执行失败："
  );

  console.error(error);

  process.exit(1);
});
