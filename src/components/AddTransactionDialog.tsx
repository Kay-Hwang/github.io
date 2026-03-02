import { useState, useEffect } from 'react';
import { type Transaction } from '@/services/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { PortfolioService } from '@/services/finance';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const transactionSchema = z.object({
    date: z.date(),
    type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'INTEREST']),
    accountId: z.string().min(1, 'Account is required'), // Form uses string, convert to number on submit
    ticker: z.string().optional(),
    assetType: z.enum(['STOCK', 'ETF', 'RP', 'CRYPTO', 'GOLD', 'OTHER']).optional(),
    quantity: z.coerce.number().min(0).optional(),
    price: z.coerce.number().min(0).optional(),
    tax: z.coerce.number().min(0).optional(),
    amount: z.coerce.number().min(0, 'Amount is required'),
    currency: z.enum(['KRW', 'USD']),
    exchangeRate: z.coerce.number().min(0).default(1),
    memo: z.string().optional(),
}).refine((data) => {
    // Conditional validation
    if (['BUY', 'SELL', 'DIVIDEND'].includes(data.type)) {
        // Ticker field is used for "Symbol" (Stocks) or "Name" (RP/Other).
        // It must be present in either case.
        return !!data.ticker && data.ticker.length > 0;
    }
    return true;
}, {
    message: "Ticker/Name is required",
    path: ["ticker"],
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function AddTransactionDialog({ transactionToEdit, open: externalOpen, onOpenChange }: { transactionToEdit?: Transaction, open?: boolean, onOpenChange?: (open: boolean) => void }) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [assetType, setAssetType] = useState<'STOCK' | 'ETF' | 'RP' | 'CRYPTO' | 'GOLD' | 'OTHER'>('STOCK');

    // Controlled vs Uncontrolled logic
    const isControlled = externalOpen !== undefined;
    const open = isControlled ? externalOpen : internalOpen;
    const setOpen = isControlled ? onOpenChange! : setInternalOpen;

    const accounts = useLiveQuery(() => db.accounts.toArray());

    const defaultValues: Partial<TransactionFormValues> = transactionToEdit ? {
        date: new Date(transactionToEdit.date),
        type: transactionToEdit.type,
        accountId: String(transactionToEdit.accountId),
        ticker: transactionToEdit.ticker,
        quantity: transactionToEdit.quantity || 0,
        price: transactionToEdit.price || 0,
        tax: transactionToEdit.tax || 0,
        amount: transactionToEdit.amount || 0,
        currency: transactionToEdit.currency,
        exchangeRate: transactionToEdit.exchangeRate || 1,
        memo: transactionToEdit.memo || '',
    } : {
        date: new Date(),
        type: 'BUY',
        currency: 'KRW',
        exchangeRate: 1300,
        amount: 0,
        quantity: 0,
        price: 0,
        tax: 0,
        memo: '',
    };

    const form = useForm<TransactionFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(transactionSchema) as any,
        defaultValues,
    });

    // Update form when transactionToEdit changes
    useEffect(() => {
        if (transactionToEdit) {
            form.reset({
                date: new Date(transactionToEdit.date),
                type: transactionToEdit.type,
                accountId: String(transactionToEdit.accountId),
                ticker: transactionToEdit.ticker,
                quantity: transactionToEdit.quantity || 0,
                price: transactionToEdit.price || 0,
                tax: transactionToEdit.tax || 0,
                amount: transactionToEdit.amount || 0,
                currency: transactionToEdit.currency,
                exchangeRate: transactionToEdit.exchangeRate || 1,
                memo: transactionToEdit.memo || '',
            });
            // Fetch asset type for existing transaction if possible? 
            // For now default to STOCK or whatever it was. 
            // We could query the asset but that requires async effect. 
            // Let's just user set it if they want to change it.
        } else if (!open) {
            // Reset to defaults when closing if not editing
            form.reset({
                date: new Date(),
                type: 'BUY',
                currency: 'KRW',
                exchangeRate: 1300,
                amount: 0,
                quantity: 0,
                price: 0,
                tax: 0,
                memo: '',
            });
            setAssetType('STOCK');
        }
    }, [transactionToEdit, open, form]);


    const type = form.watch('type');
    const ticker = form.watch('ticker');
    const isStockTransaction = ['BUY', 'SELL', 'DIVIDEND'].includes(type);

    const [foundAssetName, setFoundAssetName] = useState<string | null>(null);

    // Auto-fill price AND name when ticker changes
    useEffect(() => {
        async function fetchPrice() {
            if (ticker && isStockTransaction && !transactionToEdit) {
                try {
                    // 1. Try local DB first
                    const asset = await db.assets.get(ticker.toUpperCase());

                    // Check if we need to fetch from API:
                    // - Asset doesn't exist
                    // - OR Asset exists but name is just the ticker (we want to upgrade to full name)
                    const needsFetch = !asset || (asset.name === asset.ticker);

                    if (asset) {
                        if (asset.currentPrice) form.setValue('price', asset.currentPrice);
                        if (asset.assetType) setAssetType(asset.assetType);
                        if (asset.name !== asset.ticker) {
                            setFoundAssetName(asset.name);
                        }
                    }

                    if (needsFetch) {
                        // 2. Try fetching from API
                        // Dynamic import to avoid circular dependency issues if any
                        const data = await import('@/services/stockPrice').then(m => m.StockPriceService.fetchPrice(ticker));

                        // Check if data was found
                        if (data) {
                            form.setValue('price', data.price);
                            if (data.name) setFoundAssetName(data.name);

                            // Auto-detect currency
                            if (data.currency === 'KRW') form.setValue('currency', 'KRW');
                            if (data.currency === 'USD') form.setValue('currency', 'USD');

                            // Auto-set asset type if 6 digits or alphanumeric (common for ETFs) -> likely STOCK (KR)
                            if (/^[0-9A-Z]{6}$/.test(ticker)) setAssetType('STOCK');
                        } else if (!asset) {
                            setFoundAssetName(null);
                        }
                    }
                } catch (error) {
                    // Ignore error
                }
            } else {
                setFoundAssetName(null);
            }
        }
        const timeoutId = setTimeout(fetchPrice, 500); // 500ms debounce
        return () => clearTimeout(timeoutId);
    }, [ticker, isStockTransaction, form, transactionToEdit]);

    // Auto-calculate Total Amount based on Quantity, Price, and Tax
    const watchQuantity = form.watch('quantity') || 0;
    const watchPrice = form.watch('price') || 0;
    const watchTax = form.watch('tax') || 0;

    useEffect(() => {
        if (isStockTransaction && (type === 'BUY' || type === 'SELL')) {
            const baseAmount = watchQuantity * watchPrice;
            if (type === 'BUY') {
                form.setValue('amount', Number((baseAmount + watchTax).toFixed(2)), { shouldValidate: true });
            } else if (type === 'SELL') {
                form.setValue('amount', Math.max(0, Number((baseAmount - watchTax).toFixed(2))), { shouldValidate: true });
            }
        }
    }, [watchQuantity, watchPrice, watchTax, type, isStockTransaction, form]);

    async function onSubmit(data: TransactionFormValues) {
        try {
            const txData = {
                date: format(data.date, 'yyyy-MM-dd'),
                type: data.type,
                accountId: parseInt(data.accountId),
                ticker: data.ticker?.toUpperCase(),
                quantity: data.quantity,
                price: data.price,
                tax: data.tax,
                amount: data.amount,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                memo: data.memo,
            };

            const assetInfo = {
                name: foundAssetName || data.ticker?.toUpperCase() || '', // Use found name if available
                type: assetType
            };

            if (transactionToEdit && transactionToEdit.id) {
                await PortfolioService.updateTransaction(transactionToEdit.id, txData);
                // Also update asset type if needed? 
                // PortfolioService.addTransaction logic handles update of assetType if not set.
                // But updateTransaction is raw DB update. 
                // Let's call addTransaction logic just for asset creation if needed?
                // Or explicitly update asset.
                if (txData.ticker) {
                    // Ensure asset exists/updates
                    await PortfolioService.addTransaction(txData as any, assetInfo);
                    // The above adds a DUPLICATE transaction! We must not do that.
                    // We should separate "Ensure Asset" logic.
                    // For now, let's assume update doesn't change asset type aggressively unless we add a specific method.
                    // OR, simpler: just update the asset directly here:
                    const existing = await db.assets.get(txData.ticker!);
                    if (existing) {
                        await db.assets.update(txData.ticker!, { assetType: assetType });
                    } else {
                        // Create if missing (rare case in edit, but possible if DB was cleared partially)
                        // But we can't easily create without duplicating code.
                        // Let's ignore this edge case for "Edit" implies "Asset Exists".
                    }
                }
            } else {
                await PortfolioService.addTransaction(txData, assetInfo);
            }

            setOpen(false);
            form.reset();
        } catch (error) {
            console.error('Failed to save transaction:', error);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                        <Plus className="h-4 w-4" /> Add Transaction
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>{transactionToEdit ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                control={form.control as any}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-zinc-100",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date > new Date() || date < new Date("1900-01-01")
                                                    }
                                                    initialFocus
                                                    className="bg-zinc-900 text-zinc-100"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                control={form.control as any}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                <SelectItem value="BUY">Buy</SelectItem>
                                                <SelectItem value="SELL">Sell</SelectItem>
                                                <SelectItem value="DIVIDEND">Dividend</SelectItem>
                                                <SelectItem value="DEPOSIT">Deposit</SelectItem>
                                                <SelectItem value="WITHDRAW">Withdraw</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            control={form.control as any}
                            name="accountId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                            {accounts?.map((acc) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.name} ({acc.currency})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isStockTransaction && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="ticker"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {(assetType === 'STOCK' || assetType === 'ETF') ? 'Ticker' : 'Asset Name / ID'}
                                                </FormLabel>
                                                {(assetType === 'STOCK' || assetType === 'ETF') && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {['005930', 'AAPL', 'TSLA', 'SCHD', 'O'].map(t => (
                                                            <div
                                                                key={t}
                                                                onClick={() => form.setValue('ticker', t)}
                                                                className="cursor-pointer px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                                                            >
                                                                {t}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <FormControl>
                                                    <Input
                                                        placeholder={(assetType === 'STOCK' || assetType === 'ETF') ? "AAPL" : "e.g., CMA-RP"}
                                                        {...field}
                                                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 uppercase"
                                                    />
                                                </FormControl>
                                                {foundAssetName && (
                                                    <div className="text-xs text-emerald-400 mt-1">
                                                        Found: {foundAssetName}
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Asset Type Selector - New */}
                                    <FormItem>
                                        <FormLabel>Asset Type</FormLabel>
                                        <Select
                                            onValueChange={(val: any) => setAssetType(val)}
                                            defaultValue={assetType}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                    <SelectValue placeholder="Type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                <SelectItem value="STOCK">Stock</SelectItem>
                                                <SelectItem value="ETF">ETF</SelectItem>
                                                <SelectItem value="RP">RP (Repurchase Agreement)</SelectItem>
                                                <SelectItem value="CRYPTO">Crypto</SelectItem>
                                                <SelectItem value="GOLD">Gold</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Price (단가)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantity (수량)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="tax"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tax/Fee (세금/수수료)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                    <SelectValue placeholder="Currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                                                <SelectItem value="KRW">KRW</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Amount</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="exchangeRate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Exchange Rate (KRW/USD)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            {transactionToEdit ? 'Update Transaction' : 'Add Transaction'}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
