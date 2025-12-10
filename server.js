const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// 假資料：內容列表（暫時當作小小資料庫）
const contents = [
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
      <p>這是一篇示範文章，用來說明膝蓋伸展的基本概念。</p>
      <p>你可以在這裡放真正的 rehab 教學內容、步驟、注意事項。</p>
    `
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
      <p>這是一支示範影片，用來放鬆肩頸。</p>
      <p>未來可以嵌入 YouTube 或自己的播放器。</p>
    `
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
      <p>這是一篇介紹腰部核心啟動的示範文章。</p>
    `
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
      <p>透過這支影片帶你做腳踝活動度訓練。</p>
    `
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
      <p>這是一篇全身暖身的示範文章。</p>
    `
  }
];

// 讓 public 資料夾裡的檔案可以被瀏覽器存取
app.use(express.static(path.join(__dirname, "public")));

/**
 * GET /api/contents
 * 列表：只回傳「列表需要的欄位」
 */
app.get("/api/contents", (req, res) => {
  const listForClient = contents.map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    category: item.category,
    thumbnail: item.thumbnail,
    short: item.short,
    createdAt: item.createdAt,
    difficulty: item.difficulty
    // 不在這裡回傳 content / videoUrl / description
  }));

  res.json(listForClient);
});

/**
 * GET /api/contents/:id
 * 詳情：回傳「單一完整內容」
 */
app.get("/api/contents/:id", (req, res) => {
  const id = Number(req.params.id);       // "/api/contents/2" -> "2" -> 2
  const item = contents.find(c => c.id === id);

  if (!item) {
    return res.status(404).json({ message: "NOT FOUND" });
  }

  res.json(item);
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
