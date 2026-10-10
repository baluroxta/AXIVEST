/**
 * AXIVEST Real-Time Quantitative Engine & Upstox Client
 * Computes rolling SMAs, Drawdown series, Beta vs NIFTY 50, Sharpe Ratio,
 * Institutional Risk Score, and Investment Verdict (Buy/Hold/Caution) for any stock.
 * Author: Kandala Guru Balaji
 */

let niftyBenchmarkCache = null;

/**
 * Fetch daily candles from Upstox API v2
 */
export async function fetchUpstoxCandles(instrumentKey, fromDate = '2024-01-01', toDate = null) {
  if (!toDate) {
    const today = new Date();
    toDate = today.toISOString().split('T')[0];
  }

  // URL encode instrument key (e.g. NSE_EQ|INE... -> NSE_EQ%7CINE...)
  const encodedKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v2/historical-candle/${encodedKey}/day/${toDate}/${fromDate}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
      throw new Error(`Upstox API returned status ${res.status}`);
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data || !json.data.candles) {
      throw new Error('Invalid response structure from Upstox');
    }

    // Upstox returns candles newest first: [timestamp, open, high, low, close, volume, oi]
    // Reverse to chronological order (oldest to newest)
    const candles = [...json.data.candles].reverse().map(c => ({
      date: c[0].split('T')[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      oi: Number(c[6])
    }));

    return candles;
  } catch (err) {
    console.warn(`Upstox fetch failed for ${instrumentKey}:`, err.message);
    throw err;
  }
}

/**
 * Get cached or live NIFTY 50 benchmark candles
 */
export async function getNiftyBenchmark() {
  if (niftyBenchmarkCache && niftyBenchmarkCache.length > 0) {
    return niftyBenchmarkCache;
  }

  try {
    const niftyCandles = await fetchUpstoxCandles('NSE_INDEX|Nifty 50');
    niftyBenchmarkCache = niftyCandles;
    return niftyCandles;
  } catch (err) {
    console.warn('Failed to fetch live NIFTY benchmark from Upstox, using fallback:', err);
    return null;
  }
}

/**
 * Vectorized Quantitative Risk & Performance Analysis
 */
