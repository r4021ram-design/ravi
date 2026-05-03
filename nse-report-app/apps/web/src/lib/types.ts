export interface IndexQuote {
  symbol: string;
  last?: number;
  change?: number;
  changePercent?: number;
  status?: string;
}

export interface GlobalQuote {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  status?: string;
}

export interface ReportData {
  report_date: string;
  generated_at: string;
  generation_time_seconds: number;
  market_overview: {
    global_markets: {
      us_indices: Record<string, GlobalQuote>;
      commodities: Record<string, GlobalQuote>;
      forex: Record<string, GlobalQuote>;
      sgx_nifty: GlobalQuote;
    };
    india_opening_bias: string;
    macro_factors: string[];
  };
  index_analysis: Record<string, {
    quote: IndexQuote;
    trend: string;
    support: number[];
    resistance: number[];
    PCR: number | null;
    max_pain: number | null;
    OI_build_up: string | null;
    intraday_bias: string;
  }>;
  fii_dii: {
    net_FII?: number;
    net_DII?: number;
    analysis?: string;
    status?: string;
  };
  volatility: {
    India_VIX?: number;
    change?: string;
    regime?: string;
    interpretation?: string;
    expected_range?: string;
    status?: string;
  };
  trading_plan: {
    best_case: string[];
    worst_case: string[];
    no_trade_zone: string[];
    summary: string;
  };
  options_chain?: Record<string, unknown>;
  stocks?: unknown[];
  strategies?: unknown[];
}
