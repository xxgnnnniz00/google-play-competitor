/* 顶部整体 */
body {
  margin: 0;
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

/* 顶部标题区域 */
.page-header {
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

/* App 列表之间的距离 */
.comparison-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 每个 App 顶部栏 */
.app-header {
  display: flex;
  align-items: center;

  gap: 8px;

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
  width: 30px;
  height: 30px;

  flex: 0 0 auto;

  border-radius: 7px;
  object-fit: cover;
}

.app-title {
  margin: 0;

  font-size: 15px;
  line-height: 1.2;
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

/* 截图区和标题栏之间也缩一点 */
.screenshots-container {
  display: flex;
  align-items: center;

  gap: 8px;

  overflow-x: auto;
  overflow-y: hidden;

  padding: 7px 10px 8px;

  scroll-behavior: smooth;

  scrollbar-width: thin;
  scrollbar-color: #b5bac1 transparent;
}
