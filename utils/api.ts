
// Proxies to bypass CORS restrictions
// We add a random timestamp to the proxy URL itself where possible to prevent edge caching
const PROXY_PROVIDERS = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// --- Strategy 1: TWSE MIS (Official Taiwan Stock Exchange) ---
const TWSE_BASE_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';

const getTwseKey = (code: string): string => {
  // Heuristic: Bond ETFs (ending in 'B') are usually on TPEX (OTC)
  // Standard Equity ETFs are usually on TWSE (TSE)
  if (code.endsWith('B')) {
    return `otc_${code}.tw`;
  }
  return `tse_${code}.tw`;
};

const fetchFromTwse = async (codes: string[]): Promise<Record<string, number>> => {
  const keys = codes.map(getTwseKey).join('|');
  // Add timestamp to prevent caching at the source
  const timestamp = Date.now();
  const targetUrl = `${TWSE_BASE_URL}?ex_ch=${keys}&json=1&delay=0&_=${timestamp}`;
  
  // Try proxies for TWSE
  for (const createProxyUrl of PROXY_PROVIDERS) {
    try {
      // Create proxy URL
      let proxyUrl = createProxyUrl(targetUrl);
      
      // Add a dummy parameter to the proxy URL itself to bust proxy-level caches
      // (Append differently depending on if query string exists in proxy structure)
      if (proxyUrl.includes('?')) {
        proxyUrl += `&cb=${timestamp}`;
      } else {
        proxyUrl += `?cb=${timestamp}`;
      }

      const response = await fetch(proxyUrl);
      if (!response.ok) continue;

      const data = await response.json();
      const result: Record<string, number> = {};

      if (data.msgArray && Array.isArray(data.msgArray)) {
        data.msgArray.forEach((item: any) => {
          const code = item.c; // Stock code
          
          // Price Priority:
          // 1. z: Last Trade Price (成交價)
          // 2. b: Best Bid Price (買進價 - split by '_', take first)
          // 3. a: Best Ask Price (賣出價 - split by '_', take first)
          // 4. y: Yesterday's Close (昨收)
          
          let priceStr = item.z;
          
          // If no last trade, try Best Bid (conservative valuation)
          if (!priceStr || priceStr === '-') {
             const bids = item.b ? item.b.split('_') : [];
             if (bids.length > 0 && bids[0] && bids[0] !== '-') {
                 priceStr = bids[0];
             }
          }

          // If still nothing, try Best Ask
          if (!priceStr || priceStr === '-') {
             const asks = item.a ? item.a.split('_') : [];
             if (asks.length > 0 && asks[0] && asks[0] !== '-') {
                 priceStr = asks[0];
             }
          }
          
          // Last resort: Yesterday's Close
          if (!priceStr || priceStr === '-') {
              priceStr = item.y;
          }

          const price = parseFloat(priceStr);

          if (!isNaN(price) && price > 0) {
            result[code] = price;
          }
        });
      }

      if (Object.keys(result).length > 0) {
        return result;
      }
    } catch (e) {
      console.warn('TWSE proxy attempt failed:', e);
    }
  }
  throw new Error('TWSE MIS fetch failed');
};

// --- Strategy 2: Yahoo Finance (Fallback) ---
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/quote';

const getYahooSymbol = (code: string): string => {
  if (code.endsWith('B')) {
    return `${code}.TWO`;
  }
  return `${code}.TW`;
};

const fetchFromYahoo = async (codes: string[]): Promise<Record<string, number>> => {
  const symbols = codes.map(getYahooSymbol).join(',');
  const targetUrl = `${YAHOO_BASE_URL}?symbols=${symbols}`;

  for (const createProxyUrl of PROXY_PROVIDERS) {
    try {
      const response = await fetch(createProxyUrl(targetUrl));
      if (!response.ok) continue;

      const data = await response.json();
      const result: Record<string, number> = {};

      if (data.quoteResponse && data.quoteResponse.result) {
        data.quoteResponse.result.forEach((item: any) => {
          const code = item.symbol.split('.')[0];
          // Use regularMarketPrice (Realtime-ish/Delayed)
          const price = item.regularMarketPrice || item.previousClose;
          if (price) {
            result[code] = price;
          }
        });
      }

      if (Object.keys(result).length > 0) {
        return result;
      }
    } catch (e) {
      console.warn('Yahoo proxy attempt failed:', e);
    }
  }
  throw new Error('Yahoo Finance fetch failed');
};

// --- Main Export ---
export const fetchLivePrices = async (codes: string[]): Promise<Record<string, number>> => {
  // 1. Try TWSE MIS first (More reliable for TW stocks)
  try {
    const prices = await fetchFromTwse(codes);
    console.log('Updated prices from TWSE:', prices);
    return prices;
  } catch (error) {
    console.warn('Primary source (TWSE) failed, trying fallback...', error);
  }

  // 2. Try Yahoo Finance as backup
  try {
    const prices = await fetchFromYahoo(codes);
    console.log('Updated prices from Yahoo:', prices);
    return prices;
  } catch (error) {
    console.error('All price fetch strategies failed', error);
    throw new Error('無法連線至報價服務 (TWSE & Yahoo failed)');
  }
};
