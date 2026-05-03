export type SignalVerdict = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface Signal {
  text: string;
  verdict: SignalVerdict;
  category: 'TECHNICAL' | 'OPTIONS' | 'MACRO';
}

export interface IntelResult {
  symbol: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  overallVerdict: SignalVerdict;
  signals: Signal[];
}

// These types roughly match what we have in the backend ReportData
interface IndexData {
  quote?: { last?: number; changePercent?: number };
  trend?: string;
  PCR?: number | null;
  max_pain?: number | null;
  intraday_bias?: string;
  OI_build_up?: string | null;
  support?: number[];
  resistance?: number[];
}

export function generateIntel(
  symbol: string,
  data: IndexData,
  vixData?: { India_VIX?: number; regime?: string },
  fiiData?: { net_FII?: number }
): IntelResult {
  const signals: Signal[] = [];

  // Technical Signals
  if (data.trend) {
    const trend = data.trend.toLowerCase();
    if (trend.includes('up') || trend.includes('bullish')) {
      signals.push({ text: `Price trend is ${data.trend}`, verdict: 'BULLISH', category: 'TECHNICAL' });
    } else if (trend.includes('down') || trend.includes('bearish')) {
      signals.push({ text: `Price trend is ${data.trend}`, verdict: 'BEARISH', category: 'TECHNICAL' });
    } else {
      signals.push({ text: `Price trend is ${data.trend}`, verdict: 'NEUTRAL', category: 'TECHNICAL' });
    }
  }

  // S/R Proximity
  if (data.quote?.last && data.support && data.support.length > 0) {
    const nearestSupport = data.support[0];
    const dist = ((data.quote.last - nearestSupport) / data.quote.last) * 100;
    if (dist > 0 && dist < 0.5) {
      signals.push({ text: `Near major support at ${nearestSupport} (within ${dist.toFixed(2)}%)`, verdict: 'BULLISH', category: 'TECHNICAL' });
    }
  }
  if (data.quote?.last && data.resistance && data.resistance.length > 0) {
    const nearestResist = data.resistance[0];
    const dist = ((nearestResist - data.quote.last) / data.quote.last) * 100;
    if (dist > 0 && dist < 0.5) {
      signals.push({ text: `Near major resistance at ${nearestResist} (within ${dist.toFixed(2)}%)`, verdict: 'BEARISH', category: 'TECHNICAL' });
    }
  }

  // Options Signals
  if (data.PCR != null) {
    if (data.PCR > 1.3) {
      signals.push({ text: `Extreme PCR (${data.PCR}) - Overbought/Support`, verdict: 'BULLISH', category: 'OPTIONS' });
    } else if (data.PCR > 1.1) {
      signals.push({ text: `Strong PCR (${data.PCR})`, verdict: 'BULLISH', category: 'OPTIONS' });
    } else if (data.PCR < 0.7) {
      signals.push({ text: `Weak PCR (${data.PCR}) - Resistance`, verdict: 'BEARISH', category: 'OPTIONS' });
    } else {
      signals.push({ text: `Neutral PCR (${data.PCR})`, verdict: 'NEUTRAL', category: 'OPTIONS' });
    }
  }

  if (data.OI_build_up) {
    if (data.OI_build_up.includes('Long Build Up')) {
      signals.push({ text: `OI: Long Build Up detected`, verdict: 'BULLISH', category: 'OPTIONS' });
    } else if (data.OI_build_up.includes('Short Covering')) {
      signals.push({ text: `OI: Short Covering in progress`, verdict: 'BULLISH', category: 'OPTIONS' });
    } else if (data.OI_build_up.includes('Short Build Up')) {
      signals.push({ text: `OI: Short Build Up detected`, verdict: 'BEARISH', category: 'OPTIONS' });
    } else if (data.OI_build_up.includes('Long Unwinding')) {
      signals.push({ text: `OI: Long Unwinding detected`, verdict: 'BEARISH', category: 'OPTIONS' });
    }
  }

  // Macro Signals (VIX & FII)
  if (vixData?.India_VIX != null) {
    if (vixData.India_VIX > 18) {
      signals.push({ text: `Elevated VIX (${vixData.India_VIX.toFixed(1)}) - High volatility risk`, verdict: 'BEARISH', category: 'MACRO' });
    } else if (vixData.India_VIX < 12) {
      signals.push({ text: `Low VIX (${vixData.India_VIX.toFixed(1)}) - Complacency risk`, verdict: 'NEUTRAL', category: 'MACRO' });
    } else {
      signals.push({ text: `Stable VIX environment (${vixData.India_VIX.toFixed(1)})`, verdict: 'BULLISH', category: 'MACRO' });
    }
  }

  if (fiiData?.net_FII != null) {
    if (fiiData.net_FII > 1000) {
      signals.push({ text: `Institutional inflow: ₹${fiiData.net_FII} Cr`, verdict: 'BULLISH', category: 'MACRO' });
    } else if (fiiData.net_FII < -1000) {
      signals.push({ text: `Institutional outflow: ₹${fiiData.net_FII} Cr`, verdict: 'BEARISH', category: 'MACRO' });
    }
  }

  // Weighted Verdict Calculation
  const bullishCount = signals.filter(s => s.verdict === 'BULLISH').length;
  const bearishCount = signals.filter(s => s.verdict === 'BEARISH').length;
  const neutralCount = signals.filter(s => s.verdict === 'NEUTRAL').length;

  let score = 0;
  signals.forEach(s => {
    let weight = 1;
    if (s.category === 'TECHNICAL') weight = 1.5;
    if (s.category === 'OPTIONS') weight = 1.2;
    if (s.category === 'MACRO') weight = 1.0;

    if (s.verdict === 'BULLISH') score += weight;
    if (s.verdict === 'BEARISH') score -= weight;
  });

  let overallVerdict: SignalVerdict = 'NEUTRAL';
  if (score > 1.5) overallVerdict = 'BULLISH';
  else if (score < -1.5) overallVerdict = 'BEARISH';

  return {
    symbol,
    bullishCount,
    bearishCount,
    neutralCount,
    overallVerdict,
    signals
  };
}
