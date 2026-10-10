"""
AXIVEST Upstox CLI — Live Stock Analyzer & Investment Predictor
Usage:
    python AXIVEST/src/upstox_cli.py --ticker SBIN
    python AXIVEST/src/upstox_cli.py --ticker MARUTI,ZOMATO,TATAMOTORS
Author: Kandala Guru Balaji
"""

import argparse
import requests
import json
import os
import numpy as np
import pandas as pd

def analyze_ticker(ticker: str):
    ticker = ticker.strip().upper()
    print(f"\n=======================================================")
    print(f"  AXIVEST Live Quant Analyzer — {ticker}")
    print(f"  Author: Kandala Guru Balaji | Upstox API v2 Engine")
    print(f"=======================================================")

    # Load registry
    registry_path = os.path.join(os.path.dirname(__file__), '..', 'web', 'src', 'data', 'search_registry.json')
    if not os.path.exists(registry_path):
        print(f"Error: search_registry.json not found at {registry_path}")
        return

    with open(registry_path, 'r') as f:
        registry = json.load(f)

    # Resolve ticker
    matched = next((item for item in registry if item['symbol'] == ticker), None)
    if not matched:
        # Fallback dictionary for common names
        fallbacks = {
            'TATAMOTORS': 'NSE_EQ|INE1TAE01010',
            'TMPV': 'NSE_EQ|INE155A01022',
            'NIFTY': 'NSE_INDEX|Nifty 50',
            'NIFTY 50': 'NSE_INDEX|Nifty 50'
        }
        if ticker in fallbacks:
            matched = {'symbol': ticker, 'name': ticker, 'key': fallbacks[ticker]}
        else:
            print(f"[!] Stock '{ticker}' not found in registry. Please check symbol.")
            return

    instrument_key = matched['key']
    print(f"[*] Resolved: {matched['name']} (Key: {instrument_key})")
    print(f"[*] Fetching historical daily candles from Upstox API...")

    url = f"https://api.upstox.com/v2/historical-candle/{requests.utils.quote(instrument_key)}/day/2025-10-10/2024-01-01"
    try:
        r = requests.get(url, timeout=12)
        candles = r.json().get('data', {}).get('candles', [])
        if not candles or len(candles) < 30:
            print(f"[!] Insufficient candles returned: {len(candles)}")
            return

        # Fetch NIFTY benchmark
        nifty_url = f"https://api.upstox.com/v2/historical-candle/{requests.utils.quote('NSE_INDEX|Nifty 50')}/day/2025-10-10/2024-01-01"
        r_nifty = requests.get(nifty_url, timeout=12).json()
        nifty_candles = r_nifty.get('data', {}).get('candles', [])

        df = pd.DataFrame(candles, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'OI'])
        df['Date'] = pd.to_datetime(df['Date']).dt.date
        df = df.sort_values('Date').reset_index(drop=True)
        df['Return'] = df['Close'].pct_change()

        df_nifty = pd.DataFrame(nifty_candles, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'OI'])
        df_nifty['Date'] = pd.to_datetime(df_nifty['Date']).dt.date
        df_nifty = df_nifty.sort_values('Date').reset_index(drop=True)
        df_nifty['Nifty_Return'] = df_nifty['Close'].pct_change()

        merged = pd.merge(df[['Date', 'Close', 'Return']], df_nifty[['Date', 'Nifty_Return']], on='Date').dropna()

        ltp = float(merged['Close'].iloc[-1])
        cagr = float(((ltp / merged['Close'].iloc[0]) ** (252 / len(merged)) - 1) * 100)
        vol = float(merged['Return'].std() * np.sqrt(252) * 100)
        peak = merged['Close'].cummax()
        dd = ((merged['Close'] - peak) / peak) * 100
        max_dd = float(dd.min())

        cov = float(np.cov(merged['Return'], merged['Nifty_Return'])[0][1])
        var_n = float(np.var(merged['Nifty_Return']))
        beta = float(cov / var_n) if var_n > 0 else 1.0
        sharpe = float((cagr - 6.5) / vol) if vol > 0 else 0.0

        # Score
        score = 50
        if max_dd > -25: score += 20
        elif max_dd > -35: score += 10
        elif max_dd > -45: score -= 10
        else: score -= 25

        if vol < 20: score += 15
        elif vol < 28: score += 5
        elif vol > 38: score -= 15
        else: score -= 5

        df['SMA_50'] = df['Close'].rolling(50).mean()
        df['SMA_200'] = df['Close'].rolling(200).mean()
        s50 = float(df['SMA_50'].iloc[-1]) if pd.notnull(df['SMA_50'].iloc[-1]) else None
        s200 = float(df['SMA_200'].iloc[-1]) if pd.notnull(df['SMA_200'].iloc[-1]) else None

        if s50 and ltp > s50: score += 10
        elif s50: score -= 10
        if s200 and ltp > s200: score += 10
        elif s200: score -= 10

        if sharpe > 1.0: score += 15
        elif sharpe > 0.4: score += 8
        elif sharpe < 0: score -= 15

        score = max(10, min(95, round(score)))

        if score >= 65 and (cagr > 5 or (s50 and ltp > s50)):
            verdict = "BUY / ACCUMULATE"
            signal_box = "[+++] VERDICT: BUY / ACCUMULATE (Favorable Risk-Reward)"
        elif score < 45 or max_dd < -38 or (s200 and ltp < s200 and sharpe < 0):
            verdict = "CAUTION / SELL"
            signal_box = "[---] VERDICT: CAUTION / HIGH DOWNSIDE RISK"
        else:
            verdict = "HOLD / NEUTRAL"
            signal_box = "[===] VERDICT: HOLD / NEUTRAL (Consolidation Corridor)"

        print(f"\n-------------------------------------------------------")
        print(f"  QUANTITATIVE SUMMARY FOR {ticker}")
        print(f"-------------------------------------------------------")
        print(f"  Latest Price (LTP)       : INR {ltp:,.2f}")
        print(f"  Annualized CAGR          : {cagr:+.2f}%")
        print(f"  Annualized Volatility    : {vol:.2f}%")
        print(f"  Maximum Drawdown (MDD)   : {max_dd:.2f}%")
        print(f"  Beta vs NIFTY 50         : {beta:.2f}")
        print(f"  Sharpe Ratio (Rf=6.5%)   : {sharpe:+.2f}")
        print(f"  50 DMA Level             : INR {s50:,.2f}" if s50 else "  50 DMA: N/A")
        print(f"  200 DMA Level            : INR {s200:,.2f}" if s200 else "  200 DMA: N/A")
        print(f"  Institutional Score      : {score}/100")
        print(f"-------------------------------------------------------")
        print(f"  {signal_box}")
        print(f"-------------------------------------------------------\n")

    except Exception as e:
        print(f"[!] Error during live analysis: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AXIVEST Live Stock Analyzer via Upstox API')
    parser.add_argument('--ticker', type=str, required=True, help='Stock symbol (e.g. SBIN, MARUTI, ZOMATO)')
    args = parser.parse_args()

    tickers = [t.strip() for t in args.ticker.split(',')]
    for t in tickers:
        analyze_ticker(t)
