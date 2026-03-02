export interface Account {
    id?: number;
    name: string;
    type: 'ISA' | 'Pension' | 'Normal';
    currency: 'KRW' | 'USD';
}

export type AssetType = 'STOCK' | 'ETF' | 'RP' | 'CRYPTO' | 'GOLD' | 'OTHER';

export interface Asset {
    ticker: string;
    name: string;
    sector: string;
    assetType?: AssetType; // Optional for backward compatibility, default to STOCK
    currentPrice: number;
    currency: 'KRW' | 'USD';
    dailyChange?: number;
    dividendYield?: number;
    lastUpdated?: number; // timestamp
}

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAW' | 'INTEREST';

export interface Transaction {
    id?: number;
    date: string; // ISO string 'YYYY-MM-DD'
    type: TransactionType;
    ticker?: string; // Optional for cash transactions
    quantity?: number; // Quantity for stocks
    price?: number; // Price per share or Amount for cash
    tax?: number; // Taxes and fees
    amount: number; // Total transaction value
    currency: 'KRW' | 'USD';
    exchangeRate: number; // KRW/USD at time of transaction
    accountId: number;
    memo?: string;
}
