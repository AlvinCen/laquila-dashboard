// OrderChart.tsx — chart harian pakai jam (00–23) + bulanan pakai tanggal
import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import dayjs from 'dayjs'

type Granularity = 'daily' | 'monthly'
type Point = { t: string; v: number }
type Series = { current: Point[]; compare: Point[] }

const COLOR_TODAY = '#2F6FED'
const COLOR_COMPARE = '#FF6B6B'
const BASE = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:4000/api'

const pad2 = (x: any) => String(x).padStart(2, '0')

// ---- decoder util (bebasin bentuk API) ----
function toPoints(src: any): Point[] {
  if (!src) return []
  if (!Array.isArray(src) && Array.isArray(src.keys) && Array.isArray(src.values)) {
    return src.keys.map((k: any, i: number) => ({ t: pad2(k), v: Number(src.values[i] ?? 0) }))
  }
  if (Array.isArray(src) && src.length && Array.isArray(src[0])) {
    return (src as any[]).map(([t, v]) => ({ t: pad2(t), v: Number(v ?? 0) }))
  }
  if (Array.isArray(src)) {
    return src.map((d: any) => {
      const t = d?.t ?? d?.time ?? d?.hour ?? d?.day ?? d?.label ?? d?.x ?? d?.key
      const v = d?.v ?? d?.value ?? d?.amount ?? d?.total ?? d?.y ?? d?.sum
      if (t == null) return null
      return { t: pad2(t), v: Number(v ?? 0) }
    }).filter(Boolean) as Point[]
  }
  return []
}
function decodeSeries(json: any): Series {
  const s = json?.series ?? json?.data?.series ?? json?.series2 ?? json?.data ?? {}
  let cur = toPoints(s.current ?? s.cur ?? s.today ?? s.this ?? s)
  let cmp = toPoints(s.compare ?? s.comp ?? s.prev ?? s.previous ?? [])
  if (cur.length === 0 && s.current && !Array.isArray(s.current)) cur = toPoints(s.current)
  if (cmp.length === 0 && s.compare && !Array.isArray(s.compare)) cmp = toPoints(s.compare)
  return { current: cur, compare: cmp }
}
function mergeByUnion(cur: Point[], cmp: Point[], fallbackKeys?: string[]) {
  const keys = Array.from(new Set<string>([
    ...cur.map(d => String(d.t)),
    ...cmp.map(d => String(d.t)),
    ...(fallbackKeys ?? []),
  ])).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))
  const mc = new Map(cur.map(d => [String(d.t), Number(d.v || 0)]))
  const mp = new Map(cmp.map(d => [String(d.t), Number(d.v || 0)]))
  return keys.map(t => ({ t, current: mc.get(t) ?? 0, compare: mp.get(t) ?? 0 }))
}

