# AXIVEST — Financial Methodology & Quantitative Audit Documentation

**Project Name:** AXIVEST — Portfolio Risk & Options Intelligence  
**Author & Developer:** Kandala Guru Balaji  
**Degree:** B.Tech Computer Science and Business Systems (3rd Year)  
**Date:** October 2026  
**Tagline:** *“See the risk. Test the downside.”*  

---

## 1. Executive Summary

This document provides a formal audit and mathematical documentation of the quantitative models implemented across the AXIVEST data pipeline, database schema, and dashboard architecture. AXIVEST evaluates historical risk, macro downside scenarios, and derivatives payoff profiles across 10 major Indian equities and the NIFTY 50 benchmark over a two-year sample period (**October 2024 to October 2026**, 497 trading days).

---

## 2. Asset Universe

| Asset | Ticker (NSE) | Sector | Primary Role in Portfolio |
| :--- | :--- | :--- | :--- |
| **Bharti Airtel** | `BHARTIARTL.NS` | Telecommunications | Large-cap defensive growth |
| **HDFC Bank** | `HDFCBANK.NS` | Financial Services (Banking) | Heavyweight core banking |
| **ICICI Bank** | `ICICIBANK.NS` | Financial Services (Banking) | Core private banking growth |
| **Infosys** | `INFY.NS` | Information Technology | Global IT services & export |
| **ITC** | `ITC.NS` | FMCG & Diversified | Low-beta defensive dividend play |
| **Larsen & Toubro** | `LT.NS` | Infrastructure & Engineering | Industrial capex proxy |
| **Mahindra & Mahindra** | `M&M.NS` | Automobile & Manufacturing | Cyclical consumer & commercial auto |
| **NTPC** | `NTPC.NS` | Utilities & Energy | High-dividend utility stabilizer |
| **Reliance Industries** | `RELIANCE.NS` | Conglomerate / Energy & Retail | Index heavyweight diversifier |
| **TCS** | `TCS.NS` | Information Technology | Premier Indian IT bellwether |
| **NIFTY 50** | `^NSEI` | Benchmark Index | Market baseline & risk benchmark |

---

## 3. Mathematical Formulations & Metric Audits

### 3.1. Daily Returns
Daily arithmetic returns are calculated from adjusted close prices:
$$R_{i,t} = \frac{P_{i,t} - P_{i,t-1}}{P_{i,t-1}}$$
Where $P_{i,t}$ represents the dividend- and split-adjusted closing price of asset $i$ on trading day $t$.
* **Audit Result:** 495 daily return observations generated across all 11 assets. Maximum numerical discrepancy against raw price series is bounded below $10^{-15}$.

### 3.2. Annualized Volatility
Sample standard deviation is computed with Bessel's correction ($ddof = 1$) and annualized using the standard Indian equity market calendar assumption of 252 trading sessions per annum:
$$\sigma_{i,daily} = \sqrt{\frac{1}{N - 1} \sum_{t=1}^{N} (R_{i,t} - \bar{R}_i)^2}$$
$$\sigma_{i,annualized} = \sigma_{i,daily} \times \sqrt{252} \times 100\%$$
* **Audit Results:**
  * Highest Volatility: **Infosys (28.20%)**, **M&M (28.05%)**, **TCS (25.10%)**, **L&T (24.63%)**.
  * Moderate Volatility: **NTPC (21.27%)**, **Bharti Airtel (20.90%)**, **Reliance (20.79%)**, **HDFC Bank (19.81%)**, **ITC (19.50%)**, **ICICI Bank (18.48%)**.
  * Benchmark Baseline: **NIFTY 50 (13.13%)**.
  * Average Equity Volatility: **22.67%**.

