# NSE Report App Structure

Ye document app ko samajhne ke liye high-level map hai. Iska goal hai ki frontend, backend, APIs, data flow, aur analytics files ka relation clear ho jaye.

## 1. Big Picture

App do main parts me split hai:

```text
nse-report-app/
  apps/
    web/   -> Next.js frontend trading terminal
    api/   -> FastAPI backend, NSE data fetching, analytics, SQLite history
```

Basic flow:

```text
User command / tab
  -> apps/web/src/app/page.tsx
  -> matching function component, e.g. IVSURF.tsx or TREND.tsx
  -> fetch(API_BASE + /api/...)
  -> apps/api/app/routes/*.py
  -> services/data_ingestion or services/analytics
  -> response JSON
  -> frontend chart/report UI
```

Frontend default API URL:

```text
apps/web/src/lib/config.ts
API_BASE = NEXT_PUBLIC_API_URL or http://localhost:8000
```

## 2. Frontend Structure

```text
apps/web/
  src/
    app/
      page.tsx              -> main terminal workspace screen
      layout.tsx            -> app layout shell
      globals.css           -> global styles
      options/page.tsx      -> standalone options page
      report/page.tsx       -> report page
      strategies/page.tsx   -> strategy page

    components/
      CommandBar.tsx        -> user command input
      WorkspaceTabs.tsx     -> open/close active tabs
      FunctionSidebar.tsx   -> function shortcuts

    functions/
      CC.tsx                -> command center / market overview
      INTEL.tsx             -> intelligence scorecard
      OMON.tsx              -> options monitor
      IVSURF.tsx            -> IV skew, IV surface, term structure
      CHART.tsx             -> price chart and technicals
      OIHEAT.tsx            -> open interest heatmap
      TREND.tsx             -> historical PCR/OI/IV trend
      SPREAD.tsx            -> ratio spread matrix

    store/
      workspaceStore.ts     -> Zustand state for tabs and commands

    lib/
      config.ts             -> backend API base URL
      types.ts              -> shared frontend types
      signals.ts            -> signal/verdict helpers
```

### Frontend Control Flow

`page.tsx` is the main router for terminal functions.

Example:

```text
Command: NIFTY IVSURF
  -> workspaceStore.executeCommand()
  -> addTab("IVSURF", "NIFTY")
  -> page.tsx switch(activeTab.type)
  -> <IVSURF symbol="NIFTY" />
```

Command format:

```text
CC
NIFTY
NIFTY INTEL
NIFTY OMON
NIFTY IVSURF
NIFTY CHART
NIFTY OIHEAT
NIFTY TREND
NIFTY SPREAD
```

## 3. Backend Structure

```text
apps/api/
  app/
    main.py                         -> FastAPI app entry point and router registration
    config.py                       -> app settings

    routes/
      report.py                     -> /api/report/*
      alerts.py                     -> /api/alerts/*
      stocks.py                     -> /api/stocks/*
      strategies.py                 -> /api/strategies/*
      options.py                    -> /api/options/*
      chart.py                      -> /api/chart/*
      history.py                    -> /api/history/*

    services/
      data_ingestion/
        nse_fetcher.py              -> NSE option chain/data fetcher
        price_fetcher.py            -> price/OHLCV fetcher
        vix_fetcher.py              -> VIX fetcher
        global_fetcher.py           -> global market data fetcher

      analytics/
        pcr_calculator.py           -> PCR calculations
        max_pain.py                 -> max pain calculation
        support_resistance.py       -> support/resistance and OI bias
        iv_analysis.py              -> IV skew, surface, term structure
        greeks.py                   -> options Greeks
        technicals.py               -> technical indicators
        contract_specs.py           -> lot size/spec metadata

      report_generator.py           -> report generation
      alert_engine.py               -> alert checks
      websocket_manager.py          -> websocket manager placeholder

    db/
      database.py                   -> SQLite engine/session
      models.py                     -> SQLAlchemy models
      cache.py                      -> cache helpers

    tasks/
      snapshot_task.py              -> daily snapshot capture
      scheduled_fetch.py            -> scheduled fetch jobs
```

## 4. API Map

Registered in `apps/api/app/main.py`:

