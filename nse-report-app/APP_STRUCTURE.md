# NSE Report App Structure

Ye document app ko samajhne ke liye high-level map hai. Iska goal hai ki frontend, backend, APIs, data flow, aur analytics files ka relation clear ho jaye.

**Last Updated:** 2026-05-05

---

## 1. Big Picture

App do main parts me split hai — Next.js frontend (trading terminal UI) aur FastAPI backend (data fetching, analytics, SQLite history):

```text
nse-report-app/
  .env.example                    -> environment variable template
  APP_STRUCTURE.md                -> ye file (project map)
  apps/
    web/   -> Next.js 16 frontend trading terminal (React 19, Zustand, Tailwind 4, Lucide)
    api/   -> FastAPI backend, NSE data fetching, analytics, SQLite history
```

Basic data flow:

```text
User types command in CommandBar
  -> apps/web/src/store/workspaceStore.ts  (parse command, open tab)
  -> apps/web/src/app/page.tsx             (switch on activeTab.type)
  -> matching function component           (e.g. IVSURF.tsx, TREND.tsx)
  -> fetch(API_BASE + /api/...)            (call backend)
  -> apps/api/app/routes/*.py              (FastAPI route handler)
  -> services/data_ingestion or analytics  (fetch/calculate)
  -> response JSON                         (return to frontend)
  -> frontend chart/table/report UI        (render)
```

Frontend default API URL:

```text
apps/web/src/lib/config.ts
API_BASE = NEXT_PUBLIC_API_URL || "http://localhost:8000"
```

---

## 2. Frontend Structure

### Frontend Tech Stack

| Technology   | Version   | Purpose                         |
| ------------ | --------- | ------------------------------- |
| Next.js      | 16.2.4    | Framework (App Router)          |
| React        | 19.2.4    | UI rendering                    |
| Zustand      | 5.0.12    | Global state management         |
| Tailwind CSS | 4.x       | Utility-first styling           |
| Lucide React | 1.14.x    | Icon library                    |
| TypeScript   | 5.x       | Type safety                     |

### Frontend File Tree

```text
apps/web/
  package.json              -> dependencies & scripts (dev/build/start/lint)
  next.config.ts            -> Next.js config
  tsconfig.json             -> TypeScript config
  postcss.config.mjs        -> PostCSS + Tailwind
  eslint.config.mjs         -> ESLint config
  AGENTS.md                 -> agent instructions
  CLAUDE.md                 -> claude instructions

  src/
    app/
      layout.tsx            -> app layout shell (root)
      page.tsx              -> main terminal workspace screen (router for all functions)
      globals.css           -> global styles, terminal theme, custom scrollbar
      favicon.ico           -> app icon
      options/page.tsx      -> standalone options page (legacy)
      report/page.tsx       -> standalone report page (legacy)
      strategies/page.tsx   -> standalone strategy page (legacy)

    components/
      CommandBar.tsx         -> top command input bar (keyboard-driven)
      WorkspaceTabs.tsx      -> tab bar for open/close active function tabs
      FunctionSidebar.tsx    -> collapsible sidebar for quick function access (per symbol)

    functions/
      CC.tsx                 -> Command Center / Market Overview dashboard
      CHART.tsx              -> Price chart + technical indicators (SMA/RSI/MACD/ATR/Pivot)
      INTEL.tsx              -> Intelligence scorecard (bullish/bearish signals)
      IVSURF.tsx             -> IV Skew, IV Surface heatmap, Term Structure
      OIHEAT.tsx             -> Open Interest heatmap (multi-expiry, strike × expiry matrix)
      OMON.tsx               -> Options Monitor (full chain, Greeks, PCR, max pain)
      SPREAD.tsx             -> Ratio Spread Matrix (Excel-style, back/front spreads)
      TREND.tsx              -> Historical trend charts (PCR/OI/IV over time)

    store/
      workspaceStore.ts      -> Zustand state (tabs, commands, sidebar, command history)

    lib/
      config.ts              -> API_BASE URL config
      types.ts               -> shared TypeScript interfaces (IndexQuote, ReportData, etc.)
      signals.ts             -> signal/verdict helper functions
```

### Frontend Control Flow

`page.tsx` is the main router for all terminal functions:

```text
User types: "NIFTY IVSURF"
  -> CommandBar.tsx captures input
  -> workspaceStore.executeCommand("NIFTY IVSURF")
  -> parse: symbol="NIFTY", cmd="IVSURF"
  -> addTab("IVSURF", "NIFTY")
  -> page.tsx switch(activeTab.type)
  -> renders <IVSURF symbol="NIFTY" />
```

### Available Commands

