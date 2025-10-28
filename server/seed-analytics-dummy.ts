import { db } from './db';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);

const TZ = 'Asia/Jakarta';

function addOrder(date: string, hour: number, name: string, price: number, qty: number) {
  const created = dayjs.tz(date, TZ).hour(hour).minute(15).second(0).millisecond(0).toDate().toISOString();
  const orderId = nanoid();
  const invoice = dayjs.tz(date, TZ).format('MMYY') + '-' + (7000 + Math.floor(Math.random() * 900));
  db.prepare(
    `INSERT INTO orders (id, invoiceNumber, createdAt, marketplace, paymentStatus, orderStatus, jumlahDilunasi)
     VALUES (?, ?, ?, 'manual', 'Pending', 'Active', 0)`
  ).run(orderId, invoice, created);
  db.prepare(
    `INSERT INTO order_items (id, orderId, productName, basePrice, qty)
     VALUES (?, ?, ?, ?, ?)`
  ).run(nanoid(), orderId, name, price, qty);
}

const today = dayjs().tz(TZ).format('YYYY-MM-DD');
const yesterday = dayjs.tz(today, TZ).subtract(1, 'day').format('YYYY-MM-DD');

// Hari ini
addOrder(today, 9, 'Kandang Galvanis M', 250_000, 2);
addOrder(today, 14, 'Part Lantai Alas', 120_000, 3);
addOrder(today, 20, 'Puyuh 20-26', 869_000, 1);

// Kemarin (pembanding)
addOrder(yesterday, 10, 'Kandang Galvanis M', 250_000, 1);
addOrder(yesterday, 16, 'Puyuh 50-60', 1_295_000, 1);

console.log('✅ Dummy analytics seeded (today & yesterday).');
