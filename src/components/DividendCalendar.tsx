import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface DividendDetail {
    id: number;
    date: string;
    ticker: string;
    name: string;
    amount: number;
    currency: 'KRW' | 'USD';
    yield: number;
}

interface AnnualHistory {
    [year: number]: {
        month: string;
        amount: number;
        amountKRW: number;
        details: DividendDetail[];
    }[];
}

export function DividendCalendar({ history }: { history: AnnualHistory }) {
    const currentYear = new Date().getFullYear();
    const availableYears = Object.keys(history).map(Number).sort((a, b) => a - b);
    const [selectedYear, setSelectedYear] = useState(availableYears.length > 0 ? availableYears[availableYears.length - 1] : currentYear);

    const yearData = history[selectedYear] || [];

    const chartData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((m, idx) => {
            const found = yearData.find((d: any) => d.month === m);
            return {
                name: String(idx + 1),
                month: m,
                amount: found ? found.amount : 0, // Keeping original for reference? No, chart should show uniform currency (KRW)
                amountKRW: found ? found.amountKRW : 0,
                isPaid: true
            };
        });
    }, [yearData]);

    const totalDividendKRW = yearData.reduce((sum: number, item: any) => sum + (item.amountKRW || 0), 0);

    return (
        <Card className="col-span-1 md:col-span-3 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-xl overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => setSelectedYear(prev => availableYears.includes(prev - 1) ? prev - 1 : prev)}
                                disabled={!availableYears.includes(selectedYear - 1)}
                                className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xl font-bold">{selectedYear}년</span>
                            <button
                                onClick={() => setSelectedYear(prev => availableYears.includes(prev + 1) ? prev + 1 : prev)}
                                disabled={!availableYears.includes(selectedYear + 1)}
                                className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-3xl font-bold text-white flex items-center gap-2">
                            ₩{totalDividendKRW.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex gap-2 text-xs text-zinc-500">
                        <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-white" /> 실수령액 (세후 추정)</div>
                    </div>
                </div>

                <div className="h-32 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#71717a', fontSize: 10 }}
                                interval={0}
                            />
                            <Tooltip
                                cursor={{ fill: '#27272a' }}
                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(value: any) => [`₩${(value || 0).toLocaleString()}`, 'Dividend']}
                            />
                            <Bar dataKey="amountKRW" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.amountKRW > 0 ? '#f472b6' : '#3f3f46'} fillOpacity={entry.amountKRW > 0 ? 1 : 0.3} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="divide-y divide-zinc-900">
                    {yearData.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-sm">배당 내역이 없습니다.</div>
                    ) : (
                        [...yearData]
                            .sort((a: any, b: any) => {
                                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                return months.indexOf(b.month) - months.indexOf(a.month);
                            })
                            .map((monthItem: any) => (
                                <div key={monthItem.month} className="p-4">
                                    <div className="flex justify-between items-baseline mb-4">
                                        <h3 className="text-lg font-bold text-zinc-200">{monthItem.month}</h3>
                                        <span className="font-mono font-bold text-zinc-200">Total: ₩{(monthItem.amountKRW || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-4">
                                        {monthItem.details.map((detail: DividendDetail, idx: number) => {
                                            const day = detail.date ? new Date(detail.date).getDate() : '?';
                                            const currencySymbol = detail.currency === 'KRW' ? '₩' : '$';
                                            return (
                                                <div key={`${detail.id}-${idx}`} className="flex items-center gap-4">
                                                    <div className="w-8 text-center text-zinc-400 font-medium text-sm">{day}일</div>

                                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 overflow-hidden flex-shrink-0 border border-zinc-700">
                                                        {(detail.ticker || '').substring(0, 4)}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-zinc-200 truncate">{detail.name}</div>
                                                        <div className="text-xs text-zinc-500 truncate mt-0.5">
                                                            {detail.ticker} • Yield {detail.yield || 0}%
                                                        </div>
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">배당</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-zinc-200">{currencySymbol}{detail.amount.toLocaleString()}</div>
                                                        <div className="text-[10px] text-zinc-500 mt-1">
                                                            ({currencySymbol}{(detail.amount / (detail.yield && detail.yield > 0 ? detail.yield / 100 * detail.amount * 10 : 1)).toFixed(2)})
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