```text
CC                    -> Command Center (no symbol needed)
HELP                  -> Help screen (global)
REPORT                -> Full report (global)
STRAT                 -> Strategy builder (global)

{SYMBOL}              -> defaults to INTEL for that symbol
{SYMBOL} INTEL        -> Intelligence Scorecard
{SYMBOL} OMON         -> Options Monitor
{SYMBOL} IVSURF       -> IV Surface & Skew
{SYMBOL} CHART        -> Price Chart with Technicals
{SYMBOL} OIHEAT       -> OI Heatmap (Multi-Expiry)
{SYMBOL} TREND        -> Historical Trends (PCR/OI/IV)
{SYMBOL} SPREAD       -> Ratio Spread Matrix
```

### Function Sidebar

FunctionSidebar.tsx provides a collapsible sidebar (toggle with chevron button) that shows 7 quick-access function buttons when a symbol is active:

```text
CHART  | INTEL  | IVSURF | OIHEAT | OMON | SPREAD | TREND
```

Each button opens the corresponding function tab for the currently active symbol. Sidebar has tooltip on collapsed state.

---

## 3. Backend Structure

### Backend Tech Stack

| Technology      | Version  | Purpose                                              |
| --------------- | -------- | ---------------------------------------------------- |
| FastAPI         | 0.115.0  | Web framework                                        |
| Uvicorn         | 0.32.0   | ASGI server                                          |
| Pydantic        | 2.10.0   | Data validation & settings                           |
| SQLAlchemy      | 2.0.36   | ORM / database                                       |
| Requests        | 2.32.0   | HTTP client (NSE scraping)                           |
| NumPy           | 2.2.0    | Numerical computations                               |
| Pandas          | 2.2.0    | Data processing                                      |
| yfinance        | (used)   | Fallback price/OHLCV data                            |
| Celery          | 5.4.0    | Background task queue (configured)                   |
| Redis           | 5.2.0    | Cache/queue backend (optional, local dict fallback) |

### Backend File Tree

```text
apps/api/
  requirements.txt                        -> Python dependencies
  celeryconfig.py                         -> Celery worker configuration
  nse_history.db                          -> SQLite database file (auto-created)
  debug_nse.py                            -> debug script for NSE connectivity
  test_jugaad.py                          -> test for jugaad-data library
  test_jugaad_oc.py                       -> test for jugaad option chain
  venv/                                   -> Python virtual environment
  scratch/                                -> scratch scripts

  app/
    __init__.py                           -> package init
    main.py                               -> FastAPI app entry, CORS, router registration
    config.py                             -> Settings via pydantic-settings (.env support)

    routes/
      __init__.py                         -> routes package
      report.py                           -> /api/report/* (daily/latest report)
      alerts.py                           -> /api/alerts/* (CRUD + check)
      stocks.py                           -> /api/stocks/* (signals)
      strategies.py                       -> /api/strategies/* (simulate)
      options.py                          -> /api/options/* (chain, IV, specs, OI heatmap)
      chart.py                            -> /api/chart/* (OHLCV, technicals)
      history.py                          -> /api/history/* (trends, snapshot)

    services/
      __init__.py                         -> services package
      report_generator.py                 -> full report generation logic
      alert_engine.py                     -> alert rule checking
      websocket_manager.py                -> WebSocket manager (placeholder)

      data_ingestion/
        __init__.py                       -> data ingestion package
        nse_fetcher.py                    -> NSE option chain / OI data fetcher
        price_fetcher.py                  -> OHLCV fetcher (yfinance, multi-index support)
        vix_fetcher.py                    -> India VIX fetcher
        global_fetcher.py                 -> global market data fetcher (US, commodities, forex)

      analytics/
        __init__.py                       -> analytics package
        pcr_calculator.py                 -> Put-Call Ratio calculations
        max_pain.py                       -> Max Pain calculation
        support_resistance.py             -> Support/Resistance & OI bias detection
        iv_analysis.py                    -> IV Skew, IV Surface, Term Structure
        greeks.py                         -> Black-Scholes Greeks (delta, gamma, theta, vega)
        technicals.py                     -> Technical indicators (SMA, RSI, MACD, ATR, Pivot)
        contract_specs.py                 -> Lot size / contract spec metadata

    db/
      __init__.py                         -> db package
      database.py                         -> SQLite engine, session, Base
      models.py                           -> SQLAlchemy models (DailySnapshot, StrikeSnapshot)
      cache.py                            -> in-memory cache helpers (TTL-based dict)

    models/
      __init__.py                         -> Pydantic response models (placeholder)

    tasks/
      __init__.py                         -> tasks package
      snapshot_task.py                    -> daily snapshot capture (symbol -> DB)
      scheduled_fetch.py                  -> scheduled fetch jobs
```

