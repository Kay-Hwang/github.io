const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const tickers = ['SCHD', 'AAPL', '005930.KS'];
const baseUrl = 'https://finance.yahoo.com/quote/';

const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

async function fetchDividendData(ticker) {
  try {
    const url = `${baseUrl}${ticker}`;
    console.log(`Fetching ${ticker} from ${url}...`);
    const { data } = await axios.get(url, config);
    const $ = cheerio.load(data);

    // Initial selectors (Yahoo Finance changes classes frequently, using data-test attributes or text search is safer)
    // Yahoo struct: <td data-test="DIVIDEND_AND_YIELD-value">3.45 (4.23%)</td>
    
    let dividendYield = 'N/A';
    let forwardDividend = 'N/A';
    let exDivDate = 'N/A';
    let peRatio = 'N/A';
    let price = 'N/A';

    // Summary Tab Parsing
    // Price
    const priceText = $('fin-streamer[data-field="regularMarketPrice"]').text();
    price = priceText || $('fin-streamer[data-field="regularMarketPrice"]').attr('value') || 'N/A';

    // Dividend & Yield
    // Look for row with "Forward Dividend & Yield"
    // The label is usually in a td with class "C($primaryColor) W(51%)" and value in "Ta(end) Fw(600) Lh(14px)"
    // Or data-test attributes.
    
    // Attempt 1: data-test
    const divYieldText = $('[data-test="DIVIDEND_AND_YIELD-value"]').text(); 
    // Format: "2.64 (3.45%)"
    if (divYieldText) {
        const parts = divYieldText.split('(');
        if (parts.length > 1) {
            forwardDividend = parts[0].trim();
            dividendYield = parts[1].replace(')', '').trim();
        } else {
             // Sometimes just N/A
             forwardDividend = divYieldText;
        }
    }

    // Ex-Dividend Date
    exDivDate = $('[data-test="EX_DIVIDEND_DATE-value"]').text();

    // PE Ratio (TTM)
    peRatio = $('[data-test="PE_RATIO-value"]').text();

    // For better reliability on "Statistics" tab (Payout Ratio), we perform a second fetch if needed, 
    // but for now let's stick to summary or infer. Payout Ratio is often in "Statistics".
    // https://finance.yahoo.com/quote/SCHD/key-statistics
    
    let payoutRatio = 'N/A';
    let growRate5Y = 'N/A';

    // Try fetching stats page for detailed info
    try {
        const statsUrl = `${baseUrl}${ticker}/key-statistics`;
        const statsRes = await axios.get(statsUrl, config);
        const $stats = cheerio.load(statsRes.data);
         
        // Helper to find value by label text
        const findStat = (label) => {
            // Find td with text, then get next td
            // Matches text exactly or contains
            return $stats(`td:contains("${label}")`).next().text();
        };

        payoutRatio = findStat('Payout Ratio');
        growRate5Y = findStat('5 Year Average Dividend Yield'); // This isn't growth rate, but yield. 
        // Growth rate is harder to find on main page. Can be calculated from history or scraped from Analysis.
    } catch (e) {
        console.log(`Could not fetch stats for ${ticker}: ${e.message}`);
    }

    return {
      symbol: ticker,
      price: price,
      dividend: {
        forward: forwardDividend,
        yield: dividendYield,
        exDate: exDivDate,
        payoutRatio: payoutRatio,
        avgYield5Y: growRate5Y
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error.message);
    return { symbol: ticker, error: error.message };
  }
}

async function main() {
  const results = [];
  for (const ticker of tickers) {
    const data = await fetchDividendData(ticker);
    results.push(data);
    // Be nice to the server
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync('dividend_data.json', JSON.stringify(results, null, 2));
}

main();
