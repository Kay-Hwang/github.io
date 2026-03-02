import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { PortfolioService } from '@/services/finance';
import { type Transaction } from '@/services/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { History, Search, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AddTransactionDialog } from './AddTransactionDialog';

export function TransactionHistoryDialog() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const transactions = useLiveQuery(() => db.transactions.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const accountMap = new Map(accounts?.map(a => [a.id, a.name]));

    const filteredTransactions = transactions?.filter(t => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            t.ticker?.toLowerCase().includes(searchLower) ||
            t.type.toLowerCase().includes(searchLower) ||
            t.memo?.toLowerCase().includes(searchLower) ||
            accountMap.get(t.accountId)?.toLowerCase().includes(searchLower)
        );
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            await PortfolioService.deleteTransaction(id);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <History className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Transaction History</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        View and manage your transaction records.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 py-4">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Search transactions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-sm"
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400">Date</TableHead>
                                    <TableHead className="text-zinc-400">Type</TableHead>
                                    <TableHead className="text-zinc-400">Asset</TableHead>
                                    <TableHead className="text-right text-zinc-400">Amount</TableHead>
                                    <TableHead className="text-zinc-400">Account</TableHead>
                                    <TableHead className="text-right text-zinc-400">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions?.map((tx, index) => (
                                    <motion.tr
                                        key={tx.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                                    >
                                        <TableCell className="font-mono text-xs">{tx.date}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold 
                                                ${tx.type === 'BUY' ? 'bg-red-500/20 text-red-500' :
                                                    tx.type === 'SELL' ? 'bg-blue-500/20 text-blue-500' :
                                                        tx.type === 'DIVIDEND' ? 'bg-purple-500/20 text-purple-500' :
                                                            'bg-zinc-800 text-zinc-400'}`}>
                                                {tx.type}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-zinc-300">{tx.ticker || '-'}</div>
                                            {tx.quantity ? <div className="text-xs text-zinc-500">{tx.quantity} shares @ {tx.price}</div> : null}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-zinc-300">
                                            {tx.currency === 'KRW' ? '₩' : '$'}{tx.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-400">
                                            {accountMap.get(tx.accountId)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                                    onClick={() => setEditingTransaction(tx)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
                                                    onClick={() => handleDelete(tx.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </motion.tr>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 p-1">
                        {filteredTransactions?.map((tx, index) => (
                            <motion.div
                                key={tx.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 active:bg-zinc-800/50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <div className="text-xs text-zinc-500 mb-1">{tx.date}</div>
                                        <div className="font-bold text-zinc-200 text-lg">{tx.ticker || 'CASH'}</div>
                                        <div className="text-xs text-zinc-400">{accountMap.get(tx.accountId)}</div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold mb-1
                                            ${tx.type === 'BUY' ? 'bg-red-500/20 text-red-500' :
                                                tx.type === 'SELL' ? 'bg-blue-500/20 text-blue-500' :
                                                    tx.type === 'DIVIDEND' ? 'bg-purple-500/20 text-purple-500' :
                                                        'bg-zinc-800 text-zinc-400'}`}>
                                            {tx.type}
                                        </span>
                                        <div className="font-mono text-zinc-200 font-medium">
                                            {tx.currency === 'KRW' ? '₩' : '$'}{tx.amount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800/50">
                                    <div className="text-xs text-zinc-500 truncate max-w-[150px]">
                                        {tx.memo}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                            onClick={() => setEditingTransaction(tx)}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
                                            onClick={() => handleDelete(tx.id!)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Edit Logic using AddTransactionDialog in controlled mode */}
                {editingTransaction && (
                    <AddTransactionDialog
                        open={true}
                        onOpenChange={(open) => {
                            if (!open) setEditingTransaction(null);
                        }}
                        transactionToEdit={editingTransaction}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
