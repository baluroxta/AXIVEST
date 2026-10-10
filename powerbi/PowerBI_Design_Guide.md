# AXIVEST — Power BI Dashboard Architecture & Design Guide

**Project Title:** AXIVEST — Portfolio Risk & Options Intelligence  
**Author:** Kandala Guru Balaji  
**Degree:** B.Tech Computer Science and Business Systems (3rd Year)  
**Tagline:** *“See the risk. Test the downside.”*  
**Theme:** Institutional Financial Dark / Executive Navy  

---

## 1. Executive Dashboard Architecture

The AXIVEST Power BI Dashboard is organized into an intuitive, high-impact financial risk cockpit:

```
+---------------------------------------------------------------------------------------------------+
|  [AXIVEST LOGO]  AXIVEST — Portfolio Risk & Options Intelligence         Author: Kandala Guru Balaji |
+---------------------------------------------------------------------------------------------------+
|  [Avg Volatility]  |  [Worst Drawdown]  |  [Total Assets]  |  [Severe Stress Loss]  |  [Strategies]  |
|      22.7%         |      -52.7%        |       11         |         -22.7%         |       3        |
+---------------------------------------------------------------------------------------------------+
|  [SLICER: Asset Selector]                                                                         |
+---------------------------------------------------+-----------------------------------------------+
|  VISUAL 1: Historical Performance (Base 100)      |  VISUAL 2: Annualized Volatility Ranking      |
|  Line Chart with Stock Selector Slicer            |  Horizontal Clustered Bar Chart               |
+---------------------------------------------------+-----------------------------------------------+
|  VISUAL 3: Maximum Historical Drawdown            |  VISUAL 4: Pairwise Correlation Heatmap       |
|  Horizontal Bar Chart (Peak-to-Trough)            |  Symmetrical 11x11 Matrix with Color Scale    |
+---------------------------------------------------+-----------------------------------------------+
|  VISUAL 5: Macro Stress Testing Scenarios         |  VISUAL 6: Options Payoff at Expiration       |
|  Portfolio Loss (Mild / Moderate / Severe)        |  Payoff Curves (Bull Call, Straddle, Condor)  |
+---------------------------------------------------+-----------------------------------------------+
```

---

## 2. Step 1: Loading Data into Power BI Desktop

All required datasets have been generated and validated in `AXIVEST/data/processed/` (and copied to your `Downloads` directory for convenience):

1. Open **Power BI Desktop**.
2. Click **Get Data** $\rightarrow$ **Text/CSV**.
3. Load the following CSV files:
   * `daily_prices.csv` (Wide format historical prices)
   * `daily_prices_unpivoted.csv` (Long format with `Normalized_Price_100` and `Daily_Return_Pct`)
   * `daily_returns.csv` (Wide format daily returns)
   * `annualized_volatility.csv` (Risk rankings & asset classification)
   * `maximum_drawdown.csv` (Peak/trough drawdown metrics)
   * `stock_correlations_matrix.csv` (Full $11 \times 11$ symmetrical grid for heatmap)
   * `stress_by_stock.csv` & `stress_summary.csv` (Macro stress scenarios)
   * `options_payoff.csv` & `options_summary.csv` (Derivatives payoff curves)

> [!TIP]
> Alternatively, if you prefer connecting directly to the SQLite database `axivest.db`, use **Get Data** $\rightarrow$ **ODBC** (selecting SQLite3 Driver) or directly import the CSV exports, which load immediately without requiring third-party drivers.

---

## 3. Step 2: Preserving Existing Visuals & Unpivoting for the Stock Selector

To fulfill your requirement of **adding a working stock selector without breaking existing visuals that rely on the wide `daily_prices` table**, follow these exact click-by-click instructions:

### How to Duplicate and Unpivot in Power Query:
1. In Power BI Desktop, click **Home** $\rightarrow$ **Transform Data** (opens Power Query Editor).
2. In the **Queries** pane on the left, right-click on `daily_prices` and select **Duplicate** (this creates `daily_prices (2)`).
3. Right-click the new query and rename it to: `daily_prices_unpivoted`.
4. In the data preview of `daily_prices_unpivoted`:
   * Right-click on the **`Date`** column header.
   * Select **Unpivot Other Columns**.
   * Notice that Power Query instantly converts the 11 asset columns into two columns: `Attribute` and `Value`.