export default function OrderChart({
  granularity,
  date,
  compareDate,
  onChangeCompareDate,
  marketplace = 'all',
  onKpi                                              // <— tambah ini
}: {
  granularity: Granularity
  date: string
  compareDate?: string
  onChangeCompareDate?: (v: string) => void
  marketplace?: string
  onKpi?: (k: { total: number; compareTotal: number }) => void  // <— tambah ini
}) {
  const isMonthly = granularity === 'monthly'
  const [series, setSeries] = useState<Series>({ current: [], compare: [] })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Fallback bucket: Harian → jam 00..23, Bulanan → 01..N
  const fallbackKeys = useMemo(() => {
    if (isMonthly) {
      const month = dayjs(date).format('YYYY-MM')
      const n = dayjs(`${month}-01`).daysInMonth()
      return Array.from({ length: n }, (_, i) => pad2(i + 1))
    }
    return Array.from({ length: 24 }, (_, h) => pad2(h))
  }, [isMonthly, date])

  // Ticks untuk jam tiap 2 jam (00, 02, …, 22)
  const dailyTicks = useMemo(
    () => (isMonthly ? undefined : Array.from({ length: 12 }, (_, i) => pad2(i * 2))),
    [isMonthly]
  )

  useEffect(() => {
    let dead = false
    async function load() {
      setErr(null)
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('marketplace', marketplace)
        qs.set('granularity', granularity)

        if (isMonthly) {
          const month = dayjs(date).format('YYYY-MM')
          qs.set('month', month)
          qs.set('date', `${month}-01`) // kompat
          if (compareDate && compareDate.length === 7) {
            qs.set('compare', 'true')
            qs.set('compareDate', compareDate)
          }
        } else {
          const day = dayjs(date).format('YYYY-MM-DD')
          qs.set('date', day)
          qs.set('day', day) // kompat
          if (compareDate && compareDate.length >= 10) {
            qs.set('compare', 'true')
            qs.set('compareDate', dayjs(compareDate).format('YYYY-MM-DD'))
          }
        }

        const url = `${BASE}/analytics/orders?${qs.toString()}`
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const json = await res.json()
        const dec = decodeSeries(json)
        if (!dead) {
          setSeries(dec)
          const total = dec.current.reduce((s, d) => s + (d.v || 0), 0)
          const compareTotal = dec.compare.reduce((s, d) => s + (d.v || 0), 0)
          onKpi?.({ total, compareTotal })                         // <— kabarkan ke parent

          if (dec.current.length === 0 && dec.compare.length === 0) {
            setErr('Tidak ada data untuk periode ini.')
          }
        }
      } catch (e: any) {
        if (!dead) {
          setSeries({ current: [], compare: [] })
          setErr(`Gagal mengambil data${e?.message ? `: ${e.message}` : ''}`)
          onKpi?.({ total: 0, compareTotal: 0 })                  // <— reset KPI
          console.error('[OrderChart] fetch error', e)
        }
      } finally {
        if (!dead) setLoading(false)
      }
    }
    load()
    return () => { dead = true }
  }, [granularity, isMonthly, date, compareDate, marketplace])

  // Data final: Harian → 24 titik (jam), Bulanan → 01..N
  const chartData = useMemo(
    () => mergeByUnion(series.current, series.compare, fallbackKeys),
    [series, fallbackKeys]
  )

  const compareLabel = isMonthly
    ? (compareDate ? dayjs(`${compareDate}-01`).format('MM-YYYY') : undefined)
    : (compareDate ? dayjs(compareDate).format('DD-MM-YYYY') : undefined)

  const tooltipLabel = (l: any) => (isMonthly ? `Tanggal ${l}` : `Jam ${l}:00`)

  return (
    <div className="rounded-2xl border p-3 min-h-[280px] relative">
      {err && (
        <div className="absolute left-3 top-2 z-10 text-[12px] leading-tight text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 shadow-sm">
          {err}
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            ticks={dailyTicks as any}
            label={!isMonthly ? { value: 'Jam', position: 'insideBottomRight', offset: 0 } : undefined}
          />
          <YAxis tickFormatter={(v) =>
            new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v))
          } />
          <Tooltip
            formatter={(v: any) =>
              new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v))
            }
            labelFormatter={tooltipLabel}
          />
          <Legend
            verticalAlign="top"
            wrapperStyle={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            content={() => (
              <div className="w-full flex items-center justify-center gap-6 px-2 py-1">
                <div className="flex items-center gap-2 text-slate-700">
                  <svg width="18" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="18" y2="5" stroke={COLOR_TODAY} strokeWidth="2" />
                  </svg>
                  <span className="text-sm">{isMonthly ? 'Bulan Ini' : 'Hari Ini'}</span>
                </div>
                <div className="flex items-center gap-2" style={{ color: COLOR_COMPARE }}>
                  <svg width="18" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="18" y2="5" stroke={COLOR_COMPARE} strokeWidth="2" strokeDasharray="6 4" />
                    <circle cx="9" cy="5" r="3" fill="#fff" stroke={COLOR_COMPARE} strokeWidth="2" />
                  </svg>
                  <input
                    type={isMonthly ? 'month' : 'date'}
                    value={compareDate ?? ''}
                    onChange={(e) => onChangeCompareDate?.(e.target.value)}
                    className="bg-transparent outline-none border-0 text-sm"
                    style={{ color: COLOR_COMPARE }}
                  />
                </div>
              </div>
            )}
          />

          <Area
            type="monotone"
            dataKey="current"
            name={isMonthly ? 'Bulan Ini' : 'Hari Ini'}
            stroke={COLOR_TODAY}
            strokeWidth={2}
            fill={COLOR_TODAY}
            fillOpacity={0.18}
            activeDot={{ r: 4 }}
          />
          {series.compare.length > 0 && (
            <Line
              type="monotone"
              dataKey="compare"
              name={compareLabel}
              stroke={COLOR_COMPARE}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {loading && <div className="px-3 py-2 text-xs text-slate-500">Memuat data…</div>}
    </div>
  )
}
