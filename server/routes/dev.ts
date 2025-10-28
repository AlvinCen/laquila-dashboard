import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export default async function devRoutes(server: FastifyInstance) {

  const runScript = async (scriptName: string, reply: any) => {
    try {
      server.log.info(`Executing script: ${scriptName}`);
      const { stdout, stderr } = await execPromise(`npx tsx server/${scriptName}.ts`);
      
      if (stderr) {
        server.log.error(`Error executing ${scriptName}.ts: ${stderr}`);
        return reply.status(500).send({ message: `Error executing script: ${stderr}` });
      }
      
      server.log.info(`${scriptName} output: ${stdout}`);
      const successMessage = scriptName === 'seed' 
        ? 'Data contoh berhasil dimuat.' 
        : 'Semua data berhasil dihapus.';
      return { success: true, message: successMessage };
      
    } catch (error: any) {
      server.log.error(`Failed to run script ${scriptName}.ts`, error);
      return reply.status(500).send({ message: `Failed to execute script: ${error.message}` });
    }
  };

  server.post('/seed', (request, reply) => {
    return runScript('seed', reply);
  });

  server.post('/clear', async (request, reply) => {
     try {
      const tables = ['order_items', 'orders', 'products', 'cashflow', 'wallets', 'finance_categories', 'users', 'meta'];
      tables.forEach(table => {
          db.prepare(`DELETE FROM ${table}`).run();
      });
      // Re-add admin user
      const staffPermissions = {"master-data":["read","export"],"sales-order":["read","create","update"],"settlement":["read"],"cash-flow":["read","create","export"],"growth-insight":["read"],"order-analytic":["read"]};
      db.prepare('INSERT INTO users (id, username, password, role, permissions, allowedWalletIds) VALUES (?, ?, ?, ?, ?, ?)')
        .run(nanoid(), 'admin', '1234', 'admin', '{}', 'all');
      db.prepare('INSERT INTO users (id, username, password, role, permissions, allowedWalletIds) VALUES (?, ?, ?, ?, ?, ?)')
        .run(nanoid(), 'staff', '1234', 'staff', JSON.stringify(staffPermissions), '["WALLET-001","WALLET-005","WALLET-006"]');
      
      return { success: true, message: 'Semua data berhasil dihapus (kecuali user default).' };
    } catch (e) {
        return reply.status(500).send({ message: 'Gagal menghapus data.' });
    }
  });
}

// Dummy db import to satisfy TS, actual logic in seed.ts handles its own connection
import { db } from '../db';
import { nanoid } from 'nanoid';
