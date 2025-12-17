// server.js
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// -----------------------
// 假資料：當作小型資料庫
// -----------------------
let contents = [
  {
    id: 1,
    type: "article",
    title: "膝蓋伸展教學",
    category: "膝蓋",
    thumbnail: "/images/knee-1.jpg",
    short: "溫和伸展緊繃的膝蓋，適合久坐族與初學者。",
    createdAt: "2025-01-01",
    difficulty: "簡單",
    content: `
      這是一篇示範文章，用來說明膝蓋伸展的基本概念。
      你可以在這裡放真正的 rehab 教學內容、步驟、注意事項。
    `,
  },
  {
    id: 2,
    type: "video",
    title: "肩頸舒緩 5 分鐘影片",
    category: "肩部",
    thumbnail: "/images/shoulder-1.jpg",
    short: "上班族必備的肩頸放鬆動作，五分鐘快速完成。",
    createdAt: "2025-01-05",
    difficulty: "簡單",
    videoUrl: "https://example.com/shoulder-video-1",
    description: `
      這是一支示範影片，用來放鬆肩頸。
      未來可以嵌入 YouTube 或自己的播放器。
    `,
  },
  {
    id: 3,
    type: "article",
    title: "腰部核心啟動",
    category: "腰部",
    thumbnail: "/images/lowback-1.jpg",
    short: "透過簡單動作啟動核心，減少腰部負擔。",
    createdAt: "2025-01-10",
    difficulty: "中等",
    content: `
      這是一篇介紹腰部核心啟動的示範文章。
    `,
  },
  {
    id: 4,
    type: "video",
    title: "腳踝活動度提升影片",
    category: "腳踝",
    thumbnail: "/images/ankle-1.jpg",
    short: "改善腳踝僵硬、提升走路與運動穩定度。",
    createdAt: "2025-01-15",
    difficulty: "簡單",
    videoUrl: "https://example.com/ankle-video-1",
    description: `
      透過這支影片帶你做腳踝活動度訓練。
    `,
  },
  {
    id: 5,
    type: "article",
    title: "全身暖身伸展",
    category: "全身",
    thumbnail: "/images/fullbody-1.jpg",
    short: "運動前 10 分鐘全身暖身動作。",
    createdAt: "2025-01-20",
    difficulty: "簡單",
    content: `
      這是一篇全身暖身的示範文章。
    `,
  },
];

// -----------------------
// Middleware
// -----------------------

// 可以解析 JSON body (給 PUT / 之後可能的 POST 用)
app.use(express.json());

// 讓 public 資料夾裡的檔案可以被瀏覽器存取
app.use(express.static(path.join(__dirname, "public")));

// -----------------------
// GET /api/contents
// 列表：回傳摘要欄位
// -----------------------
app.get("/api/contents", (req, res) => {
  const category = (req.query.category || "all").toString();
  const q = (req.query.q || "").toString().trim().toLowerCase();
  const type = (req.query.type || "all").toString();

  const filtered = contents.filter((item) => {
    const matchCategory = category === "all" || item.category === category;
    const matchType = type === "all" || item.type === type;

    const titleText = (item.title || "").toLowerCase();
    const matchQ = q === "" || titleText.includes(q);

    return matchCategory && matchType && matchQ;
  });

  const listForClient = filtered.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    category: item.category,
    thumbnail: item.thumbnail,
    short: item.short,
    createdAt: item.createdAt,
    difficulty: item.difficulty,
  }));

  res.json(listForClient);
});

// -----------------------
// GET /api/contents/:id
// 單一詳情
// -----------------------
app.get("/api/contents/:id", (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "ID 必須是數字" });
  }

  const item = contents.find((c) => c.id === id);

  if (!item) {
    return res.status(404).json({ message: "NOT FOUND" });
  }
  console.log("GET detail id =", req.params.id);

  res.json(item);
});

// -----------------------
// PUT /api/contents/:id
// 更新：用在前端詳情編輯後儲存
// -----------------------
app.put("/api/contents/:id", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "ID 必須是數字" });
  }

  const index = contents.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "NOT FOUND" });
  }

  const oldItem = contents[index];

  // 可以支援多一點欄位（先以 title / content 為主，之後你可以自己加）
  const { title, content } = req.body;

  const updatedItem = {
    ...oldItem,
    ...(title !== undefined ? { title } : {}),
    ...(content !== undefined ? { content } : {}),
  };

  contents[index] = updatedItem;

  res.json(updatedItem);
});

// -----------------------
// 啟動伺服器
// -----------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
