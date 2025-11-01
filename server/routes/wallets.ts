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

const Q = (id: string) => `"${id.replace(/"/g, '""')}"`;

// ---------- Table & column detection ----------
function detectTable(): string {
  const r = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wallets','wallet','finance_wallets') LIMIT 1"
    )
    .get() as { name?: string } | undefined;
  return r?.name ?? "wallets";
}
const TABLE = detectTable();

type ColInfo = { name: string; pk: number; type?: string | null };
type ColsMap = {
  idKey?: string;
  nameKey?: string;
  numberKey?: string;
  balanceKey?: string;
  createdKey?: string;
};

function detectCols(): ColsMap {
  const infos = db.prepare(`PRAGMA table_info(${Q(TABLE)})`).all() as ColInfo[];
  const names = new Set(infos.map((c) => c.name));
  const has = (n: string) => names.has(n);
  const pick = (...cands: string[]) => cands.find(has);

  const idKey =
    infos.find((c) => c.pk === 1)?.name ?? pick("id", "wallet_id", "uuid");

  const nameKey = pick(
    "name",
    "nama",
    "wallet_name",
    "nama_wallet",
    "walletName",
    "label",
    "title"
  );
  const numberKey = pick(
    "number",
    "nomor",
    "account_number",
    "accountNo",
    "no_rek",
    "norek",
    "rekening"
  );
  const balanceKey = pick(
    "balance",
    "saldo",
    "amount",
    "initial_balance",
    "starting_balance"
  );
  const createdKey = pick(
    "createdAt",
    "created_at",
    "created",
    "date",
    "tanggal",
    "tgl",
    "created_on"
  );

  return { idKey, nameKey, numberKey, balanceKey, createdKey };
}

let C: ColsMap = detectCols();

// ---------- Row mapper ----------
function mapRow(raw: any) {
  const id = raw?.[C.idKey ?? "id"] ?? raw?.rowid ?? raw?._rid_;
  return {
    id: String(id ?? ""),
    name: C.nameKey ? String(raw?.[C.nameKey] ?? "") : "",
    number: C.numberKey ? String(raw?.[C.numberKey] ?? "") : "",
    balance: Number(C.balanceKey ? raw?.[C.balanceKey] ?? 0 : 0),
    ...(C.createdKey ? { createdAt: raw?.[C.createdKey] } : {}),
  };
}

// ---------- Routes ----------
export default async function walletsRoutes(app: FastifyInstance) {
  // GET /
  app.get("/", async (_req, reply) => {
    try {
      C = detectCols(); // refresh mapping
      const orderBy = C.createdKey ? Q(C.createdKey) : "rowid";
      const rows = db
        .prepare(
          `SELECT rowid AS _rid_, * FROM ${Q(TABLE)} ORDER BY ${orderBy} DESC`
        )
        .all();
      reply.send(rows.map(mapRow));
    } catch (e: any) {
      reply.code(500).send({ error: e?.message || "Failed to load wallets" });
    }
  });

  // POST /
  app.post("/", async (req, reply) => {
    try {
      C = detectCols();
      const body = WalletCreate.parse(req.body);

      const cols: string[] = [];
      const vals: any[] = [];
      if (C.nameKey) {
        cols.push(C.nameKey);
        vals.push(body.name);
      }
      if (C.numberKey) {
        cols.push(C.numberKey);
        vals.push(body.number ?? "");
      }
      if (C.balanceKey) {
        cols.push(C.balanceKey);
        vals.push(Number(body.balance) || 0);
      }

      // Fallback kalau tabel kosong & mapping belum ketemu kolom text
      if (!cols.length) {
        const infos = db
          .prepare(`PRAGMA table_info(${Q(TABLE)})`)
          .all() as ColInfo[];
        const fallback = infos.find(
          (c) =>
            c.pk !== 1 &&
            ((c.type ?? "").toUpperCase().includes("CHAR") ||
              (c.type ?? "").toUpperCase().includes("TEXT"))
        );
        if (fallback) {
          cols.push(fallback.name);
          vals.push(body.name);
        }
      }

      if (!cols.length) {
        return reply
          .code(500)
          .send({ error: "Wallet table has no writable columns." });
      }

      db.prepare(
        `INSERT INTO ${Q(TABLE)} (${cols.map(Q).join(", ")}) VALUES (${cols
          .map(() => "?")
          .join(", ")})`
      ).run(...vals);

      const row = db
        .prepare(
          `SELECT rowid AS _rid_, * FROM ${Q(TABLE)} WHERE rowid = last_insert_rowid()`
        )
        .get();
      reply.send(mapRow(row));
    } catch (err: any) {
      reply
        .code(500)
        .send({ error: err?.message || "Failed to create wallet" });
    }
  });

  // PUT /:id
  app.put("/:id", async (req, reply) => {
    try {
      C = detectCols();
      const { id } = req.params as { id: string };
      const body = WalletUpdate.parse(req.body);

      const set: string[] = [];
      const vals: any[] = [];
      if (body.name !== undefined && C.nameKey) {
        set.push(`${Q(C.nameKey)} = ?`);
        vals.push(body.name);
      }
      if (body.number !== undefined && C.numberKey) {
        set.push(`${Q(C.numberKey)} = ?`);
        vals.push(body.number ?? "");
      }
      if (body.balance !== undefined && C.balanceKey) {
        set.push(`${Q(C.balanceKey)} = ?`);
        vals.push(Number(body.balance) || 0);
      }
      if (!set.length) return reply.code(400).send({ error: "No fields to update" });

      const idNum = Number(id);
      const where = C.idKey ? `(${Q(C.idKey)} = ? OR rowid = ?)` : `rowid = ?`;

      if (C.idKey)
        db.prepare(`UPDATE ${Q(TABLE)} SET ${set.join(", ")} WHERE ${where}`)
          .run(...vals, id, isNaN(idNum) ? -1 : idNum);
      else
        db.prepare(`UPDATE ${Q(TABLE)} SET ${set.join(", ")} WHERE ${where}`)
          .run(...vals, isNaN(idNum) ? -1 : idNum);

      const row = C.idKey
        ? db
            .prepare(
              `SELECT rowid AS _rid_, * FROM ${Q(TABLE)} WHERE (${Q(
                C.idKey
              )} = ? OR rowid = ?) LIMIT 1`
            )
            .get(id, isNaN(idNum) ? -1 : idNum)
        : db
            .prepare(
              `SELECT rowid AS _rid_, * FROM ${Q(TABLE)} WHERE rowid = ? LIMIT 1`
            )
            .get(isNaN(idNum) ? -1 : idNum);

      reply.send(mapRow(row));
    } catch (err: any) {
      reply
        .code(500)
        .send({ error: err?.message || "Failed to update wallet" });
    }
  });

  // DELETE /:id
  app.delete("/:id", async (req, reply) => {
    try {
      C = detectCols();
      const { id } = req.params as { id: string };
      const idNum = Number(id);
      const where = C.idKey ? `(${Q(C.idKey)} = ? OR rowid = ?)` : `rowid = ?`;

      if (C.idKey)
        db.prepare(`DELETE FROM ${Q(TABLE)} WHERE ${where}`).run(
          id,
          isNaN(idNum) ? -1 : idNum
        );
      else
        db.prepare(`DELETE FROM ${Q(TABLE)} WHERE ${where}`).run(
          isNaN(idNum) ? -1 : idNum
        );

      reply.code(204).send();
    } catch (err: any) {
      reply
        .code(500)
        .send({ error: err?.message || "Failed to delete wallet" });
    }
  });
}
