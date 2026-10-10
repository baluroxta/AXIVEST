-- ==============================================================================
-- AXIVEST — Portfolio Risk & Options Intelligence
-- Analytical SQL Queries & Quantitative Research Script
-- Author: Kandala Guru Balaji
-- Degree: B.Tech Computer Science and Business Systems (3rd Year)
-- Tagline: "See the risk. Test the downside."
-- Database: SQLite (axivest.db)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- QUERY 1: Data Quality & Completeness Audit
-- Purpose: Verify data date ranges, observation counts, and asset coverage.
-- ------------------------------------------------------------------------------
SELECT 
    'daily_prices_unpivoted' AS table_name,
    COUNT(DISTINCT Stock) AS total_assets,
    MIN(Date) AS earliest_date,
    MAX(Date) AS latest_date,
    COUNT(*) AS total_observations,
    SUM(CASE WHEN Price IS NULL THEN 1 ELSE 0 END) AS null_price_count
FROM daily_prices_unpivoted

UNION ALL

SELECT 
    'daily_returns' AS table_name,
    11 AS total_assets,
    MIN(Date) AS earliest_date,
    MAX(Date) AS latest_date,
    COUNT(*) AS total_observations,
    0 AS null_price_count
FROM daily_returns;


-- ------------------------------------------------------------------------------
-- QUERY 2: Asset Risk Ranking (Volatility vs. Drawdown)
-- Purpose: Join volatility and drawdown tables and compute relative risk ranks
--          using SQL Window Functions (RANK() OVER).
-- ------------------------------------------------------------------------------
SELECT 
    v.stock,
    v.asset_type,
    v.annualized_volatility_pct,
    RANK() OVER (ORDER BY v.annualized_volatility_pct DESC) AS volatility_rank,
    m.max_drawdown_pct,
    RANK() OVER (ORDER BY m.max_drawdown_pct ASC) AS drawdown_severity_rank,
    m.peak_date,
    m.trough_date,
    ROUND(m.peak_price, 2) AS peak_price,
    ROUND(m.trough_price, 2) AS trough_price
FROM annualized_volatility v
JOIN maximum_drawdown m ON v.stock = m.stock
ORDER BY v.annualized_volatility_pct DESC;


