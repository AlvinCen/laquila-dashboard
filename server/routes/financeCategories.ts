import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "../db";

const CatCreate = z.object({
  name: z.string().min(1),
  type: z.enum(["income", "expense"]),
});
const CatUpdate = CatCreate.partial();

const tableRow = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('finance_categories','financeCategories','financeCategory') LIMIT 1"
  )
  .get() as { name?: string } | undefined;
const TABLE = tableRow?.name ?? "finance_categories";

type ColInfo = { name: string; pk: number };
const colInfos = db.prepare(`PRAGMA table_info('${TABLE}')`).all() as ColInfo[];

const has = (n: string) => colInfos.some(c => c.name === n);
const NAME   = has("name")  ? "name"  : (has("nama") ? "nama" : "name");
const TYPE   = has("type")  ? "type"  : (has("jenis") ? "jenis" : (has("tipe") ? "tipe" : "type"));
const CREATED= has("createdAt") ? "createdAt" : (has("created_at") ? "created_at" : null);

// deteksi kolom PK/id kalau ada; kalau tidak ada atau nilainya NULL, fallback ke rowid
const PKCOL = colInfos.find(c => c.pk === 1)?.name || (has("id") ? "id" : null);
// ekspresi select id yang selalu terisi
const SELECT_ID = PKCOL ? `COALESCE("${PKCOL}", rowid) AS id` : `rowid AS id`;
const q = (c: string) => `"${c}"`;

export default async function financeCategoriesRoutes(app: FastifyInstance) {
  // GET /
  app.get("/", async (_req, reply) => {
    const cols = [SELECT_ID, `${q(NAME)} AS name`, `${q(TYPE)} AS type`];
    if (CREATED) cols.push(`${q(CREATED)} AS createdAt`);
    const rows = db.prepare(`SELECT ${cols.join(", ")} FROM ${q(TABLE)} ORDER BY ${CREATED ? q(CREATED) : "rowid"} DESC`).all();
    reply.send(rows);
  });

  // POST /
  app.post("/", async (req, reply) => {
    const { name, type } = CatCreate.parse(req.body);
    // tidak menyentuh kolom id; biarkan DB mengisi PK/rowid
    db.prepare(`INSERT INTO ${q(TABLE)} (${q(NAME)}, ${q(TYPE)}) VALUES (?, ?)`).run(name, type);

    const cols = [SELECT_ID, `${q(NAME)} AS name`, `${q(TYPE)} AS type`];
    if (CREATED) cols.push(`${q(CREATED)} AS createdAt`);
    // row terbaru via rowid
    const row = db.prepare(`SELECT ${cols.join(", ")} FROM ${q(TABLE)} WHERE rowid = last_insert_rowid()`).get();
    reply.send(row);
  });

  // PUT /:id  → bisa pakai id TEXT atau rowid number
  app.put("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CatUpdate.parse(req.body);

    const set: string[] = [];
    const vals: any[] = [];
    if (body.name !== undefined) { set.push(`${q(NAME)} = ?`); vals.push(body.name); }
    if (body.type !== undefined) { set.push(`${q(TYPE)} = ?`); vals.push(body.type); }
    if (!set.length) return reply.code(400).send({ error: "No fields to update" });

    // where: cocokkan ke kolom PK/id ATAU rowid
    const where = PKCOL ? `(${q(PKCOL)} = ? OR rowid = ?)` : `rowid = ?`;
    const idNum = Number(id); // NaN kalau bukan angka
    if (PKCOL) db.prepare(`UPDATE ${q(TABLE)} SET ${set.join(", ")} WHERE ${where}`).run(...vals, id, isNaN(idNum) ? -1 : idNum);
    else       db.prepare(`UPDATE ${q(TABLE)} SET ${set.join(", ")} WHERE ${where}`).run(...vals, isNaN(idNum) ? -1 : idNum);

    const cols = [SELECT_ID, `${q(NAME)} AS name`, `${q(TYPE)} AS type`];
    if (CREATED) cols.push(`${q(CREATED)} AS createdAt`);
    const selWhere = PKCOL ? `(${q(PKCOL)} = ? OR rowid = ?)` : `rowid = ?`;
    const row = PKCOL
      ? db.prepare(`SELECT ${cols.join(", ")} FROM ${q(TABLE)} WHERE ${selWhere} LIMIT 1`).get(id, isNaN(idNum) ? -1 : idNum)
      : db.prepare(`SELECT ${cols.join(", ")} FROM ${q(TABLE)} WHERE ${selWhere} LIMIT 1`).get(isNaN(idNum) ? -1 : idNum);
    reply.send(row);
  });

  // DELETE /:id  → dukung id atau rowid
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const idNum = Number(id);
    const where = PKCOL ? `(${q(PKCOL)} = ? OR rowid = ?)` : `rowid = ?`;
    if (PKCOL) db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(id, isNaN(idNum) ? -1 : idNum);
    else       db.prepare(`DELETE FROM ${q(TABLE)} WHERE ${where}`).run(isNaN(idNum) ? -1 : idNum);
    reply.code(204).send();
  });
}
