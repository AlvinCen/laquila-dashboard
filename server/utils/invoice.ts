import { db } from '../db';
import dayjs from 'dayjs';

/**
 * Generates the next invoice number in MMYY-#### format.
 * It checks the database for the last used number for the current month
 * and increments it. If it's a new month, it starts from 7000.
 */
export function getNextInvoiceNumber(): string {
    const now = dayjs();
    const currentMonthYear = now.format('MMYY');
    const startOfMonth = now.startOf('month').toISOString();

    const stmt = db.prepare(`
        SELECT MAX(SUBSTR(invoiceNumber, 6)) 
        FROM orders 
        WHERE createdAt >= ? AND invoiceNumber LIKE ?
    `);
    
    const result = stmt.get(startOfMonth, `${currentMonthYear}-%`) as string | null;
    const lastNum = result ? parseInt(Object.values(result)[0], 10) : null;
    
    const nextNum = (lastNum && lastNum >= 7000) ? lastNum + 1 : 7000;
    
    return `${currentMonthYear}-${nextNum}`;
}
