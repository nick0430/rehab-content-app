// =======================
// DOM 元素參考
// =======================
const listEl = document.getElementById("content-list");      // 卡片列表區
const detailEl = document.getElementById("detail-view");  // 詳情區
const statusEl = document.getElementById("status");          // 狀態訊息區（例如：載入中 / 錯誤）
const filterContainer = document.getElementById("category-filters"); // 分類按鈕區

// =======================
// 全域狀態
// =======================

// 從後端 API 拿回來的所有內容
let contents = [];

// 目前使用者選擇的「篩選條件」
let currentCategory = "all"; // "all" / "膝蓋" / "肩部" / ...
let currentKeyword = "";     // 搜尋關鍵字（標題用）

// =======================
// 工具函式：從資料裡取出分類
// =======================
function getCategoriesFromContents(list) {
  const set = new Set();
  list.forEach(item => {
    if (item.category) {
      set.add(item.category);
    }
  });
  return Array.from(set);
}

// =======================
// 畫出分類按鈕
// =======================
function renderCategoryFilters() {
  if (!filterContainer) return;
  const categories = getCategoriesFromContents(contents);

  let html = `<button data-category="all" class="active">全部</button>`;
  categories.forEach(cat => {
    html += `<button data-category="${cat}">${cat}</button>`;
  });

  filterContainer.innerHTML = html;
}

// =======================
// 綁定分類按鈕事件
// =======================
function setupFilterButtons() {
  if (!filterContainer) return;

  const buttons = filterContainer.querySelectorAll("button");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // 切換按鈕樣式
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // 更新目前分類狀態
      const category = btn.dataset.category;
      currentCategory = !category || category === "all" ? "all" : category;

      // 確保顯示列表畫面
      detailEl.classList.add("hidden");
      listEl.classList.remove("hidden");

      // 根據最新條件重新篩選
      applyFilters();
    });
  });
}

// =======================
// 綁定搜尋輸入框事件
// =======================
function setupSearch() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    // 更新目前搜尋字
    currentKeyword = searchInput.value;

    // 確保顯示列表畫面
    detailEl.classList.add("hidden");
    listEl.classList.remove("hidden");

    // 根據最新條件重新篩選
    applyFilters();
  });
}

// =======================
// 依目前狀態（分類＋關鍵字）篩選，再畫列表
// =======================
function applyFilters() {
  if (!Array.isArray(contents)) {
    renderList([]);
    return;
  }

  const keyword = currentKeyword.trim().toLowerCase();

  const filtered = contents.filter(item => {
    // 類別條件
    const matchCategory =
      currentCategory === "all" || item.category === currentCategory;

    // 關鍵字條件（套在 title 上）
    const titleText = (item.title || "").toLowerCase();
    const matchKeyword =
      keyword === "" || titleText.includes(keyword);

    return matchCategory && matchKeyword;
  });

  renderList(filtered);
}

// =======================
// 畫出卡片列表（安全版）
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

  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id; // 之後拿來載入單一內容

    // 標題
    const titleEl = document.createElement("h3");
    titleEl.className = "title";
    titleEl.textContent = item.title || "（未命名內容）";

    // 類別＋型態
    const metaEl = document.createElement("p");
    metaEl.className = "meta";
    const typeLabel = item.type === "video" ? "影片" : "文章";
    metaEl.textContent = `${item.category || "未分類"} ｜ ${typeLabel}`;

    // 簡短摘要
    const shortEl = document.createElement("p");
    shortEl.className = "short";
    shortEl.textContent = item.short || "";

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(shortEl);

    fragment.appendChild(card);
  });

  listEl.appendChild(fragment);

  // 綁定卡片點擊
  setupCardClick();
}

// =======================
// 綁定卡片點擊事件（載入詳情）
// =======================
function setupCardClick() {
  const cards = listEl.querySelectorAll(".card");

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const id = Number(card.dataset.id);
      if (Number.isNaN(id)) return;

      loadContentById(id);
    });
  });
}

