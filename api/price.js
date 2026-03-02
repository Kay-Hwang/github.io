export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const uppercaseTicker = ticker.toUpperCase();
        const isKoreanStock = /^[0-9A-Z]{6}$/.test(uppercaseTicker);

        let price = 0;
        let name = '';
        let dailyChange = 0;
        let currency = 'USD';

        if (isKoreanStock) {
            // Use Naver Finance polling API for Korean stocks
            const targetUrl = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${uppercaseTicker}`;
            const https = await import('https');
            const iconv = await import('iconv-lite');

            const data = await new Promise((resolve, reject) => {
                https.get(targetUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                }, (res) => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Naver API failed: ${res.statusCode}`));
                    }
                    const chunks = [];
                    res.on('data', d => chunks.push(d));
                    res.on('end', () => {
                        try {
                            const text = iconv.decode(Buffer.concat(chunks), 'euc-kr');
                            resolve(JSON.parse(text));
                        } catch (e) {
                            reject(new Error('Failed to parse Naver API response'));
                        }
                    });
                }).on('error', reject);
            });

            const item = data.result?.areas?.[0]?.datas?.[0];

            if (item) {
                price = item.nv; // Current price
                dailyChange = item.cr; // Change rate (percentage)
                name = item.nm; // Name
                currency = 'KRW';
            } else {
                return res.status(404).json({ error: 'Stock not found on Naver' });
            }
        } else {
            // Use Yahoo Finance Chart API for US stocks / ETFs
            const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${uppercaseTicker}`;
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`Yahoo API failed: ${response.status}`);
            }

            const data = await response.json();
            const result = data.chart?.result?.[0];

            if (result && result.meta) {
                price = result.meta.regularMarketPrice;
                // Calculate daily change manually if not provided directly in meta
                const prevClose = result.meta.chartPreviousClose;
                if (price && prevClose) {
                    dailyChange = ((price - prevClose) / prevClose) * 100;
                }
                currency = result.meta.currency || 'USD';
                name = result.meta.longName || result.meta.shortName || result.meta.symbol;
            } else {
                return res.status(404).json({ error: 'Stock not found on Yahoo' });
            }
        }

        return res.status(200).json({
            ticker: uppercaseTicker,
            price,
            dailyChange,
            name,
            currency
        });
    } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
        return res.status(500).json({ error: 'Failed to fetch price data', details: error.message });
    }
}
