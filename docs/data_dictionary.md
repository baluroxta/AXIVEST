# AXIVEST — Comprehensive Data Dictionary

**Project Title:** AXIVEST — Portfolio Risk & Options Intelligence  
**Author:** Kandala Guru Balaji  
**Degree:** B.Tech Computer Science and Business Systems (3rd Year)  
**Database:** SQLite (`axivest.db`) | Flat Files: CSV (`data/processed/`)  

---

## 1. Table: `daily_prices`
* **Purpose:** Stores raw adjusted closing prices in wide format for all 10 equities and the NIFTY 50 index benchmark.
* **Granularity:** One record per trading day.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `Date` | TEXT (ISO 8601) | PRIMARY KEY | Trading session date (`YYYY-MM-DD`) | `2024-10-09` |
| `Bharti Airtel` | REAL | NOT NULL | Adjusted close price in INR | `1643.50` |
| `HDFC Bank` | REAL | NOT NULL | Adjusted close price in INR | `792.58` |
| `ICICI Bank` | REAL | NOT NULL | Adjusted close price in INR | `1224.30` |
| `Infosys` | REAL | NOT NULL | Adjusted close price in INR | `1835.55` |
| `ITC` | REAL | NOT NULL | Adjusted close price in INR | `436.39` |
| `L&T` | REAL | NOT NULL | Adjusted close price in INR | `3421.46` |
| `M&M` | REAL | NOT NULL | Adjusted close price in INR | `3095.36` |
| `NTPC` | REAL | NOT NULL | Adjusted close price in INR | `397.76` |
| `Reliance` | REAL | NOT NULL | Adjusted close price in INR | `1362.83` |
| `TCS` | REAL | NOT NULL | Adjusted close price in INR | `3951.25` |
| `NIFTY 50` | REAL | NOT NULL | Index adjusted closing value | `24981.95` |

---

## 2. Table: `daily_prices_unpivoted`
* **Purpose:** Normalized long format table essential for Power BI dynamic stock selector slicers and cross-asset relative comparisons.
* **Granularity:** One record per asset per trading day (5,456 rows).

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `Date` | TEXT | COMPOSITE KEY | Trading session date (`YYYY-MM-DD`) | `2024-10-09` |
| `Stock` | TEXT | COMPOSITE KEY | Asset or Index name | `TCS` |
| `Price` | REAL | NOT NULL | Nominal adjusted close price in INR | `3951.25` |
| `Normalized_Price_100` | REAL | NOT NULL | Rebased price index (Base 100 on start date) | `100.00` |
| `Daily_Return_Pct` | REAL | NULLABLE | Daily percentage return ($R_t \times 100\%$) | `1.25` |

---

## 3. Table: `daily_returns`
* **Purpose:** Stores daily percentage return observations in wide format for all assets ($R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$).
* **Granularity:** One record per trading day (495 rows).

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `Date` | TEXT | PRIMARY KEY | Trading session date (`YYYY-MM-DD`) | `2024-10-10` |
| `[Asset Names]` | REAL | NOT NULL | Arithmetic daily return in decimal | `0.0179` (+1.79%) |

---

## 4. Table: `annualized_volatility`
* **Purpose:** Stores annualized volatility calculated over the historical sample period.
* **Formula:** $\sigma_{\text{ann}} = \text{std}(R, ddof=1) \times \sqrt{252} \times 100\%$.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `stock` | TEXT | PRIMARY KEY | Asset or Index name | `Infosys` |
| `annualized_volatility_pct` | REAL | NOT NULL | Annualized sample standard deviation in % | `28.2009` |
| `asset_type` | TEXT | CHECK | Category: `Equity` or `Index` | `Equity` |

---

## 5. Table: `maximum_drawdown`
* **Purpose:** Stores historical maximum peak-to-trough decline metrics with exact turning-point dates.
* **Formula:** $\text{MDD} = \min_t \left( \frac{P_t - \max_{s \le t} P_s}{\max_{s \le t} P_s} \right) \times 100\%$.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `stock` | TEXT | PRIMARY KEY | Asset or Index name | `TCS` |
| `max_drawdown_pct` | REAL | NOT NULL | Maximum historical percentage drawdown | `-52.68` |
| `peak_date` | TEXT | NOT NULL | Date when running peak occurred | `2024-12-13` |
| `peak_price` | REAL | NOT NULL | Price level at historical peak | `4166.66` |
| `trough_date` | TEXT | NOT NULL | Date when maximum drawdown was reached | `2026-07-01` |
| `trough_price` | REAL | NOT NULL | Price level at historical trough | `1971.79` |
| `asset_type` | TEXT | CHECK | Category: `Equity` or `Index` | `Equity` |

