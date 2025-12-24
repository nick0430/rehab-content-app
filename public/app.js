// public/app.js

// =======================
// 環境判斷：Web vs iOS/Android（Capacitor）
// =======================
const IS_NATIVE =
  window.location.protocol === "capacitor:" ||
  window.location.protocol === "ionic:";

// ⚠️ 不要在結尾加 /
// iOS/Android → 走 Render
// Web（同源） → 走相對路徑 /api/xxx
const API_BASE = IS_NATIVE ? "https://rehab-content-app.onrender.com" : "";

// 把 "/api/xxx" 轉成正確完整 URL
function apiUrl(path) {
  // 允許你直接丟完整 https://... 也能用
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

// 共用 fetch：自動處理錯誤訊息
async function fetchJson(path, options = {}) {
  const url = apiUrl(path);
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

// =======================
// DOM 元素參考
// =======================
const listEl = document.getElementById("content-list");
const detailEl = document.getElementById("detail-view");
const statusEl = document.getElementById("status");
const filterContainer = document.getElementById("category-filters");

const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");
const pageInfoEl = document.getElementById("page-info");

// =======================
// 全域狀態
// =======================
let contents = [];
let currentCategory = "all";
let currentKeyword = "";

let currentPage = 1;
let pageSize = 5;
let total = 0;

let currentSort = "createdAt";
let currentOrder = "desc";

const USE_CURSOR = true;

// cursor 分頁狀態
let cursorStack = [null];
let cursorIndex = 0;
let nextCursor = null;
let hasNext = false;

function resetPaging() {
  if (USE_CURSOR) {
    cursorStack = [null];
    cursorIndex = 0;
    nextCursor = null;
    hasNext = false;
  } else {
    currentPage = 1;
  }
}

// =======================
// 分類 UI
// =======================
function renderCategoryFilters(categories) {
  if (!filterContainer) return;

  let html = `<button data-category="all" class="active">全部</button>`;
  categories.forEach((cat) => {
    html += `<button data-category="${cat}">${cat}</button>`;
  });
  filterContainer.innerHTML = html;
}

function setupFilterButtons() {
  if (!filterContainer) return;

  const buttons = filterContainer.querySelectorAll("button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.category;
      currentCategory = !category || category === "all" ? "all" : category;

      resetPaging();

      detailEl.classList.add("hidden");
      listEl.classList.remove("hidden");

      fetchListFromServer();
    });
  });
}

// =======================
// 搜尋
// =======================
function setupSearch() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    currentKeyword = searchInput.value;

    resetPaging();

    detailEl.classList.add("hidden");
    listEl.classList.remove("hidden");

    fetchListFromServer();
  });
}

// =======================
// 排序
// =======================
function setupSort() {
  const el = document.getElementById("sort-select");
  if (!el) return;

  el.addEventListener("change", () => {
    const [s, o] = el.value.split("_");
    currentSort = s;
    currentOrder = o;

    resetPaging();
    fetchListFromServer();
  });
}

// =======================
// 分頁 UI
// =======================
function updatePager() {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (pageInfoEl) {
    const pageText = USE_CURSOR ? cursorIndex + 1 : currentPage;
    pageInfoEl.textContent = `第 ${pageText} / ${totalPages} 頁（共 ${total} 筆）`;
  }

  if (prevBtn) prevBtn.disabled = USE_CURSOR ? cursorIndex <= 0 : currentPage <= 1;
  if (nextBtn) nextBtn.disabled = USE_CURSOR ? !hasNext : currentPage >= totalPages;
}

function setupPager() {
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (USE_CURSOR) {
        if (cursorIndex > 0) {
          cursorIndex -= 1;
          fetchListFromServer();
        }
      } else {
        if (currentPage > 1) {
          currentPage -= 1;
          fetchListFromServer();
        }
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (USE_CURSOR) {
        if (hasNext && nextCursor) {
          cursorStack = cursorStack.slice(0, cursorIndex + 1);
          cursorStack.push(nextCursor);
          cursorIndex += 1;
          fetchListFromServer();
        }
      } else {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage < totalPages) {
          currentPage += 1;
          fetchListFromServer();
        }
      }
    });
  }
}

// =======================
// 從後端抓列表（分頁）
// =======================
async function fetchListFromServer() {
  try {
    statusEl.textContent = "載入中...";

    const params = new URLSearchParams();

    if (currentCategory !== "all") params.set("category", currentCategory);

    const keyword = currentKeyword.trim();
    if (keyword !== "") params.set("q", keyword);

    params.set("limit", String(pageSize));
    params.set("sort", currentSort);
    params.set("order", currentOrder);

    if (USE_CURSOR) {
      params.set("mode", "cursor");

      const cursorUsed = cursorStack[cursorIndex];
      if (cursorUsed) {
        params.set("cursorId", String(cursorUsed.id));
        params.set("cursorCreatedAt", String(cursorUsed.createdAt));
      }
    } else {
      params.set("mode", "offset");
      params.set("page", String(currentPage));
    }

    const data = await fetchJson(`/api/contents?${params.toString()}`);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    contents = rows;
    total = Number.isFinite(data?.total) ? data.total : rows.length;

    hasNext = Boolean(data?.hasNext);
    nextCursor = data?.nextCursor || null;

    statusEl.textContent = "";
    renderList(contents);
    updatePager();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "載入內容失敗，請稍後再試。";
  }
}

