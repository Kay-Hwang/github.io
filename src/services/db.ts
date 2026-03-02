import Dexie, { type Table } from 'dexie';
import type { Account, Asset, Transaction } from './types';

export class AppDatabase extends Dexie {
    accounts!: Table<Account, number>;
    assets!: Table<Asset, string>;
    transactions!: Table<Transaction, number>;

    constructor() {
        super('AssetManagerDB');
        this.version(1).stores({
            accounts: '++id, name, type',
            assets: 'ticker, name, sector',
            transactions: '++id, date, type, ticker, accountId'
        });
    }
}

export const db = new AppDatabase();

export async function seedDatabase() {
    if (localStorage.getItem('hasSeeded') === 'true') return;

    const accountCount = await db.accounts.count();
    if (accountCount > 0) return; // Already seeded

    // 1. Seed Accounts
    const accountId1 = await db.accounts.add({
        name: '키움증권 (ISA)',
        type: 'ISA',
        currency: 'KRW'
    });
    const accountId2 = await db.accounts.add({
        name: '토스증권',
        type: 'Normal',
        currency: 'KRW'
    });
    const accountId3 = await db.accounts.add({
        name: '연금저축',
        type: 'Pension',
        currency: 'KRW'
    });

    // 2. Seed Assets
    await db.assets.bulkAdd([
        { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', sector: 'ETF', currentPrice: 78.50, currency: 'USD', dividendYield: 3.45 },
        { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', currentPrice: 185.00, currency: 'USD', dividendYield: 0.55 },
        { ticker: '005930', name: '삼성전자', sector: 'Technology', currentPrice: 72000, currency: 'KRW', dividendYield: 2.1 },
        { ticker: 'O', name: 'Realty Income Corp', sector: 'Real Estate', currentPrice: 55.20, currency: 'USD', dividendYield: 5.2 }
    ]);

    // 3. Seed Transactions (History)
    const transactions: Transaction[] = [
        // Initial Deposits
        { date: '2023-01-01', type: 'DEPOSIT', amount: 30000000, currency: 'KRW', exchangeRate: 1250, accountId: accountId1, memo: 'Initial Capital' },
        { date: '2023-01-15', type: 'DEPOSIT', amount: 50000000, currency: 'KRW', exchangeRate: 1250, accountId: accountId3, memo: 'Pension Contribution' },

        // Buy SCHD
        { date: '2023-02-01', type: 'BUY', ticker: 'SCHD', quantity: 100, price: 72.50, amount: 7250, currency: 'USD', exchangeRate: 1260, accountId: accountId1 },
        { date: '2023-03-01', type: 'BUY', ticker: 'SCHD', quantity: 50, price: 73.00, amount: 3650, currency: 'USD', exchangeRate: 1270, accountId: accountId1 },

        // Buy AAPL
        { date: '2023-02-10', type: 'BUY', ticker: 'AAPL', quantity: 20, price: 150.00, amount: 3000, currency: 'USD', exchangeRate: 1265, accountId: accountId2 },

        // Buy Samsung
        { date: '2023-04-05', type: 'BUY', ticker: '005930', quantity: 200, price: 65000, amount: 13000000, currency: 'KRW', exchangeRate: 1, accountId: accountId3 },

        // Buy O
        { date: '2023-05-20', type: 'BUY', ticker: 'O', quantity: 150, price: 60.00, amount: 9000, currency: 'USD', exchangeRate: 1280, accountId: accountId1 },

        // Dividends (Sample History)
        { date: '2023-03-25', type: 'DIVIDEND', ticker: 'SCHD', amount: 55.20, currency: 'USD', exchangeRate: 1290, accountId: accountId1, memo: 'Q1 Dividend' },
        { date: '2023-06-25', type: 'DIVIDEND', ticker: 'SCHD', amount: 88.50, currency: 'USD', exchangeRate: 1300, accountId: accountId1, memo: 'Q2 Dividend' },
        { date: '2023-05-15', type: 'DIVIDEND', ticker: 'O', amount: 36.50, currency: 'USD', exchangeRate: 1295, accountId: accountId1, memo: 'May Dividend' },
    ];

    await db.transactions.bulkAdd(transactions);
    localStorage.setItem('hasSeeded', 'true');
    console.log("Database seeded successfully");
}

export async function exportDatabase(): Promise<string> {
    const data = {
        accounts: await db.accounts.toArray(),
        assets: await db.assets.toArray(),
        transactions: await db.transactions.toArray()
    };
    return JSON.stringify(data);
}

export async function importDatabase(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);
    if (!data.accounts || !data.assets || !data.transactions) {
        throw new Error('Invalid backup file format');
    }

    await db.transaction('rw', db.accounts, db.assets, db.transactions, async () => {
        // Clear existing data
        await db.accounts.clear();
        await db.assets.clear();
        await db.transactions.clear();

        // Restore new data
        if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
        if (data.assets.length > 0) await db.assets.bulkAdd(data.assets);
        if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
    });

    // Ensure seeding doesn't run again and overwrite the restored data
    localStorage.setItem('hasSeeded', 'true');
}