---

## 4. API Map

All routes registered in `apps/api/app/main.py`:

### Health

```text
GET  /health                              -> app health check
```

### Report (`/api/report`)

```text
GET  /api/report/daily                    -> generate full daily report
GET  /api/report/latest                   -> get latest cached report
```

### Alerts (`/api/alerts`)

```text
POST   /api/alerts                        -> create alert rule
GET    /api/alerts                        -> list all alert rules
DELETE /api/alerts/{rule_id}              -> delete alert rule
POST   /api/alerts/check                  -> trigger alert check
```

### Stocks (`/api/stocks`)

```text
GET  /api/stocks/signals                  -> stock signal scorecard
```

### Strategies (`/api/strategies`)

```text
POST /api/strategies/simulate             -> simulate a strategy
```

### Options (`/api/options`)

```text
GET  /api/options/{symbol}                -> full option chain + technicals + Greeks
GET  /api/options/{symbol}/iv-skew        -> IV skew analysis (CE vs PE IV by strike)
GET  /api/options/{symbol}/iv-surface     -> IV surface data (strike × expiry heatmap)
GET  /api/options/{symbol}/specs          -> contract specs (lot size, margin info)
GET  /api/options/{symbol}/oi-heatmap     -> OI data matrix (strike × expiry, CE/PE/Net OI)
```

### Chart (`/api/chart`)

```text
GET  /api/chart/{symbol}/ohlcv            -> historical OHLCV data (?days=7..365)
GET  /api/chart/{symbol}/technicals       -> OHLCV + SMA/RSI/MACD/ATR/Pivot (?days=20..365)
```

### History (`/api/history`)

```text
GET  /api/history/{symbol}/trends         -> historical PCR/OI/IV/Spot trends (?days=5..365)
POST /api/history/{symbol}/snapshot       -> manually trigger today's snapshot capture
```

### CORS Origins

```text
http://localhost:3000    (Next.js dev server)
http://localhost:5173    (Vite dev server, if used)
```

---

## 5. Function Detail Flows

### CC (Command Center)

```text
Frontend: apps/web/src/functions/CC.tsx
Calls:    GET /api/report/daily
Shows:    Global markets, India indices, VIX, FII/DII, trading plan, options overview
```

### INTEL (Intelligence Scorecard)

```text
Frontend: apps/web/src/functions/INTEL.tsx
Calls:    GET /api/options/{symbol}
Shows:    Bullish/Bearish signal scorecard, PCR bias, max pain, S/R levels, OI build-up
Uses:     lib/signals.ts for verdict calculation
```

### OMON (Options Monitor)

```text
Frontend: apps/web/src/functions/OMON.tsx
Calls:    GET /api/options/{symbol}?expiry={selected}
Shows:    Full options chain table, OI bars, Greeks, PCR, max pain, multi-expiry selector
```

### IVSURF (IV Surface & Skew)

```text
Frontend: apps/web/src/functions/IVSURF.tsx
Calls:    GET /api/options/{symbol}/iv-skew
          GET /api/options/{symbol}/iv-surface
Shows:    Three views toggled by tabs:
          SKEW    -> CE IV vs PE IV across strikes (line chart)
          SURFACE -> IV heatmap across strikes × expiries (color grid)
          TERM    -> ATM IV across expiries (term structure)

Backend analytics: apps/api/app/services/analytics/iv_analysis.py
```

### CHART (Price Chart + Technicals)

```text
Frontend: apps/web/src/functions/CHART.tsx
Calls:    GET /api/chart/{symbol}/technicals?days=90
Shows:    Candlestick/line chart, SMA 20/50/200, RSI 14, MACD, ATR, Pivot Points
Backend:  apps/api/app/services/analytics/technicals.py
Data:     apps/api/app/services/data_ingestion/price_fetcher.py (yfinance fallback)
```

### OIHEAT (OI Heatmap)

```text
Frontend: apps/web/src/functions/OIHEAT.tsx
Calls:    GET /api/options/{symbol}/oi-heatmap
Shows:    Multi-expiry OI heatmap (strike × expiry matrix), CE/PE/Net OI color cells
```

### TREND (Historical Trends)

```text
Frontend: apps/web/src/functions/TREND.tsx
Calls:    GET /api/history/{symbol}/trends?days=30
Shows:    Time-series charts for PCR, Total OI, ATM IV, Spot price
          + Verbal trend analysis (verdict, insights, pcr_trend, oi_bias)
Data:     DailySnapshot table in SQLite (apps/api/nse_history.db)

Important: TREND depends on stored daily snapshots.
If snapshots missing -> analysis stays neutral, no fake confidence.
```

