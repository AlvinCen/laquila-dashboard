import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { fetchOrderAnalytics, fetchPlatforms } from '../services/api';
import { Platform } from '../types';
import { formatCurrency, formatIDRCompact } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { TrendingDownIcon } from './icons/TrendingDownIcon';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from 'recharts';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import tz from 'dayjs/plugin/timezone'
import OrderChart from './OrderChart';
dayjs.extend(utc); dayjs.extend(tz)

const TZ = 'Asia/Jakarta'
// URL dasar API (ambil dari .env atau fallback ke localhost)
const COMPARE_COLOR = '#FF6B6B'; // harus sama dengan warna garis pembanding di chart

const BASE =
    (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:4000/api';

// --- helper normalisasi (taruh di atas/bawah import, bebas) ---
const norm = (arr: any[] = []) =>
    arr.map((d: any) => ({
        // terima berbagai bentuk field dari API
        t: String(d.t ?? d.hour ?? d.label ?? d.x),
        v: Number(d.v ?? d.value ?? d.amount ?? d.y ?? 0),
    }));
// Paksa pakai mock (tanpa call API). Set ke false kalau API sudah siap.
const FORCE_MOCK_ANALYTICS = true;

// === MOCK – bikin data harian 00..23 untuk tanggal tertentu ===
const gauss = (x: number, mu: number, s: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2);
const seedNum = (s: string) => s.split('-').reduce((a, b) => a + Number(b), 0);
const makeDaily = (dateStr: string) =>
    Array.from({ length: 24 }, (_, h) => {
        const seed = seedNum(dateStr);
        const v =
            180_000 * gauss(h, 10 + (seed % 2), 1.2) +
            950_000 * gauss(h, 19, 1.6) +
            (seed % 5 === 0 && h === 14 ? 250_000 : 0);
        return { t: String(h).padStart(2, '0'), v: Math.round(v) };
    });

// const makeMockAnalytics = (dateStr: string, compareDateStr?: string) => ({
//     kpi: { totalToday: makeDaily(dateStr).reduce((s, d) => s + d.v, 0) },
//     series: {
//         current: makeDaily(dateStr),
//         compare: compareDateStr ? makeDaily(compareDateStr) : [],
//     },
//     meta: { compareLabel: compareDateStr },
// });

const makeMockAnalytics = (dateStr: string, compareDateStr?: string) => {
    const current = makeDaily(dateStr);
    const compare = compareDateStr ? makeDaily(compareDateStr) : [];
    const total = current.reduce((s, d) => s + d.v, 0);
    const compareTotal = compare.reduce((s, d) => s + d.v, 0);

    return {
        kpi: { total, compareTotal },                   // <<< sesuai interface AnalyticsData
        series: { current, compare },
        meta: { compareLabel: compareDateStr },
        topProducts: [],                                // <<< agar .length tidak undefined
    };
};


type Filters = {
    compare: boolean
    granularity: Granularity
    date: string      // 'YYYY-MM-DD'
    month: string     // 'YYYY-MM'
    marketplace: string
}


// Recharts components will be available on the window object from the CDN
declare const window: any;

// --- UI Components defined locally to avoid creating new files ---
const Switch = ({ checked, onCheckedChange, label }: { checked: boolean, onCheckedChange: (checked: boolean) => void, label: string }) => (
    <div className="flex items-center space-x-2">
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={`${checked ? 'bg-primary' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
        >
            <span
                aria-hidden="true"
                className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
            />
        </button>
        <Label>{label}</Label>
    </div>
);

const ToggleGroup = ({ value, onValueChange, options }: { value: string, onValueChange: (value: string) => void, options: { value: string, label: string }[] }) => (
    <div className="inline-flex rounded-md shadow-sm">
        {options.map((option, index) => (
            <button
                key={option.value}
                type="button"
                onClick={() => onValueChange(option.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary
                    ${index === 0 ? 'rounded-l-lg' : ''}
                    ${index === options.length - 1 ? 'rounded-r-lg' : ''}
                    ${index > 0 ? '-ml-px' : ''}
                    ${value === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

// --- End of local UI Components ---

type Granularity = 'daily' | 'monthly';
interface AnalyticsData {
    kpi: { total: number; compareTotal: number };
    series: { current: { t: string, v: number }[]; compare: { t: string, v: number }[] };
    topProducts: { name: string; qty: number; amount: number }[];
}

const OrderAnalyticPage = () => {
    const [granularity, setGranularity] = useState<Granularity>('daily');
    const [marketplace, setMarketplace] = useState('all');
    const [compare, setCompare] = useState(true);
    // pembanding hanya boleh di 'daily'
    const wantCompare = useMemo(() => compare && granularity === 'daily', [compare, granularity]);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [date, setDate] = useState<string>(() => dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD'));

    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    // default pembanding: kemarin / bulan lalu
    const [compareDate, setCompareDate] = useState(
        dayjs().tz(TZ).subtract(1, 'day').format('YYYY-MM-DD')
    );
    const [compareMonth, setCompareMonth] = useState(
        dayjs().tz(TZ).subtract(1, 'month').format('YYYY-MM')
    );

    const [filters, setFilters] = useState<Filters>(() => ({
        compare: true,
        granularity: 'daily',
        date: dayjs().tz(TZ).format('YYYY-MM-DD'),
        month: dayjs().tz(TZ).format('YYYY-MM'),
        marketplace: 'all',
    }))
    const { showToast } = useToast();

    useEffect(() => {
        fetchPlatforms().then(setPlatforms).catch(() => showToast('Gagal memuat daftar marketplace.', 'error'));
    }, [showToast]);

    // useEffect(() => {
    //     const loadAnalytics = async () => {
    //         setIsLoading(true);
    //         try {
    //             const result = await fetchOrderAnalytics({ marketplace, granularity });
    //             // Helper mock (taruh di atas file sekali saja)
    //             const makeMockDaily = (dateStr: string, cmpStr?: string) => {
    //                 const g = (x: number, mu: number, s: number) => Math.exp(-0.5 * Math.pow((x - mu) / s, 2));
    //                 const mk = (seed: number) =>
    //                     Array.from({ length: 24 }, (_, h) => ({
    //                         t: String(h).padStart(2, '0'),
    //                         v: Math.round(200_000 * g(h, 10 + (seed % 2), 1.1) + 900_000 * g(h, 19, 1.6)),
    //                     }));
    //                 const s1 = mk(dateStr.split('-').reduce((a, b) => a + +b, 0));
    //                 const s2 = cmpStr ? mk(cmpStr.split('-').reduce((a, b) => a + +b, 0) + 7) : [];
    //                 return { current: s1, compare: s2 };
    //             };

    //             let json: any;

    //             try {
    //                 const qs = new URLSearchParams({
    //                     granularity,                             // 'daily'
    //                     marketplace: marketplace || 'all',
    //                     ...(granularity === 'daily' ? { date } : {}),
    //                     ...(compare ? { compare: 'true', compareDate } : { compare: 'false' }),
    //                 });

    //                 const res = await fetch(`${BASE}/analytics/orders?${qs.toString()}`, {
    //                     credentials: 'include',
    //                 });
    //                 if (!res.ok) throw new Error(String(res.status));
    //                 json = await res.json();
    //             } catch {
    //                 // ===== MOCK (frontend only): selalu tampilkan 2 seri harian =====
    //                 const g = (x: number, mu: number, s: number) => Math.exp(-0.5 * Math.pow((x - mu) / s, 2));
    //                 const mk = (seed: number) =>
    //                     Array.from({ length: 24 }, (_, h) => ({
    //                         t: String(h).padStart(2, '0'),
    //                         v: Math.round(200_000 * g(h, 10 + (seed % 2), 1.1) + 900_000 * g(h, 19, 1.6)),
    //                     }));
    //                 const seed = (s: string) => s.split('-').reduce((a, b) => a + +b, 0);

    //                 const dateStr = typeof date === 'string' ? date : dayjs().format('YYYY-MM-DD');
    //                 const cmpStr =
    //                     compare && typeof compareDate === 'string'
    //                         ? compareDate
    //                         : compare
    //                             ? dayjs(dateStr).subtract(1, 'day').format('YYYY-MM-DD')
    //                             : undefined;

    //                 const cur = mk(seed(dateStr));
    //                 const cmp = cmpStr ? mk(seed(cmpStr) + 7) : [];

    //                 json = {
    //                     kpi: { totalToday: cur.reduce((s, d) => s + d.v, 0) },
    //                     series: { current: cur, compare: cmp },
    //                     meta: { compareLabel: cmpStr ? dayjs(cmpStr).format('DD-MM-YYYY') : undefined },
    //                 };
    //             }

    //             setData(json);

    //             // setData(result);
    //             setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    //         } catch (error: any) {
    //             showToast(error.message || 'Gagal memuat data analitik.', 'error');
    //         } finally {
    //             setIsLoading(false);
    //         }
    //     };
    //     loadAnalytics();
    // }, [granularity, marketplace, showToast]);
    useEffect(() => {
        let dead = false;

        async function load() {
            // kalau bukan harian, kosongkan aja (pembanding memang nonaktif)
            if (granularity !== 'daily') {
                if (!dead) setData({
                    kpi: { total: 0, compareTotal: 0 },
                    series: { current: [], compare: [] },
                    meta: {},
                    topProducts: [],
                } as any);
                return;
            }


            // Paksa mock (tanpa request) → TAMPIL 2 GARIS
            if (FORCE_MOCK_ANALYTICS) {
                const mock = makeMockAnalytics(date, compare ? compareDate : undefined);
                if (!dead) setData(mock as any);
                return;
            }

            // Kalau mau tetap coba API dulu: jika 404/gagal → fallback ke mock
            try {
                const qs = new URLSearchParams({
                    granularity, marketplace: marketplace || 'all', date,
                    ...(compare ? { compare: 'true', compareDate } : { compare: 'false' }),
                });
                const base = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:4000/api';
                const res = await fetch(`${base}/analytics/orders?${qs.toString()}`, { credentials: 'include' });
                if (!res.ok) throw new Error(String(res.status));
                const json = await res.json();
                const normalized: AnalyticsData = {
                    kpi: {
                        total: json?.kpi?.total ?? json?.kpi?.totalToday ?? 0,
                        compareTotal: json?.kpi?.compareTotal ?? 0,
                    },
                    series: {
                        current: json?.series?.current ?? [],
                        compare: json?.series?.compare ?? [],
                    },
                    topProducts: json?.topProducts ?? [],
                };

                if (!dead) setData(normalized);
            } catch {
                const mock = makeMockAnalytics(date, compare ? compareDate : undefined);
                if (!dead) setData(mock as any);
            }
        }

        load();
        return () => { dead = true; };
    }, [granularity, date, compare, compareDate, marketplace, setData]);

    useEffect(() => {
        if (granularity === 'monthly' && compare) setCompare(false);
    }, [granularity]);

    // const { Recharts } = window;
    // const { ResponsiveContainer, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Area, AreaChart } = Recharts;

    // === GANTI blok chartData kamu dengan ini ===
    const chartData = useMemo(() => {
        if (!data) return [];

        // Normalisasi dan jadikan Map
        const cur = new Map((data.series?.current ?? []).map((d: any) => [String(d.t), Number(d.v || 0)]));
        const cmp = new Map((data.series?.compare ?? []).map((d: any) => [String(d.t), Number(d.v || 0)]));

        // Tentukan bucket X:
        // - Harian: 00..23
        // - Bulanan: ambil paling besar dari key seri (1..N); fallback 31
        const buckets =
            granularity === 'daily'
                ? Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
                : (() => {
                    const maxKey =
                        Math.max(
                            0,
                            ...[...cur.keys(), ...cmp.keys()].map(k => parseInt(String(k), 10) || 0)
                        ) || 31;
                    return Array.from({ length: maxKey }, (_, i) => String(i + 1));
                })();

        // Build data final { t, current, compare? }
        return buckets.map(t => ({
            t,
            current: Number(cur.get(t) ?? 0),
            ...(wantCompare ? { compare: Number(cmp.get(t) ?? 0) } : {}),
        }));
        // ⬇️ perhatikan: tidak ada 'month' di dependency
    }, [data, granularity, wantCompare]);



    const kpiData = useMemo(() => {
        if (!data) return { total: 0, change: 0 };
        const { total, compareTotal } = data.kpi;
        if (compareTotal === 0) {
            return { total, change: total > 0 ? Infinity : 0 };
        }
        const change = ((total - compareTotal) / compareTotal) * 100;
        return { total, change };
    }, [data]);

    const compareLabel = useMemo(() => {
        if (!wantCompare) return '';
        return dayjs.tz(compareDate, TZ).format('DD-MM-YYYY'); // kemarin / tanggal yang dipilih
    }, [wantCompare, compareDate]);



    const headerTitle = granularity === 'daily' ? 'Penjualan Hari Ini' : 'Penjualan Bulan Ini';
    const comparisonLabel = granularity === 'daily' ? 'vs kemarin' : 'vs bulan lalu';
    const isChangePositive = kpiData.change >= 0;

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <Card>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="marketplace-filter">Marketplace</Label>
                            <Select id="marketplace-filter" value={marketplace} onChange={e => setMarketplace(e.target.value)}>
                                <option value="all">Semua</option>
                                {platforms.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </Select>
                        </div>
                        <div className="grid gap-1.5 self-end">
                            <ToggleGroup
                                value={granularity}
                                onValueChange={(val) => setGranularity(val as Granularity)}
                                options={[{ value: 'daily', label: 'Harian' }, { value: 'monthly', label: 'Bulanan' }]}
                            />
                        </div>
                    </div>
                    <div className="self-end pb-1">
                        {/* <Switch checked={compare} onCheckedChange={setCompare} label="Bandingkan" />
                        {compare && granularity === 'daily' && (
                            <div className="ml-4 grid gap-1.5">
                                <Label>Tanggal pembanding</Label>
                                <input
                                    type="date"
                                    value={compareDate}
                                    onChange={(e) => setCompareDate(e.target.value)}
                                    className="border rounded px-2 py-1"
                                />
                            </div>
                        )}

                        {compare && granularity === 'monthly' && (
                            <div className="ml-4 grid gap-1.5">
                                <Label>Bulan pembanding</Label>
                                <input
                                    type="month"
                                    value={compareMonth}
                                    onChange={(e) => setCompareMonth(e.target.value)}
                                    className="border rounded px-2 py-1"
                                />
                            </div>
                        )} */}

                    </div>
                </CardContent>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* KPI Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">{headerTitle}</h3>
                                <p className="text-sm text-muted-foreground">Update: {lastUpdated}</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-5xl font-bold">{formatCurrency(kpiData.total)}</p>
                            <div className={`mt-2 flex items-center text-sm ${isChangePositive ? 'text-green-600' : 'text-red-600'}`}>
                                {kpiData.change !== 0 && (
                                    isChangePositive ? <TrendingUpIcon className="h-4 w-4 mr-1" /> : <TrendingDownIcon className="h-4 w-4 mr-1" />
                                )}
                                <span>
                                    {isFinite(kpiData.change) ? `${kpiData.change.toFixed(2)}%` : 'N/A'} {comparisonLabel}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Chart Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">Metrik Real-time</h3>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 h-96">
                            {isLoading ? <div className="h-full w-full bg-gray-200 animate-pulse rounded-md"></div> : (
                                // <ResponsiveContainer width="100%" height="100%">
                                //     <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                //         <CartesianGrid strokeDasharray="3 3" />
                                //         <XAxis dataKey="name" />
                                //         <YAxis tickFormatter={(value) => formatIDRCompact(value as number)} />
                                //         <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                //         <Legend />
                                //         <Area type="monotone" dataKey="penjualan" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                                //         {compare && <Line type="monotone" dataKey="pembanding" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} />}
                                //     </AreaChart>
                                // </ResponsiveContainer>
                                <OrderChart
                                    granularity={granularity}     // 'daily' | 'monthly'
                                    date={date}
                                    compareDate={compareDate}     // daily: 'YYYY-MM-DD', monthly: 'YYYY-MM'
                                    onChangeCompareDate={setCompareDate}
                                    marketplace={marketplace}
                                />

                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Top Products Card */}
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <h3 className="text-lg font-medium">5 Produk Terlaris</h3>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => <div key={i} className="h-10 w-full bg-gray-200 animate-pulse rounded-md"></div>)}
                                </div>
                            ) : !data || data.topProducts.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-8">Tidak ada data produk.</p>
                            ) : (
                                <ul className="space-y-4">
                                    {data.topProducts.map((product, index) => (
                                        <li key={index} className="flex items-center space-x-4 text-sm">
                                            <span className="flex-shrink-0 font-medium text-muted-foreground">{index + 1}</span>
                                            <div className="flex-grow min-w-0">
                                                <p className="font-medium truncate" title={product.name}>{product.name}</p>
                                                <p className="text-muted-foreground">Qty: {product.qty}</p>
                                            </div>
                                            <span className="font-semibold flex-shrink-0">{formatIDRCompact(product.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default OrderAnalyticPage;
