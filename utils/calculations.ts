import { AssetType, Holding, CalculatedHolding } from '../types';

// Constants based on user prompt
const FEE_RATE = 0.001425; // 0.1425%
const FEE_DISCOUNT = 0.28; // 28% discount (2.8折)
const TAX_RATE_STOCK = 0.001; // 0.1% for Stock ETFs
const TAX_RATE_BOND = 0;      // 0% for Bond ETFs (currently)

/**
 * Calculate Holding Cost
 * Formula: (Qty * AvgPrice) + (Qty * AvgPrice * 0.1425% * 28%)
 */
export const calculateCost = (holding: Holding): number => {
  const baseCost = holding.quantity * holding.avgPrice;
  const fee = baseCost * FEE_RATE * FEE_DISCOUNT;
  return Math.round(baseCost + fee);
};

/**
 * Calculate Present Value
 * Stock Formula: (Qty * CurrPrice) - (Qty * CurrPrice * 0.1425% * 28%) - (Qty * CurrPrice * 0.1%)
 * Bond Formula: (Qty * CurrPrice) - (Qty * CurrPrice * 0.1425% * 28%)
 */
export const calculatePresentValue = (holding: Holding): number => {
  const marketValue = holding.quantity * holding.currentPrice;
  const fee = marketValue * FEE_RATE * FEE_DISCOUNT;
  
  let tax = 0;
  if (holding.type === AssetType.STOCK) {
    tax = marketValue * TAX_RATE_STOCK;
  }
  
  return Math.round(marketValue - fee - tax);
};

export const enrichHolding = (holding: Holding): CalculatedHolding => {
  const cost = calculateCost(holding);
  const presentValue = calculatePresentValue(holding);
  const profit = presentValue - cost;
  const roi = cost === 0 ? 0 : (profit / cost) * 100;
  const marketValueRaw = holding.quantity * holding.currentPrice;

  return {
    ...holding,
    marketValueRaw,
    cost,
    presentValue,
    profit,
    roi
  };
};

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatPercent = (val: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val / 100);
};