import { AssetType, Holding } from './types';

export const INITIAL_CASH = 1000000; // 100萬定存
export const TARGET_ASSETS = 8000000; // 總資產目標
export const TARGET_INVESTMENT = 7000000; // 預計投入股債

// User provided data (excluding "元大台灣高息低波")
// Categorized by common knowledge of these tickers
export const INITIAL_HOLDINGS: Holding[] = [
  {
    id: '1',
    name: '元大台灣50',
    code: '0050',
    type: AssetType.STOCK,
    quantity: 22000,
    avgPrice: 62.35,
    currentPrice: 63.7,
  },
  {
    id: '2',
    name: '元大高股息',
    code: '0056',
    type: AssetType.STOCK,
    quantity: 20000,
    avgPrice: 35.96,
    currentPrice: 36.54,
  },
  {
    id: '5',
    name: '群益台灣精選高息',
    code: '00919',
    type: AssetType.STOCK,
    quantity: 40000,
    avgPrice: 21.62,
    currentPrice: 22.46,
  },
  {
    id: '3',
    name: '元大美債20年',
    code: '00679B',
    type: AssetType.BOND,
    quantity: 45000,
    avgPrice: 27.62,
    currentPrice: 27.27,
  },
  {
    id: '4',
    name: '元大投資級公司債',
    code: '00720B',
    type: AssetType.BOND,
    quantity: 30000,
    avgPrice: 33.74,
    currentPrice: 33.69,
  },
  {
    id: '6',
    name: '群益ESG投等債20+',
    code: '00937B',
    type: AssetType.BOND,
    quantity: 45000,
    avgPrice: 15.17,
    currentPrice: 15.07,
  },
];