---

## 6. Table: `stock_correlations_pairwise`
* **Purpose:** Stores unique pairwise Pearson correlation coefficients (55 unique pairs) for SQL ranking and diversification queries.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `stock_1` | TEXT | COMPOSITE KEY | First asset in pair | `Infosys` |
| `stock_2` | TEXT | COMPOSITE KEY | Second asset in pair | `TCS` |
| `correlation` | REAL | NOT NULL | Pearson correlation coefficient $[-1.0, 1.0]$ | `0.7448` |

---

## 7. Table: `stock_correlations_matrix`
* **Purpose:** Stores complete $11 \times 11$ symmetrical grid (121 cells) formatted for Power BI Matrix Heatmap visuals.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `row_stock` | TEXT | COMPOSITE KEY | Matrix row header asset | `HDFC Bank` |
| `col_stock` | TEXT | COMPOSITE KEY | Matrix column header asset | `ICICI Bank` |
| `correlation` | REAL | NOT NULL | Pearson correlation coefficient | `0.5038` |

---

## 8. Table: `stress_by_stock`
* **Purpose:** Asset-level shock assumptions and weighted impacts across 3 hypothetical macro stress scenarios.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `scenario` | TEXT | COMPOSITE KEY | Macro scenario (*Mild, Moderate, Severe*) | `Severe Stress` |
| `stock` | TEXT | COMPOSITE KEY | Equity asset name | `M&M` |
| `assumed_shock_pct` | REAL | NOT NULL | Hypothetical asset drop in % | `-30.0` |
| `portfolio_weight_pct` | REAL | NOT NULL | Portfolio allocation weight in % | `10.0` |
| `weighted_impact_pct` | REAL | NOT NULL | $\text{Shock} \times \text{Weight} / 100$ | `-3.0` |

---

## 9. Table: `stress_summary`
* **Purpose:** Portfolio-level aggregate loss and residual capital on an illustrative ₹100,000 baseline.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `scenario` | TEXT | PRIMARY KEY | Scenario name | `Severe Stress` |
| `portfolio_return_pct` | REAL | NOT NULL | Net portfolio return in % | `-22.7` |
| `portfolio_loss_pct` | REAL | NOT NULL | Absolute percentage portfolio loss | `22.7` |
| `starting_portfolio_value`| REAL | NOT NULL | Baseline investment capital in INR | `100000.0` |
| `estimated_value_after_stress`| REAL | NOT NULL | Residual portfolio value in INR | `77300.0` |

---

## 10. Table: `options_payoff`
* **Purpose:** Expiration profit/loss curves for 3 options strategies across underlying spot prices from ₹700 to ₹1,300.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `strategy` | TEXT | COMPOSITE KEY | Strategy name | `Bull Call Spread` |
| `underlying_at_expiry` | REAL | COMPOSITE KEY | Spot price at contract expiry in INR | `1050.0` |
| `net_profit_per_unit` | REAL | NOT NULL | Net profit/loss per unit at expiry in INR | `15.0` |

---

## 11. Table: `options_summary`
* **Purpose:** Strategy-level contract boundaries, premium debits/credits, and breakeven coordinates.

| Column | Data Type | Constraint | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `strategy` | TEXT | PRIMARY KEY | Strategy name | `Bull Call Spread` |
| `description` | TEXT | NOT NULL | Strategy description | `Limited-risk bullish play` |
| `net_premium_paid_per_unit` | REAL | NOT NULL | Net initial debit (positive) or credit (negative) | `35.0` |
| `best_profit_in_tested_range` | REAL | NOT NULL | Maximum achievable profit | `65.0` |
| `worst_profit_in_tested_range` | REAL | NOT NULL | Maximum potential loss | `-35.0` |
| `tested_price_min` | REAL | NOT NULL | Minimum tested underlying price | `700.0` |
| `tested_price_max` | REAL | NOT NULL | Maximum tested underlying price | `1300.0` |
| `breakeven_lower` | REAL | NOT NULL | Lower underlying breakeven point | `1035.0` |
| `breakeven_upper` | REAL | NOT NULL | Upper underlying breakeven point | `1035.0` |
