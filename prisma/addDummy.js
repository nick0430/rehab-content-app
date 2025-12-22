// prisma/addDummy.js
require("dotenv").config();

const { PrismaClient } = require("./generated/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = ["膝蓋", "肩部", "腰部", "腳踝", "全身"];
  const difficulties = ["簡單", "中等", "困難"];

  const items = [];

  for (let i = 1; i <= 20; i++) {
    const category = categories[i % categories.length];
    const difficulty = difficulties[i % difficulties.length];

    const isVideo = i % 3 === 0; // 每 3 筆做 1 筆影片
    const day = String(i).padStart(2, "0");
    const createdAt = new Date(`2025-02-${day}`);

    if (isVideo) {
      items.push({
        type: "video",
        title: `${category} 測試影片 ${i}`,
        category,
        thumbnail: `/images/dummy-${i}.jpg`,
        short: `這是用來測試分頁的影片資料（第 ${i} 筆）。`,
        createdAt,
        difficulty,
        videoUrl: `https://example.com/dummy-video-${i}`,
        description: `影片描述：這是測試資料（第 ${i} 筆）。`,
      });
    } else {
      items.push({
        type: "article",
        title: `${category} 測試文章 ${i}`,
        category,
        thumbnail: `/images/dummy-${i}.jpg`,
        short: `這是用來測試分頁的文章資料（第 ${i} 筆）。`,
        createdAt,
        difficulty,
        content: `文章內容：這是測試資料（第 ${i} 筆）。`,
      });
    }
  }

  await prisma.content.createMany({ data: items });

  const count = await prisma.content.count();
  console.log("Added dummy rows =", items.length);
  console.log("Total Content rows =", count);
}

main()
  .catch((err) => {
    console.error("Add dummy failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
