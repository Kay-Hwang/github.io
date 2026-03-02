import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart as PieIcon } from 'lucide-react';

// Trello/Notion style vivid colors for dark mode
const COLORS = [
    '#10B981', // Emerald 500 (Main)
    '#3B82F6', // Blue 500
    '#8B5CF6', // Violet 500
    '#F59E0B', // Amber 500
    '#EF4444', // Red 500
    '#6366F1', // Indigo 500
    '#EC4899', // Pink 500
    '#14B8A6', // Teal 500
];

interface PortfolioChartProps {
    holdings: any[];
}

export function PortfolioChart({ holdings }: PortfolioChartProps) {
    const data = useMemo(() => {
        if (!holdings || holdings.length === 0) return [];
        return holdings.map(h => ({
            name: h.ticker,
            value: h.currentValue || 0
        })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    // Custom Tooltip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            const percent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            return (
                <div className="bg-zinc-900/90 border border-zinc-700 p-2 rounded shadow-xl backdrop-blur-md">
                    <p className="text-zinc-100 font-bold">{item.name}</p>
                    <p className="text-emerald-400 font-mono">
                        ${item.value.toLocaleString()} ({percent.toFixed(1)}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <Card className="col-span-1 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-xl text-zinc-100 h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieIcon className="w-5 h-5 text-blue-400" />
                        자산 비중
                    </CardTitle>
                    <CardDescription className="text-zinc-400">포트폴리오 구성 비율</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        {data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {data.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-zinc-400 text-xs ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-zinc-500">
                                데이터가 없습니다.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