### SPREAD (Ratio Spread Matrix)

```text
Frontend: apps/web/src/functions/SPREAD.tsx
Calls:    GET /api/options/{symbol}
Shows:    Three-panel Excel-style grid:
          1. Options Chain (center)
          2. Back Spread Matrix (left) — buy far, sell near
          3. Front Spread Matrix (right) — sell far, buy near
          ATM row highlighted, color-coded P/L, hover trade breakdowns
```

---

## 6. Database

### Current DB File

```text
apps/api/nse_history.db      (SQLite, auto-created)
```

### Connection

```text
apps/api/app/db/database.py
Engine: sqlite:///./nse_history.db
```

### Tables

#### DailySnapshot

```text
id                  INTEGER   PK, auto-increment
symbol              TEXT      indexed
date                TEXT      indexed (YYYY-MM-DD)
timestamp           DATETIME  auto (UTC)
pcr_oi              FLOAT     nullable
pcr_volume          FLOAT     nullable
india_vix           FLOAT     nullable
atm_iv              FLOAT     nullable
total_ce_oi         INTEGER   nullable
total_pe_oi         INTEGER   nullable
underlying_value    FLOAT     nullable
max_pain            FLOAT     nullable
support_level       FLOAT     nullable
resistance_level    FLOAT     nullable
```

#### StrikeSnapshot

```text
id                  INTEGER   PK, auto-increment
symbol              TEXT      indexed
date                TEXT      indexed
expiry              TEXT      indexed
strike_price        FLOAT     indexed
ce_oi               INTEGER   default 0
pe_oi               INTEGER   default 0
ce_iv               FLOAT     default 0
pe_iv               FLOAT     default 0
```

---

## 7. Configuration

### Backend Settings (`apps/api/app/config.py`)

```text
APP_NAME              = "NSE Daily Report App"
APP_VERSION           = "0.1.0"
DEBUG                 = true

DATABASE_URL          = sqlite:///./nse_report.db
USE_LOCAL_CACHE       = true  (dict-based, no Redis dependency for MVP)

CACHE_TTL_LIVE        = 60s   (live market data)
CACHE_TTL_EOD         = 86400s (end-of-day)
CACHE_TTL_REPORT      = 3600s  (generated reports)

NSE_RATE_LIMIT        = 0.35s between requests
NSE_MAX_RETRIES       = 3
NSE_TIMEOUT           = 15s

REPORT_SCHEDULE_IST   = 08:00
POST_MARKET_SCHEDULE  = 16:00
```

### Frontend Config (`apps/web/src/lib/config.ts`)

```text
API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
```

---

## 8. Where To Change What

### Adding a New Terminal Function

```text
1. Define new FunctionCode in:
   -> apps/web/src/store/workspaceStore.ts (add to FunctionCode type + validCommands array)

2. Create function component:
   -> apps/web/src/functions/NEWFUNC.tsx

3. Import & add to switch:
   -> apps/web/src/app/page.tsx (import, add case)

4. Add to sidebar (optional):
   -> apps/web/src/components/FunctionSidebar.tsx (add to FUNCTIONS array)
```

### Adding a New Backend Endpoint

```text
1. Create route file:
   -> apps/api/app/routes/new_route.py

2. Register router:
   -> apps/api/app/main.py (import + app.include_router)
```

### Adding New Analytics

```text
1. Create analytics module:
   -> apps/api/app/services/analytics/new_analysis.py

2. Expose via route:
   -> apps/api/app/routes/options.py (or new route file)
```

### Fixing Data Fetching

```text
NSE option chain:     apps/api/app/services/data_ingestion/nse_fetcher.py
Price/OHLCV:          apps/api/app/services/data_ingestion/price_fetcher.py (yfinance fallback)
VIX:                  apps/api/app/services/data_ingestion/vix_fetcher.py
Global markets:       apps/api/app/services/data_ingestion/global_fetcher.py
```

### Fixing Chart/UI Issues

```text
Relevant function:    apps/web/src/functions/{FUNC}.tsx
Styling:              apps/web/src/app/globals.css
State:                apps/web/src/store/workspaceStore.ts
API URL:              apps/web/src/lib/config.ts + NEXT_PUBLIC_API_URL env var
```

### Historical Trend Logic

```text
Route:                apps/api/app/routes/history.py
Snapshot capture:     apps/api/app/tasks/snapshot_task.py
Scheduled jobs:       apps/api/app/tasks/scheduled_fetch.py
DB models:            apps/api/app/db/models.py
```

