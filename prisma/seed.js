// prisma/seed.js
require("dotenv").config();

const { PrismaClient } = require("./generated/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // 清空避免重複
  await prisma.content.deleteMany({});

  // 塞入 5 筆
  await prisma.content.createMany({
    data: [
      {
        type: "article",
        title: "膝蓋伸展教學",
        category: "膝蓋",
        thumbnail: "/images/knee-1.jpg",
        short: "溫和伸展緊繃的膝蓋，適合久坐族與初學者。",
        createdAt: new Date("2025-01-01"),
        difficulty: "簡單",
        content: `
這是一篇示範文章，用來說明膝蓋伸展的基本概念。
你可以在這裡放真正的 rehab 教學內容、步驟、注意事項。
        `.trim(),
      },
      {
        type: "video",
        title: "肩頸舒緩 5 分鐘影片",
        category: "肩部",
        thumbnail: "/images/shoulder-1.jpg",
        short: "上班族必備的肩頸放鬆動作，五分鐘快速完成。",
        createdAt: new Date("2025-01-05"),
        difficulty: "簡單",
        videoUrl: "https://example.com/shoulder-video-1",
        description: `
這是一支示範影片，用來放鬆肩頸。
未來可以嵌入 YouTube 或自己的播放器。
        `.trim(),
      },
      {
        type: "article",
        title: "腰部核心啟動",
        category: "腰部",
        thumbnail: "/images/lowback-1.jpg",
        short: "透過簡單動作啟動核心，減少腰部負擔。",
        createdAt: new Date("2025-01-10"),
        difficulty: "中等",
        content: `這是一篇介紹腰部核心啟動的示範文章。`.trim(),
      },
      {
        type: "video",
        title: "腳踝活動度提升影片",
        category: "腳踝",
        thumbnail: "/images/ankle-1.jpg",
        short: "改善腳踝僵硬、提升走路與運動穩定度。",
        createdAt: new Date("2025-01-15"),
        difficulty: "簡單",
        videoUrl: "https://example.com/ankle-video-1",
        description: `透過這支影片帶你做腳踝活動度訓練。`.trim(),
      },
      {
        type: "article",
        title: "全身暖身伸展",
        category: "全身",
        thumbnail: "/images/fullbody-1.jpg",
        short: "運動前 10 分鐘全身暖身動作。",
        createdAt: new Date("2025-01-20"),
        difficulty: "簡單",
        content: `這是一篇全身暖身的示範文章。`.trim(),
      },
    ],
  });

  const count = await prisma.content.count();
  console.log("Seed done. Content rows =", count);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
