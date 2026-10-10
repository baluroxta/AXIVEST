"""
Batch enrich market catalog with live historical candles from Upstox API v2.
Calculates CAGR, Volatility, Max Drawdown, Beta vs NIFTY, Sharpe, Institutional Score,
and Investment Verdict (Buy/Hold/Caution) for all flagship market stocks.
Author: Kandala Guru Balaji
"""

import requests
import json
import time
import os
import numpy as np
import pandas as pd

def enrich_all():
    catalog_path = r'AXIVEST\web\src\data\market_catalog.json'
    with open(catalog_path, 'r') as f:
        catalog = json.load(f)

    print(f"Total stocks in catalog to enrich: {len(catalog)}")

    # 1. Fetch NIFTY 50 benchmark
    print("Fetching NIFTY 50 benchmark...")
    nifty_url = f"https://api.upstox.com/v2/historical-candle/{requests.utils.quote('NSE_INDEX|Nifty 50')}/day/2025-10-10/2024-01-01"
    r_nifty = requests.get(nifty_url, timeout=15).json()
    nifty_candles = r_nifty.get('data', {}).get('candles', [])
    df_nifty = pd.DataFrame(nifty_candles, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'OI'])
    df_nifty['Date'] = pd.to_datetime(df_nifty['Date']).dt.date
    df_nifty = df_nifty.sort_values('Date').reset_index(drop=True)
    df_nifty['Nifty_Return'] = df_nifty['Close'].pct_change()
    print(f"NIFTY 50 fetched: {len(df_nifty)} trading days.")

    stocks_data = []
    price_history = {}
    stress_data = []
    options_data = []

    for idx, item in enumerate(catalog):
        sym = item['symbol']
        name = item['name']
        sector = item['sector']
        key = item['key']

        try:
            url = f"https://api.upstox.com/v2/historical-candle/{requests.utils.quote(key)}/day/2025-10-10/2024-01-01"
            r = requests.get(url, timeout=10)
            candles = r.json().get('data', {}).get('candles', [])

            if not candles or len(candles) < 30:
                print(f"Skipping {sym}: insufficient candles ({len(candles)})")
                continue

            df = pd.DataFrame(candles, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'OI'])
            df['Date'] = pd.to_datetime(df['Date']).dt.date
            df = df.sort_values('Date').reset_index(drop=True)
            df['Return'] = df['Close'].pct_change()

            # Merge with NIFTY
            merged = pd.merge(df[['Date', 'Close', 'Return', 'Volume']], df_nifty[['Date', 'Nifty_Return']], on='Date').dropna()

            ltp = float(merged['Close'].iloc[-1])
            prev_close = float(merged['Close'].iloc[-2])
            change_pct = float(((ltp - prev_close) / prev_close) * 100)
            high_52w = float(merged['Close'].max())
            low_52w = float(merged['Close'].min())

            # Return & Volatility
            n_days = len(merged)
            cagr = float(((ltp / merged['Close'].iloc[0]) ** (252 / n_days) - 1) * 100)
            daily_std = float(merged['Return'].std())
            volatility = float(daily_std * np.sqrt(252) * 100)

            # Drawdown
            peak = merged['Close'].cummax()
            dd = ((merged['Close'] - peak) / peak) * 100
            max_dd = float(dd.min())

            # Beta
            cov = float(np.cov(merged['Return'], merged['Nifty_Return'])[0][1])
            var_n = float(np.var(merged['Nifty_Return']))
            beta = float(cov / var_n) if var_n > 0 else 1.0

            # Sharpe (Rf = 6.5%)
            sharpe = float((cagr - 6.5) / volatility) if volatility > 0 else 0.0

            # Institutional Risk Score (0 - 100)
            score = 50
            if max_dd > -25: score += 20
            elif max_dd > -35: score += 10
            elif max_dd > -45: score -= 10
            else: score -= 25

            if volatility < 20: score += 15
            elif volatility < 28: score += 5
            elif volatility > 38: score -= 15
            else: score -= 5

            # Moving averages
            df['SMA_20'] = df['Close'].rolling(20).mean()
            df['SMA_50'] = df['Close'].rolling(50).mean()
            df['SMA_200'] = df['Close'].rolling(200).mean()

            curr_sma50 = float(df['SMA_50'].iloc[-1]) if pd.notnull(df['SMA_50'].iloc[-1]) else None
            curr_sma200 = float(df['SMA_200'].iloc[-1]) if pd.notnull(df['SMA_200'].iloc[-1]) else None

            if curr_sma50 and ltp > curr_sma50: score += 10
            elif curr_sma50: score -= 10

            if curr_sma200 and ltp > curr_sma200: score += 10
            elif curr_sma200: score -= 10

            if sharpe > 1.0: score += 15
            elif sharpe > 0.4: score += 8
            elif sharpe < 0: score -= 15

            score = max(12, min(95, round(score)))

            # Investment Verdict
            if score >= 65 and (cagr > 5 or (curr_sma50 and ltp > curr_sma50)):
                verdict = "Buy / Accumulate"
                verdict_type = "buy"
                rationale = f"Resilient peak drawdown of {max_dd:.1f}% with positive structural momentum (Sharpe: {sharpe:.2f}). Trading near/above medium-term SMAs."
            elif score < 45 or max_dd < -38 or (curr_sma200 and ltp < curr_sma200 and sharpe < 0):
                verdict = "Caution / High Downside"
                verdict_type = "caution"
                rationale = f"Elevated drawdown depth ({max_dd:.1f}%) and subdued risk-adjusted return (Sharpe: {sharpe:.2f}). Downward pressure on moving averages."
            else:
                verdict = "Hold / Neutral"
                verdict_type = "hold"
                rationale = f"Consolidating in a balanced risk-reward corridor. Beta is {beta:.2f} with annualized volatility of {volatility:.1f}%. Wait for 50 DMA breakout."

            stock_entry = {
                'symbol': sym,
                'name': name,
                'sector': sector,
                'instrument_key': key,
                'ltp': round(ltp, 2),
                'change_pct': round(change_pct, 2),
                'high_52w': round(high_52w, 2),
                'low_52w': round(low_52w, 2),
                'cagr': round(cagr, 2),
                'annualized_volatility': round(volatility, 2),
                'max_drawdown': round(max_dd, 2),
                'beta': round(beta, 2),
                'sharpe_ratio': round(sharpe, 2),
                'risk_score': score,
                'verdict': verdict,
                'verdict_type': verdict_type,
                'rationale': rationale
            }
            stocks_data.append(stock_entry)

            # Price History
            dates_str = [d.strftime('%Y-%m-%d') for d in df['Date']]
            prices_lst = [round(float(p), 2) for p in df['Close']]
            sma20_lst = [round(float(p), 2) if pd.notnull(p) else None for p in df['SMA_20']]
            sma50_lst = [round(float(p), 2) if pd.notnull(p) else None for p in df['SMA_50']]
            sma200_lst = [round(float(p), 2) if pd.notnull(p) else None for p in df['SMA_200']]
            dd_lst = [round(float(d), 2) for d in dd]
            base100_lst = [round(float(p / prices_lst[0] * 100), 2) for p in prices_lst]
            vol_lst = [int(v) for v in df['Volume']]

            price_history[sym] = {
                'dates': dates_str,
                'prices': prices_lst,
                'sma_20': sma20_lst,
                'sma_50': sma50_lst,
                'sma_200': sma200_lst,
                'drawdowns': dd_lst,
                'base_100': base100_lst,
                'volume': vol_lst
            }

            # Stress Data
            stress_data.append({
                'symbol': sym,
                'sector': sector,
                'beta': round(beta, 2),
                'crisis_2008_impact': round(-52.0 * beta, 2),
                'covid_2020_impact': round(-38.4 * beta, 2),
                'tech_bubble_impact': round(-44.2 * beta * 0.9, 2),
                'rate_hike_impact': round(-14.5 * beta, 2),
                'stagflation_impact': round(-26.0 * beta, 2)
            })

            # Synthetic Options Data
            strike_interval = 100 if ltp > 5000 else 50 if ltp > 1000 else 20 if ltp > 200 else 10
            atm_strike = round(ltp / strike_interval) * strike_interval
            chain = []
            for offset in range(-3, 4):
                strike = atm_strike + (offset * strike_interval)
                is_call_itm = ltp > strike
                is_put_itm = ltp < strike
                int_call = max(0.0, ltp - strike)
                int_put = max(0.0, strike - ltp)
                time_val = round(ltp * (volatility / 100.0) * 0.08, 1)
                chain.append({
                    'strike': strike,
                    'call_ltp': round(int_call + time_val, 1),
                    'put_ltp': round(int_put + time_val, 1),
                    'call_moneyness': 'ITM' if is_call_itm else 'ATM' if offset == 0 else 'OTM',
                    'put_moneyness': 'ITM' if is_put_itm else 'ATM' if offset == 0 else 'OTM',
                    'call_delta': round(0.5 + (offset * -0.1), 2),
                    'put_delta': round(-0.5 + (offset * -0.1), 2),
                    'iv': round(volatility, 1)
                })

            options_data.append({
                'symbol': sym,
                'spot_price': round(ltp, 2),
                'atm_strike': atm_strike,
                'chain': chain
            })

            print(f"[{idx+1}/{len(catalog)}] {sym}: Close=₹{ltp:.2f}, Score={score}, Verdict={verdict}")
            time.sleep(0.05) # Polite delay

        except Exception as e:
            print(f"Error processing {sym}: {e}")

    # Save to JSON
    out_dir = r'AXIVEST\web\src\data'
    with open(os.path.join(out_dir, 'stocks_data.json'), 'w') as f:
        json.dump(stocks_data, f, indent=2)
    with open(os.path.join(out_dir, 'price_history.json'), 'w') as f:
        json.dump(price_history, f, indent=2)
    with open(os.path.join(out_dir, 'stress_data.json'), 'w') as f:
        json.dump(stress_data, f, indent=2)
    with open(os.path.join(out_dir, 'options_data.json'), 'w') as f:
        json.dump(options_data, f, indent=2)

    print("\nSUCCESS! Successfully enriched datasets:")
    print(f"- stocks_data.json: {len(stocks_data)} stocks")
    print(f"- price_history.json: {len(price_history)} stocks with complete 2024-2025 DMA history")
    print(f"- stress_data.json: {len(stress_data)} stocks")
    print(f"- options_data.json: {len(options_data)} stocks")

if __name__ == '__main__':
    enrich_all()
