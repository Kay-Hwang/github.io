import { db } from './db';

export const StockPriceService = {
    async fetchPrice(ticker: string): Promise<{ price: number; dailyChange: number; currency: string; name?: string } | null> {
        try {
            const targetUrl = `/api/price?ticker=${encodeURIComponent(ticker)}`;
            const response = await fetch(targetUrl);

            if (!response.ok) {
                console.warn(`Failed to fetch price for ${ticker}: ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            return {
                price: data.price,
                dailyChange: data.dailyChange,
                currency: data.currency,
                name: data.name
            };
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error);
            return null;
        }
    },

    async fetchExchangeRate(): Promise<number> {
        try {
            // Fetch USD/KRW exchange rate using allorigins directly since we removed fetchWithProxy
            const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
            const targetUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${YAHOO_QUOTE_URL}?symbols=KRW=X`)}`;
            const response = await fetch(targetUrl);

            if (!response.ok) {
                console.warn(`Failed to fetch exchange rate: ${response.statusText}`);
                return 1300; // Fallback default
            }

            const data = await response.json();
            const result = data.quoteResponse?.result?.[0];

            if (result && result.regularMarketPrice) {
                return result.regularMarketPrice;
            }
            return 1300;
        } catch (error) {
            console.error('Error fetching exchange rate:', error);
            return 1300;
        }
    },

    async updateAssetPrices() {
        const assets = await db.assets.toArray();
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        // Collect all tickers to fetch in batch? 
        // Yahoo Quote API supports multiple symbols: ?symbols=AAPL,TSLA,005930.KS
        // This would be much more efficient.
        // Let's filter assets that need update first.

        const assetsToUpdate = assets.filter(asset => {
            // Skip non-trackable
            if (asset.assetType === 'RP' || asset.assetType === 'OTHER') return false;
            // Skip if updated recently
            if (asset.lastUpdated && (now - asset.lastUpdated < ONE_HOUR)) return false;
            return true;
        });

        if (assetsToUpdate.length === 0) return;

        // Prepare tickers (chunking might be needed if too many, say 20 at a time)
        const CHUNK_SIZE = 20;
        for (let i = 0; i < assetsToUpdate.length; i += CHUNK_SIZE) {
            const chunk = assetsToUpdate.slice(i, i + CHUNK_SIZE);
            try {
                // Fetch all in parallel for this chunk
                const fetchPromises = chunk.map(asset =>
                    StockPriceService.fetchPrice(asset.ticker).then(data => ({ ticker: asset.ticker, data }))
                );

                const results = await Promise.all(fetchPromises);

                for (const result of results) {
                    if (result.data) {
                        await db.assets.update(result.ticker, {
                            currentPrice: result.data.price,
                            dailyChange: result.data.dailyChange || 0,
                            lastUpdated: now,
                        });
                        console.log(`Updated price for ${result.ticker}: ${result.data.price}`);
                    }
                }
            } catch (error) {
                console.error("Batch update failed for chunk", chunk.map(a => a.ticker), error);
            }
        }
    },

    async refreshAllAssetNames() {
        // Force refresh all assets regardless of lastUpdated
        const assets = await db.assets.toArray();
        if (assets.length === 0) return;

        // Prepare chunks
        const CHUNK_SIZE = 20;
        for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
            const chunk = assets.slice(i, i + CHUNK_SIZE);
            try {
                // Fetch all in parallel for this chunk
                const fetchPromises = chunk.map(asset =>
                    StockPriceService.fetchPrice(asset.ticker).then(data => ({ ticker: asset.ticker, data }))
                );

                const results = await Promise.all(fetchPromises);

                for (const result of results) {
                    if (result.data && result.data.name) {
                        console.log(`Refreshing ${result.ticker} -> Name: ${result.data.name}, Price: ${result.data.price}`);
                        await db.assets.update(result.ticker, {
                            name: result.data.name,
                            currentPrice: result.data.price || 0,
                            dailyChange: result.data.dailyChange || 0,
                            lastUpdated: Date.now()
                        });
                    } else {
                        console.warn(`Refresh failed for ${result.ticker}`);
                    }
                }
            } catch (error) {
                console.error("Batch name refresh failed", error);
            }
        }
    }
};
