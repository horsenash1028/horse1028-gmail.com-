import React, { useState, useCallback, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector
} from 'recharts';
import { AssetType, PortfolioSummary, CalculatedHolding, ThemeColors, Holding } from '../types';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Edit2, Info, Eye, EyeOff, RefreshCw, Coins, Target, AlertTriangle, Calculator, ArrowRight, ArrowLeftRight, PiggyBank } from 'lucide-react';
import { HoldingsTable } from './HoldingsTable';

interface DashboardProps {
  summary: PortfolioSummary;
  holdings: CalculatedHolding[];
  cash: number;
  theme: 'light' | 'dark' | 'contrast';
  customColors: ThemeColors;
  onUpdateHolding: (id: string, field: 'avgPrice' | 'currentPrice' | 'quantity', value: number) => void;
  onAddHolding?: (holding: Holding) => void;
  onDeleteHolding?: (id: string) => void;
  onUpdateCash: (value: number) => void;
  onRefreshPrices?: () => void;
  isUpdatingPrices?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  summary, 
  holdings, 
  cash, 
  theme, 
  customColors, 
  onUpdateHolding, 
  onAddHolding, 
  onDeleteHolding, 
  onUpdateCash,
  onRefreshPrices,
  isUpdatingPrices
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [hiddenSlices, setHiddenSlices] = useState<string[]>([]);
  const [isCashExcluded, setIsCashExcluded] = useState(false); // Toggle for Pie Chart
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);

  // Dynamic Chart Colors based on Custom Colors & Theme
  const CHART_COLORS = {
    STOCK: customColors.stock,
    BOND: customColors.bond,
    CASH: customColors.cash,
    CENTER_TEXT: theme === 'light' ? '#374151' : (theme === 'contrast' ? '#ffffff' : '#f3f4f6'),
    GRID: theme === 'light' ? '#f3f4f6' : (theme === 'contrast' ? '#333333' : '#334155'),
    TOOLTIP_BG: theme === 'light' ? '#ffffff' : (theme === 'contrast' ? '#000000' : '#1e293b'),
    TOOLTIP_BORDER: theme === 'light' ? '#e5e7eb' : (theme === 'contrast' ? '#ffffff' : '#334155'),
    TOOLTIP_TEXT: theme === 'light' ? '#374151' : '#f3f4f6',
    ACTIVE_STROKE: theme === 'light' ? '#ffffff' : (theme === 'contrast' ? '#000000' : '#1e293b'), // Stroke color for active slice cutout
  };

  const allocationData = [
    { name: '股票 ETF', value: summary.stockValue, type: AssetType.STOCK },
    { name: '債券 ETF', value: summary.bondValue, type: AssetType.BOND },
    { name: '定存現金', value: summary.cashValue, type: 'CASH' },
  ];

  // Data for Pie Chart (Filtered)
  const pieChartData = useMemo(() => {
     let data = allocationData;
     if (isCashExcluded) {
         data = data.filter(d => d.type !== 'CASH');
     }
     return data.filter(d => !hiddenSlices.includes(d.name));
  }, [allocationData, isCashExcluded, hiddenSlices]);

  // Total for Pie Chart Center
  const pieTotalValue = useMemo(() => {
     return pieChartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [pieChartData]);

  const holdingsData = holdings.map(h => ({
    name: h.name.replace('元大', '').replace('群益', ''),
    fullName: h.name,
    code: h.code,
    value: h.presentValue,
    cost: h.cost,
    profit: h.profit,
    roi: h.roi,
    type: h.type
  })).sort((a, b) => b.value - a.value);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };
  
  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  const toggleSlice = (name: string) => {
    setHiddenSlices(prev => {
        if (prev.includes(name)) {
            return prev.filter(n => n !== name);
        } else {
            return [...prev, name];
        }
    });
    setActiveIndex(-1);
  };

  // Logic for Stock/Bond deviation (Target 60/40)
  const stockGap = summary.stockRatio - 60;
  
  // Logic for Market Drop Signal
  const isMarketDropOpportunity = summary.totalRoi <= -10;
  
  // Rebalancing Logic
  const rebalancingCalculations = useMemo(() => {
      const investedTotal = summary.stockValue + summary.bondValue;
      if (investedTotal === 0) return { action: 'none', amount: 0, text: '無投資部位' };

      const targetStockValue = investedTotal * 0.6;
      const diff = targetStockValue - summary.stockValue; // + means Buy Stock, - means Sell Stock (or Buy Bond)
      
      // Strategy 1: Switch (Sell A to Buy B)
      const switchAmount = Math.abs(diff);
      const switchAction = diff > 0 ? 'buy_stock' : 'buy_bond';

      // Strategy 2: Inflow (Use Cash to Buy Underweight)
      // Logic: New Total * 0.6 = (CurrentStock + X). Solve for X?
      // Simpler: Just buy the shortfall directly? No, that changes the denominator.
      // Formula: (S + x) / (Total + x) = 0.6
      // S + x = 0.6T + 0.6x => 0.4x = 0.6T - S
      // x = (0.6 * Total - Stock) / 0.4  (If buying stock)
      // OR x = (0.4 * Total - Bond) / 0.6 (If buying bond)
      
      let inflowAmount = 0;
      let inflowType = '';
      
      if (diff > 0) {
          // Stock is low (e.g. 50%). Need to buy Stock.
          // x = (0.6 * Total - Stock) / (1 - 0.6) = (TargetStock - Stock) / 0.4
          inflowAmount = (targetStockValue - summary.stockValue) / 0.4;
          inflowType = 'stock';
      } else {
          // Bond is low (Stock is high). Need to buy Bond.
          // Target Bond = 0.4. Current Bond.
          // x = (0.4 * Total - Bond) / (1 - 0.4) = (TargetBond - Bond) / 0.6
          const targetBondValue = investedTotal * 0.4;
          inflowAmount = (targetBondValue - summary.bondValue) / 0.6;
          inflowType = 'bond';
      }

      return {
          investedTotal,
          diff,
          switchAmount,
          switchAction,
          inflowAmount,
          inflowType
      };
  }, [summary]);

  
  // Custom Active Shape for the Pie Chart with Drop Shadow and Stroke
  const renderActiveShape = useCallback((props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        {/* Main Expanded Sector with Strong Drop Shadow and Stroke */}
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8} 
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke={CHART_COLORS.ACTIVE_STROKE}
          strokeWidth={2}
          style={{ filter: 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.25))' }} 
        />
        {/* Decorative Outer Ring (Halo) */}
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 12}
          outerRadius={outerRadius + 14}
          fill={fill}
          fillOpacity={0.4}
        />
      </g>
    );
  }, [CHART_COLORS.ACTIVE_STROKE]);

  // Logic for Center Text in Donut Chart
  const activeItem = activeIndex >= 0 && activeIndex < pieChartData.length 
    ? pieChartData[activeIndex] 
    : null;
    
  // Default to Total Assets if no item is hovered
  const centerTitle = activeItem ? activeItem.name : (isCashExcluded ? '投資總值' : '總資產現值');
  const centerValue = activeItem ? activeItem.value : pieTotalValue;
  
  // Dynamic color: use item color when hovered, otherwise default text color
  const centerColor = activeItem 
    ? (activeItem.type === 'CASH' ? CHART_COLORS.CASH : CHART_COLORS[activeItem.type as AssetType]) 
    : CHART_COLORS.CENTER_TEXT;
    
  // Percentage: Show specific % when hovered
  const centerRate = activeItem 
    ? (pieTotalValue > 0 ? (activeItem.value / pieTotalValue * 100).toFixed(1) + '%' : '0%') 
    : '';

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
            className="rounded-xl shadow-lg border p-3 animate-fade-in"
            style={{ 
                backgroundColor: CHART_COLORS.TOOLTIP_BG, 
                borderColor: CHART_COLORS.TOOLTIP_BORDER,
                color: CHART_COLORS.TOOLTIP_TEXT
            }}
        >
          <div className="font-bold text-sm mb-1">{data.fullName} ({data.code})</div>
          <div className="space-y-1 text-xs font-mono">
             <div className="flex justify-between gap-4">
                <span className="opacity-70">現值:</span>
                <span className="font-bold">${formatCurrency(data.value)}</span>
             </div>
             <div className="flex justify-between gap-4">
                <span className="opacity-70">成本:</span>
                <span className="font-medium text-skin-text-muted">${formatCurrency(data.cost)}</span>
             </div>
             <div className="flex justify-between gap-4">
                <span className="opacity-70">損益:</span>
                <span className={data.profit >= 0 ? 'text-skin-success' : 'text-skin-danger'}>
                    {data.profit > 0 ? '+' : ''}{formatCurrency(data.profit)}
                </span>
             </div>
             <div className="flex justify-between gap-4">
                <span className="opacity-70">報酬率:</span>
                <span className={data.roi >= 0 ? 'text-skin-success' : 'text-skin-danger'}>
                    {data.roi > 0 ? '+' : ''}{data.roi.toFixed(2)}%
                </span>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Helper styles for glass/gradient cards
  const cardBaseStyle = "rounded-xl shadow-sm border border-skin-border relative overflow-hidden group hover:shadow-md transition-all duration-300 backdrop-blur-sm";
  const getGradientStyle = (color: string, opacity = 0.05) => ({
    background: `linear-gradient(135deg, ${theme === 'dark' ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.8)'}, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')})`
  });

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Update Price Indicator - Fixed Toast Notification */}
      <div 
        className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-in-out transform ${
          isUpdatingPrices 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-skin-card/90 backdrop-blur-md text-skin-primary border border-skin-primary/20 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-bold ring-1 ring-skin-primary/10">
            <div className="p-1.5 bg-skin-primary/10 rounded-full">
                <RefreshCw size={16} className="animate-spin" />
            </div>
            <div className="flex flex-col">
                <span>更新即時報價</span>
                <span className="text-[10px] font-normal opacity-80 text-skin-text-muted">正從證交所取得最新資料...</span>
            </div>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Total Assets */}
        <div className={cardBaseStyle} style={getGradientStyle(customColors.primary)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-skin-primary rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 opacity-10"></div>
          <div className="p-6 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-skin-text-muted text-sm font-medium">總資產現值</h3>
              <div className="p-2 bg-skin-primary/10 rounded-lg text-skin-primary">
                 <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-skin-text-base mt-2 font-mono">
              ${formatCurrency(summary.totalAssets)}
            </p>
            <p className="text-xs text-skin-text-muted mt-1">包含 {formatCurrency(cash)} 定存與現金</p>
          </div>
        </div>

        {/* Card 2: Securities Value & Cost */}
        <div className={cardBaseStyle} style={getGradientStyle(customColors.stock)}>
          <div className="p-6 relative">
            <div className="flex items-center justify-between">
                <h3 className="text-skin-text-muted text-sm font-medium">證券市值 & 成本</h3>
                <div className="p-2 bg-skin-base rounded-lg text-skin-text-muted group-hover:text-skin-primary transition-colors">
                    <Coins size={16} />
                </div>
            </div>
            <div className="mt-3 flex flex-col gap-1">
                <div className="flex items-end justify-between">
                    <span className="text-xs text-skin-text-muted">市值</span>
                    <span className="text-xl font-bold font-mono text-skin-text-base">${formatCurrency(summary.stockValue + summary.bondValue)}</span>
                </div>
                <div className="w-full h-px bg-skin-border/50 my-1"></div>
                <div className="flex items-end justify-between">
                    <span className="text-xs text-skin-text-muted">成本</span>
                    <span className="text-base font-medium font-mono text-skin-text-muted">${formatCurrency(summary.totalCost)}</span>
                </div>
            </div>
          </div>
        </div>

        {/* Card 3: Estimated Profit */}
        <div className={cardBaseStyle} style={getGradientStyle(summary.totalProfit >= 0 ? customColors.stock : customColors.cash)}>
          <div className="p-6 relative">
            <div className="flex items-center justify-between">
                <h3 className="text-skin-text-muted text-sm font-medium">預估總損益</h3>
                <div className={`p-2 rounded-lg ${summary.totalProfit >= 0 ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-green-50 text-green-500 dark:bg-green-900/20'}`}>
                    {summary.totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
            </div>
            <p className={`text-2xl font-bold mt-2 font-mono ${summary.totalProfit >= 0 ? 'text-skin-success' : 'text-skin-danger'}`}>
                {summary.totalProfit > 0 ? '+' : ''}{formatCurrency(summary.totalProfit)}
            </p>
            <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                summary.totalProfit >= 0 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                {summary.totalRoi > 0 ? '+' : ''}{summary.totalRoi.toFixed(2)}%
                </span>
            </div>
          </div>
        </div>

        {/* Card 4: Allocation Ratio (Enhanced) */}
        <div className={`${cardBaseStyle} flex flex-col`} style={getGradientStyle(customColors.bond)}>
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-skin-text-muted text-sm font-medium">股債配置 (60/40)</h3>
                <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setShowRebalanceModal(true)}
                        className="p-1.5 text-xs font-bold text-skin-primary bg-skin-primary/10 hover:bg-skin-primary/20 rounded-md transition-colors flex items-center gap-1"
                        title="智能再平衡計算"
                     >
                        <Calculator size={14} />
                        調整建議
                     </button>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-4">
                {/* Visualization of Current vs Target */}
                <div className="space-y-3">
                    
                    {/* Current Bar */}
                    <div className="group/bar">
                        <div className="flex justify-between text-xs mb-1.5 font-mono">
                            <span className="text-skin-text-base font-bold flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-skin-text-base animate-pulse"></div> 目前
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold" style={{ color: customColors.stock }}>{summary.stockRatio.toFixed(1)}%</span>
                                <span className="text-skin-border text-[10px]">|</span>
                                <span className="font-bold" style={{ color: customColors.bond }}>{summary.bondRatio.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="w-full h-3 bg-skin-base rounded-full overflow-hidden flex shadow-inner relative">
                            <div style={{ width: `${summary.stockRatio}%`, backgroundColor: customColors.stock }} className="h-full transition-all duration-700 ease-out hover:opacity-90" title={`股票: ${summary.stockRatio.toFixed(1)}%`}></div>
                            <div style={{ width: `${summary.bondRatio}%`, backgroundColor: customColors.bond }} className="h-full transition-all duration-700 ease-out hover:opacity-90" title={`債券: ${summary.bondRatio.toFixed(1)}%`}></div>
                            
                            {/* Target Marker Overlay (60% Line) */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white mix-blend-overlay z-10" style={{ left: '60%' }} title="目標 60%"></div>
                        </div>
                    </div>

                    {/* Target Bar (Reference) */}
                    <div className="opacity-60 grayscale-[0.3] hover:opacity-100 hover:grayscale-0 transition-all">
                        <div className="flex justify-between text-xs mb-1.5 font-mono">
                            <span className="text-skin-text-muted font-medium flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-skin-text-muted"></div> 目標
                            </span>
                            <div className="flex items-center gap-2 text-skin-text-muted">
                                <span>60.0%</span>
                                <span className="text-skin-border text-[10px]">|</span>
                                <span>40.0%</span>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-skin-base rounded-full overflow-hidden flex">
                            <div style={{ width: `60%`, backgroundColor: customColors.stock }} className="h-full"></div>
                            <div style={{ width: `40%`, backgroundColor: customColors.bond }} className="h-full"></div>
                        </div>
                    </div>

                </div>
            </div>

            <div className="text-xs mt-4 pt-3 border-t border-skin-border flex items-center justify-between">
                <span className="text-skin-text-muted">偏離診斷:</span>
                <span className={`${Math.abs(stockGap) < 2 ? 'text-skin-success' : 'text-skin-danger'} font-bold font-mono`}>
                    {Math.abs(stockGap) < 1 
                        ? '配置完美' 
                        : (stockGap > 0 ? `股票 +${stockGap.toFixed(1)}%` : `債券 +${Math.abs(stockGap).toFixed(1)}%`)
                    }
                </span>
            </div>
          </div>
        </div>

        {/* Card 5: Cash Input - With Opportunity Banner */}
        <div className={`${cardBaseStyle} flex flex-col ${isMarketDropOpportunity ? 'border-skin-danger ring-1 ring-skin-danger' : ''}`} style={getGradientStyle(customColors.cash)}>
          {/* Opportunity Banner - Visible only when market drops */}
          {isMarketDropOpportunity && (
            <div className="bg-skin-danger text-white text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 animate-pulse shadow-inner">
                <AlertTriangle size={14} fill="currentColor" className="text-white" />
                <span>進場訊號 (跌幅&gt;10%)</span>
            </div>
          )}

          <div className="p-6 flex flex-col justify-between flex-1">
            <div>
                <div className="flex items-center justify-between">
                    <h3 className="text-skin-text-muted text-sm font-medium flex items-center gap-2">
                        加碼資金 (現金)
                        <Edit2 className="w-3 h-3 text-skin-text-muted" />
                    </h3>
                    <div className={`p-1 rounded text-xs font-bold ${
                    (summary.cashValue / summary.totalAssets) > 0.1 
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                    {summary.totalAssets > 0 ? ((summary.cashValue / summary.totalAssets) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div className="mt-2 flex items-center relative">
                    <span className="text-xl font-bold text-skin-text-base mr-1 absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none">$</span>
                    <input 
                        type="number" 
                        value={cash}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => onUpdateCash(parseFloat(e.target.value) || 0)}
                        className="text-2xl font-bold text-skin-text-base w-full bg-transparent border-b border-skin-border/50 hover:border-skin-primary focus:border-skin-primary focus:outline-none transition-colors font-mono pl-5 py-1 no-spinner"
                    />
                </div>
            </div>
            
            <p className={`text-xs mt-3 pt-2 border-t border-skin-border/30 font-bold flex items-center gap-1 ${isMarketDropOpportunity ? 'text-skin-danger' : 'text-skin-text-muted'}`}>
                {isMarketDropOpportunity ? <TrendingDown size={14} /> : null}
                {isMarketDropOpportunity ? '建議分批布局' : '股市跌幅 > 10% 進場準備'}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation Pie Chart */}
        <div className="bg-skin-card p-6 rounded-xl shadow-sm border border-skin-border lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-skin-text-base">資產配置</h3>
            <button 
                onClick={() => setIsCashExcluded(!isCashExcluded)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${isCashExcluded ? 'bg-skin-primary text-skin-primary-fg border-transparent' : 'bg-skin-base text-skin-text-muted border-skin-border'}`}
            >
                {isCashExcluded ? '包含現金' : '隱藏現金'}
            </button>
          </div>
          
          <div className="flex flex-col items-center flex-1">
             {/* Chart Container */}
            <div className="relative w-[220px] h-[220px] mb-6 flex-shrink-0">
               {/* Center Text Overlay */}
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 select-none">
                 <div className="text-center transition-all duration-300 transform scale-100">
                    <p className="text-sm text-skin-text-muted font-medium mb-1 tracking-wider">{centerTitle}</p>
                    <p className="text-xl font-bold transition-colors duration-200 font-mono" style={{ color: centerColor }}>
                        ${formatCurrency(centerValue)}
                    </p>
                    {centerRate && (
                        <p className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block bg-skin-base text-skin-text-base animate-fade-in shadow-sm border border-skin-border/50`}>
                            {centerRate}
                        </p>
                    )}
                </div>
               </div>
               
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     activeIndex={activeIndex}
                     activeShape={renderActiveShape}
                     data={pieChartData}
                     cx="50%" // Centered
                     cy="50%" // Centered
                     innerRadius={65} // Slightly increased for better text visibility
                     outerRadius={85}
                     paddingAngle={2}
                     dataKey="value"
                     onMouseEnter={onPieEnter}
                     onMouseLeave={onPieLeave}
                     stroke="none"
                   >
                     {pieChartData.map((entry, index) => (
                       <Cell 
                         key={`cell-${entry.name}`} 
                         fill={entry.type === 'CASH' ? CHART_COLORS.CASH : CHART_COLORS[entry.type as AssetType]} 
                         className="cursor-pointer focus:outline-none transition-all duration-300"
                       />
                     ))}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
            </div>

            {/* Custom Interactive Legend */}
            <div 
                className="w-full space-y-3"
                onMouseLeave={() => setActiveIndex(-1)} // Mouse Leave optimization
            >
              {allocationData.map((entry, index) => {
                 // Skip cash in legend if excluded
                 if (isCashExcluded && entry.type === 'CASH') return null;

                 const isHidden = hiddenSlices.includes(entry.name);
                 const isActive = !isHidden && activeItem?.name === entry.name;
                 const color = entry.type === 'CASH' ? CHART_COLORS.CASH : CHART_COLORS[entry.type as AssetType];
                 
                 // Calculate percentage based on current view (excluded or not)
                 const pct = pieTotalValue > 0 ? entry.value / pieTotalValue * 100 : 0;

                 return (
                  <div 
                    key={`legend-${index}`}
                    onClick={() => toggleSlice(entry.name)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer border select-none group ${
                      isActive 
                        ? 'bg-skin-base border-skin-border shadow-md transform scale-[1.02]' 
                        : isHidden 
                            ? 'bg-skin-base/30 border-transparent opacity-50' 
                            : 'border-transparent hover:bg-skin-base'
                    }`}
                    onMouseEnter={() => {
                        if(!isHidden) {
                            const idx = pieChartData.findIndex(d => d.name === entry.name);
                            if (idx !== -1) setActiveIndex(idx);
                        }
                    }}
                  >
                    <div className="flex items-center gap-3">
                       <div className="relative">
                           <div className={`w-3 h-3 rounded-full shadow-sm transition-colors ${isHidden ? 'bg-gray-400' : ''}`} style={{ backgroundColor: isHidden ? undefined : color }} />
                           {isHidden && (
                               <div className="absolute inset-0 flex items-center justify-center">
                                   <div className="w-4 h-0.5 bg-skin-text-muted rotate-45 transform origin-center"></div>
                               </div>
                           )}
                       </div>
                      <span className={`text-sm font-medium ${isActive ? 'text-skin-text-base' : 'text-skin-text-muted'} ${isHidden ? 'line-through' : ''}`}>
                        {entry.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {!isHidden && (
                            <div className="text-right">
                                <div className="font-bold text-skin-text-base text-sm">
                                    {formatPercent(pct)}
                                </div>
                                <div className="text-xs text-skin-text-muted font-mono">
                                    ${formatCurrency(entry.value)}
                                </div>
                            </div>
                        )}
                        <div className="text-skin-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Holdings Bar Chart - Unchanged */}
        <div className="bg-skin-card p-6 rounded-xl shadow-sm border border-skin-border lg:col-span-2">
          <h3 className="text-lg font-bold text-skin-text-base mb-4">持股價值分佈</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={holdingsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.GRID} />
                <XAxis 
                    dataKey="name" 
                    tick={{fontSize: 12, fill: '#6b7280'}} 
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis hide />
                <RechartsTooltip content={<CustomBarTooltip />} cursor={{fill: CHART_COLORS.GRID, opacity: 0.3}} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {holdingsData.map((entry, index) => {
                    const color = entry.type === AssetType.BOND ? CHART_COLORS.BOND : CHART_COLORS.STOCK;
                    return (
                        <Cell key={`cell-${index}`} fill={color} opacity={0.85} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Holdings Table Section */}
      <div className="space-y-4">
        {/* Info Alert */}
        <div className="bg-skin-primary-bg/50 border-l-4 border-skin-primary p-4 rounded-r shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex">
                <div className="flex-shrink-0">
                   <Info className="h-5 w-5 text-skin-primary" />
                </div>
                <div className="ml-3">
                    <p className="text-sm text-skin-text-base opacity-80">
                        提示：表格內的數值可直接點擊編輯，並會自動計算手續費與稅金。
                    </p>
                </div>
            </div>
        </div>
        
        <HoldingsTable 
            holdings={holdings} 
            customColors={customColors}
            onUpdateHolding={onUpdateHolding}
            onAddHolding={onAddHolding}
            onDeleteHolding={onDeleteHolding}
            onRefreshPrices={onRefreshPrices}
            isUpdatingPrices={isUpdatingPrices}
        />
      </div>

      {/* Rebalance Modal */}
      {showRebalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-skin-card w-full max-w-lg rounded-2xl shadow-xl border border-skin-border overflow-hidden transform transition-all flex flex-col">
              <div className="p-4 border-b border-skin-border flex justify-between items-center bg-skin-base">
                <h3 className="font-bold text-lg flex items-center gap-2 text-skin-text-base">
                  <Calculator size={20} className="text-skin-primary" />
                  智能再平衡建議
                </h3>
                <button onClick={() => setShowRebalanceModal(false)} className="text-skin-text-muted hover:text-skin-text-base">
                  <ArrowRight size={20} className="rotate-45" /> {/* Close Icon alternative */}
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                 <div className="text-sm text-skin-text-muted bg-skin-base p-3 rounded-lg border border-skin-border">
                    目標配置為 <strong>股票 60%</strong> / <strong>債券 40%</strong>。以下提供兩種達成平衡的策略建議。
                 </div>

                 {rebalancingCalculations.investedTotal > 0 ? (
                    <>
                        {/* Strategy 1: Inflow */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-skin-text-base flex items-center gap-2">
                                <PiggyBank size={18} className="text-skin-primary" />
                                策略一：投入閒置資金 (不賣出)
                            </h4>
                            <div className="bg-skin-card border border-skin-border rounded-xl p-4 shadow-sm relative overflow-hidden">
                                {rebalancingCalculations.diff === 0 ? (
                                    <div className="text-center text-skin-success font-bold py-2">目前配置完美，無需調整！</div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-skin-text-muted">建議操作</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${rebalancingCalculations.inflowType === 'stock' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {rebalancingCalculations.inflowType === 'stock' ? '買入股票' : '買入債券'}
                                            </span>
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-skin-text-base mb-1">
                                            ${formatCurrency(rebalancingCalculations.inflowAmount)}
                                        </div>
                                        <p className="text-xs text-skin-text-muted">
                                            若您有足夠現金，請買入上述金額的 {rebalancingCalculations.inflowType === 'stock' ? '股票 ETF' : '債券 ETF'}，即可將比例拉回 60/40。
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Strategy 2: Switch */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-skin-text-base flex items-center gap-2">
                                <ArrowLeftRight size={18} className="text-skin-primary" />
                                策略二：資產轉換 (賣高買低)
                            </h4>
                            <div className="bg-skin-card border border-skin-border rounded-xl p-4 shadow-sm">
                                {rebalancingCalculations.diff === 0 ? (
                                    <div className="text-center text-skin-success font-bold py-2">目前配置完美，無需調整！</div>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 text-center p-3 bg-skin-base/50 rounded-lg">
                                            <div className="text-xs text-skin-text-muted mb-1">賣出</div>
                                            <div className="font-bold text-skin-text-base font-mono text-lg">
                                                ${formatCurrency(rebalancingCalculations.switchAmount)}
                                            </div>
                                            <div className={`text-xs font-bold mt-1 ${rebalancingCalculations.switchAction === 'buy_stock' ? 'text-blue-500' : 'text-red-500'}`}>
                                                {rebalancingCalculations.switchAction === 'buy_stock' ? '債券 ETF' : '股票 ETF'}
                                            </div>
                                        </div>
                                        <div className="text-skin-text-muted">
                                            <ArrowRight />
                                        </div>
                                        <div className="flex-1 text-center p-3 bg-skin-base/50 rounded-lg">
                                            <div className="text-xs text-skin-text-muted mb-1">買入</div>
                                            <div className="font-bold text-skin-text-base font-mono text-lg">
                                                ${formatCurrency(rebalancingCalculations.switchAmount)}
                                            </div>
                                            <div className={`text-xs font-bold mt-1 ${rebalancingCalculations.switchAction === 'buy_stock' ? 'text-red-500' : 'text-blue-500'}`}>
                                                {rebalancingCalculations.switchAction === 'buy_stock' ? '股票 ETF' : '債券 ETF'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-skin-text-muted mt-3 text-center">
                                    此操作不需額外資金，但可能會產生交易稅與手續費，並實現部分損益。
                                </p>
                            </div>
                        </div>
                    </>
                 ) : (
                    <div className="text-center py-8 text-skin-text-muted">
                        請先新增持股以取得建議
                    </div>
                 )}
              </div>
              
              <div className="p-4 bg-skin-base border-t border-skin-border flex justify-end">
                <button 
                    onClick={() => setShowRebalanceModal(false)}
                    className="px-6 py-2 bg-skin-primary text-skin-primary-fg rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity"
                >
                    了解
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};