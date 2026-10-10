-- ==============================================================================
-- AXIVEST — Portfolio Risk & Options Intelligence
-- Relational Schema DDL & Architecture Definition
-- Author: Kandala Guru Balaji
-- Degree: B.Tech Computer Science and Business Systems (3rd Year)
-- Tagline: "See the risk. Test the downside."
-- Database: SQLite (axivest.db)
-- ==============================================================================

-- 1. Daily Prices Table (Wide Format for historical reference)
CREATE TABLE IF NOT EXISTS daily_prices (
    Date TEXT PRIMARY KEY,
    "Bharti Airtel" REAL NOT NULL,
    "HDFC Bank" REAL NOT NULL,
    "ICICI Bank" REAL NOT NULL,
    "Infosys" REAL NOT NULL,
    "ITC" REAL NOT NULL,
    "L&T" REAL NOT NULL,
    "M&M" REAL NOT NULL,
    "NTPC" REAL NOT NULL,
    "Reliance" REAL NOT NULL,
    "TCS" REAL NOT NULL,
    "NIFTY 50" REAL NOT NULL
);

-- 2. Daily Prices Unpivoted Table (Normalized long format for Power BI & SQL analysis)
CREATE TABLE IF NOT EXISTS daily_prices_unpivoted (
    Date TEXT NOT NULL,
    Stock TEXT NOT NULL,
    Price REAL NOT NULL,
    Normalized_Price_100 REAL NOT NULL,
    Daily_Return_Pct REAL,
    PRIMARY KEY (Date, Stock)
);

-- 3. Daily Percentage Returns (Wide Format)
CREATE TABLE IF NOT EXISTS daily_returns (
    Date TEXT PRIMARY KEY,
    "Bharti Airtel" REAL NOT NULL,
    "HDFC Bank" REAL NOT NULL,
    "ICICI Bank" REAL NOT NULL,
    "Infosys" REAL NOT NULL,
    "ITC" REAL NOT NULL,
    "L&T" REAL NOT NULL,
    "M&M" REAL NOT NULL,
    "NTPC" REAL NOT NULL,
    "Reliance" REAL NOT NULL,
    "TCS" REAL NOT NULL,
    "NIFTY 50" REAL NOT NULL
);

-- 4. Annualized Volatility Table
CREATE TABLE IF NOT EXISTS annualized_volatility (
    stock TEXT PRIMARY KEY,
    annualized_volatility_pct REAL NOT NULL,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('Equity', 'Index'))
);

-- 5. Maximum Drawdown Table
CREATE TABLE IF NOT EXISTS maximum_drawdown (
    stock TEXT PRIMARY KEY,
    max_drawdown_pct REAL NOT NULL,
    peak_date TEXT NOT NULL,
    peak_price REAL NOT NULL,
    trough_date TEXT NOT NULL,
    trough_price REAL NOT NULL,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('Equity', 'Index'))
);

-- 6. Pairwise Stock Correlations (Unique combinations, 55 pairs)
CREATE TABLE IF NOT EXISTS stock_correlations_pairwise (
    stock_1 TEXT NOT NULL,
    stock_2 TEXT NOT NULL,
    correlation REAL NOT NULL,
    PRIMARY KEY (stock_1, stock_2)
);

-- 7. Stock Correlation Matrix (Full 11x11 symmetric grid, 121 cells)
CREATE TABLE IF NOT EXISTS stock_correlations_matrix (
    row_stock TEXT NOT NULL,
    col_stock TEXT NOT NULL,
    correlation REAL NOT NULL,
    PRIMARY KEY (row_stock, col_stock)
);

-- 8. Stress Test Shocks by Stock
CREATE TABLE IF NOT EXISTS stress_by_stock (
    scenario TEXT NOT NULL,
    stock TEXT NOT NULL,
    assumed_shock_pct REAL NOT NULL,
    portfolio_weight_pct REAL NOT NULL,
    weighted_impact_pct REAL NOT NULL,
    PRIMARY KEY (scenario, stock)
);

-- 9. Stress Test Portfolio Summary
CREATE TABLE IF NOT EXISTS stress_summary (
    scenario TEXT PRIMARY KEY,
    portfolio_return_pct REAL NOT NULL,
    portfolio_loss_pct REAL NOT NULL,
    starting_portfolio_value REAL NOT NULL,
    estimated_value_after_stress REAL NOT NULL
);

-- 10. Options Expiration Payoff Curves
CREATE TABLE IF NOT EXISTS options_payoff (
    strategy TEXT NOT NULL,
    underlying_at_expiry REAL NOT NULL,
    net_profit_per_unit REAL NOT NULL,
    PRIMARY KEY (strategy, underlying_at_expiry)
);

-- 11. Options Strategies Summary
CREATE TABLE IF NOT EXISTS options_summary (
    strategy TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    net_premium_paid_per_unit REAL NOT NULL,
    best_profit_in_tested_range REAL NOT NULL,
    worst_profit_in_tested_range REAL NOT NULL,
    tested_price_min REAL NOT NULL,
    tested_price_max REAL NOT NULL,
    breakeven_lower REAL NOT NULL,
    breakeven_upper REAL NOT NULL
);

-- Indexes for Optimal Analytical Performance
CREATE INDEX IF NOT EXISTS idx_prices_date ON daily_prices(Date);
CREATE INDEX IF NOT EXISTS idx_returns_date ON daily_returns(Date);
CREATE INDEX IF NOT EXISTS idx_prices_long_stock ON daily_prices_unpivoted(Stock, Date);
CREATE INDEX IF NOT EXISTS idx_corr_pairwise ON stock_correlations_pairwise(stock_1, stock_2);
CREATE INDEX IF NOT EXISTS idx_corr_matrix ON stock_correlations_matrix(row_stock, col_stock);
CREATE INDEX IF NOT EXISTS idx_stress_scenario ON stress_by_stock(scenario);
CREATE INDEX IF NOT EXISTS idx_options_strat ON options_payoff(strategy);