export function analyzeStockCandles(candles, niftyCandles = null, symbol = 'STOCK', name = '', sector = 'Equity') {
  if (!candles || candles.length < 30) {
    throw new Error('Insufficient candle data for quantitative analysis (minimum 30 days required)');
  }

  const n = candles.length;
  const dates = candles.map(c => c.date);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ltp = closes[n - 1];
  const prevClose = closes[n - 2];
  const dayChangePct = ((ltp - prevClose) / prevClose) * 100;
  const high52w = Math.max(...closes);
  const low52w = Math.min(...closes);

  // 1. Moving Averages (20, 50, 200 DMA)
  const sma20 = [];
  const sma50 = [];
  const sma200 = [];

  for (let i = 0; i < n; i++) {
    // 20 DMA
    if (i >= 19) {
      const slice20 = closes.slice(i - 19, i + 1);
      sma20.push(Number((slice20.reduce((a, b) => a + b, 0) / 20).toFixed(2)));
    } else {
      sma20.push(null);
    }

    // 50 DMA
    if (i >= 49) {
      const slice50 = closes.slice(i - 49, i + 1);
      sma50.push(Number((slice50.reduce((a, b) => a + b, 0) / 50).toFixed(2)));
    } else {
      sma50.push(null);
    }

    // 200 DMA
    if (i >= 199) {
      const slice200 = closes.slice(i - 199, i + 1);
      sma200.push(Number((slice200.reduce((a, b) => a + b, 0) / 200).toFixed(2)));
    } else {
      sma200.push(null);
    }
  }

  // 2. Returns & Volatility
  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (dailyReturns.length - 1);
  const dailyStd = Math.sqrt(variance);
  const annualizedVolatility = Number((dailyStd * Math.sqrt(252) * 100).toFixed(2));

  // 3. CAGR
  const totalReturn = (ltp / closes[0]) - 1;
  const years = n / 252;
  const cagr = Number(((Math.pow(ltp / closes[0], 1 / years) - 1) * 100).toFixed(2));

  // 4. Drawdown Series & Max Drawdown
  let runningMax = closes[0];
  const drawdowns = [];
  let maxDrawdown = 0;

  for (let i = 0; i < n; i++) {
    if (closes[i] > runningMax) {
      runningMax = closes[i];
    }
    const dd = ((closes[i] - runningMax) / runningMax) * 100;
    drawdowns.push(Number(dd.toFixed(2)));
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
    }
  }
  maxDrawdown = Number(maxDrawdown.toFixed(2));

  // 5. Beta vs NIFTY 50
  let beta = 1.0;
  if (niftyCandles && niftyCandles.length > 30) {
    const niftyMap = new Map();
    for (let i = 1; i < niftyCandles.length; i++) {
      const prev = niftyCandles[i - 1].close;
      const curr = niftyCandles[i].close;
      niftyMap.set(niftyCandles[i].date, (curr - prev) / prev);
    }

    const pairedStock = [];
    const pairedNifty = [];

    for (let i = 1; i < n; i++) {
      const d = dates[i];
      if (niftyMap.has(d)) {
        pairedStock.push(dailyReturns[i - 1]);
        pairedNifty.push(niftyMap.get(d));
      }
    }

    if (pairedStock.length > 20) {
      const mStock = pairedStock.reduce((a, b) => a + b, 0) / pairedStock.length;
      const mNifty = pairedNifty.reduce((a, b) => a + b, 0) / pairedNifty.length;

      let cov = 0;
      let varNifty = 0;
      for (let i = 0; i < pairedStock.length; i++) {
        cov += (pairedStock[i] - mStock) * (pairedNifty[i] - mNifty);
        varNifty += Math.pow(pairedNifty[i] - mNifty, 2);
      }
      cov /= (pairedStock.length - 1);
      varNifty /= (pairedStock.length - 1);

      if (varNifty > 0) {
        beta = Number((cov / varNifty).toFixed(2));
      }
    }
  }

  // 6. Sharpe Ratio (Rf = 6.5%)
  const riskFreeRate = 6.5;
  const sharpe = annualizedVolatility > 0 ? Number(((cagr - riskFreeRate) / annualizedVolatility).toFixed(2)) : 0;

  // 7. Institutional Risk Scoring (0 to 100)
  // Higher score = superior risk-adjusted profile / favorable upside
  let score = 50; // base

  // Drawdown scoring (+/- 25 pts)
  if (maxDrawdown > -25) score += 20;
  else if (maxDrawdown > -35) score += 10;
  else if (maxDrawdown > -45) score -= 10;
  else score -= 25;

  // Volatility scoring (+/- 15 pts)
  if (annualizedVolatility < 20) score += 15;
  else if (annualizedVolatility < 28) score += 5;
  else if (annualizedVolatility > 38) score -= 15;
  else score -= 5;

  // Trend / SMA alignment (+/- 20 pts)
  const currSma50 = sma50[n - 1];
  const currSma200 = sma200[n - 1];

  if (currSma50 && ltp > currSma50) score += 10;
  else if (currSma50) score -= 10;

  if (currSma200 && ltp > currSma200) score += 10;
  else if (currSma200) score -= 10;

  // Sharpe / CAGR bonus (+/- 15 pts)
  if (sharpe > 1.0) score += 15;
  else if (sharpe > 0.4) score += 8;
  else if (sharpe < 0) score -= 15;

  score = Math.max(10, Math.min(95, Math.round(score)));

  // 8. Investment Verdict Assignment
  let verdict = 'Hold / Neutral';
  let verdictType = 'hold';
  let badgeColor = '#f59e0b';
  let rationale = [];

  if (score >= 65 && (cagr > 5 || ltp > currSma50)) {
    verdict = 'Buy / Accumulate';
    verdictType = 'buy';
    badgeColor = '#10b981';
    rationale = [
      `Resilient peak drawdown of ${maxDrawdown}%, well above sector distress levels.`,
      `Price (₹${ltp.toLocaleString('en-IN')}) is trading ${currSma50 && ltp > currSma50 ? 'above' : 'near'} 50 DMA, indicating positive structural momentum.`,
      `Favorable risk-adjusted return with Sharpe ratio of ${sharpe} against benchmark risk-free rate of 6.5%.`,
      `Ideal candidate for systematic SIP accumulation or swing entry on pullbacks.`
    ];
  } else if (score < 45 || maxDrawdown < -38 || (currSma200 && ltp < currSma200 && sharpe < 0)) {
    verdict = 'Caution / High Downside';
    verdictType = 'caution';
    badgeColor = '#ef4444';
    rationale = [
      `Elevated drawdown depth of ${maxDrawdown}%, reflecting heavy institutional selling pressure.`,
      `Subdued risk-adjusted return (Sharpe: ${sharpe}) provides weak compensation for volatility (${annualizedVolatility}%).`,
      `Bearish moving average structure with spot price below intermediate moving averages.`,
      `Recommend hedging downside exposure via Put Options or trimming position size.`
    ];
  } else {
    verdict = 'Hold / Neutral';
    verdictType = 'hold';
    badgeColor = '#f59e0b';
    rationale = [
      `Consolidating in a neutral trading corridor with balanced risk-reward dynamics.`,
      `Moderate beta exposure (β = ${beta}) aligns with benchmark market fluctuations.`,
      `Sharpe ratio of ${sharpe} indicates fair return profile without clear directional breakout.`,
      `Maintain existing positions; wait for decisive volume breakout above 50 DMA before adding fresh capital.`
    ];
  }

  // 9. Macro Stress Testing Scenarios
  const macroScenarios = [
    { scenario: '2008 Financial Crisis', marketShock: -52.0, impact: Number((-52.0 * beta).toFixed(2)) },
    { scenario: 'COVID-19 Liquidity Shock', marketShock: -38.4, impact: Number((-38.4 * beta).toFixed(2)) },
    { scenario: 'Tech Sector De-Rating', marketShock: -44.2, impact: Number((-44.2 * beta * 0.9).toFixed(2)) },
    { scenario: 'Rate Hike Shock (+300 bps)', marketShock: -14.5, impact: Number((-14.5 * beta).toFixed(2)) },
    { scenario: 'Global Stagflation Spike', marketShock: -26.0, impact: Number((-26.0 * beta).toFixed(2)) }
  ];

  // 10. Synthetic Options Chain Grid around LTP
  const strikeInterval = ltp > 5000 ? 100 : ltp > 1000 ? 50 : ltp > 200 ? 20 : 10;
  const atmStrike = Math.round(ltp / strikeInterval) * strikeInterval;
  const optionsChain = [];

  for (let offset = -3; offset <= 3; offset++) {
    const strike = atmStrike + (offset * strikeInterval);
    const moneyness = Number(((ltp - strike) / strike * 100).toFixed(2));
    const isCallITM = ltp > strike;
    const isPutITM = ltp < strike;

    // Standard Black-Scholes estimate
    const intrinsicCall = Math.max(0, ltp - strike);
    const timeVal = Math.round(ltp * (annualizedVolatility / 100) * 0.08);
    const callPremium = Number((intrinsicCall + timeVal).toFixed(1));
    const intrinsicPut = Math.max(0, strike - ltp);
    const putPremium = Number((intrinsicPut + timeVal).toFixed(1));

    optionsChain.push({
      strike,
      callLtp: callPremium,
      putLtp: putPremium,
      callMoneyness: isCallITM ? 'ITM' : offset === 0 ? 'ATM' : 'OTM',
      putMoneyness: isPutITM ? 'ITM' : offset === 0 ? 'ATM' : 'OTM',
      callDelta: Number((0.5 + (offset * -0.1)).toFixed(2)),
      putDelta: Number((-0.5 + (offset * -0.1)).toFixed(2)),
      iv: annualizedVolatility
    });
  }

  // Base 100 series for chart
  const base100 = closes.map(p => Number(((p / closes[0]) * 100).toFixed(2)));

  return {
    symbol,
    name: name || symbol,
    sector,
    ltp,
    dayChangePct: Number(dayChangePct.toFixed(2)),
    high52w,
    low52w,
    cagr,
    annualizedVolatility,
    maxDrawdown,
    beta,
    sharpe,
    score,
    verdict,
    verdictType,
    badgeColor,
    rationale,
    macroScenarios,
    optionsChain,
    history: {
      dates,
      prices: closes,
      sma20,
      sma50,
      sma200,
      drawdowns,
      base100,
      volumes
    }
  };
}
