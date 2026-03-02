import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { seedDatabase } from '@/services/db';
import { PortfolioService } from '@/services/finance';
import { Calendar, TrendingUp, PieChart as PieIcon, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { PortfolioChart } from '@/components/PortfolioChart';
import { DividendCalendar } from '@/components/DividendCalendar';
import { TransactionHistoryDialog } from '@/components/TransactionHistoryDialog';
import { motion } from 'framer-motion';

// --- Components ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SummaryCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
    <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-xl text-zinc-100 shadow-lg hover:bg-zinc-900/70 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-zinc-400 truncate pr-2">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground text-zinc-500 flex-shrink-0" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold truncate" title={value}>${value}</div>
            <div className="text-[10px] md:text-xs text-zinc-500 mt-1 truncate">
                {trend && <span className="text-emerald-400 mr-1">{trend}</span>}
                {subtext}
            </div>
        </CardContent>
    </Card>
);

const PerformanceTable = ({ accounts, holdings }: { accounts: any[], holdings: any[] }) => {
    return (
        <Card className="col-span-1 md:col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-xl text-zinc-100 shadow-xl h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-400" /> 수익률 현황</CardTitle>
                <CardDescription className="text-zinc-400">계좌별 / 종목별 성과</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="accounts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                        <TabsTrigger value="accounts">계좌별</TabsTrigger>
                        <TabsTrigger value="holdings">종목별</TabsTrigger>
                    </TabsList>
                    <TabsContent value="accounts">
                        <div className="mt-4 space-y-4">
                            {/* Desktop Table Header */}
                            <div className="hidden md:grid grid-cols-4 text-sm text-zinc-500 pb-2 border-b border-zinc-800">
                                <div className="col-span-1">계좌명</div>
                                <div className="text-right">투자원금</div>
                                <div className="text-right">평가액</div>
                                <div className="text-right">누적/보유 수익률</div>
                            </div>
                            {accounts.map(acc => (
                                <div key={acc.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors py-3 md:py-2">
                                    {/* Desktop Row */}
                                    <div className="hidden md:grid grid-cols-4 items-center">
                                        <div className="col-span-1 font-medium text-zinc-300">{acc.name}</div>
                                        <div className="text-right text-zinc-400 text-sm">₩{acc.netInvested.toLocaleString()}</div>
                                        <div className="text-right text-zinc-300 text-sm">₩{acc.value.toLocaleString()}</div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${acc.cumulativeRoi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {acc.cumulativeRoi > 0 ? '+' : ''}{acc.cumulativeRoi}%
                                            </div>
                                            <div className={`text-xs ${acc.currentRoi >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                                                ({acc.currentRoi > 0 ? '+' : ''}{acc.currentRoi}%)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile Card */}
                                    <div className="flex md:hidden flex-col gap-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="font-bold text-zinc-200 truncate">{acc.name}</div>
                                            <div className={`text-sm font-bold flex-shrink-0 ${acc.cumulativeRoi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {acc.cumulativeRoi > 0 ? '+' : ''}{acc.cumulativeRoi}%
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-zinc-800/50 p-2 rounded overflow-hidden">
                                                <div className="text-zinc-500 mb-1">투자원금</div>
                                                <div className="text-zinc-300 truncate font-mono">₩{acc.netInvested.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-zinc-800/50 p-2 rounded overflow-hidden">
                                                <div className="text-zinc-500 mb-1">평가액</div>
                                                <div className="text-zinc-300 truncate font-mono">₩{acc.value.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="holdings">
                        <div className="mt-4 space-y-4">
                            {/* Desktop Table Header */}
                            <div className="hidden md:grid grid-cols-5 text-sm text-zinc-500 pb-2 border-b border-zinc-800">
                                <div className="col-span-1">종목명</div>
                                <div className="text-right">현재가</div>
                                <div className="text-right">투자원금</div>
                                <div className="text-right">평가액</div>
                                <div className="text-right">수익률</div>
                            </div>

                            {holdings.map((asset, idx) => {
                                const currencySymbol = asset.currency === 'KRW' ? '₩' : '$';
                                return (
                                    <div key={idx} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors py-3 md:py-2">
                                        {/* Desktop Row */}
                                        <div className="hidden md:grid grid-cols-5 items-center">
                                            <div className="col-span-1 font-medium text-zinc-300">
                                                {asset.name}
                                                <div className="text-[10px] text-zinc-500">{asset.ticker}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-zinc-300 font-mono text-sm">{currencySymbol}{asset.currentPrice?.toLocaleString()}</div>
                                                <div className={`text-xs ${asset.dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {asset.dailyChange > 0 ? '+' : ''}{asset.dailyChange ? asset.dailyChange.toFixed(2) : '0.00'}%
                                                </div>
                                            </div>
                                            <div className="text-right text-zinc-400 text-sm">{currencySymbol}{asset.totalCost.toLocaleString()}</div>
                                            <div className="text-right text-zinc-300 text-sm">{currencySymbol}{asset.currentValue?.toLocaleString() || 0}</div>
                                            <div className="text-right">
                                                <div className={`text-sm font-bold ${asset.currentValue > asset.totalCost ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {asset.totalCost > 0 ? ((asset.currentValue - asset.totalCost) / asset.totalCost * 100).toFixed(2) : 0}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Card */}
                                        <div className="flex md:hidden flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-zinc-200">{asset.name}</div>
                                                    <div className="text-xs text-zinc-500">{asset.ticker}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono text-zinc-200">{currencySymbol}{asset.currentPrice?.toLocaleString()}</div>
                                                    <div className={`text-xs ${asset.dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {asset.dailyChange > 0 ? '+' : ''}{asset.dailyChange ? asset.dailyChange.toFixed(2) : '0.00'}%
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-zinc-800/50 p-2 rounded">
                                                    <div className="text-zinc-500 mb-1">투자원금</div>
                                                    <div className="text-zinc-300">{currencySymbol}{asset.totalCost.toLocaleString()}</div>
                                                </div>
                                                <div className="bg-zinc-800/50 p-2 rounded">
                                                    <div className="text-zinc-500 mb-1">평가액</div>
                                                    <div className="text-zinc-300">{currencySymbol}{asset.currentValue?.toLocaleString() || 0}</div>
                                                </div>
                                                <div className="bg-zinc-800/50 p-2 rounded">
                                                    <div className="text-zinc-500 mb-1">수익률</div>
                                                    <div className={`font-bold ${asset.currentValue > asset.totalCost ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {asset.totalCost > 0 ? ((asset.currentValue - asset.totalCost) / asset.totalCost * 100).toFixed(2) : 0}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    useEffect(() => {
        seedDatabase();
        PortfolioService.updatePrices();
    }, []);

    const accountPerformance = useLiveQuery(() => PortfolioService.getAccountPerformance());
    const holdings = useLiveQuery(() => PortfolioService.calculateHoldings());
    const dividendHistory = useLiveQuery(() => PortfolioService.getDividendHistory());

    // Aggregate totals for KPI cards
    const totalNetInvested = accountPerformance?.reduce((sum, acc) => sum + acc.netInvested, 0) || 0;
    const totalValue = accountPerformance?.reduce((sum, acc) => sum + acc.value, 0) || 0;
    const totalGain = totalValue - totalNetInvested;
    const cumulativeRoi = totalNetInvested > 0 ? (totalGain / totalNetInvested) * 100 : 0;

    // Current ROI (Holding based) - Weighted average across all holdings
    const totalHoldingsCost = holdings?.reduce((sum, h) => sum + (h.totalCostKRW || 0), 0) || 0;
    const totalHoldingsValue = holdings?.reduce((sum, h) => sum + (h.currentValueKRW || 0), 0) || 0;
    const currentRoi = totalHoldingsCost > 0 ? ((totalHoldingsValue - totalHoldingsCost) / totalHoldingsCost) * 100 : 0;

    // Annual Dividend Calculation (Sum of latest year in history?)
    // dividendHistory structure has changed to include amountKRW
    const currentYear = new Date().getFullYear();
    const annualDividendKRW = dividendHistory && dividendHistory[currentYear]
        ? dividendHistory[currentYear].reduce((sum: number, item: any) => sum + (item.amountKRW || 0), 0)
        : 0;

    return (
        <div className="min-h-screen bg-black p-8 font-sans text-zinc-100">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                        <p className="text-zinc-400">Your asset performance at a glance.</p>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-right hidden md:block">
                            <div className="text-sm text-zinc-500">순수 투자 원금</div>
                            <div className="font-mono text-zinc-300">₩{totalNetInvested.toLocaleString()}</div>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="text-sm text-zinc-500">총 자산 평가액</div>
                            <div className="text-2xl font-bold text-white">₩{totalValue.toLocaleString()}</div>
                        </div>
                        <div className="flex gap-2">
                            <AddTransactionDialog />
                            <TransactionHistoryDialog />
                            <SettingsDialog />
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: {
                                staggerChildren: 0.1
                            }
                        }
                    }}
                >
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                        <SummaryCard
                            title="총 자산"
                            value={`₩${totalValue.toLocaleString()}`}
                            icon={Calendar}
                            subtext={
                                <span className="flex items-center gap-1">
                                    <span>원금:</span>
                                    <span className="font-mono text-zinc-400">₩{totalNetInvested.toLocaleString()}</span>
                                </span>
                            }
                        />
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                        <SummaryCard title="누적 수익률" value={`${cumulativeRoi.toFixed(2)}%`} icon={Activity} trend="" subtext="전체 자산 기준" />
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                        <SummaryCard title="보유 수익률" value={`${currentRoi.toFixed(2)}%`} icon={TrendingUp} subtext="현재 보유 자산 기준" />
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                        <SummaryCard title={`수령 배당금 (${currentYear})`} value={`₩${annualDividendKRW.toLocaleString()}`} icon={PieIcon} subtext={`Total ${currentYear}`} />
                    </motion.div>
                </motion.div>

                {/* Main Content Grid */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <PortfolioChart holdings={holdings || []} />
                    <PerformanceTable accounts={accountPerformance || []} holdings={holdings || []} />
                    <DividendCalendar history={dividendHistory || {}} />
                </motion.div>
            </div>
        </div>
    );
}
