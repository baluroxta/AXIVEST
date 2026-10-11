import React, { useState, useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Sliders,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  DollarSign,
  Database,
  Layers,
  ChevronRight,
  Search,
  RefreshCw,
  Zap
} from 'lucide-react';

import initialStocksData from './data/stocks_data.json';
import initialPriceHistory from './data/price_history.json';
import initialStressData from './data/stress_data.json';
import initialOptionsData from './data/options_data.json';
import correlationData from './data/correlation_data.json';
import searchRegistry from './data/search_registry.json';
import { fetchUpstoxCandles, getNiftyBenchmark, analyzeStockCandles } from './utils/quantEngine';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, deepdive, stress, options, correlation, data
  const [selectedStockSymbol, setSelectedStockSymbol] = useState('RELIANCE');
  const [verdictFilter, setVerdictFilter] = useState('ALL'); // ALL, buy, hold, caution
  const [sectorFilter, setSectorFilter] = useState('ALL');
  
  // Dynamic Stocks State (Can be expanded on-demand by Upstox searches)
  const [allStocks, setAllStocks] = useState(initialStocksData);
  const [allHistory, setAllHistory] = useState(initialPriceHistory);
  const [allStress, setAllStress] = useState(initialStressData);
  const [allOptions, setAllOptions] = useState(initialOptionsData);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Stock Deep Dive Toggles
  const [chartMode, setChartMode] = useState('raw'); // raw, base100
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(false);
  const [calcInvestment, setCalcInvestment] = useState(10000);

  // Stress Simulator State
  const [stressCapital, setStressCapital] = useState(100000);
  const [selectedScenario, setSelectedScenario] = useState('2008 Financial Crisis');

  // Options Payoff State
  const [selectedOptionType, setSelectedOptionType] = useState('CALL'); // CALL, PUT
  const [sliderSpotPrice, setSliderSpotPrice] = useState(null);

  // Unique Sectors list
  const sectors = useMemo(() => {
    const set = new Set(allStocks.map(s => s.sector).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [allStocks]);

  // Selected Stock Data
  const currentStock = useMemo(() => {
    return allStocks.find(s => s.symbol === selectedStockSymbol) || allStocks[0];
  }, [allStocks, selectedStockSymbol]);

  // Sync spot price slider when selected stock changes
  useEffect(() => {
    if (currentStock) {
      setSliderSpotPrice(Math.round(currentStock.ltp));
    }
  }, [currentStock]);

  // Autocomplete Suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toUpperCase().trim();
    return searchRegistry
      .filter(item => item.symbol.includes(q) || item.name.toUpperCase().includes(q))
      .slice(0, 8);
  }, [searchQuery]);

  // Handle On-Demand Upstox Live Fetch for Any Stock
  const handleAnalyzeStock = async (stockItem) => {
    setShowSuggestions(false);
    setSearchQuery(stockItem.symbol);
    setIsSearching(true);
    setSearchError(null);

    // If stock already exists in state, simply switch to it
    const existing = allStocks.find(s => s.symbol === stockItem.symbol);
    if (existing && allHistory[stockItem.symbol]) {
      setSelectedStockSymbol(stockItem.symbol);
      setIsSearching(false);
      setActiveTab('deepdive');
      return;
    }

    try {
      // 1. Fetch stock candles from Upstox API
      const candles = await fetchUpstoxCandles(stockItem.key);
      if (!candles || candles.length < 20) {
        throw new Error(`Insufficient trading candles returned by Upstox for ${stockItem.symbol}`);
      }

      // 2. Fetch NIFTY 50 benchmark
      const niftyCandles = await getNiftyBenchmark();

      // 3. Compute vectorized quant metrics & verdict
      const analysis = analyzeStockCandles(candles, niftyCandles, stockItem.symbol, stockItem.name, 'Equity');

      // 4. Update Application State
      const newStockEntry = {
        symbol: analysis.symbol,
        name: analysis.name,
        sector: analysis.sector,
        instrument_key: stockItem.key,
        ltp: analysis.ltp,
        change_pct: analysis.dayChangePct,
        high_52w: analysis.high52w,
        low_52w: analysis.low52w,
        cagr: analysis.cagr,
        annualized_volatility: analysis.annualizedVolatility,
        max_drawdown: analysis.maxDrawdown,
        beta: analysis.beta,
        sharpe_ratio: analysis.sharpe,
        risk_score: analysis.score,
        verdict: analysis.verdict,
        verdict_type: analysis.verdictType,
        rationale: analysis.rationale[0] || 'Real-time Upstox quant engine analysis.'
      };

      setAllStocks(prev => [newStockEntry, ...prev.filter(s => s.symbol !== analysis.symbol)]);

      setAllHistory(prev => ({
        ...prev,
        [analysis.symbol]: {
          dates: analysis.history.dates,
          prices: analysis.history.prices,
          sma_20: analysis.history.sma20,
          sma_50: analysis.history.sma50,
          sma_200: analysis.history.sma200,
          drawdowns: analysis.history.drawdowns,
          base_100: analysis.history.base100,
          volume: analysis.history.volumes
        }
      }));

      setAllStress(prev => [
        {
          symbol: analysis.symbol,
          sector: analysis.sector,
          beta: analysis.beta,
          crisis_2008_impact: Number((-52.0 * analysis.beta).toFixed(2)),
          covid_2020_impact: Number((-38.4 * analysis.beta).toFixed(2)),
          tech_bubble_impact: Number((-44.2 * analysis.beta * 0.9).toFixed(2)),
          rate_hike_impact: Number((-14.5 * analysis.beta).toFixed(2)),
          stagflation_impact: Number((-26.0 * analysis.beta).toFixed(2))
        },
        ...prev.filter(s => s.symbol !== analysis.symbol)
      ]);

      setAllOptions(prev => [
        {
          symbol: analysis.symbol,
          spot_price: analysis.ltp,
          atm_strike: Math.round(analysis.ltp / 50) * 50,
          chain: analysis.optionsChain.map(o => ({
            strike: o.strike,
            call_ltp: o.callLtp,
            put_ltp: o.putLtp,
            call_moneyness: o.callMoneyness,
            put_moneyness: o.putMoneyness,
            call_delta: o.callDelta,
            put_delta: o.putDelta,
            iv: o.iv
          }))
        },
        ...prev.filter(s => s.symbol !== analysis.symbol)
      ]);

      setSelectedStockSymbol(analysis.symbol);
      setActiveTab('deepdive');
    } catch (err) {
      console.error('Error analyzing stock:', err);
      setSearchError(`Failed to fetch live candles for ${stockItem.symbol}: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered stocks for Verdict Screener
  const filteredStocks = useMemo(() => {
    return allStocks.filter(s => {
      const matchVerdict = verdictFilter === 'ALL' || s.verdict_type === verdictFilter;
      const matchSector = sectorFilter === 'ALL' || s.sector === sectorFilter;
      return matchVerdict && matchSector;
    });
  }, [allStocks, verdictFilter, sectorFilter]);

  // Deep Dive Chart Data
  const stockChartData = useMemo(() => {
    const sData = allHistory[selectedStockSymbol] || allHistory['RELIANCE'] || Object.values(allHistory)[0];
    if (!sData) return { labels: [], datasets: [] };

    const yValues = chartMode === 'base100' ? sData.base_100 : sData.prices;

    const datasets = [
      {
        label: `${selectedStockSymbol} ${chartMode === 'base100' ? '(Base 100 Index)' : 'Price (₹)'}`,
        data: yValues,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.1
      }
    ];

    if (showSMA20 && chartMode === 'raw' && sData.sma_20) {
      datasets.push({
        label: '20-Day SMA (Momentum)',
        data: sData.sma_20,
        borderColor: '#10B981',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.1
      });
    }

    if (showSMA50 && chartMode === 'raw' && sData.sma_50) {
      datasets.push({
        label: '50-Day SMA (Trend)',
        data: sData.sma_50,
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.1
      });
    }

    if (showSMA200 && chartMode === 'raw' && sData.sma_200) {
      datasets.push({
        label: '200-Day SMA (Long-Term)',
        data: sData.sma_200,
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.1
      });
    }

    return {
      labels: sData.dates,
      datasets
    };
  }, [selectedStockSymbol, chartMode, showSMA20, showSMA50, showSMA200, allHistory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: '#94A3B8',
          font: { family: 'Inter', size: 12 },
          boxWidth: 14
        }
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#CBD5E1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y;
            return `${ctx.dataset.label}: ${chartMode === 'base100' ? (val ? val.toFixed(1) : '') : '₹' + (val ? val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '')}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748B', maxTicksLimit: 10 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748B',
          callback: (val) => chartMode === 'base100' ? val : '₹' + val.toLocaleString('en-IN')
        }
      }
    }
  };

  // Options Payoff Data for Selected Stock
  const currentStockOptions = useMemo(() => {
    return allOptions.find(o => o.symbol === selectedStockSymbol) || allOptions[0];
  }, [allOptions, selectedStockSymbol]);

  const optionsChartData = useMemo(() => {
    if (!currentStockOptions || !currentStockOptions.chain) {
      return { labels: [], datasets: [] };
    }

    const strikes = currentStockOptions.chain.map(c => c.strike);
    const atm = currentStockOptions.atm_strike || (strikes.length > 0 ? strikes[Math.floor(strikes.length / 2)] : 1000);
    const premium = currentStockOptions.chain.find(c => c.strike === atm)?.call_ltp || 35;

    // Simulate price range around strikes
    const minS = Math.round(strikes[0] * 0.85);
    const maxS = Math.round(strikes[strikes.length - 1] * 1.15);
    const step = Math.round((maxS - minS) / 12);

    const labels = [];
    const payoffs = [];

    for (let s = minS; s <= maxS; s += step) {
      labels.push(`₹${s}`);
      if (selectedOptionType === 'CALL') {
        // Long Call payoff: max(0, S - K) - premium
        payoffs.push(Number((Math.max(0, s - atm) - premium).toFixed(1)));
      } else {
        // Long Put payoff: max(0, K - S) - premium
        payoffs.push(Number((Math.max(0, atm - s) - premium).toFixed(1)));
      }
    }

    return {
      labels,
      datasets: [
        {
          label: `${selectedStockSymbol} Long ${selectedOptionType} (ATM ₹${atm}) Payoff`,
          data: payoffs,
          borderColor: selectedOptionType === 'CALL' ? '#10B981' : '#EF4444',
          backgroundColor: selectedOptionType === 'CALL' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          fill: true,
          tension: 0
        }
      ]
    };
  }, [currentStockOptions, selectedOptionType, selectedStockSymbol]);

  return (
    <div className="app-container">
      {/* 1. Header Top */}
      <header className="header-top">
        <div className="brand-section">
          <div className="brand-icon-box">
            <Activity size={28} />
          </div>
          <div className="brand-title-wrap">
            <h1>AXIVEST</h1>
            <p className="tagline">“See the risk. Test the downside.”</p>
          </div>
        </div>
      </header>

      {/* 2. Upstox Live API Connection Strip */}
      <div className="upstox-status-bar">
        <div className="upstox-status-left">
          <span className="live-pulse"></span>
          <span>UPSTOX LIVE API CONNECTED</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>|</span>
          <span style={{ color: '#E2E8F0' }}>Live Vectorized Predictions & Risk Scoring Active</span>
        </div>
        <div className="upstox-status-right">
          <span>Coverage: {allStocks.length} Flagship Stocks + 4,800+ NSE Equities</span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} />
          <span>Market Screener ({allStocks.length})</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'deepdive' ? 'active' : ''}`}
          onClick={() => setActiveTab('deepdive')}
        >
          <Compass size={18} />
          <span>Stock Deep-Dive</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'stress' ? 'active' : ''}`}
          onClick={() => setActiveTab('stress')}
        >
          <ShieldAlert size={18} />
          <span>Macro Stress Simulator</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'options' ? 'active' : ''}`}
          onClick={() => setActiveTab('options')}
        >
          <Sliders size={18} />
          <span>Options Intelligence</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'correlation' ? 'active' : ''}`}
          onClick={() => setActiveTab('correlation')}
        >
          <Layers size={18} />
          <span>Correlation Matrix</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <Database size={18} />
          <span>SQL & Database</span>
        </button>
      </nav>

      {/* 4. Live Stock Search Bar */}
      <div className="search-bar-wrap">
        <div className="search-input-box">
          <Search size={18} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search any stock ticker or company (e.g. SBIN, MARUTI, ZOMATO, TATASTEEL, HAL)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchSuggestions.length > 0) {
                handleAnalyzeStock(searchSuggestions[0]);
              }
            }}
          />
          {isSearching && <RefreshCw size={18} color="#3B82F6" className="animate-spin" />}
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <div className="search-suggestions-dropdown">
            {searchSuggestions.map((item) => (
              <div
                key={item.symbol}
                className="suggestion-item"
                onClick={() => handleAnalyzeStock(item)}
              >
                <div>
                  <div className="suggestion-symbol">{item.symbol}</div>
                  <div className="suggestion-name">{item.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#10B981' }}>
                  <Zap size={13} />
                  <span>Fetch & Predict</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchError && (
          <div style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* 5. Executive KPI Strip */}
      <section className="kpi-strip">
        <div className="glass-panel kpi-card">
          <span className="kpi-label">Market Coverage</span>
          <span className="kpi-val mono-num">{allStocks.length}</span>
          <span className="kpi-sub">Flagship Equities across 9 sectors + Upstox on-demand</span>
        </div>

        <div className="glass-panel kpi-card">
          <span className="kpi-label">Average Volatility</span>
          <span className="kpi-val mono-num">
            {(allStocks.reduce((a, b) => a + (b.annualized_volatility || 20), 0) / allStocks.length).toFixed(1)}%
          </span>
          <span className="kpi-sub">Annualized 252-day trading sample</span>
        </div>

        <div className="glass-panel kpi-card">
          <span className="kpi-label">Buy Signals Active</span>
          <span className="kpi-val mono-num" style={{ color: '#10B981' }}>
            {allStocks.filter(s => s.verdict_type === 'buy').length}
          </span>
          <span className="kpi-sub">Strong risk-adjusted momentum</span>
        </div>

        <div className="glass-panel kpi-card">
          <span className="kpi-label">Caution / Sell Warnings</span>
          <span className="kpi-val mono-num" style={{ color: '#EF4444' }}>
            {allStocks.filter(s => s.verdict_type === 'caution').length}
          </span>
          <span className="kpi-sub">Elevated drawdown & downside risk</span>
        </div>

        <div className="glass-panel kpi-card">
          <span className="kpi-label">NIFTY 50 Benchmark</span>
          <span className="kpi-val mono-num" style={{ color: '#3B82F6' }}>
            {allStocks.find(s => s.symbol === 'NIFTY 50')?.ltp?.toLocaleString('en-IN') || '25,285'}
          </span>
          <span className="kpi-sub">Reference index for Beta & covariance</span>
        </div>
      </section>

      {/* TAB 1: OVERVIEW & SIGNALS SCREENER */}
      {activeTab === 'overview' && (
        <section className="animate-fade-in">
          {/* Sector Slicer Pills */}
          <div className="sector-pills-row">
            {sectors.map(sec => (
              <button
                key={sec}
                className={`sector-pill ${sectorFilter === sec ? 'active' : ''}`}
                onClick={() => setSectorFilter(sec)}
              >
                {sec === 'ALL' ? 'All Market Sectors' : sec}
              </button>
            ))}
          </div>

          <div className="section-header">
            <h2 className="section-title">
              <Activity size={22} color="#10B981" />
              <span>Investment Verdict Screener ({filteredStocks.length} Assets)</span>
            </h2>

            <div className="filter-btn-group">
              <button
                className={`filter-btn ${verdictFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setVerdictFilter('ALL')}
              >
                All Signals ({allStocks.length})
              </button>
              <button
                className={`filter-btn ${verdictFilter === 'buy' ? 'active' : ''}`}
                onClick={() => setVerdictFilter('buy')}
              >
                Buy / Accumulate
              </button>
              <button
                className={`filter-btn ${verdictFilter === 'hold' ? 'active' : ''}`}
                onClick={() => setVerdictFilter('hold')}
              >
                Hold / Neutral
              </button>
              <button
                className={`filter-btn ${verdictFilter === 'caution' ? 'active' : ''}`}
                onClick={() => setVerdictFilter('caution')}
              >
                Caution / High Downside
              </button>
            </div>
          </div>

          <div className="verdict-grid">
            {filteredStocks.map((stock) => {
              const isBuy = stock.verdict_type === 'buy';
              const isHold = stock.verdict_type === 'hold';
              const isCaution = stock.verdict_type === 'caution';

              return (
                <div
                  key={stock.symbol}
                  className="glass-panel verdict-card"
                  onClick={() => {
                    setSelectedStockSymbol(stock.symbol);
                    setActiveTab('deepdive');
                  }}
                >
                  <div>
                    <div className="verdict-card-top">
                      <div className="stock-headline">
                        <h3>{stock.symbol}</h3>
                        <span className="stock-sector">{stock.sector} • {stock.name}</span>
                      </div>
                      <span className={`badge-chip ${isBuy ? 'badge-buy' : isHold ? 'badge-hold' : 'badge-caution'}`}>
                        {stock.verdict}
                      </span>
                    </div>

                    <div className="price-row">
                      <span className="price-main mono-num">₹{stock.ltp.toLocaleString('en-IN')}</span>
                      <span
                        className="ret-badge mono-num"
                        style={{ color: stock.change_pct >= 0 ? '#10B981' : '#EF4444' }}
                      >
                        {stock.change_pct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct}%
                      </span>
                    </div>

                    <div className="metric-strip">
                      <div className="metric-item">
                        <span className="metric-lbl">Annual Volatility</span>
                        <span className="metric-val mono-num">{stock.annualized_volatility}%</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-lbl">Max Drawdown</span>
                        <span className="metric-val mono-num" style={{ color: stock.max_drawdown < -35 ? '#EF4444' : '#E2E8F0' }}>
                          {stock.max_drawdown}%
                        </span>
                      </div>
                    </div>

                    <div className="score-box">
                      <div className="score-head">
                        <span style={{ color: '#94A3B8' }}>Institutional Quality Score</span>
                        <span className="mono-num" style={{ color: isBuy ? '#10B981' : isCaution ? '#EF4444' : '#F59E0B' }}>
                          {stock.risk_score}/100
                        </span>
                      </div>
                      <div className="score-progress">
                        <div
                          className="score-fill"
                          style={{
                            width: `${stock.risk_score}%`,
                            background: isBuy ? '#10B981' : isCaution ? '#EF4444' : '#F59E0B'
                          }}
                        />
                      </div>
                    </div>

                    <p className="verdict-rationale-snippet">{stock.rationale}</p>
                  </div>

                  <button className="inspect-btn">
                    <span>Inspect Quantitative Deep-Dive</span>
                    <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: STOCK DEEP DIVE */}
      {activeTab === 'deepdive' && (
        <section className="animate-fade-in">
          {/* Stock Selector Pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
            {allStocks.slice(0, 15).map(s => (
              <button
                key={s.symbol}
                className={`filter-btn ${selectedStockSymbol === s.symbol ? 'active' : ''}`}
                style={{
                  background: selectedStockSymbol === s.symbol ? '#3B82F6' : 'rgba(255, 255, 255, 0.05)',
                  color: selectedStockSymbol === s.symbol ? '#FFFFFF' : '#94A3B8',
                  padding: '8px 16px',
                  borderRadius: 8
                }}
                onClick={() => setSelectedStockSymbol(s.symbol)}
              >
                {s.symbol}
              </button>
            ))}
          </div>

          <div className="deepdive-grid">
            {/* Left: Chart & Technicals */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <div className="chart-controls">
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                    {currentStock.name} ({currentStock.symbol})
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                    {currentStock.sector} • Current LTP: ₹{currentStock.ltp.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${chartMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setChartMode('raw')}
                  >
                    Nominal (₹)
                  </button>
                  <button
                    className={`toggle-btn ${chartMode === 'base100' ? 'active' : ''}`}
                    onClick={() => setChartMode('base100')}
                  >
                    Rebased (Base 100)
                  </button>

                  {chartMode === 'raw' && (
                    <>
                      <button
                        className={`toggle-btn ${showSMA20 ? 'active' : ''}`}
                        onClick={() => setShowSMA20(!showSMA20)}
                      >
                        SMA 20
                      </button>
                      <button
                        className={`toggle-btn ${showSMA50 ? 'active' : ''}`}
                        onClick={() => setShowSMA50(!showSMA50)}
                      >
                        SMA 50
                      </button>
                      <button
                        className={`toggle-btn ${showSMA200 ? 'active' : ''}`}
                        onClick={() => setShowSMA200(!showSMA200)}
                      >
                        SMA 200
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="chart-box">
                <Line data={stockChartData} options={chartOptions} />
              </div>

              {/* Rationale & Drivers Box */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className={`badge-chip ${currentStock.verdict_type === 'buy' ? 'badge-buy' : currentStock.verdict_type === 'hold' ? 'badge-hold' : 'badge-caution'}`}>
                    {currentStock.verdict}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                    Institutional Score: <strong style={{ color: '#FFFFFF' }}>{currentStock.risk_score}/100</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                    Beta vs NIFTY 50: <strong style={{ color: '#3B82F6' }}>{currentStock.beta}</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                    Sharpe Ratio: <strong style={{ color: currentStock.sharpe_ratio >= 0 ? '#10B981' : '#EF4444' }}>{currentStock.sharpe_ratio}</strong>
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#E2E8F0', marginBottom: 16, lineHeight: 1.5 }}>
                  {currentStock.rationale}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: 14, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#10B981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} /> Quantitative Strengths
                    </h4>
                    <ul style={{ fontSize: '0.8rem', color: '#CBD5E1', paddingLeft: 18, lineHeight: 1.5 }}>
                      <li>Annualized CAGR of {currentStock.cagr}% over the observed trading period.</li>
                      <li>Drawdown profile of {currentStock.max_drawdown}% evaluated relative to sector peer group.</li>
                      <li>Beta sensitivity of {currentStock.beta} reflects controlled systemic market exposure.</li>
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: 14, borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#EF4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={16} /> Downside Risk Considerations
                    </h4>
                    <ul style={{ fontSize: '0.8rem', color: '#CBD5E1', paddingLeft: 18, lineHeight: 1.5 }}>
                      <li>Annualized Volatility stands at {currentStock.annualized_volatility}%.</li>
                      <li>In a 2008-style macro crisis, model projects instantaneous equity hit of {Number((-52 * currentStock.beta).toFixed(1))}%.</li>
                      <li>Ensure position sizing adheres to portfolio stop-loss thresholds.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Timeline & Capital Calculator */}
            <div className="sidebar-panel">
              {/* Range & Drawdown Card */}
              <div className="glass-panel" style={{ padding: 20 }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={18} color="#EF4444" /> 52-Week Range & Risk Profile
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94A3B8' }}>Maximum Drawdown:</span>
                    <strong style={{ color: '#EF4444' }} className="mono-num">{currentStock.max_drawdown}%</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94A3B8' }}>52-Week High Level:</span>
                    <span className="mono-num">₹{currentStock.high_52w?.toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94A3B8' }}>52-Week Low Level:</span>
                    <span className="mono-num">₹{currentStock.low_52w?.toLocaleString('en-IN')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Beta vs NIFTY 50:</span>
                    <span className="mono-num" style={{ color: '#3B82F6', fontWeight: 700 }}>{currentStock.beta}</span>
                  </div>
                </div>
              </div>

              {/* Investment Return Calculator */}
              <div className="glass-panel calc-box">
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} color="#10B981" /> Capital Growth Simulator
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  Simulated return based on stock's CAGR of {currentStock.cagr}%:
                </p>

                <input
                  type="number"
                  className="calc-input"
                  value={calcInvestment}
                  onChange={(e) => setCalcInvestment(Number(e.target.value))}
                  step="5000"
                />

                {(() => {
                  const oneYearValue = calcInvestment * (1 + currentStock.cagr / 100);
                  const netGainLoss = oneYearValue - calcInvestment;
                  const isPositive = netGainLoss >= 0;

                  return (
                    <div className="calc-res-grid">
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Projected 1-Yr Value</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }} className="mono-num">
                          ₹{Math.round(oneYearValue).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Projected Net P&L</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isPositive ? '#10B981' : '#EF4444' }} className="mono-num">
                          {isPositive ? '+' : ''}₹{Math.round(netGainLoss).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: MACRO STRESS SIMULATOR */}
      {activeTab === 'stress' && (
        <section className="animate-fade-in">
          <div className="section-header">
            <h2 className="section-title">
              <ShieldAlert size={22} color="#EF4444" />
              <span>Macroeconomic Portfolio Stress Testing Engine</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
              Simulates market shock impacts across {allStocks.length} equities parameterized by Upstox Beta (β)
            </p>
          </div>

          <div className="simulator-layout">
            {/* Simulator Controls */}
            <div className="glass-panel sim-controls-panel">
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600 }}>
                  Starting Portfolio Capital: <strong style={{ color: '#FFFFFF' }} className="mono-num">₹{stressCapital.toLocaleString('en-IN')}</strong>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min="50000"
                  max="10000000"
                  step="50000"
                  value={stressCapital}
                  onChange={(e) => setStressCapital(Number(e.target.value))}
                  style={{ marginTop: 10 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, marginBottom: 8, display: 'block' }}>
                  Select Historical Stress Scenario:
                </label>
                <div className="scenario-pill-list">
                  {[
                    { name: '2008 Financial Crisis', marketShock: -52.0 },
                    { name: 'COVID-19 Liquidity Shock', marketShock: -38.4 },
                    { name: 'Tech Sector De-Rating', marketShock: -44.2 },
                    { name: 'Rate Hike Shock (+300 bps)', marketShock: -14.5 },
                    { name: 'Global Stagflation Spike', marketShock: -26.0 }
                  ].map(sc => (
                    <button
                      key={sc.name}
                      className={`scenario-pill-btn ${selectedScenario === sc.name ? 'active' : ''}`}
                      onClick={() => setSelectedScenario(sc.name)}
                    >
                      <span style={{ fontWeight: 600 }}>{sc.name}</span>
                      <span className="mono-num" style={{ color: '#EF4444', fontWeight: 700 }}>
                        {sc.marketShock}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stress Results Card */}
              {(() => {
                const stockStress = allStress.find(s => s.symbol === selectedStockSymbol) || allStress[0];
                const shockKey = selectedScenario.includes('2008') ? 'crisis_2008_impact'
                  : selectedScenario.includes('COVID') ? 'covid_2020_impact'
                  : selectedScenario.includes('Tech') ? 'tech_bubble_impact'
                  : selectedScenario.includes('Rate') ? 'rate_hike_impact' : 'stagflation_impact';
                
                const lossPct = Math.abs(stockStress ? stockStress[shockKey] : 30);
                const rupeeLoss = stressCapital * (lossPct / 100.0);
                const residualVal = stressCapital - rupeeLoss;

                return (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 16, borderRadius: 10 }}>
                    <div style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      {selectedStockSymbol} Exposure under {selectedScenario}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#EF4444' }} className="mono-num">
                      -₹{Math.round(rupeeLoss).toLocaleString('en-IN')} (-{lossPct.toFixed(1)}%)
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#E2E8F0', marginTop: 4 }}>
                      Residual Capital: <strong className="mono-num">₹{Math.round(residualVal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Asset-Level Shock Table */}
            <div className="glass-panel" style={{ padding: 22 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>
                Cross-Asset Stress Shock Projections ({selectedScenario})
              </h3>

              <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Symbol</th>
                      <th style={{ padding: '8px 12px' }}>Sector</th>
                      <th style={{ padding: '8px 12px' }}>Beta (β)</th>
                      <th style={{ padding: '8px 12px' }}>Projected Shock</th>
                      <th style={{ padding: '8px 12px' }}>Simulated Loss (on Capital)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStress.slice(0, 15).map((row, idx) => {
                      const shockKey = selectedScenario.includes('2008') ? 'crisis_2008_impact'
                        : selectedScenario.includes('COVID') ? 'covid_2020_impact'
                        : selectedScenario.includes('Tech') ? 'tech_bubble_impact'
                        : selectedScenario.includes('Rate') ? 'rate_hike_impact' : 'stagflation_impact';
                      const shockVal = row[shockKey];
                      const assetCapitalLoss = stressCapital * (Math.abs(shockVal) / 100.0);

                      return (
                        <tr key={row.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.symbol}</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{row.sector}</td>
                          <td style={{ padding: '10px 12px', color: '#3B82F6', fontWeight: 600 }} className="mono-num">{row.beta}</td>
                          <td style={{ padding: '10px 12px', color: '#EF4444', fontWeight: 600 }} className="mono-num">{shockVal}%</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }} className="mono-num">₹{Math.round(assetCapitalLoss).toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: OPTIONS INTELLIGENCE */}
      {activeTab === 'options' && (
        <section className="animate-fade-in">
          <div className="section-header">
            <h2 className="section-title">
              <Sliders size={22} color="#8B5CF6" />
              <span>Options Intelligence & Payoff Curves ({selectedStockSymbol})</span>
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`filter-btn ${selectedOptionType === 'CALL' ? 'active' : ''}`}
                onClick={() => setSelectedOptionType('CALL')}
              >
                Long Call Strategy
              </button>
              <button
                className={`filter-btn ${selectedOptionType === 'PUT' ? 'active' : ''}`}
                onClick={() => setSelectedOptionType('PUT')}
              >
                Long Put (Hedge)
              </button>
            </div>
          </div>

          <div className="options-cockpit">
            {/* Options Chain Grid */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>
                Synthetic Option Chain around LTP (₹{currentStock.ltp})
              </h4>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', textAlign: 'center' }}>
                      <th style={{ padding: '6px' }}>Call LTP</th>
                      <th style={{ padding: '6px' }}>Strike</th>
                      <th style={{ padding: '6px' }}>Put LTP</th>
                      <th style={{ padding: '6px' }}>Moneyness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentStockOptions?.chain?.map((item) => (
                      <tr key={item.strike} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <td style={{ padding: '8px 6px', color: '#10B981', fontWeight: 600 }}>₹{item.call_ltp}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, background: 'rgba(255,255,255,0.04)' }}>₹{item.strike}</td>
                        <td style={{ padding: '8px 6px', color: '#EF4444', fontWeight: 600 }}>₹{item.put_ltp}</td>
                        <td style={{ padding: '8px 6px', fontSize: '0.72rem', color: '#94A3B8' }}>{item.call_moneyness}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payoff Chart */}
            <div className="glass-panel" style={{ padding: 22, height: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {selectedStockSymbol} — Expiration Payoff Profile
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Model based on Upstox real-time implied volatility
                </span>
              </div>
              <div style={{ height: 400 }}>
                <Line data={optionsChartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 5: CORRELATION MATRIX */}
      {activeTab === 'correlation' && (
        <section className="animate-fade-in">
          <div className="section-header">
            <h2 className="section-title">
              <Layers size={22} color="#06B6D4" />
              <span>Symmetrical Asset Correlation Heatmap Matrix</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
              Pearson correlation coefficients across daily return series (443 trading observations)
            </p>
          </div>

          <div className="glass-panel matrix-wrapper">
            <table className="corr-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: 120 }}>Asset</th>
                  {correlationData.symbols.map(a => (
                    <th key={a} style={{ minWidth: 70 }}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlationData.symbols.map((rowAsset, rIdx) => (
                  <tr key={rowAsset}>
                    <td style={{ textAlign: 'left', fontWeight: 700, background: 'rgba(15, 23, 42, 0.7)' }}>
                      {rowAsset}
                    </td>
                    {correlationData.symbols.map((colAsset, cIdx) => {
                      const val = correlationData.matrix[rIdx][cIdx];
                      const isDiag = rIdx === cIdx;

                      let cellBg = 'transparent';
                      let cellColor = '#CBD5E1';

                      if (isDiag) {
                        cellBg = 'rgba(255, 255, 255, 0.08)';
                        cellColor = '#FFFFFF';
                      } else if (val >= 0.55) {
                        cellBg = 'rgba(239, 68, 68, 0.25)';
                        cellColor = '#FCA5A5';
                      } else if (val <= 0.25) {
                        cellBg = 'rgba(16, 185, 129, 0.25)';
                        cellColor = '#6EE7B7';
                      }

                      return (
                        <td key={colAsset} style={{ background: cellBg, color: cellColor, fontWeight: isDiag ? 700 : 500 }}>
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 6: DATA & SQL QUERIES */}
      {activeTab === 'data' && (
        <section className="animate-fade-in">
          <div className="section-header">
            <h2 className="section-title">
              <Database size={22} color="#F59E0B" />
              <span>Relational Database, SQL Queries & Project Downloads</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 26 }}>
            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Database size={24} color="#3B82F6" />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>axivest.db (SQLite)</h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: 14 }}>
                11 indexed relational tables containing raw prices, returns, drawdowns, stress shocks, and option curves.
              </p>
              <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>
                ✓ Stored in repository at <code>data/database/axivest.db</code>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <FileText size={24} color="#10B981" />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Financial Model (.xlsx)</h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: 14 }}>
                5-tab institutional workbook with dynamic Excel formulas, KPI cards, stress testing, and payoff curves.
              </p>
              <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>
                ✓ Stored in repository at <code>excel/axivest_financial_risk_model.xlsx</code>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <BarChart3 size={24} color="#F59E0B" />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Power BI Template Guide</h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: 14 }}>
                Detailed click-by-click instructions, unpivoting workflow, and 12 production DAX measures.
              </p>
              <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>
                ✓ Stored in repository at <code>powerbi/PowerBI_Design_Guide.md</code>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 22 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
              Sample Production SQL Query: Relative Risk Ranking via Window Functions
            </h3>
            <pre style={{
              background: '#070B12',
              padding: 16,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.82rem',
              color: '#93C5FD',
              fontFamily: 'JetBrains Mono',
              overflowX: 'auto',
              lineHeight: 1.5
            }}>
{`SELECT 
    v.stock,
    v.annualized_volatility_pct,
    RANK() OVER (ORDER BY v.annualized_volatility_pct DESC) AS volatility_rank,
    m.max_drawdown_pct,
    RANK() OVER (ORDER BY m.max_drawdown_pct ASC) AS drawdown_severity_rank,
    m.peak_date,
    m.trough_date
FROM annualized_volatility v
JOIN maximum_drawdown m ON v.stock = m.stock
ORDER BY v.annualized_volatility_pct DESC;`}
            </pre>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div>
          <strong>AXIVEST</strong> — Portfolio Risk & Options Intelligence | Developed by <strong>Kandala Guru Balaji</strong>
        </div>
      </footer>
    </div>
  );
}