5. Rename the columns:
   * Rename `Attribute` $\rightarrow$ **`Stock`** (Data Type: *Text*).
   * Rename `Value` $\rightarrow$ **`Price`** (Data Type: *Decimal Number*).
   * Ensure `Date` has Data Type: *Date*.
6. Click **Close & Apply** in the top-left corner.
* **Outcome:** Your original `daily_prices` table remains completely untouched and wide, while `daily_prices_unpivoted` gives you the long format required for the interactive Stock Selector slicer!

---

## 4. Step 3: DAX Measures Setup

In Power BI Desktop, create a dedicated Measures Table:
1. Click **Home** $\rightarrow$ **Enter Data**.
2. Name the table **`_DAX_Measures`** and click **Load**.
3. In the Data pane, right-click `_DAX_Measures` and select **New Measure**.
4. Copy and paste the measures from [DAX_Measures.dax](file:///c:/Users/kanda/Downloads/Stock_Market_Performance_Dashboard_and_Risk_Analysis-main/Stock_Market_Performance_Dashboard_and_Risk_Analysis-main/AXIVEST/powerbi/DAX_Measures.dax):
   * `Average Annualized Volatility`
   * `Worst Historical Drawdown`
   * `Total Assets Analysed`
   * `Severe Stress Portfolio Loss`
   * `Options Strategies Analysed`
   * `Portfolio Value Post-Stress`
   * `Expiration Profit Per Unit`

---

## 5. Step 4: Visuals Configuration & Formatting Guide

### Visual 1 to 5: Executive KPI Cards (Top Row)
* **Type:** Card or New Card Visual (horizontal layout).
* **Card 1:** `Average Annualized Volatility` (Format: `0.0%` $\rightarrow$ Shows **22.7%**).
* **Card 2:** `Worst Historical Drawdown` (Format: `0.0%` $\rightarrow$ Shows **-52.7%**). Accent: Red.
* **Card 3:** `Total Assets Analysed` (Format: `0` $\rightarrow$ Shows **11**).
* **Card 4:** `Severe Stress Portfolio Loss` (Format: `0.0%` $\rightarrow$ Shows **22.7%**). Accent: Amber/Red.
* **Card 5:** `Options Strategies Analysed` (Format: `0` $\rightarrow$ Shows **3**).

---

### Visual 6: Interactive Historical Price Trend & Stock Selector
* **Chart Type:** **Line Chart**.
* **Source Table:** `daily_prices_unpivoted`.
* **Field Mapping:**
  * **X-axis:** `daily_prices_unpivoted[Date]` (Set to Date, not Hierarchy, for smooth daily trend).
  * **Y-axis:** `daily_prices_unpivoted[Normalized_Price_100]` (Average or Max).
  * **Legend:** `daily_prices_unpivoted[Stock]`.
  * **Tooltips:** `daily_prices_unpivoted[Price]`, `daily_prices_unpivoted[Daily_Return_Pct]`.
* **Slicer Configuration:**
  * Add a **Slicer** visual beside or above the chart.
  * Field: `daily_prices_unpivoted[Stock]`.
  * Style: **Dropdown** or **Tile / Horizontal Buttons**.
  * Slicer Settings: Enable **Selection** $\rightarrow$ *Show "Select All"* option.
* **Why Normalized Base 100?**  
  TCS trades around ₹3,000–₹4,000, while NTPC trades around ₹300–₹400. Using raw prices distorts the Y-axis scale. Using `Normalized_Price_100` allows any stock (or multiple stocks) to be compared directly against NIFTY 50 on a shared baseline of 100!

---

### Visual 7: Annualized Volatility Ranking
* **Chart Type:** **Clustered Bar Chart** (Horizontal bars).
* **Source Table:** `annualized_volatility`.
* **Field Mapping:**
  * **Y-axis:** `annualized_volatility[stock]`.
  * **X-axis:** `annualized_volatility[annualized_volatility_pct]`.
  * **Sort:** Sort Y-axis by `annualized_volatility_pct` **Descending**.
  * **Data Labels:** Turn **On** (Display units: None, Decimal places: 1, Format: `0.0%`).
  * **Conditional Formatting / Colors:** Give `NIFTY 50` a distinct neutral grey bar (`#64748B`), and equity bars deep navy/blue (`#1B365D`).

---

### Visual 8: Maximum Historical Drawdown Comparison
* **Chart Type:** **Clustered Bar Chart** (Horizontal bars).
* **Source Table:** `maximum_drawdown`.
* **Field Mapping:**
  * **Y-axis:** `maximum_drawdown[stock]`.
  * **X-axis:** `maximum_drawdown[max_drawdown_pct]`.
  * **Sort:** Sort by `max_drawdown_pct` **Ascending** (worst drawdown at top: TCS -52.7%, Infosys -48.2%).
  * **Bar Color:** Coral Red (`#E53E3E`) to visually signal downside risk.
  * **Tooltips:** `maximum_drawdown[peak_date]`, `maximum_drawdown[trough_date]`, `maximum_drawdown[peak_price]`, `maximum_drawdown[trough_price]`.

---

### Visual 9: Correlation Matrix Heatmap
* **Chart Type:** **Matrix Visual**.
* **Source Table:** `stock_correlations_matrix`.
* **Field Mapping:**
  * **Rows:** `stock_correlations_matrix[row_stock]`.
  * **Columns:** `stock_correlations_matrix[col_stock]`.
  * **Values:** `stock_correlations_matrix[correlation]`.
* **Conditional Formatting (The Heatmap Effect):**
  1. In the Visualizations pane, go to **Format visual** $\rightarrow$ **Cell elements**.
  2. Select **Background color** and toggle it **On** (click the $fx$ button).
  3. Format style: **Gradient**.
  4. Minimum (Value: 0.0): Light Green (`#C6F6D5` — High diversification).
  5. Center (Value: 0.5): Light Yellow (`#FEFCBF`).
  6. Maximum (Value: 1.0): Deep Red (`#FEB2B2` — Strong co-movement / concentration risk).
* **Outcome:** You now have an institutional-grade, full $11 \times 11$ heatmap without blank cells or manual hacks!

---

### Visual 10: Macro Stress Testing Portfolio Loss
* **Chart Type:** **Clustered Column Chart**.
* **Source Table:** `stress_summary`.
* **Field Mapping:**
  * **X-axis:** `stress_summary[scenario]` (*Mild Stress, Moderate Stress, Severe Stress*).
  * **Y-axis:** `stress_summary[portfolio_loss_pct]`.
  * **Data Labels:** Turn **On** (Shows 4.4%, 10.7%, 22.7%).
  * **Color:** 
    * Mild Stress: `#F6AD55` (Soft Orange)
    * Moderate Stress: `#ED8936` (Amber)
    * Severe Stress: `#C53030` (Crimson)
  * **Sub-title / Note:** *"Illustrative instantaneous shock on ₹100,000 portfolio."*

---

### Visual 11: Options Strategy Payoff at Expiration
* **Chart Type:** **Line Chart**.
* **Source Table:** `options_payoff`.
* **Field Mapping:**
  * **X-axis:** `options_payoff[underlying_at_expiry]` (Continuous axis, ₹700 to ₹1,300).
  * **Y-axis:** `options_payoff[net_profit_per_unit]`.
  * **Legend:** `options_payoff[strategy]`.
* **Analytics Line:**
  * In the **Analytics pane**, add a **Constant Line** on Y-axis = `0`.
  * Style: **Dashed**, Color: Grey (`#718096`), Title: **Breakeven (₹0)**.
* **Line Colors:**
  * Bull Call Spread: Blue (`#2B6CB0`)
  * Long Straddle: Purple (`#805AD5`)
  * Iron Condor: Teal/Green (`#319795`)

---

## 6. Design Best Practices Implemented

1. **Title & Number Formats:** Every percentage is displayed with one decimal place (`0.0%`), and currency values in Indian Rupees (`₹#,##0`).
2. **Contextual Tooltips:** Hovering over any stock bar reveals peak dates, trough dates, and nominal values.
3. **No Decorative Clutter:** Every chart addresses a specific quantitative question (Volatility, Downside Drawdown, Macro Shock, Expiration Payoff).
4. **Attribution:** Title banner clearly credits **Kandala Guru Balaji**.
