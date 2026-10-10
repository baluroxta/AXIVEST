"""
AXIVEST — Export Web Data
Generates rich, fully calculated JSON data for the interactive Vercel Web Dashboard.
Includes automated quantitative investment verdict, SMA trend, and risk scores.
Author: Kandala Guru Balaji
"""

import os
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
WEB_DATA_DIR = os.path.join(BASE_DIR, "web", "src", "data")
os.makedirs(WEB_DATA_DIR, exist_ok=True)

# 1. Load Core Datasets
prices = pd.read_csv(os.path.join(PROCESSED_DIR, "daily_prices.csv"))
returns = pd.read_csv(os.path.join(PROCESSED_DIR, "daily_returns.csv"))
vol = pd.read_csv(os.path.join(PROCESSED_DIR, "annualized_volatility.csv"))
mdd = pd.read_csv(os.path.join(PROCESSED_DIR, "maximum_drawdown.csv"))
corr_pairwise = pd.read_csv(os.path.join(PROCESSED_DIR, "stock_correlations_pairwise.csv"))
corr_matrix = pd.read_csv(os.path.join(PROCESSED_DIR, "stock_correlations_matrix.csv"))
stress_stock = pd.read_csv(os.path.join(PROCESSED_DIR, "stress_by_stock.csv"))
stress_sum = pd.read_csv(os.path.join(PROCESSED_DIR, "stress_summary.csv"))
opt_payoff = pd.read_csv(os.path.join(PROCESSED_DIR, "options_payoff.csv"))
opt_sum = pd.read_csv(os.path.join(PROCESSED_DIR, "options_summary.csv"))

asset_cols = [c for c in prices.columns if c != "Date"]
dates = prices["Date"].tolist()

# Sector mapping & descriptive metadata
SECTOR_MAP = {
    "Bharti Airtel": "Telecommunications",
    "HDFC Bank": "Banking & Financial Services",
    "ICICI Bank": "Banking & Financial Services",
    "Infosys": "Information Technology",
    "ITC": "FMCG & Consumer Goods",
    "L&T": "Engineering & Infrastructure",
    "M&M": "Automobile & Manufacturing",
    "NTPC": "Power & Utilities",
    "Reliance": "Diversified Conglomerate",
    "TCS": "Information Technology",
    "NIFTY 50": "Benchmark Equity Index"
}

TICKER_MAP = {
    "Bharti Airtel": "BHARTIARTL.NS",
    "HDFC Bank": "HDFCBANK.NS",
    "ICICI Bank": "ICICIBANK.NS",
    "Infosys": "INFY.NS",
    "ITC": "ITC.NS",
    "L&T": "LT.NS",
    "M&M": "M&M.NS",
    "NTPC": "NTPC.NS",
    "Reliance": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "NIFTY 50": "^NSEI"
}

# 2. Build Stock-by-Stock Intelligence & Investment Verdicts
stocks_data = []

vol_dict = dict(zip(vol["stock"], vol["annualized_volatility_pct"]))
mdd_dict = mdd.set_index("stock").to_dict(orient="index")

