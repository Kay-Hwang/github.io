import { db } from './db';
import { StockPriceService } from './stockPrice';
import type { Transaction } from './types';


export interface Holding {
    ticker: string;
    quantity: number;
    averagePrice: number;
    totalCost: number;
    currentPrice?: number;
    currentValue?: number;
    dailyChange?: number;
    currency: 'KRW' | 'USD';
    accountId?: number;
    name: string; // Asset name
    // Normalized values for aggregation
    totalCostKRW?: number;
    currentValueKRW?: number;
}

export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    totalDividend: number;
    holdings: Holding[];
}

export class PortfolioService {

    // Add a transaction and ensure the asset exists in the DB
    static async addTransaction(transaction: Omit<Transaction, 'id'>, assetInfo?: { name: string, type: 'STOCK' | 'ETF' | 'RP' | 'CRYPTO' | 'GOLD' | 'OTHER' }) {
        await db.transaction('rw', db.transactions, db.assets, async () => {
            await db.transactions.add(transaction);

            // If it's an asset transaction, ensure asset exists
            if (transaction.ticker && ['BUY', 'SELL', 'DIVIDEND', 'INTEREST'].includes(transaction.type)) {
                const existingAsset = await db.assets.get(transaction.ticker);

                if (!existingAsset) {
                    // Create new asset
                    await db.assets.add({
                        ticker: transaction.ticker,
                        name: assetInfo?.name || transaction.ticker,
                        assetType: assetInfo?.type || 'STOCK',
                        sector: assetInfo?.type === 'ETF' ? 'ETF' : 'Unknown',
                        currentPrice: transaction.price || 0, // Initial price estimate
                        currency: transaction.currency,
                        dividendYield: 0,
                        lastUpdated: 0 // Force update next time unless it's RP
                    });

                    // Trigger immediate fetch in background ONLY if it's a trackable asset
                    if (assetInfo?.type !== 'RP' && assetInfo?.type !== 'OTHER') {
                        // We assume StockPriceService is available globally or imported. 
                        // To avoid circular deps if they exist, we might skip this or use dynamic import if needed.
                        // But usually in service plain TS files we can import.
                        // Assuming StockPriceService will pick it up on next updateAssetPrices pass or we can trigger it.
                        // For now, let's leave the heavy lifting to updateAssetPrices or the UI's pre-fetch.
                    }
                } else {
                    // Update existing asset
                    const updates: any = {};

                    // 1. Migration: Set assetType if missing
                    if (!existingAsset.assetType && assetInfo?.type) {
                        updates.assetType = assetInfo.type;
                    }

                    // 2. Name Upgrade: If existing name is just the ticker (placeholder), and we have a better name
                    if (existingAsset.name === existingAsset.ticker && assetInfo?.name && assetInfo.name !== existingAsset.ticker) {
                        updates.name = assetInfo.name;
                    }

                    if (Object.keys(updates).length > 0) {
                        await db.assets.update(transaction.ticker, updates);
                    }
                }
            }
        });
    }

    static async updateTransaction(id: number, transaction: Partial<Transaction>) {
        await db.transactions.update(id, transaction);
    }

    static async deleteTransaction(id: number) {
        await db.transactions.delete(id);
    }

    // --- Account Management ---

    static async addAccount(account: { name: string; type: 'ISA' | 'Normal' | 'Pension'; currency: 'KRW' | 'USD' }) {
        return await db.accounts.add(account);
    }

    static async deleteAccount(id: number) {
        return await db.transaction('rw', db.accounts, db.transactions, async () => {
            await db.accounts.delete(id);
            // Delete all transactions associated with this account to prevent orphans
            await db.transactions.where('accountId').equals(id).delete();
        });
    }

    static async updatePrices() {
        await StockPriceService.updateAssetPrices();
    }

    static async refreshAllAssetNames() {
        await StockPriceService.refreshAllAssetNames();
    }

