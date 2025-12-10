// 全域狀態：內容列表
let contents = [];

// 抓 DOM 元素
const listEl = document.getElementById("content-list");      // 卡片列表區
const detailEl = document.getElementById("detail-view");     // 詳情區
const statusEl = document.getElementById("status");          // 狀態文字
const filterContainer = document.getElementById("category-filters"); // 分類按鈕區

// 產生分類按鈕（根據 contents 自動抓出所有 category）
function renderCategoryFilters() {
  if (!filterContainer) return;

  // 從 contents 中找出所有不重複的 category
  const categories = [...new Set(contents.map(item => item.category))];

  // 先放一顆「全部」按鈕
  let html = `<button data-category="all" class="active">全部</button>`;

  // 為每一種 category 產生一顆按鈕
  categories.forEach(cat => {
    html += `<button data-category="${cat}">${cat}</button>`;
  });

  filterContainer.innerHTML = html;
}

// 1️⃣ 渲染卡片列表
function renderList(list) {
  // 顯示列表模式：列表顯示、詳情隱藏
  listEl.classList.remove("hidden");
  detailEl.classList.add("hidden");

  // 清空舊列表
  listEl.innerHTML = "";

  let html = "";
  list.forEach(item => {
    html += `
      <div class="card" data-id="${item.id}">
        <div class="thumbnail">
          縮圖：${item.thumbnail || "（無縮圖）"}
        </div>
        <h3 class="title">${item.title}</h3>
        <p class="meta">
          類別：${item.category} ｜ 
          類型：${item.type === "video" ? "影片" : "文章"} ｜ 
          難度：${item.difficulty || "未設定"}
        </p>
        <p class="short">${item.short || ""}</p>
      </div>
    `;
  });

  listEl.innerHTML = html;

  // 卡片畫好後，綁定點擊事件（查看詳情）
  setupCardClick();
}

// 2️⃣ 綁定卡片點擊事件 → 撈單一詳情
function setupCardClick() {
  const cards = document.querySelectorAll("#content-list .card");

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const id = Number(card.dataset.id);
      if (Number.isNaN(id)) return;

      loadContentById(id); // 用 id 去撈 /api/contents/:id
    });
  });
}

// 3️⃣ 顯示單一內容詳情
function showDetail(item) {
  // 隱藏列表、顯示詳情
  listEl.classList.add("hidden");
  detailEl.classList.remove("hidden");

  let html = "";

  if (item.type === "article") {
    html = `
      <button id="back-btn">← 返回列表</button>
      <h2>${item.title}</h2>
      <p>
        分類：${item.category} ｜ 
        難度：${item.difficulty || "未設定"}
      </p>
      <hr>
      <div class="content-body">
        ${item.content || "（本文內容尚未提供）"}
      </div>
    `;
  } else if (item.type === "video") {
    html = `
      <button id="back-btn">← 返回列表</button>
      <h2>${item.title}</h2>
      <p>
        分類：${item.category} ｜ 
        難度：${item.difficulty || "未設定"}
      </p>
      <hr>
      <div class="video-area" style="padding:12px; background:#eee; margin-bottom:8px;">
        這裡未來可以放真正的影片播放器<br>
        目前先顯示影片連結：<br>
        <small>${item.videoUrl || "（尚未提供影片網址）"}</small>
      </div>
      <div class="content-body">
        ${item.description || ""}
      </div>
    `;
  } else {
    html = `
      <button id="back-btn">← 返回列表</button>
      <p>未知的內容類型。</p>
    `;
  }

  detailEl.innerHTML = html;

  const backBtn = document.getElementById("back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      detailEl.classList.add("hidden");
      listEl.classList.remove("hidden");
    });
  }
}

// 4️⃣ 依分類過濾的工具函式
function filterByCategory(list, categoryName) {
  return list.filter(item => item.category === categoryName);
}

// 5️⃣ 綁定分類篩選按鈕
function setupFilterButtons() {
  if (!filterContainer) return;

  const buttons = filterContainer.querySelectorAll("button");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // 切換 active 樣式
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.category; // all / 膝蓋 / 肩部 / ...

      if (!category || category === "all") {
        renderList(contents);
      } else {
        const filtered = filterByCategory(contents, category);
        renderList(filtered);
      }

      // 切回列表模式
      detailEl.classList.add("hidden");
      listEl.classList.remove("hidden");
    });
  });
}

// 6️⃣ 從後端 API 撈「列表」資料
async function loadContents() {
  try {
    if (statusEl) statusEl.textContent = "載入中...";
    listEl.innerHTML = "";
    detailEl.classList.add("hidden");

    const res = await fetch("/api/contents");

    if (!res.ok) {
      throw new Error("載入列表失敗：" + res.status);
    }

    const data = await res.json();
    contents = data;

    if (!Array.isArray(contents) || contents.length === 0) {
      if (statusEl) statusEl.textContent = "目前沒有任何內容。";
      return;
    }

    if (statusEl) statusEl.textContent = "";

    // 先根據 contents 產生分類按鈕，再綁定事件，再畫列表
    renderCategoryFilters();
    setupFilterButtons();
    renderList(contents);
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "載入內容列表失敗，請稍後再試。";
  }
}

// 7️⃣ 從後端 API 撈「單一內容」
async function loadContentById(id) {
  try {
    if (statusEl) statusEl.textContent = "載入詳情中...";

    const res = await fetch(`/api/contents/${id}`);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("找不到這則內容。");
      } else {
        throw new Error("載入詳情失敗：" + res.status);
      }
    }

    const item = await res.json();
    if (statusEl) statusEl.textContent = "";

    showDetail(item);
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = err.message || "載入詳情發生錯誤。";
  }
}

// 8️⃣ 初始化：一進頁面先撈列表
loadContents();