### 3.3. Maximum Drawdown (MDD)
Maximum drawdown measures the maximum observed loss from a historical cumulative peak to a subsequent trough before a new peak is achieved:
$$\text{Peak}_{i,t} = \max_{s \le t} P_{i,s}$$
$$\text{Drawdown}_{i,t} = \frac{P_{i,t} - \text{Peak}_{i,t}}{\text{Peak}_{i,t}} \times 100\%$$
$$\text{MDD}_i = \min_{t} \text{Drawdown}_{i,t}$$
* **Audit Results & Exact Historical Dates:**
  * **TCS:** **-52.68%** (Peak: 2024-12-13 @ ₹4,166.66 $\rightarrow$ Trough: 2026-07-01 @ ₹1,971.80) — *Worst Historical Drawdown in Asset Universe*.
  * **Infosys:** **-48.17%** (Peak: 2024-12-13 @ ₹1,901.08 $\rightarrow$ Trough: 2026-07-01 @ ₹985.20).
  * **ITC:** **-42.37%** (Peak: 2024-10-15 @ ₹442.47 $\rightarrow$ Trough: 2026-10-08 @ ₹254.98).
  * **HDFC Bank:** **-31.04%** (Peak: 2025-07-30 @ ₹996.42 $\rightarrow$ Trough: 2026-09-09 @ ₹687.10).
  * **NTPC:** **-29.67%** (Peak: 2024-10-15 @ ₹405.51 $\rightarrow$ Trough: 2025-01-13 @ ₹285.20).
  * **M&M:** **-26.89%** (Peak: 2026-01-02 @ ₹3,657.89 $\rightarrow$ Trough: 2026-10-08 @ ₹2,674.20).
  * **Reliance:** **-26.33%** (Peak: 2026-01-02 @ ₹1,528.30 $\rightarrow$ Trough: 2026-10-01 @ ₹1,125.85).
  * **L&T:** **-24.35%** (Peak: 2026-02-23 @ ₹3,872.99 $\rightarrow$ Trough: 2026-03-23 @ ₹2,929.80).
  * **Bharti Airtel:** **-18.77%** (Peak: 2025-11-21 @ ₹1,991.97 $\rightarrow$ Trough: 2026-05-12 @ ₹1,618.00).
  * **ICICI Bank:** **-18.37%** (Peak: 2025-07-23 @ ₹1,464.85 $\rightarrow$ Trough: 2026-03-30 @ ₹1,195.80).
  * **NIFTY 50 Index:** **-15.56%** (Peak: 2026-01-02 @ ₹25,637.80 $\rightarrow$ Trough: 2026-10-08 @ ₹21,648.50).

### 3.4. Correlation Matrix
Pairwise Pearson correlation coefficient for daily returns between assets $X$ and $Y$:
$$r_{X,Y} = \frac{\sum_{t=1}^{N} (R_{X,t} - \bar{R}_X)(R_{Y,t} - \bar{R}_Y)}{\sqrt{\sum_{t=1}^{N} (R_{X,t} - \bar{R}_X)^2 \sum_{t=1}^{N} (R_{Y,t} - \bar{R}_Y)^2}}$$
* **Audit Results:**
  * Highest Correlation: **Infosys & TCS ($r = 0.7448$)** — demonstrating high industry co-movement.
  * Strong Bank Co-movement: **HDFC Bank & ICICI Bank ($r = 0.5038$)**.
  * Highest Index Sensitivity: **HDFC Bank & NIFTY 50 ($r = 0.7091$)**, **L&T & NIFTY 50 ($r = 0.6988$)**.
  * Lowest Correlation / Diversification: **Infosys & NTPC ($r = 0.0465$)**, **NTPC & TCS ($r = 0.0650$)**.

---

## 4. Macro Stress-Testing Methodology

Stress testing models hypothetical instantaneous shocks applied to an equal-weighted portfolio of 10 equities (10% weight each = 100% total equity exposure). The portfolio baseline capital is set to an illustrative **₹100,000**.

$$R_{\text{portfolio}} = \sum_{i=1}^{10} w_i \times \Delta_i \quad \text{where } w_i = 0.10$$
$$\text{Portfolio Loss (\%)} = |R_{\text{portfolio}}|$$
$$\text{Estimated Capital Post-Stress} = \text{₹}100,000 \times (1 + R_{\text{portfolio}})$$

### Scenarios Breakdown:
1. **Mild Stress (Correction / Sector Rotation):**
   * Shocks: IT (-5%), Banks (-4%), Auto (-6%), Energy (-5%), Utilities (-3%), FMCG (-3%).
   * **Portfolio Impact:** **-4.40%** | Loss: **4.40%** | Residual Capital: **₹95,600**.
2. **Moderate Stress (Macro Headwinds & Rate Hike Cycle):**
   * Shocks: IT (-12%), Banks (-10%), Auto (-15%), Energy (-12%), Utilities (-8%), FMCG (-7%).
   * **Portfolio Impact:** **-10.70%** | Loss: **10.70%** | Residual Capital: **₹89,300**.