    // Calculate current holdings based on transaction history
    static async calculateHoldings(accountId?: number): Promise<Holding[]> {
        let transactions = await db.transactions.toArray();
        if (accountId) {
            transactions = transactions.filter(t => t.accountId === accountId);
        }

        const holdingsMap = new Map<string, Holding>();

        for (const tx of transactions) {
            if (!tx.ticker) continue;

            const key = tx.ticker;

            let holding = holdingsMap.get(key) || {
                ticker: tx.ticker,
                name: tx.ticker, // Default to ticker, will be updated from asset map later
                quantity: 0,
                averagePrice: 0,
                totalCost: 0,
                currency: tx.currency,
                accountId: accountId,
                totalCostKRW: 0 // Initialize KRW cost tracking
            };

            // Ensure totalCostKRW is initialized if retrieving existing holding without it
            if (holding.totalCostKRW === undefined) holding.totalCostKRW = 0;

            if (tx.type === 'BUY') {
                const newQuantity = holding.quantity + (tx.quantity || 0);
                const newCost = holding.totalCost + (tx.amount || 0); // Amount is total value of transaction

                // Track KRW Cost Basis using historical rate
                const txExchangeRate = tx.exchangeRate || 1;
                const costKRW = tx.amount * (tx.currency === 'USD' ? txExchangeRate : 1);
                const newCostKRW = (holding.totalCostKRW || 0) + costKRW;

                holding.quantity = newQuantity;
                holding.totalCost = newCost;
                holding.totalCostKRW = newCostKRW;
                holding.averagePrice = newQuantity > 0 ? newCost / newQuantity : 0;
            } else if (tx.type === 'SELL') {
                const newQuantity = holding.quantity - (tx.quantity || 0);
                // Reduce cost proportionally
                const costSold = (holding.averagePrice * (tx.quantity || 0));
                holding.totalCost -= costSold;

                // Reduce KRW cost proportionally
                if (holding.quantity > 0) {
                    const avgCostKRW = (holding.totalCostKRW || 0) / holding.quantity;
                    const soldQuantity = tx.quantity || 0;
                    const costSoldKRW = avgCostKRW * soldQuantity;
                    holding.totalCostKRW = (holding.totalCostKRW || 0) - costSoldKRW;
                }

                holding.quantity = Math.max(0, newQuantity);
            }

            holdingsMap.set(key, holding);
        }

        // Filter out zero quantity holdings
        const holdings = Array.from(holdingsMap.values()).filter(h => h.quantity > 0);

        // Fetch current prices (from Assets table)
        const assets = await db.assets.toArray();
        const assetMap = new Map(assets.map(a => [a.ticker, a]));
        const exchangeRate = await StockPriceService.fetchExchangeRate();

        return holdings.map(h => {
            const asset = assetMap.get(h.ticker);
            const currentPrice = asset?.currentPrice || 0;
            const currentValue = h.quantity * currentPrice;

            // Normalize to KRW
            // totalCostKRW is now historically tracked. Use it if available, fallback to current rate if somehow missing logic
            const totalCostKRW = h.totalCostKRW ?? (h.currency === 'USD' ? h.totalCost * exchangeRate : h.totalCost);

            // Current Value uses Current Exchange Rate
            const currentValueKRW = h.currency === 'USD' ? currentValue * exchangeRate : currentValue;

            return {
                ...h,
                name: asset?.name || h.ticker, // Use asset name if available
                currentPrice,
                dailyChange: asset?.dailyChange || 0,
                currentValue,
                totalCostKRW,
                currentValueKRW
            };
        });
    }

    static async getDividendHistory() {
        const transactions = await db.transactions.where('type').equals('DIVIDEND').toArray();
        const history: Record<number, any[]> = {};

        // Fetch asset yields for detail display
        const assets = await db.assets.toArray();
        const assetMap = new Map(assets.map(a => [a.ticker, a]));
        const exchangeRate = await StockPriceService.fetchExchangeRate();

        for (const tx of transactions) {
            const date = new Date(tx.date);
            const year = date.getFullYear();
            const month = date.toLocaleString('en-US', { month: 'short' });

            if (!history[year]) history[year] = [];

            // Calculate normalized amounts
            const amountKRW = tx.currency === 'USD' ? tx.amount * exchangeRate : tx.amount;

            // Find if month entry exists
            let monthEntry = history[year].find((m: any) => m.month === month);
            if (!monthEntry) {
                monthEntry = { month, amount: 0, amountKRW: 0, details: [] };
                history[year].push(monthEntry);
            }

            monthEntry.amount += tx.amount; // Mixed currency sum (legacy support)
            monthEntry.amountKRW += amountKRW; // Normalized sum

            const asset = assetMap.get(tx.ticker || '');
            monthEntry.details.push({
                id: tx.id || 0,
                date: tx.date,
                ticker: tx.ticker || '',
                name: asset ? asset.name : (tx.ticker || 'Unknown'),
                amount: tx.amount,
                currency: tx.currency, // Include currency
                yield: asset ? asset.dividendYield : 0
            });
        }

        // Sort details by date
        for (const year in history) {
            history[year].forEach((monthItem: any) => {
                monthItem.details.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            });
        }

        return history;
    }