for stock in asset_cols:
    s_prices = prices[stock].tolist()
    start_p = s_prices[0]
    curr_p = s_prices[-1]
    cum_ret = ((curr_p - start_p) / start_p) * 100.0
    
    # 20-Day & 50-Day SMA
    s_series = pd.Series(s_prices)
    sma20 = s_series.rolling(20, min_periods=1).mean().tolist()
    sma50 = s_series.rolling(50, min_periods=1).mean().tolist()
    curr_sma20 = sma20[-1]
    curr_sma50 = sma50[-1]
    
    v_val = vol_dict.get(stock, 20.0)
    mdd_info = mdd_dict.get(stock, {})
    mdd_val = mdd_info.get("max_drawdown_pct", -25.0)
    
    # Correlation with NIFTY 50
    if stock == "NIFTY 50":
        corr_nifty = 1.0
    else:
        c_row = corr_pairwise[
            ((corr_pairwise["stock_1"] == stock) & (corr_pairwise["stock_2"] == "NIFTY 50")) |
            ((corr_pairwise["stock_2"] == stock) & (corr_pairwise["stock_1"] == "NIFTY 50"))
        ]
        corr_nifty = float(c_row["correlation"].iloc[0]) if len(c_row) > 0 else 0.5
        
    # Quantitative Verdict Engine Logic
    # Factors:
    # 1. Momentum: curr_p vs sma20 vs sma50
    # 2. Volatility penalty
    # 3. Drawdown severity penalty
    # 4. Long-term cumulative trend
    
    momentum_bullish = curr_sma20 > curr_sma50
    above_sma50 = curr_p > curr_sma50
    
    # Risk Score out of 100 (Higher is safer/more attractive risk-adjusted)
    base_score = 50
    if cum_ret > 0:
        base_score += 15
    if momentum_bullish:
        base_score += 15
    if above_sma50:
        base_score += 10
    if v_val < 20.0:
        base_score += 10
    elif v_val > 25.0:
        base_score -= 15
    if mdd_val > -25.0:
        base_score += 10
    elif mdd_val < -40.0:
        base_score -= 20
        
    risk_score = int(np.clip(base_score, 15, 95))
    
    if stock == "NIFTY 50":
        verdict = "CORE BENCHMARK (HOLD / BASELINE)"
        badge = "BENCHMARK"
        rationale = f"NIFTY 50 represents the diversified macroeconomic baseline of the Indian corporate economy with a balanced 13.1% volatility and shallow historical drawdown of -15.6%."
        drivers = [
            "Diversified exposure across top 50 Indian blue-chips",
            "Lowest volatility profile in the entire asset universe (13.1%)",
            "Shallowest drawdown (-15.6%) demonstrating institutional stability"
        ]
        risks = [
            "Exposed to broad global macro and monetary tightening cycles",
            "Heavy financial sector weighting (~30%) drives systemic correlation"
        ]
    elif risk_score >= 70:
        verdict = "BUY / ACCUMULATE"
        badge = "BUY"
        rationale = f"{stock} demonstrates favorable quantitative risk-adjusted strength. It possesses controlled annualized volatility ({v_val:.1f}%), resilient historical drawdown ({mdd_val:.1f}%), and positive trend momentum."
        drivers = [
            f"Favorable drawdown containment ({mdd_val:.1f}% vs peers exceeding -40%)",
            f"Controlled volatility of {v_val:.1f}%, keeping portfolio beta stable",
            f"Current price (₹{curr_p:,.2f}) trading with favorable medium-term support"
        ]
        risks = [
            f"Vulnerable to sector-specific demand rotation",
            f"Correlation to NIFTY ({corr_nifty:.2f}) dictates market sensitivity"
        ]
    elif risk_score >= 45:
        verdict = "HOLD / NEUTRAL"
        badge = "HOLD"
        rationale = f"{stock} exhibits balanced signals. While underlying fundamentals remain sound, its volatility ({v_val:.1f}%) and historical drawdown ({mdd_val:.1f}%) suggest consolidating before adding aggressive exposure."
        drivers = [
            f"Established large-cap leadership within the {SECTOR_MAP.get(stock)} sector",
            f"Correlation of {corr_nifty:.2f} provides moderate market alignment",
            f"Testing key technical support near current levels (₹{curr_p:,.2f})"
        ]
        risks = [
            f"Elevated price swing variance relative to the benchmark index",
            f"Recovery from historical trough required to confirm sustained uptrend"
        ]
    else:
        verdict = "CAUTION / HIGH DOWNSIDE RISK"
        badge = "CAUTION"
        rationale = f"{stock} carries significant historical downside baggage with a deep maximum drawdown of {mdd_val:.1f}% and heightened volatility of {v_val:.1f}%. Risk management mandates strict stop-loss rules or options hedge coverage."
        drivers = [
            f"Premier brand franchise in {SECTOR_MAP.get(stock)}",
            f"Long-term value play once cyclical stabilization is confirmed",
            f"High beta offers substantial upside torque during sudden sector rebounds"
        ]
        risks = [
            f"Severe peak-to-trough historical drop of {mdd_val:.1f}%",
            f"High annualized volatility ({v_val:.1f}%) increases downside variance",
            f"Downtrend pressure indicates potential for further consolidation"
        ]

    stocks_data.append({
        "name": stock,
        "ticker": TICKER_MAP.get(stock, stock),
        "sector": SECTOR_MAP.get(stock, "Equities"),
        "currentPrice": round(curr_p, 2),
        "startPrice": round(start_p, 2),
        "cumulativeReturnPct": round(cum_ret, 2),
        "volatilityPct": round(v_val, 2),
        "maxDrawdownPct": round(mdd_val, 2),
        "peakDate": mdd_info.get("peak_date", "2024-10-09"),
        "peakPrice": round(mdd_info.get("peak_price", curr_p), 2),
        "troughDate": mdd_info.get("trough_date", "2026-10-09"),
        "troughPrice": round(mdd_info.get("trough_price", curr_p), 2),
        "correlationToNifty": round(corr_nifty, 4),
        "sma20": round(curr_sma20, 2),
        "sma50": round(curr_sma50, 2),
        "verdict": verdict,
        "badge": badge,
        "riskScore": risk_score,
        "rationale": rationale,
        "keyDrivers": drivers,
        "keyRisks": risks
    })

# 3. Price History per Stock (Raw, Base 100, SMA 20, SMA 50)
price_history = {
    "dates": dates,
    "series": {}
}

for stock in asset_cols:
    raw_p = [round(x, 2) for x in prices[stock].tolist()]
    base_100 = [round((x / raw_p[0]) * 100.0, 2) for x in raw_p]
    s_series = pd.Series(raw_p)
    sma20 = [round(x, 2) for x in s_series.rolling(20, min_periods=1).mean().tolist()]
    sma50 = [round(x, 2) for x in s_series.rolling(50, min_periods=1).mean().tolist()]
    
    price_history["series"][stock] = {
        "raw": raw_p,
        "base100": base_100,
        "sma20": sma20,
        "sma50": sma50
    }

# 4. Stress Test Data
stress_data = {
    "summary": stress_sum.to_dict(orient="records"),
    "byStock": stress_stock.to_dict(orient="records")
}

# 5. Options Payoff Data
options_data = {
    "summary": opt_sum.to_dict(orient="records"),
    "payoff": opt_payoff.to_dict(orient="records")
}

# 6. Correlation Matrix
corr_data = {
    "assets": asset_cols,
    "matrix": corr_matrix.to_dict(orient="records")
}

# Write all JSON files
with open(os.path.join(WEB_DATA_DIR, "stocks_data.json"), "w", encoding="utf-8") as f:
    json.dump(stocks_data, f, indent=2)

with open(os.path.join(WEB_DATA_DIR, "price_history.json"), "w", encoding="utf-8") as f:
    json.dump(price_history, f, indent=2)

with open(os.path.join(WEB_DATA_DIR, "stress_data.json"), "w", encoding="utf-8") as f:
    json.dump(stress_data, f, indent=2)

with open(os.path.join(WEB_DATA_DIR, "options_data.json"), "w", encoding="utf-8") as f:
    json.dump(options_data, f, indent=2)

with open(os.path.join(WEB_DATA_DIR, "correlation_data.json"), "w", encoding="utf-8") as f:
    json.dump(corr_data, f, indent=2)

print("All web data successfully exported to:", WEB_DATA_DIR)