-- ------------------------------------------------------------------------------
-- QUERY 3: Cumulative Return & Hypothetical Growth of ₹10,000 Invested
-- Purpose: Evaluate historical return trajectory from day one to the latest date
--          for each asset and compute ending capital.
-- ------------------------------------------------------------------------------
WITH InitialAndFinalPrices AS (
    SELECT 
        Stock,
        FIRST_VALUE(Price) OVER (PARTITION BY Stock ORDER BY Date ASC) AS start_price,
        LAST_VALUE(Price) OVER (
            PARTITION BY Stock 
            ORDER BY Date ASC 
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS end_price,
        MIN(Date) OVER (PARTITION BY Stock) AS start_date,
        MAX(Date) OVER (PARTITION BY Stock) AS end_date
    FROM daily_prices_unpivoted
)
SELECT DISTINCT
    Stock,
    start_date,
    end_date,
    ROUND(start_price, 2) AS start_price,
    ROUND(end_price, 2) AS end_price,
    ROUND(((end_price - start_price) / start_price) * 100.0, 2) AS total_cumulative_return_pct,
    ROUND(10000.0 * (end_price / start_price), 2) AS ending_value_of_10k_invested
FROM InitialAndFinalPrices
ORDER BY total_cumulative_return_pct DESC;


-- ------------------------------------------------------------------------------
-- QUERY 4: Pairwise Correlation Screening (Highest vs. Lowest Pairs)
-- Purpose: Identify top 5 co-moving pairs (high concentration risk) and
--          top 5 diversification pairs (lowest correlation).
-- ------------------------------------------------------------------------------
-- Top 5 Highest Correlated Pairs
SELECT 
    'High Co-movement' AS category,
    stock_1,
    stock_2,
    correlation
FROM stock_correlations_pairwise
ORDER BY correlation DESC
LIMIT 5;

-- Top 5 Lowest Correlated Pairs (Optimal Diversification)
SELECT 
    'High Diversification' AS category,
    stock_1,
    stock_2,
    correlation
FROM stock_correlations_pairwise
ORDER BY correlation ASC
LIMIT 5;


-- ------------------------------------------------------------------------------
-- QUERY 5: Macro Stress Testing Portfolio Loss Aggregation
-- Purpose: Aggregate stock-level shocks by scenario, verify weighted impact sums,
--          and compute residual portfolio value on illustrative ₹100,000.
-- ------------------------------------------------------------------------------
SELECT 
    scenario,
    COUNT(stock) AS assets_shocked,
    ROUND(AVG(portfolio_weight_pct), 1) AS equal_weight_each_pct,
    ROUND(SUM(weighted_impact_pct), 2) AS total_portfolio_return_pct,
    ROUND(ABS(SUM(weighted_impact_pct)), 2) AS total_portfolio_loss_pct,
    100000.0 AS starting_capital_inr,
    ROUND(100000.0 * (1.0 + (SUM(weighted_impact_pct) / 100.0)), 2) AS post_stress_capital_inr
FROM stress_by_stock
GROUP BY scenario
ORDER BY total_portfolio_loss_pct ASC;


-- ------------------------------------------------------------------------------
-- QUERY 6: Moving Averages & Trend Filtering (20-Day vs. 50-Day SMA)
-- Purpose: Compute moving averages using SQL window frames to evaluate
--          short-term momentum against medium-term trend for TCS.
-- ------------------------------------------------------------------------------
SELECT 
    Date,
    Stock,
    ROUND(Price, 2) AS close_price,
    ROUND(AVG(Price) OVER (
        PARTITION BY Stock 
        ORDER BY Date 
        ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
    ), 2) AS sma_20_day,
    ROUND(AVG(Price) OVER (
        PARTITION BY Stock 
        ORDER BY Date 
        ROWS BETWEEN 49 PRECEDING AND CURRENT ROW
    ), 2) AS sma_50_day,
    CASE 
        WHEN AVG(Price) OVER (PARTITION BY Stock ORDER BY Date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) >
             AVG(Price) OVER (PARTITION BY Stock ORDER BY Date ROWS BETWEEN 49 PRECEDING AND CURRENT ROW)
        THEN 'Bullish Momentum (20 > 50)'
        ELSE 'Bearish Pressure (20 <= 50)'
    END AS technical_trend
FROM daily_prices_unpivoted
WHERE Stock = 'TCS'
ORDER BY Date DESC
LIMIT 15;


-- ------------------------------------------------------------------------------
-- QUERY 7: Options Strategy Profitability Analysis
-- Purpose: Calculate strategy distribution, count of profitable expiration steps,
--          and boundaries across the tested price spectrum (₹700 - ₹1300).
-- ------------------------------------------------------------------------------
SELECT 
    strategy,
    COUNT(*) AS tested_price_points,
    SUM(CASE WHEN net_profit_per_unit > 0 THEN 1 ELSE 0 END) AS profitable_steps_count,
    SUM(CASE WHEN net_profit_per_unit = 0 THEN 1 ELSE 0 END) AS breakeven_steps_count,
    SUM(CASE WHEN net_profit_per_unit < 0 THEN 1 ELSE 0 END) AS loss_steps_count,
    ROUND(MAX(net_profit_per_unit), 2) AS max_profit_in_range,
    ROUND(MIN(net_profit_per_unit), 2) AS max_loss_in_range,
    ROUND(AVG(net_profit_per_unit), 2) AS average_profit_across_range
FROM options_payoff
GROUP BY strategy
ORDER BY max_profit_in_range DESC;


-- ------------------------------------------------------------------------------
-- QUERY 8: Equity Universe vs. Benchmark Index Summary
-- Purpose: Compare aggregate risk statistics between equities and the NIFTY 50 index.
-- ------------------------------------------------------------------------------
SELECT 
    v.asset_type,
    COUNT(v.stock) AS total_assets,
    ROUND(AVG(v.annualized_volatility_pct), 2) AS avg_volatility_pct,
    ROUND(MIN(v.annualized_volatility_pct), 2) AS min_volatility_pct,
    ROUND(MAX(v.annualized_volatility_pct), 2) AS max_volatility_pct,
    ROUND(AVG(m.max_drawdown_pct), 2) AS avg_max_drawdown_pct,
    ROUND(MIN(m.max_drawdown_pct), 2) AS worst_drawdown_pct
FROM annualized_volatility v
JOIN maximum_drawdown m ON v.stock = m.stock
GROUP BY v.asset_type;