```text
GET    /health

GET    /api/report/daily
GET    /api/report/latest

POST   /api/alerts
GET    /api/alerts
DELETE /api/alerts/{rule_id}
POST   /api/alerts/check

GET    /api/stocks/signals
POST   /api/strategies/simulate

GET    /api/options/{symbol}
GET    /api/options/{symbol}/iv-skew
GET    /api/options/{symbol}/iv-surface
GET    /api/options/{symbol}/specs
GET    /api/options/{symbol}/oi-heatmap

GET    /api/chart/{symbol}/ohlcv
GET    /api/chart/{symbol}/technicals

GET    /api/history/{symbol}/trends
POST   /api/history/{symbol}/snapshot
```

## 5. TREND Flow

Frontend:

```text
apps/web/src/functions/TREND.tsx
```

Calls:

```text
GET /api/history/{symbol}/trends?days=30
```

Backend:

```text
apps/api/app/routes/history.py
```

Data source:

```text
DailySnapshot table
apps/api/app/db/models.py
```

Returned fields:

```text
date
pcr_oi
total_ce_oi
total_pe_oi
net_oi
atm_iv
spot
max_pain
analysis.verdict
analysis.insights
analysis.pcr_trend
analysis.oi_bias
```

Important rule:

```text
TREND is historical snapshot based.
It is only as good as stored daily snapshots.
If snapshots are missing or partial, analysis should stay neutral instead of pretending confidence.
```

## 6. IVSURF Flow

Frontend:

```text
apps/web/src/functions/IVSURF.tsx
```

Calls two APIs:

```text
GET /api/options/{symbol}/iv-skew
GET /api/options/{symbol}/iv-surface
```

Backend route:

```text
apps/api/app/routes/options.py
```

Analytics:

```text
apps/api/app/services/analytics/iv_analysis.py
```

IVSURF views:

```text
SKEW     -> CE IV vs PE IV across strikes
SURFACE  -> IV heatmap across strikes and expiries
TERM     -> ATM IV across expiries
```

Important rule:

```text
IV skew and term structure are volatility signals, not guaranteed directional calls.
Put skew often means hedging/fear.
Call skew often means upside speculation.
Backwardation often means near-term event risk.
Contango is normal term structure.
```

## 7. Database

Current DB:

```text
apps/api/nse_history.db
```

Connection:

```text
apps/api/app/db/database.py
sqlite:///./nse_history.db
```

Main historical tables:

```text
DailySnapshot
  symbol
  date
  pcr_oi
  pcr_volume
  india_vix
  atm_iv
  total_ce_oi
  total_pe_oi
  underlying_value
  max_pain
  support_level
  resistance_level

StrikeSnapshot
  symbol
  date
  expiry
  strike_price
  ce_oi
  pe_oi
  ce_iv
  pe_iv
```

## 8. Where To Change What

Use this guide when adding/fixing features:

```text
New terminal command
  -> apps/web/src/store/workspaceStore.ts
  -> apps/web/src/app/page.tsx
  -> apps/web/src/functions/NewFunction.tsx

New backend endpoint
  -> apps/api/app/routes/new_route.py
  -> register router in apps/api/app/main.py

New option analytics
  -> apps/api/app/services/analytics/*.py
  -> expose through apps/api/app/routes/options.py

Historical trend logic
  -> apps/api/app/routes/history.py
  -> data stored by apps/api/app/tasks/snapshot_task.py

Chart display issue
  -> relevant file in apps/web/src/functions/

API URL issue
  -> apps/web/src/lib/config.ts
  -> NEXT_PUBLIC_API_URL environment variable
```

## 9. Recommended Quality Rules

Keep these rules for fewer errors:

```text
1. Backend should never crash on missing/null market data.
2. Frontend should not invent fallback market values like PCR=1 or IV=15 unless clearly marked mock.
3. Analysis text should use words like "bias", "usually", "suggests" instead of guaranteed predictions.
4. Any API returning partial data should still render useful partial UI.
5. Mock data should be clearly labeled as mock.
6. Generated files like __pycache__ and .next should not be committed.
7. Build/lint should be run after killing stale Next build locks when needed.
```

## 10. Current Important Notes

Recent fixes improved:

```text
IV surface analysis:
  - fixed undefined skew_ratio crash
  - added neutral fallback for incomplete skew data

TREND analysis:
  - added null-safe recent snapshot handling
  - made PCR wording less overconfident

Frontend charts:
  - removed fake PCR/IV fallback plotting
  - added insufficient data states
  - improved partial IV API failure handling
```

Known local environment issue:

```text
There are multiple node.exe processes and a .next/lock file.
Next build may say "Another next build process is already running".
Before final build verification, stop stale Node/Next processes or clear the lock only after confirming no dev server is needed.
```

