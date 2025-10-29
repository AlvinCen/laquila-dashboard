// server/routes/wallets.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";

const WalletCreate = z.object({
  name: z.string().min(1),
  number: z.string().optional().default(""),
  balance: z.number().optional().default(0),
});
const WalletUpdate = WalletCreate.partial();

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// --- 1) Deteksi nama tabel yang ada ---
function detectTable(): string {
  const r = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wallets','wallet','finance_wallets') LIMIT 1"
    )
    .get() as { name?: string } | undefined;
  return r?.name ?? "wallets";
}

const TABLE = detectTable();

// --- 2) Deteksi kolom yang ada dari data nyata (SELECT * LIMIT 1) ---
type Cols = { idKey?: string; nameKey?: string; numberKey?: string; balanceKey?: string; createdKey?: string };

function detectCols(): Cols {
  try {
    const one = db.prepare(`SELECT rowid as _rid_, * FROM ${q(TABLE)} LIMIT 1`).get() as any;
    const keys = one ? Object.keys(one) : [];

    const pick = (...cands: string[]) => cands.find(k => keys.includes(k));

    const nameKey   = pick("name", "nama", "wallet_name", "nama_wallet");
    const numberKey = pick("number", "nomor", "account_number", "no_rek", "norek");
    const balanceKey= pick("balance", "saldo");
    const createdKey= pick("createdAt", "created_at", "created");

    // id kolom yang mungkin ada
    const idKey = pick("id", "wallet_id", "uuid");

    return { idKey, nameKey, numberKey, balanceKey, createdKey };
  } catch {
    // fallback konservatif kalau tabel masih kosong: asumsi umum
    return { idKey: "id", nameKey: "name", numberKey: "number", balanceKey: "balance", createdKey: "createdAt" };
  }
}

let C = detectCols();

// --- 3) Helper mapping row mentah -> shape API ---
function mapRow(raw: any) {
  const id = raw?.[C.idKey ?? "id"] ?? raw?._rid_ ?? raw?.rowid;
  return {
    id: String(id ?? ""),
    name: raw?.[C.nameKey ?? "name"] ?? "",
    number: String(raw?.[C.numberKey ?? "number"] ?? ""),
    balance: Number(raw?.[C.balanceKey ?? "balance"] ?? 0),
    ...(C.createdKey ? { createdAt: raw?.[C.createdKey] } : {}),
  };
}

export default async function walletsRoutes(app: FastifyInstance) {
  // GET /
  app.get("/", async (_req, reply) => {
    try {
      // refresh deteksi kolom (kalau skema berubah setelah insert pertama)
      C = detectCols();

      const orderBy = C.createdKey ? q(C.createdKey) : "_rid_";
      const rowsRaw = db
        .prepare(`SELECT rowid as _rid_, * FROM ${q(TABLE)} ORDER BY ${orderBy} DESC`)
        .all();

      reply.send(rowsRaw.map(mapRow));
    } catch (e: any) {
      reply.code(500).send({ error: e?.message || "Failed to load wallets" });
    }
  });

  // POST /
  app.post("/", async (req, reply) => {
    const body = WalletCreate.parse(req.body);

    // siapkan kolom yang benar-benar ada
    const cols: string[] = [];
    const vals: any[] = [];

    if (C.nameKey)   { cols.push(C.nameKey);   vals.push(body.name); }
    if (C.numberKey) { cols.push(C.numberKey); vals.push(body.number ?? ""); }
    if (C.balanceKey){ cols.push(C.balanceKey);vals.push(Number(body.balance) || 0); }

    if (!cols.length) return reply.code(500).send({ error: "Wallet table has no writable columns." });

    const placeholders = cols.map(() => "?").join(", ");
    db.prepare(`INSERT INTO ${q(TABLE)} (${cols.map(q).join(", ")}) VALUES (${placeholders})`).run(...vals);

    const row = db.prepare(`SELECT rowid as _rid_, * FROM ${q(TABLE)} WHERE rowid = last_insert_rowid()`).get();
    // update deteksi kolom jika sebelumnya tabel kosong
    C = detectCols();
    reply.send(mapRow(row));
  });

  // PUT /:id  (terima PK id atau rowid)
  app.put("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = WalletUpdate.parse(req.body);

    const set: string[] = [];
    const vals: any[] = [];

    if (body.name !== undefined && C.nameKey)   { set.push(`${q(C.nameKey)} = ?`);   vals.push(body.name); }
    if (body.number !== undefined && C.numberKey){ set.push(`${q(C.numberKey)} = ?`); vals.push(body.number ?? ""); }
    if (body.balance !== undefined && C.balanceKey){ set.push(`${q(C.balanceKey)} = ?`); vals.push(Number(body.balance) || 0); }

    if (!set.length) return reply.code(400).send({ error: "No fields to update" });

    const idNum = Number(id);
    const where = C.idKey ? `(${q(C.idKey)} = ? OR rowid = ?)` : `rowid = ?`;
    if (C.idKey)
      db.prepare(`UPDATE ${q(TABLE)} SET ${set.join(", ")} WHERE ${where}`).run(...vals, id, isNaN(idNum) ? -1 : idNum);
    else
      db.prepare(`UPDATE ${q(TABLE)} SET ${set.join(", ")} WHERE ${where}`).run(...vals, isNaN(idNum) ? -1 : idNum);

    const row = C.idKey
      ? db.prepare(`SELECT rowid as _rid_, * FROM ${q(TABLE)} WHERE (${q(C.idKey)} = ? OR rowid = ?) LIMIT 1`).get(id, isNaN(idNum) ? -1 : idNum)
      : db.prepare(`SELECT rowid as _rid_, * FROM ${q(TABLE)} WHERE rowid = ? LIMIT 1`).get(isNaN(idNum) ? -1 : idNum);

    reply.send(mapRow(row));
  });

  // DELETE /:id  (terima PK id atau rowid)
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const idNum = Number(id);
    const where = C.idKey ? `(${q(C.idKey)} = ? OR rowid = ?)` : `rowid = ?`;
    if (C.idKey)
      db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(id, isNaN(idNum) ? -1 : idNum);
    else
      db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(isNaN(idNum) ? -1 : idNum);

    reply.code(204).send();
  });
}
