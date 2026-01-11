export enum AssetType {
  STOCK = 'STOCK', // 股票型 ETF
  BOND = 'BOND',   // 債券型 ETF
}

export interface Holding {
  id: string;
  name: string;
  code: string; // e.g., 0050
  type: AssetType;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface CalculatedHolding extends Holding {
  marketValueRaw: number; // 單純市價 * 股數
  cost: number;           // 持有成本 (含手續費)
  presentValue: number;   // 持有現值 (扣除交易稅與手續費)
  profit: number;         // 預估損益
  roi: number;            // 報酬率
}

export interface DividendRecord {
  id: string;
  date: string;           // 入帳日期 (Payment Date)
  exDividendDate?: string; // 除息日期 (Ex-Dividend Date)
  ticker: string;
  amount: number;
  note?: string;
}

export interface PortfolioSummary {
  totalAssets: number; // 現金 + 證券現值
  stockValue: number;
  bondValue: number;
  cashValue: number;
  totalCost: number;
  totalProfit: number;
  totalRoi: number;
  stockRatio: number;
  bondRatio: number;
}

export interface ThemeColors {
  primary: string;
  stock: string;
  bond: string;
  cash: string;
}