    static async getAccountPerformance() {
        const accounts = await db.accounts.toArray();
        const transactions = await db.transactions.toArray();
        const currentExchangeRate = await StockPriceService.fetchExchangeRate();

        return Promise.all(accounts.map(async acc => {
            const accTx = transactions.filter(t => t.accountId === acc.id);

            // 1. Net Invested (In KRW)
            // We need to convert historical investments to KRW based on *historical* exchange rate?
            // OR we just take the input amount if the input was KRW.
            // If the account is USD, the deposits were likely USD. 
            // If the account is Normal (KRW), deposits are KRW.
            // Simple approach: normalize everything to KRW based on transaction-time exchange rate for historical cash flow?
            // Actually, for "Net Invested", we usually want the amount of money put IN.
            // If I put 1000 USD in 2020 (rate 1100) -> 1,100,000 KRW invested.
            // If I put 1000 USD in 2024 (rate 1350) -> 1,350,000 KRW invested.
            // So we should use the `exchangeRate` stored in the transaction.

            const deposits = accTx.filter(t => t.type === 'DEPOSIT').reduce((sum, t) => {
                const amountKRW = t.currency === 'KRW' ? t.amount : t.amount * (t.exchangeRate || 1300);
                return sum + amountKRW;
            }, 0);

            const withdrawals = accTx.filter(t => t.type === 'WITHDRAW').reduce((sum, t) => {
                const amountKRW = t.currency === 'KRW' ? t.amount : t.amount * (t.exchangeRate || 1300);
                return sum + amountKRW;
            }, 0);

            const netInvested = deposits - withdrawals;

            // 2. Current Cash Balance
            // We need to track cash balance in the Account's native currency.
            // Then convert total cash to KRW at current rate.

            let cashBalanceNative = 0;
            // Re-calculate cash flow carefully in account's native currency
            const accountCurrency = acc.currency;

            for (const t of accTx) {
                // If transaction currency matches account currency, add/sub directly
                // If not, we might need conversion (e.g. paying USD from KRW account? rare but possible)
                // For simplicity, assume transaction currency usually matches or is converted at explicit rate
                // But generally:
                // DEPOSIT/WITHDRAW = cash change
                // BUY = cash decrease
                // SELL = cash increase
                // DIVIDEND = cash increase

                let amountInAccCurrency = 0;

                if (t.currency === accountCurrency) {
                    amountInAccCurrency = t.amount;
                } else {
                    // Conversion needed. 
                    // e.g. Buy USD stock using KRW account -> Amount is in USD, need to subtract KRW equivalent
                    if (accountCurrency === 'KRW' && t.currency === 'USD') {
                        amountInAccCurrency = t.amount * (t.exchangeRate || currentExchangeRate);
                    } else if (accountCurrency === 'USD' && t.currency === 'KRW') {
                        amountInAccCurrency = t.amount / (t.exchangeRate || currentExchangeRate);
                    }
                }

                if (t.type === 'DEPOSIT' || t.type === 'SELL' || t.type === 'DIVIDEND' || t.type === 'INTEREST') {
                    cashBalanceNative += amountInAccCurrency;
                } else if (t.type === 'WITHDRAW' || t.type === 'BUY') {
                    cashBalanceNative -= amountInAccCurrency;
                }
            }

            const cashBalanceKRW = accountCurrency === 'KRW'
                ? cashBalanceNative
                : cashBalanceNative * currentExchangeRate;

            // 3. Current Holdings Value
            // CalculateHoldings returns value in Asset Currency.
            const accountHoldings = await this.calculateHoldings(acc.id);

            const holdingsValueKRW = accountHoldings.reduce((sum, h) => {
                const val = h.currentValue || 0;
                if (h.currency === 'USD') return sum + (val * currentExchangeRate);
                return sum + val;
            }, 0);

            const totalValue = cashBalanceKRW + holdingsValueKRW;

            // 4. ROI
            const gain = totalValue - netInvested;
            const cumulativeRoi = netInvested > 0 ? (gain / netInvested) * 100 : 0;

            // Current ROI (Holding based)
            // Total Holdings Value (KRW) vs Total Cost Basis (KRW)
            const totalCostBasisKRW = accountHoldings.reduce((sum, h) => {
                // Now we have accurate historical cost in KRW
                return sum + (h.totalCostKRW || 0);
            }, 0);

            const currentRoi = totalCostBasisKRW > 0 ? ((holdingsValueKRW - totalCostBasisKRW) / totalCostBasisKRW) * 100 : 0;

            return {
                id: acc.id,
                name: acc.name,
                netInvested: Math.round(netInvested), // KRW
                value: Math.round(totalValue), // KRW
                cumulativeRoi: parseFloat(cumulativeRoi.toFixed(2)),
                currentRoi: parseFloat(currentRoi.toFixed(2)),
                currency: 'KRW' // Normalized
            };
        }));
    }
}
