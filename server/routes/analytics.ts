// server/routes/analytics.ts
import { FastifyInstance } from 'fastify';
import { db } from '../db';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);

const TZ = 'Asia/Jakarta';

function dayWindow(dateStr: string) {
  const start = dayjs.tz(dateStr, TZ).startOf('day');
  const end = start.endOf('day');
  return { start: start.toISOString(), end: end.toISOString(), label: start.format('DD-MM-YYYY') };
}

function hourlySeries(startIso: string, endIso: string) {
  // total = Σ(basePrice × qty) per jam
  const rows = db.prepare(`
    SELECT strftime('%H', datetime(o.createdAt)) AS h,
           SUM(oi.basePrice * oi.qty) AS v
    FROM orders o
    JOIN order_items oi ON oi.orderId = o.id
    WHERE o.createdAt BETWEEN ? AND ?
    GROUP BY h
  `).all(startIso, endIso) as any[];

  const map = new Map(rows.map(r => [r.h, Number(r.v || 0)]));
  return Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    return { t: h, v: Number(map.get(h) ?? 0) };
  });
}

export default async function analyticsRoutes(app: FastifyInstance) {
  // GET /api/analytics/orders?granularity=daily&date=YYYY-MM-DD&compare=true&compareDate=YYYY-MM-DD&marketplace=all
  app.get('/api/analytics/orders', async (req) => {
    const q = req.query as any;
    const granularity = q.granularity ?? 'daily';
    if (granularity !== 'daily') {
      return { kpi: { totalToday: 0 }, series: { current: [], compare: [] }, meta: {} };
    }

    const date = q.date || dayjs().tz(TZ).format('YYYY-MM-DD');
    const wantCompare = String(q.compare) === 'true';
    const compareDate = wantCompare
      ? (q.compareDate || dayjs.tz(date, TZ).subtract(1, 'day').format('YYYY-MM-DD'))
      : null;

    const w = dayWindow(date);
    const current = hourlySeries(w.start, w.end);
    const totalToday = current.reduce((s, d) => s + d.v, 0);

    let compare: any[] = [];
    let compareLabel: string | undefined = undefined;
    if (compareDate) {
      const c = dayWindow(compareDate);
      compare = hourlySeries(c.start, c.end);
      compareLabel = c.label;
    }

    return { kpi: { totalToday }, series: { current, compare }, meta: { compareLabel } };
  });
}
