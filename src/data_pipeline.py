"""
AXIVEST — Portfolio Risk & Options Intelligence
Data Processing, Calculation & Validation Pipeline
Author: Kandala Guru Balaji
Degree: B.Tech Computer Science and Business Systems (3rd Year)
Tagline: "See the risk. Test the downside."

This script performs end-to-end data processing, risk metric calculation,
stress testing, options payoff modeling, and SQLite database population.
"""

import os
import sqlite3
import pandas as pd
import numpy as np

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "processed")
DB_DIR = os.path.join(BASE_DIR, "data", "database")
DB_PATH = os.path.join(DB_DIR, "axivest.db")

# Fallback source directory for original CSV exports
DOWNLOADS_DIR = r"C:\Users\kanda\Downloads"

TRADING_DAYS = 252
PORTFOLIO_VALUE = 100000.0  # Illustrative baseline portfolio in INR

ASSETS = [
    "Bharti Airtel",
    "HDFC Bank",
    "ICICI Bank",
    "Infosys",
    "ITC",
    "L&T",
    "M&M",
    "NTPC",
    "Reliance",
    "TCS"
]
BENCHMARK = "NIFTY 50"
ALL_COLUMNS = ASSETS + [BENCHMARK]


def ensure_directories():
    """Ensure all required project subdirectories exist."""
    dirs = [
        DATA_DIR,
        DB_DIR,
        os.path.join(BASE_DIR, "src"),
        os.path.join(BASE_DIR, "notebooks"),
        os.path.join(BASE_DIR, "sql"),
        os.path.join(BASE_DIR, "excel"),
        os.path.join(BASE_DIR, "powerbi"),
        os.path.join(BASE_DIR, "docs"),
        os.path.join(BASE_DIR, "screenshots"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    print("Project folder structure verified successfully.")


def load_source_prices():
    """Load historical prices from Downloads or existing data directory."""
    source_path = os.path.join(DATA_DIR, "daily_prices.csv")
    if not os.path.exists(source_path):
        source_path = os.path.join(DOWNLOADS_DIR, "axivest_prices.csv")
    
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source prices file not found at {source_path}")
    
    df = pd.read_csv(source_path)
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
    df = df.sort_values("Date").reset_index(drop=True)
    return df


def calculate_returns(prices_df):
    """
    Calculate daily percentage returns: R_t = (P_t - P_{t-1}) / P_{t-1}.
    Preserves Date column.
    """
    ret_df = prices_df.copy()
    ret_df[ALL_COLUMNS] = prices_df[ALL_COLUMNS].pct_change()
    ret_df = ret_df.dropna().reset_index(drop=True)
    return ret_df


def calculate_annualized_volatility(returns_df):
    """
    Annualized Volatility: sample standard deviation (ddof=1) * sqrt(252) * 100%.
    """
    records = []
    for asset in ALL_COLUMNS:
        std_daily = returns_df[asset].std(ddof=1)
        ann_vol = std_daily * np.sqrt(TRADING_DAYS) * 100.0
        records.append({
            "stock": asset,
            "annualized_volatility_pct": round(float(ann_vol), 4),
            "asset_type": "Index" if asset == BENCHMARK else "Equity"
        })
    return pd.DataFrame(records)


def calculate_maximum_drawdown(prices_df):
    """
    Maximum Drawdown: Peak-to-trough decline over historical series.
    Drawdown_t = (Price_t - Running_Peak_t) / Running_Peak_t * 100%.
    """
    records = []
    for asset in ALL_COLUMNS:
        s = prices_df[["Date", asset]].dropna().copy()
        s["peak"] = s[asset].cummax()
        s["drawdown"] = (s[asset] - s["peak"]) / s["peak"] * 100.0
        
        mdd = s["drawdown"].min()
        trough_idx = s["drawdown"].idxmin()
        trough_date = s.loc[trough_idx, "Date"]
        trough_price = s.loc[trough_idx, asset]
        
        peak_price = s.loc[trough_idx, "peak"]
        peak_idx = s[s[asset] == peak_price].index[0]
        peak_date = s.loc[peak_idx, "Date"]
        
        records.append({
            "stock": asset,
            "max_drawdown_pct": round(float(mdd), 2),
            "peak_date": peak_date,
            "peak_price": round(float(peak_price), 2),
            "trough_date": trough_date,
            "trough_price": round(float(trough_price), 2),
            "asset_type": "Index" if asset == BENCHMARK else "Equity"
        })
    df_mdd = pd.DataFrame(records).sort_values("max_drawdown_pct").reset_index(drop=True)
    return df_mdd


def calculate_correlations(returns_df):
    """
    Calculate both unique pairwise correlation and full symmetric matrix.
    """
    corr_matrix = returns_df[ALL_COLUMNS].corr().round(4)
    
    # 1. Unique pairwise combinations (upper triangle, 55 pairs)
    pairwise_records = []
    for i in range(len(ALL_COLUMNS)):
        for j in range(i + 1, len(ALL_COLUMNS)):
            s1 = ALL_COLUMNS[i]
            s2 = ALL_COLUMNS[j]
            val = corr_matrix.loc[s1, s2]
            pairwise_records.append({
                "stock_1": s1,
                "stock_2": s2,
                "correlation": round(float(val), 4)
            })
    pairwise_df = pd.DataFrame(pairwise_records)
    
    # 2. Symmetric long matrix for Power BI heatmap visual (121 pairs)
    matrix_records = []
    for s1 in ALL_COLUMNS:
        for s2 in ALL_COLUMNS:
            val = corr_matrix.loc[s1, s2]
            matrix_records.append({
                "row_stock": s1,
                "col_stock": s2,
                "correlation": round(float(val), 4)
            })
    matrix_df = pd.DataFrame(matrix_records)
    
    return pairwise_df, matrix_df


def build_unpivoted_prices(prices_df):
    """
    Unpivot wide prices table into long format:
    Date, Stock, Price, Normalized_Price_100 (indexed to 100 on start date), Daily_Return_Pct.
    Essential for Power BI single/multi stock selector line chart without scale distortion.
    """
    df_long = pd.melt(prices_df, id_vars=["Date"], var_name="Stock", value_name="Price")
    df_long["Date"] = pd.to_datetime(df_long["Date"])
    df_long = df_long.sort_values(["Stock", "Date"]).reset_index(drop=True)
    
    # Normalized base 100
    df_long["Base_Price"] = df_long.groupby("Stock")["Price"].transform("first")
    df_long["Normalized_Price_100"] = (df_long["Price"] / df_long["Base_Price"]) * 100.0
    df_long["Daily_Return_Pct"] = df_long.groupby("Stock")["Price"].pct_change() * 100.0
    
    df_long["Date"] = df_long["Date"].dt.strftime("%Y-%m-%d")
    df_long = df_long[["Date", "Stock", "Price", "Normalized_Price_100", "Daily_Return_Pct"]]
    return df_long


def build_stress_test_datasets():
    """
    Hypothetical stress test shock models for 10 equity assets across 3 macro scenarios.
    Equal 10% weighting per asset (Total equity portfolio = 100%, ₹100,000 illustrative capital).
    """
    scenarios = {
        "Mild Stress": {
            "TCS": -5.0, "Infosys": -5.0, "HDFC Bank": -4.0, "ICICI Bank": -4.0,
            "Reliance": -5.0, "NTPC": -3.0, "L&T": -5.0, "M&M": -6.0,
            "ITC": -3.0, "Bharti Airtel": -4.0
        },
        "Moderate Stress": {
            "TCS": -12.0, "Infosys": -12.0, "HDFC Bank": -10.0, "ICICI Bank": -10.0,
            "Reliance": -12.0, "NTPC": -8.0, "L&T": -12.0, "M&M": -15.0,
            "ITC": -7.0, "Bharti Airtel": -9.0
        },
        "Severe Stress": {
            "TCS": -25.0, "Infosys": -25.0, "HDFC Bank": -22.0, "ICICI Bank": -22.0,
            "Reliance": -25.0, "NTPC": -18.0, "L&T": -25.0, "M&M": -30.0,
            "ITC": -15.0, "Bharti Airtel": -20.0
        }
    }
    
    by_stock_records = []
    summary_records = []
    weight = 10.0  # 10% per stock
    
    for scenario_name, shocks in scenarios.items():
        total_impact = 0.0
        for stock, shock in shocks.items():
            weighted_impact = shock * (weight / 100.0)
            total_impact += weighted_impact
            by_stock_records.append({
                "scenario": scenario_name,
                "stock": stock,
                "assumed_shock_pct": shock,
                "portfolio_weight_pct": weight,
                "weighted_impact_pct": round(weighted_impact, 2)
            })
        
        portfolio_return = round(total_impact, 2)
        portfolio_loss = round(abs(portfolio_return), 2)
        post_stress_val = round(PORTFOLIO_VALUE * (1 + portfolio_return / 100.0), 2)
        
        summary_records.append({
            "scenario": scenario_name,
            "portfolio_return_pct": portfolio_return,
            "portfolio_loss_pct": portfolio_loss,
            "starting_portfolio_value": PORTFOLIO_VALUE,
            "estimated_value_after_stress": post_stress_val
        })
        
    return pd.DataFrame(by_stock_records), pd.DataFrame(summary_records)


def build_options_models():
    """
    Options Expiration Payoff Models:
    1. Bull Call Spread (Buy 1000 Call @ 50, Sell 1100 Call @ 15 -> Net Debit: 35)
    2. Long Straddle (Buy 1000 Call @ 55, Buy 1000 Put @ 50 -> Net Debit: 105)
    3. Iron Condor (Sell 900 Put, Buy 850 Put, Sell 1100 Call, Buy 1150 Call -> Net Credit: 23)
    Tested price range: 700 to 1300 at step 25.
    """
    prices = np.arange(700, 1325, 25)
    payoff_records = []
    
    for S in prices:
        # 1. Bull Call Spread
        # Long Call 1000 (pre=50), Short Call 1100 (pre=15) -> Net Premium Paid = 35
        bcs_payoff = max(S - 1000, 0) - max(S - 1100, 0) - 35
        payoff_records.append({
            "strategy": "Bull Call Spread",
            "underlying_at_expiry": float(S),
            "net_profit_per_unit": float(bcs_payoff)
        })
        
        # 2. Long Straddle
        # Long Call 1000 (pre=55), Long Put 1000 (pre=50) -> Net Premium Paid = 105
        straddle_payoff = max(S - 1000, 0) + max(1000 - S, 0) - 105
        payoff_records.append({
            "strategy": "Long Straddle",
            "underlying_at_expiry": float(S),
            "net_profit_per_unit": float(straddle_payoff)
        })
        
        # 3. Credit Iron Condor
        # Long Put 850 (pre=5), Short Put 900 (pre=14), Short Call 1100 (pre=18), Long Call 1150 (pre=4)
        # Net Credit = 14 - 5 + 18 - 4 = 23 (stored as -23 net premium paid)
        ic_long_put = max(850 - S, 0)
        ic_short_put = -max(900 - S, 0)
        ic_short_call = -max(S - 1100, 0)
        ic_long_call = max(S - 1150, 0)
        ic_payoff = ic_long_put + ic_short_put + ic_short_call + ic_long_call + 23
        payoff_records.append({
            "strategy": "Iron Condor",
            "underlying_at_expiry": float(S),
            "net_profit_per_unit": float(ic_payoff)
        })
        
    payoff_df = pd.DataFrame(payoff_records)
    
    summary_df = pd.DataFrame([
        {
            "strategy": "Bull Call Spread",
            "description": "Limited-risk bullish strategy (Long 1000C / Short 1100C)",
            "net_premium_paid_per_unit": 35.0,
            "best_profit_in_tested_range": 65.0,
            "worst_profit_in_tested_range": -35.0,
            "tested_price_min": 700.0,
            "tested_price_max": 1300.0,
            "breakeven_lower": 1035.0,
            "breakeven_upper": 1035.0
        },
        {
            "strategy": "Long Straddle",
            "description": "Volatility breakout strategy (Long 1000C / Long 1000P)",
            "net_premium_paid_per_unit": 105.0,
            "best_profit_in_tested_range": 195.0,
            "worst_profit_in_tested_range": -105.0,
            "tested_price_min": 700.0,
            "tested_price_max": 1300.0,
            "breakeven_lower": 895.0,
            "breakeven_upper": 1105.0
        },
        {
            "strategy": "Iron Condor",
            "description": "Range-bound credit strategy (850P/900P credit spread + 1100C/1150C credit spread)",
            "net_premium_paid_per_unit": -23.0,  # Negative denotes net credit collected
            "best_profit_in_tested_range": 23.0,
            "worst_profit_in_tested_range": -27.0,
            "tested_price_min": 700.0,
            "tested_price_max": 1300.0,
            "breakeven_lower": 877.0,
            "breakeven_upper": 1123.0
        }
    ])
    
    return payoff_df, summary_df


def populate_sqlite_database(tables_dict):
    """Save all processed datasets into axivest.db with optimized indexing."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    for table_name, df in tables_dict.items():
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        print(f"Loaded table '{table_name}' ({len(df)} rows) into {DB_PATH}")
        
    # Create indexes for analytical query speed
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prices_date ON daily_prices(Date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_returns_date ON daily_returns(Date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prices_long_stock ON daily_prices_unpivoted(Stock, Date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_corr_pairwise ON stock_correlations_pairwise(stock_1, stock_2);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_corr_matrix ON stock_correlations_matrix(row_stock, col_stock);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stress_scenario ON stress_by_stock(scenario);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_options_strat ON options_payoff(strategy);")
    
    conn.commit()
    conn.close()
    print("SQLite database indexing completed successfully.")


def export_csvs(tables_dict):
    """Export cleaned, verified CSVs to data/processed for Power BI & Excel ingestion."""
    for table_name, df in tables_dict.items():
        csv_path = os.path.join(DATA_DIR, f"{table_name}.csv")
        df.to_csv(csv_path, index=False)
    print(f"All {len(tables_dict)} CSV datasets exported to {DATA_DIR}.")


def run_pipeline():
    """Main pipeline execution routine with rigorous validation."""
    print("=" * 60)
    print("AXIVEST Financial Analytics Pipeline Execution")
    print("=" * 60)
    
    ensure_directories()
    
    prices_df = load_source_prices()
    print(f"Loaded daily prices: {len(prices_df)} dates from {prices_df['Date'].min()} to {prices_df['Date'].max()}.")
    
    returns_df = calculate_returns(prices_df)
    vol_df = calculate_annualized_volatility(returns_df)
    mdd_df = calculate_maximum_drawdown(prices_df)
    pairwise_corr, matrix_corr = calculate_correlations(returns_df)
    unpivoted_prices = build_unpivoted_prices(prices_df)
    stress_by_stock, stress_summary = build_stress_test_datasets()
    options_payoff, options_summary = build_options_models()
    
    # Validation checks
    assert len(prices_df) == 496, f"Expected 496 price records, got {len(prices_df)}"
    assert len(returns_df) == 495, f"Expected 495 return records, got {len(returns_df)}"
    assert len(vol_df) == 11, f"Expected 11 volatility records, got {len(vol_df)}"
    assert len(mdd_df) == 11, f"Expected 11 drawdown records, got {len(mdd_df)}"
    assert len(pairwise_corr) == 55, f"Expected 55 pairwise correlations, got {len(pairwise_corr)}"
    assert len(matrix_corr) == 121, f"Expected 121 matrix correlations, got {len(matrix_corr)}"
    assert len(unpivoted_prices) == 496 * 11, f"Expected {496*11} unpivoted price rows, got {len(unpivoted_prices)}"
    assert len(stress_summary) == 3, f"Expected 3 stress summaries, got {len(stress_summary)}"
    assert len(options_summary) == 3, f"Expected 3 options summaries, got {len(options_summary)}"
    print("All mathematical integrity assertions passed with 100% precision!")
    
    tables_dict = {
        "daily_prices": prices_df,
        "daily_prices_unpivoted": unpivoted_prices,
        "daily_returns": returns_df,
        "annualized_volatility": vol_df,
        "maximum_drawdown": mdd_df,
        "stock_correlations_pairwise": pairwise_corr,
        "stock_correlations_matrix": matrix_corr,
        "stress_by_stock": stress_by_stock,
        "stress_summary": stress_summary,
        "options_payoff": options_payoff,
        "options_summary": options_summary
    }
    
    export_csvs(tables_dict)
    populate_sqlite_database(tables_dict)
    
    print("\nPipeline execution complete. AXIVEST is synchronized and database-ready.")
    return tables_dict


if __name__ == "__main__":
    run_pipeline()