---

## 9. Running The App

### Backend (FastAPI)

```bash
cd apps/api
# Activate venv
.\venv\Scripts\activate       # Windows
# source venv/bin/activate    # Mac/Linux

# Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Next.js)

```bash
cd apps/web
npm run dev
# -> http://localhost:3000
```

### Full Stack

```text
Terminal 1: uvicorn (port 8000)
Terminal 2: npm run dev (port 3000)
Frontend fetches from http://localhost:8000/api/*
```

---

## 10. Quality Rules

```text
1. Backend should never crash on missing/null market data — always return safe defaults.
2. Frontend should not invent fallback market values (PCR=1, IV=15) unless clearly labeled MOCK.
3. Analysis text should use words like "bias", "usually", "suggests" — no guaranteed predictions.
4. Any API returning partial data should still render useful partial UI.
5. Mock data should be clearly labeled as mock.
6. Generated files like __pycache__, .next, node_modules should not be committed.
7. Build/lint should be run after killing stale Next build locks when needed.
8. IV signals are volatility indicators, not directional guarantees:
   - Put skew -> hedging/fear
   - Call skew -> upside speculation
   - Backwardation -> near-term event risk
   - Contango -> normal term structure
```

---

## 11. Current Known Issues & Notes

### Recent Fixes (as of May 2026)

```text
✅ IV surface analysis: fixed undefined skew_ratio crash, added neutral fallback
✅ TREND analysis: null-safe recent snapshot handling, less overconfident PCR wording
✅ Frontend charts: removed fake PCR/IV fallback plotting, added insufficient data states
✅ SPREAD module: ratio matrix accessibility fixes, data rendering stabilized
✅ Backend routes: fixed 404s on /api/chart/*/technicals and /api/options/*/iv-surface
✅ Price fetcher: multi-index yfinance support, synthetic mock data fallback for demo
✅ FunctionSidebar: collapsible sidebar with tooltip on collapsed state
```

### Known Environment Issues

```text
⚠ Multiple node.exe processes / .next/lock file conflict.
  If Next.js says "Another build is already running",
  stop stale Node/Next processes or delete .next/lock before building.

⚠ NSE scraping is fragile — NSE changes headers/cookies frequently.
  Always have yfinance fallback for critical data.
  
⚠ Database URL in config.py says nse_report.db but actual file is nse_history.db.
  DB module uses its own path, so it works, but naming is inconsistent.
```

---

## 12. File Size Reference

Quick reference for locating substantial logic:

### Frontend (by size)

```text
IVSURF.tsx        21.5 KB   <- largest function, 3 views (skew/surface/term)
OMON.tsx          18.6 KB   <- full chain + Greeks + multi-expiry
SPREAD.tsx        16.2 KB   <- Excel-style 3-panel grid
TREND.tsx         14.6 KB   <- time-series charts + trend analysis
CHART.tsx         13.2 KB   <- candlestick + technicals overlay
CC.tsx            10.0 KB   <- market overview dashboard
OIHEAT.tsx         8.9 KB   <- OI heatmap matrix
INTEL.tsx          5.7 KB   <- signal scorecard
signals.ts         5.3 KB   <- verdict helpers
workspaceStore.ts  3.9 KB   <- Zustand state
FunctionSidebar    3.9 KB   <- sidebar component
CommandBar.tsx     2.7 KB   <- command input
WorkspaceTabs.tsx  1.6 KB   <- tab bar
types.ts           1.4 KB   <- shared types
```

### Backend (by size)

```text
report_generator.py   14.2 KB   <- full report logic
iv_analysis.py        12.2 KB   <- IV skew/surface/term structure
nse_fetcher.py         8.9 KB   <- NSE option chain fetcher
options.py (route)     8.9 KB   <- options endpoints
technicals.py          8.4 KB   <- technical indicators
price_fetcher.py       7.1 KB   <- OHLCV (yfinance)
history.py (route)     6.6 KB   <- trend endpoints + analysis
alert_engine.py        4.9 KB   <- alert checks
scheduled_fetch.py     5.6 KB   <- scheduled jobs
global_fetcher.py      4.5 KB   <- global market data
vix_fetcher.py         4.0 KB   <- VIX
greeks.py              3.9 KB   <- Black-Scholes Greeks
support_resistance.py  3.7 KB   <- S/R + OI bias
pcr_calculator.py      3.5 KB   <- PCR
max_pain.py            3.3 KB   <- max pain
snapshot_task.py        3.2 KB   <- daily snapshot
contract_specs.py      2.7 KB   <- lot size/specs
chart.py (route)       2.5 KB   <- OHLCV/technicals endpoints
```
