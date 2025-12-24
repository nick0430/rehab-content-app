// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");

// Prisma v7 + SQLite adapter
const { PrismaClient } = require("./prisma/generated/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// 建立 SQLite adapter：url 來自 .env 的 DATABASE_URL
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

// 建立 Prisma Client
const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 3000;

// -----------------------
// ✅ CORS（手寫版：穩定允許 Capacitor WebView）
// -----------------------
const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // 只對白名單 origin 回應 Access-Control-Allow-Origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// -----------------------
// Middleware
// -----------------------
app.use(express.json());

// API 不要快取（可留可不留）
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// 靜態檔（Web）
app.use(express.static(path.join(__dirname, "public")));

// -----------------------
// ✅ 確認部署用：GET /api/ping
// -----------------------
app.get("/api/ping", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
  });
});

// -----------------------
// GET /api/contents
// 列表：支援 category / type / q（標題）
// 支援 offset / cursor 分頁
// -----------------------
app.get("/api/contents", async (req, res) => {
  const category = String(req.query.category || "all");
  const type = String(req.query.type || "all");
  const q = String(req.query.q || "").trim();

  const mode = String(req.query.mode || "offset"); // "offset" | "cursor"

  const limitNum = Number(req.query.limit || 10);
  const limit =
    Number.isFinite(limitNum) && limitNum >= 1 ? Math.min(50, Math.floor(limitNum)) : 10;

  const sort = String(req.query.sort || "createdAt");
  const order = String(req.query.order || "desc").toLowerCase();

  const allowedSort = new Set(["id", "createdAt", "title", "category", "difficulty"]);
  const sortField = allowedSort.has(sort) ? sort : "createdAt";
  const sortOrder = order === "asc" ? "asc" : "desc";

  // ✅ 穩定排序（tie-breaker：id 同方向）
  const orderBy =
    sortField === "id"
      ? { id: sortOrder }
      : [{ [sortField]: sortOrder }, { id: sortOrder }];

  // ✅ where（篩選）
  const baseWhere = {};
  if (category !== "all") baseWhere.category = category;
  if (type !== "all") baseWhere.type = type;
  if (q !== "") baseWhere.title = { contains: q };

  try {
    const total = await prisma.content.count({ where: baseWhere });

    // ---------------------------
    // Cursor Pagination（游標分頁）
    // ---------------------------
    if (mode === "cursor") {
      const cursorIdRaw = req.query.cursorId;
      const cursorCreatedAtRaw = req.query.cursorCreatedAt;

      let where = baseWhere;

      // 只有在 cursor 真的存在時才加條件（第一頁沒有 cursor）
      if (cursorIdRaw !== undefined && cursorCreatedAtRaw !== undefined) {
        const cursorId = Number(cursorIdRaw);
        const cursorCreatedAt = new Date(String(cursorCreatedAtRaw));

        if (Number.isNaN(cursorId) || Number.isNaN(cursorCreatedAt.getTime())) {
          return res.status(400).json({ message: "cursorId 或 cursorCreatedAt 格式錯誤" });
        }

        const isAsc = sortOrder === "asc";

        // createdAt cursor：下一頁取更舊（desc）或更新（asc）
        const cursorWhere = {
          OR: [
            { createdAt: isAsc ? { gt: cursorCreatedAt } : { lt: cursorCreatedAt } },
            {
              AND: [
                { createdAt: cursorCreatedAt },
                { id: isAsc ? { gt: cursorId } : { lt: cursorId } },
              ],
            },
          ],
        };

        where = { AND: [baseWhere, cursorWhere] };
      }

      // ✅ 多拿 1 筆判斷 hasNext
      const rowsPlusOne = await prisma.content.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          category: true,
          thumbnail: true,
          short: true,
          createdAt: true,
          difficulty: true,
        },
        orderBy,
        take: limit + 1,
      });

      const hasNext = rowsPlusOne.length > limit;
      const rows = hasNext ? rowsPlusOne.slice(0, limit) : rowsPlusOne;

      const last = rows.length ? rows[rows.length - 1] : null;
      const nextCursor = hasNext && last ? { id: last.id, createdAt: last.createdAt } : null;

      return res.json({
        mode: "cursor",
        limit,
        total,
        rows,
        hasNext,
        nextCursor,
      });
    }

    // ---------------------------
    // Offset Pagination（原本 page/limit）
    // ---------------------------
    const pageNum = Number(req.query.page || 1);
    const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
    const skip = (page - 1) * limit;

    const rows = await prisma.content.findMany({
      where: baseWhere,
      select: {
        id: true,
        type: true,
        title: true,
        category: true,
        thumbnail: true,
        short: true,
        createdAt: true,
        difficulty: true,
      },
      orderBy,
      skip,
      take: limit,
    });

    res.json({ mode: "offset", page, limit, total, rows });
  } catch (err) {
    console.error("GET /api/contents failed:", err);
    res.status(500).json({ message: "資料庫查詢失敗" });
  }
});

// -----------------------
// GET /api/categories
// -----------------------
app.get("/api/categories", async (req, res) => {
  try {
    const rows = await prisma.content.findMany({
      select: { category: true },
      distinct: ["category"],
    });

    const categories = rows
      .map((r) => r.category)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "zh-Hant"));

    res.json(categories);
  } catch (err) {
    console.error("GET /api/categories failed:", err);
    res.status(500).json({ message: "取得分類失敗" });
  }
});

// -----------------------
// GET /api/contents/:id
// -----------------------
app.get("/api/contents/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "ID 必須是數字" });
  }

  try {
    const item = await prisma.content.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({ message: "NOT FOUND" });
    }

    res.json(item);
  } catch (err) {
    console.error("GET /api/contents/:id failed:", err);
    res.status(500).json({ message: "資料庫查詢失敗" });
  }
});

// -----------------------
// PUT /api/contents/:id
// -----------------------
app.put("/api/contents/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "ID 必須是數字" });
  }

  const body = req.body || {};
  const title = body.title;
  const content = body.content;

  if (title !== undefined && String(title).trim() === "") {
    return res.status(400).json({ message: "標題不可空白" });
  }

  try {
    const oldItem = await prisma.content.findUnique({ where: { id } });
    if (!oldItem) {
      return res.status(404).json({ message: "NOT FOUND" });
    }

    if (oldItem.type !== "article") {
      return res.status(400).json({ message: "只有文章可編輯" });
    }

    const data = {};
    if (title !== undefined) data.title = String(title);
    if (content !== undefined) data.content = String(content);

    const updated = await prisma.content.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/contents/:id failed:", err);
    res.status(500).json({ message: "資料庫更新失敗" });
  }
});

// -----------------------
// 啟動伺服器
// -----------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// （可選）關閉時斷開 DB
process.on("SIGINT", async () => {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
});
