// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

// Prisma v7 + SQLite adapter（你目前的 Prisma Client 是 engine type "client"，必須用 adapter）
const { PrismaClient } = require("./prisma/generated/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// ✅ CORS：允許 iOS App (capacitor://localhost) 以及本機開發
const corsOptions = {
  origin: (origin, cb) => {
    // 沒有 origin（例如 curl / server-to-server）先放行
    if (!origin) return cb(null, true);

    const allowlist = new Set([
      "capacitor://localhost",
      "ionic://localhost",
      "http://localhost",
      "http://localhost:3000",
    ]);

    if (allowlist.has(origin)) return cb(null, true);
    return cb(new Error("CORS blocked: " + origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// 建立 SQLite adapter：url 來自 .env 的 DATABASE_URL
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

// 建立 Prisma Client（之後用 prisma.content.findMany / update 等）
const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 3000;

// -----------------------
// Middleware
// -----------------------
// ✅ CORS 必須放在路由前，且 PUT 會有 preflight(OPTIONS)
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// 解析 JSON body（PUT / POST 會用到）
app.use(express.json());

// 讓 public 裡的靜態檔案可被瀏覽器讀取（/、/styles.css、/app.js）
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

// （可選）簡單 log：看請求有沒有進來
// app.use((req, res, next) => {
//   console.log(req.method, req.url);
//   next();
// });

// -----------------------
// GET /api/contents
// 列表：支援 query 篩選 category / type / q（標題）
// -----------------------
app.get("/api/contents", async (req, res) => {
  const category = String(req.query.category || "all");
  const type = String(req.query.type || "all");
  const q = String(req.query.q || "").trim();

  // ✅ 分頁模式：offset（原本） or cursor（新）
  const mode = String(req.query.mode || "offset"); // "offset" | "cursor"

  // ✅ limit（兩種模式都用得到）
  const limitNum = Number(req.query.limit || 10);
  const limit =
    Number.isFinite(limitNum) && limitNum >= 1 ? Math.min(50, Math.floor(limitNum)) : 10;

  // ✅ 排序參數（預設：createdAt desc）
  const sort = String(req.query.sort || "createdAt");
  const order = String(req.query.order || "desc").toLowerCase();

  // ✅ 白名單
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
    // total 仍然回（方便前端顯示總筆數/總頁數）
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

        // ✅ DESC（最新在前）：下一頁要更舊
        // createdAt < cursorCreatedAt OR (createdAt == cursorCreatedAt AND id < cursorId)
        // ✅ ASC（最舊在前）：下一頁要更新
        // createdAt > cursorCreatedAt OR (createdAt == cursorCreatedAt AND id > cursorId)
        const isAsc = sortOrder === "asc";

        // 我們主要用 createdAt 做 cursor（最符合你目前的排序）
        // 若 sortField 不是 createdAt，就仍用 createdAt 的 cursor 規則（你目前 UI 主要是 createdAt）
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

      // ✅ 多拿 1 筆，用來判斷 hasNext（經典技巧）
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
// 單一詳情：回完整一筆（文章含 content、影片含 videoUrl/description）
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
// 更新文章：只允許更新 article 的 title / content
// -----------------------
app.put("/api/contents/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "ID 必須是數字" });
  }

  // 防呆：避免 req.body 是 undefined/null
  const body = req.body || {};
  const title = body.title;
  const content = body.content;

  // 你前端規則：標題不可空白
  if (title !== undefined && String(title).trim() === "") {
    return res.status(400).json({ message: "標題不可空白" });
  }

  try {
    const oldItem = await prisma.content.findUnique({ where: { id } });
    if (!oldItem) {
      return res.status(404).json({ message: "NOT FOUND" });
    }

    // 只允許文章被更新（你前端只有 article 才能編輯）
    if (oldItem.type !== "article") {
      return res.status(400).json({ message: "只有文章可編輯" });
    }

    // data 只放「有提供」的欄位（避免把 undefined 寫進 DB）
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
