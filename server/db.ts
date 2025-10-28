import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// FIX: Cast `process` to `any` to resolve TypeScript error about missing `cwd` property.
const dataDir = path.join((process as any).cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'laquila.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
// FIX: Cast `process` to `any` to resolve TypeScript error about missing `cwd` property.
const schemaPath = path.join((process as any).cwd(), 'server', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

console.log('Database connected and schema initialized.');