// =======================
// 畫列表
// =======================
function renderList(list) {
  listEl.innerHTML = "";

  if (!list || list.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "目前沒有符合條件的內容。";
    listEl.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;

    const titleEl = document.createElement("h3");
    titleEl.className = "title";
    titleEl.textContent = item.title || "（未命名內容）";

    const metaEl = document.createElement("p");
    metaEl.className = "meta";
    const typeLabel = item.type === "video" ? "影片" : "文章";
    metaEl.textContent = `${item.category || "未分類"} ｜ ${typeLabel}`;

    const shortEl = document.createElement("p");
    shortEl.className = "short";
    shortEl.textContent = item.short || "";

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(shortEl);

    fragment.appendChild(card);
  });

  listEl.appendChild(fragment);
  setupCardClick();
}

function setupCardClick() {
  const cards = listEl.querySelectorAll(".card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.dataset.id);
      if (!Number.isNaN(id)) loadContentById(id);
    });
  });
}

// =======================
// 讀單筆
// =======================
async function loadContentById(id) {
  try {
    statusEl.textContent = "載入內容中...";

    const item = await fetchJson(`/api/contents/${id}`);
    statusEl.textContent = "";
    showDetail(item);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "載入內容時發生錯誤，請稍後再試。";
  }
}

// =======================
// 詳情
// =======================
function showDetail(item) {
  listEl.classList.add("hidden");
  detailEl.classList.remove("hidden");

  if (item.type === "article") {
    detailEl.innerHTML = `
      <button id="back-btn">← 返回列表</button>
      <h2 class="detail-title"></h2>
      <p class="detail-meta"></p>
      <hr>
      <div class="content-body"></div>

      <hr>
      <h3>編輯這篇內容</h3>
      <div class="edit-form">
        <label>標題：<input id="edit-title" type="text"></label><br>
        <label>內文：<textarea id="edit-content" rows="6"></textarea></label><br>
        <button id="save-btn">儲存修改</button>
      </div>
    `;
  } else if (item.type === "video") {
    detailEl.innerHTML = `
      <button id="back-btn">← 返回列表</button>
      <h2 class="detail-title"></h2>
      <p class="detail-meta"></p>
      <hr>
      <div class="video-area" style="padding:12px; background:#eee; margin-bottom:8px;">
        <div class="video-line1"></div>
        <div class="video-line2"></div>
        <small class="video-link"></small>
      </div>
      <div class="content-body"></div>
    `;
  } else {
    detailEl.innerHTML = `
      <button id="back-btn">← 返回列表</button>
      <p>未知的內容類型。</p>
    `;
  }

  const backBtn = document.getElementById("back-btn");
  backBtn?.addEventListener("click", () => {
    detailEl.classList.add("hidden");
    listEl.classList.remove("hidden");
  });

  const titleEl = detailEl.querySelector(".detail-title");
  const metaEl = detailEl.querySelector(".detail-meta");
  const contentBody = detailEl.querySelector(".content-body");

  if (item.type === "article") {
    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) metaEl.textContent = `分類：${item.category}`;
    if (contentBody) contentBody.textContent = item.content || "（尚未提供內容）";

    const titleInput = document.getElementById("edit-title");
    const contentInput = document.getElementById("edit-content");
    const saveBtn = document.getElementById("save-btn");

    if (titleInput) titleInput.value = item.title || "";
    if (contentInput) contentInput.value = item.content || "";

    saveBtn?.addEventListener("click", async () => {
      const newTitle = titleInput.value.trim();
      const newContent = contentInput.value.trim();

      if (!newTitle) return alert("標題不可空白");

      try {
        statusEl.textContent = "儲存中...";

        const updated = await fetchJson(`/api/contents/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, content: newContent }),
        });

        statusEl.textContent = "已儲存。";
        await fetchListFromServer();
        showDetail(updated);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "儲存失敗，請稍後再試。";
        alert("儲存失敗：" + (err.message || ""));
      }
    });
  } else if (item.type === "video") {
    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) metaEl.textContent = `分類：${item.category} ｜ 難度：${item.difficulty || "未設定"}`;
    if (contentBody) contentBody.textContent = item.description || "";

    const videoLine1 = detailEl.querySelector(".video-line1");
    const videoLine2 = detailEl.querySelector(".video-line2");
    const videoLink = detailEl.querySelector(".video-link");

    if (videoLine1) videoLine1.textContent = "這裡未來可以放真正的影片播放器";
    if (videoLine2) videoLine2.textContent = "目前先顯示影片連結：";

    if (videoLink) {
      if (item.videoUrl) {
        const a = document.createElement("a");
        a.href = item.videoUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = item.videoUrl;
        videoLink.appendChild(a);
      } else {
        videoLink.textContent = "（尚未提供影片網址）";
      }
    }
  }
}

// =======================
// 初次載入：先抓分類、再抓列表
// =======================
async function loadCategoriesAndFirstPage() {
  try {
    const categories = await fetchJson("/api/categories");
    renderCategoryFilters(Array.isArray(categories) ? categories : []);
    setupFilterButtons();
  } catch (err) {
    console.error(err);
  }

  setupSearch();
  setupPager();
  setupSort();
  fetchListFromServer();
}

loadCategoriesAndFirstPage();