3. **Severe Stress (Systemic Shock / Black Swan Liquidity Crisis):**
   * Shocks: IT (-25%), Banks (-22%), Auto (-30%), Energy (-25%), Utilities (-18%), FMCG (-15%).
   * **Portfolio Impact:** **-22.70%** | Loss: **22.70%** | Residual Capital: **₹77,300**.

---

## 5. Options Strategy Payoff Architecture

Payoff models calculate net profit per unit at expiration across spot prices $S_T \in [700, 1300]$ at increments of ₹25.

### 5.1. Bull Call Spread (Moderately Bullish, Capped Risk)
* **Structure:** Long 1 Call @ Strike $K_1 = 1000$ (Premium Paid = ₹50), Short 1 Call @ Strike $K_2 = 1100$ (Premium Received = ₹15).
* **Net Debit (Premium Paid):** $50 - 15 = \text{₹}35$.
* **Payoff Equation:**
  $$\Pi_{\text{BCS}}(S_T) = \max(S_T - 1000, 0) - \max(S_T - 1100, 0) - 35$$
* **Max Profit:** $(1100 - 1000) - 35 = \text{₹}65$ (Achieved when $S_T \ge 1100$).
* **Max Loss:** $-\text{₹}35$ (Occurs when $S_T \le 1000$).
* **Breakeven:** $K_1 + \text{Net Debit} = 1000 + 35 = \text{₹}1035$.

### 5.2. Long Straddle (Non-Directional Volatility Expansion)
* **Structure:** Long 1 Call @ Strike $K = 1000$ (Premium = ₹55), Long 1 Put @ Strike $K = 1000$ (Premium = ₹50).
* **Net Debit (Premium Paid):** $55 + 50 = \text{₹}105$.
* **Payoff Equation:**
  $$\Pi_{\text{Straddle}}(S_T) = \max(S_T - 1000, 0) + \max(1000 - S_T, 0) - 105$$
* **Max Profit:** Unlimited on upside, substantially large on downside ($1000 - 105 = \text{₹}895$).
* **Max Loss:** $-\text{₹}105$ (Occurs at $S_T = 1000$).
* **Breakevens:** Lower: $1000 - 105 = \text{₹}895$ | Upper: $1000 + 105 = \text{₹}1105$.

### 5.3. Iron Condor (Range-Bound Volatility Contraction / Credit)
* **Structure:** Long Put $K_{p1} = 850$ (Paid ₹5), Short Put $K_{p2} = 900$ (Rec ₹14), Short Call $K_{c1} = 1100$ (Rec ₹18), Long Call $K_{c2} = 1150$ (Paid ₹4).
* **Net Credit Collected:** $14 - 5 + 18 - 4 = \text{₹}23$ (Represented as Net Premium Paid = -₹23).
* **Payoff Equation:**
  $$\Pi_{\text{IC}}(S_T) = \max(850 - S_T, 0) - \max(900 - S_T, 0) - \max(S_T - 1100, 0) + \max(S_T - 1150, 0) + 23$$
* **Max Profit:** $+\text{₹}23$ (Achieved when $900 \le S_T \le 1100$).
* **Max Loss:** $\text{Wing Width} - \text{Net Credit} = (900 - 850) - 23 = \text{₹}27$ (Occurs when $S_T \le 850$ or $S_T \ge 1150$).
* **Breakevens:** Lower: $900 - 23 = \text{₹}877$ | Upper: $1100 + 23 = \text{₹}1123$.

---

## 6. Disclosures, Assumptions & Limitations

1. **Transaction Costs:** Omitted for mathematical clarity. In real-world Indian markets, brokerage, Securities Transaction Tax (STT), exchange turnover charges, SEBI turnover fees, stamp duty, and 18% GST apply and reduce net returns.
2. **Execution Slippage & Bid-Ask Spreads:** Theoretical prices assume execution exactly at modelled strike and settlement premiums.
3. **Settlement Mechanism:** Indian index options (e.g. NIFTY) are cash-settled European-style (`CE`/`PE`). Equity options in India are physically settled upon expiry for in-the-money (ITM) contracts.
4. **Survivorship Bias:** The selected 10 equities reflect current heavyweight market capitalization. Historical analysis of current winners does not account for companies that de-listed or fell out of the index over earlier decades.
5. **Educational Disclaimer:** AXIVEST is designed exclusively for quantitative portfolio assessment and academic demonstration. No part of this analysis constitutes financial advice or performance guarantees.