// =======================
// 從後端載入單一內容
// =======================
async function loadContentById(id) {
  try {
    statusEl.textContent = "載入內容中...";

    const res = await fetch(`/api/contents/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        statusEl.textContent = "找不到這則內容。";
      } else {
        statusEl.textContent = `載入內容失敗（${res.status}）`;
      }
      return;
    }

    const item = await res.json();
    statusEl.textContent = "";
    showDetail(item);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "載入內容時發生錯誤，請稍後再試。";
  }
}

// =======================
// 顯示單一內容詳情（折衷安全版）
// =======================
function showDetail(item) {
  // 切換畫面
  listEl.classList.add("hidden");
  detailEl.classList.remove("hidden");

  // 先決定基本結構（架子）
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
        <label>
          標題：
          <input id="edit-title" type="text">
        </label>
        <br>
        <label>
          內文：
          <textarea id="edit-content" rows="6"></textarea>
        </label>
        <br>
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

  // 返回按鈕
  const backBtn = document.getElementById("back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      detailEl.classList.add("hidden");
      listEl.classList.remove("hidden");
    });
  }

  const titleEl = detailEl.querySelector(".detail-title");
  const metaEl = detailEl.querySelector(".detail-meta");
  const contentBody = detailEl.querySelector(".content-body");

  // =========================
  // 文章類型 article
  // =========================
  if (item.type === "article") {
    // 顯示區
    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) metaEl.textContent = `分類：${item.category}`;
    if (contentBody) {
      // ⭐ 用 textContent，而不是 innerHTML（避免 XSS）
      contentBody.textContent = item.content || "（尚未提供內容）";
    }

    // 編輯區
    const titleInput = document.getElementById("edit-title");
    const contentInput = document.getElementById("edit-content");
    const saveBtn = document.getElementById("save-btn");

    if (titleInput) titleInput.value = item.title;
    if (contentInput) contentInput.value = item.content || "";

    if (saveBtn && titleInput && contentInput) {
      saveBtn.addEventListener("click", async () => {
        const newTitle = titleInput.value.trim();
        const newContent = contentInput.value.trim();

        if (!newTitle) {
          alert("標題不可空白");
          return;
        }

        try {
          statusEl.textContent = "儲存中...";

          const res = await fetch(`/api/contents/${item.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: newTitle,
              content: newContent,
            }),
          });

          if (!res.ok) {
            throw new Error("儲存失敗：" + res.status);
          }

          const updated = await res.json();
          statusEl.textContent = "已儲存。";

          // 更新前端陣列
          const idx = contents.findIndex(c => c.id === updated.id);
          if (idx !== -1) {
            contents[idx] = updated;
          }

          // 重新顯示更新後的詳情
          showDetail(updated);
        } catch (err) {
          console.error(err);
          statusEl.textContent = "儲存失敗，請稍後再試。";
          alert("儲存失敗：" + (err.message || ""));
        }
      });
    }

  // =========================
  // 影片類型 video
  // =========================
  } else if (item.type === "video") {
    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
      metaEl.textContent = `分類：${item.category} ｜ 難度：${
        item.difficulty || "未設定"
      }`;
    }
    if (contentBody) {
      contentBody.textContent = item.description || "";
    }

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
// 初次載入列表：從後端撈資料
// =======================
async function loadContents() {
  try {
    statusEl.textContent = "載入中...";

    const res = await fetch("/api/contents");
    if (!res.ok) {
      statusEl.textContent = `載入列表失敗（${res.status}）`;
      return;
    }

    const data = await res.json();
    contents = Array.isArray(data) ? data : [];
    statusEl.textContent = "";

    // 建立分類按鈕、綁定事件
    renderCategoryFilters();
    setupFilterButtons();
    setupSearch();

    // 依預設條件（全部＋沒有關鍵字）先畫一次列表
    applyFilters();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "載入內容失敗，請稍後再試。";
  }
}

// 直接呼叫載入（假設 script 放在 body 最後）
loadContents();
