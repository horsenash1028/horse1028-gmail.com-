import React, { useState, useMemo, useEffect } from 'react';
import { DividendRecord, Holding, ThemeColors, AssetType } from '../types';
import { formatCurrency } from '../utils/calculations';
import { Plus, Trash2, Coins, Calendar, TrendingUp, BarChart3, GripHorizontal, ArrowRight, Percent, DollarSign, CheckCircle2, Hourglass, Filter, ZoomOut, Target, Edit2, Info } from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, Brush, ReferenceArea
} from 'recharts';

interface DividendTrackerProps {
  holdings: Holding[];
  records: DividendRecord[];
  onUpdateRecords: (records: DividendRecord[]) => void;
  theme: 'light' | 'dark' | 'contrast';
  customColors: ThemeColors;
}

export const DividendTracker: React.FC<DividendTrackerProps> = ({ holdings, records, onUpdateRecords, theme, customColors }) => {
  const currentSystemYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentSystemYear);
  const [trendTicker, setTrendTicker] = useState<string>('ALL');
  
  // Goal State
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('dividend_monthly_goal');
    return saved ? parseFloat(saved) : 20000; // Default 20k
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(monthlyGoal.toString());

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    exDividendDate: '', // New field in form
    ticker: holdings[0]?.code || '',
    amount: '',
    note: ''
  });

  const [chartView, setChartView] = useState<'yearly' | 'monthly'>('monthly');

  // --- Zoom & Pan State ---
  const [zoomDomain, setZoomDomain] = useState<{ startIndex: number | undefined; endIndex: number | undefined }>({ 
    startIndex: undefined, 
    endIndex: undefined 
  });
  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');

  // Dynamic Chart Colors
  const CHART_COLORS = {
    BAR: customColors.cash,
    BAR_HOVER: customColors.primary,
    LINE: customColors.stock,
    LINE_DOT: theme === 'contrast' ? '#ffffff' : customColors.stock,
    GRID: theme === 'light' ? '#f3f4f6' : (theme === 'contrast' ? '#333333' : '#334155'),
    TEXT: theme === 'light' ? '#374151' : '#f3f4f6',
    TOOLTIP_BG: theme === 'light' ? '#ffffff' : (theme === 'contrast' ? '#000000' : '#1e293b'),
    TOOLTIP_TEXT: theme === 'light' ? '#374151' : '#f3f4f6',
    SELECTION: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  };

  // --- Calculations ---
  
  // 0. Available Years
  const availableYears = useMemo(() => {
    const years = new Set(records.map(r => new Date(r.date).getFullYear()));
    years.add(currentSystemYear); 
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [records, currentSystemYear]);

  const today = new Date().toISOString().split('T')[0];

  // 1. Selected Year Records
  const selectedYearRecords = useMemo(() => records.filter(r => {
    return new Date(r.date).getFullYear() === selectedYear;
  }), [records, selectedYear]);

  // 2. Totals
  const receivedInSelectedYear = selectedYearRecords
    .filter(r => r.date <= today)
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingInSelectedYear = selectedYearRecords
    .filter(r => r.date > today)
    .reduce((sum, r) => sum + r.amount, 0);
    
  const totalInSelectedYear = receivedInSelectedYear + pendingInSelectedYear;
  
  const totalDividendsAllTime = records.reduce((sum, r) => sum + r.amount, 0);
  const totalReceivedAllTime = records
        .filter(r => r.date <= today)
        .reduce((sum, r) => sum + r.amount, 0);

  const totalPortfolioCost = holdings.reduce((sum, h) => sum + (h.avgPrice * h.quantity), 0);
  const yieldOnCost = totalPortfolioCost > 0 ? (totalInSelectedYear / totalPortfolioCost) * 100 : 0;
  const allTimeYield = totalPortfolioCost > 0 ? (totalReceivedAllTime / totalPortfolioCost) * 100 : 0;
  const avgMonthlyIncome = totalInSelectedYear / 12;
  const goalProgress = (avgMonthlyIncome / monthlyGoal) * 100;

  // 5. Chart Data Preparation
  const yearlyTrendData = useMemo(() => {
    const filteredRecords = trendTicker === 'ALL' 
        ? records 
        : records.filter(r => r.ticker === trendTicker);

    return filteredRecords.reduce((acc, curr) => {
      const year = curr.date.split('-')[0];
      const existing = acc.find(x => x.year === year);
      if (existing) {
        existing.amount += curr.amount;
      } else {
        acc.push({ year, amount: curr.amount });
      }
      return acc;
    }, [] as { year: string; amount: number }[])
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [records, trendTicker]);

  const chartYDomain = useMemo(() => {
    if (chartView !== 'yearly' || yearlyTrendData.length === 0) return [0, 'auto'];
    if (zoomDomain.startIndex === undefined || zoomDomain.endIndex === undefined) {
        return [0, 'auto'];
    }
    const visibleData = yearlyTrendData.slice(
        zoomDomain.startIndex, 
        (zoomDomain.endIndex || yearlyTrendData.length - 1) + 1
    );
    if (visibleData.length === 0) return [0, 'auto'];
    const maxVal = Math.max(...visibleData.map(d => d.amount));
    const upperLimit = Math.ceil(maxVal * 1.1);
    return [0, upperLimit];
  }, [chartView, yearlyTrendData, zoomDomain]);

  useEffect(() => {
    setZoomDomain({ startIndex: undefined, endIndex: undefined });
  }, [yearlyTrendData]);

  const yearlyPerformance = useMemo(() => {
    const dataWithGrowth = yearlyTrendData.map((item, index) => {
        const prev = yearlyTrendData[index - 1];
        const growth = prev && prev.amount > 0 
            ? ((item.amount - prev.amount) / prev.amount) * 100 
            : 0;
        const diff = prev ? item.amount - prev.amount : 0;
        return { year: item.year, amount: item.amount, growth, diff, hasPrev: !!prev };
    });
    return dataWithGrowth.reverse();
  }, [yearlyTrendData]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthStr = `${monthNum}月`;
        const value = selectedYearRecords
            .filter(r => new Date(r.date).getMonth() === i)
            .reduce((sum, r) => sum + r.amount, 0);
        return { name: monthStr, value, monthNum };
    });
    return months;
  }, [selectedYearRecords]);

  const tickerData = useMemo(() => {
    return selectedYearRecords.reduce((acc, curr) => {
        const existing = acc.find(x => x.name === curr.ticker);
        if (existing) {
        existing.value += curr.amount;
        } else {
        acc.push({ name: curr.ticker, value: curr.amount });
        }
        return acc;
    }, [] as { name: string; value: number }[]).sort((a, b) => b.value - a.value);
  }, [selectedYearRecords]);


  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.ticker) return;

    const newRecord: DividendRecord = {
      id: Date.now().toString(),
      date: formData.date,
      exDividendDate: formData.exDividendDate || undefined,
      ticker: formData.ticker,
      amount: parseFloat(formData.amount),
      note: formData.note
    };

    const newRecords = [newRecord, ...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdateRecords(newRecords);
    
    const newRecordYear = new Date(formData.date).getFullYear();
    if (newRecordYear !== selectedYear) {
        if(confirm(`您新增了 ${newRecordYear} 年的紀錄，是否切換至該年度檢視？`)) {
            setSelectedYear(newRecordYear);
        }
    }
    
    setFormData(prev => ({ ...prev, amount: '', note: '', exDividendDate: '' }));
  };

  const handleExDateChange = (dateStr: string) => {
    setFormData(prev => {
        // Simple logic: auto-set payment date to ~30 days after ex-date if it's currently default or empty
        const nextState = { ...prev, exDividendDate: dateStr };
        if (dateStr) {
            const date = new Date(dateStr);
            date.setDate(date.getDate() + 30);
            nextState.date = date.toISOString().split('T')[0];
        }
        return nextState;
    });
  };

  const handleUpdateRecord = (id: string, field: keyof DividendRecord, value: any) => {
    const updated = records.map(r => r.id === id ? { ...r, [field]: value } : r);
    onUpdateRecords(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm('確定要刪除這筆紀錄嗎？')) {
      onUpdateRecords(records.filter(r => r.id !== id));
    }
  };
  
  const handleSaveGoal = () => {
     const val = parseFloat(tempGoal);
     if (!isNaN(val) && val > 0) {
         setMonthlyGoal(val);
         localStorage.setItem('dividend_monthly_goal', val.toString());
         setIsEditingGoal(false);
     }
  };

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) setRefAreaLeft(e.activeLabel);
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
        setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (!refAreaLeft || !refAreaRight) {
        setRefAreaLeft('');
        setRefAreaRight('');
        return;
    }
    const leftIndex = yearlyTrendData.findIndex(d => d.year === refAreaLeft);
    const rightIndex = yearlyTrendData.findIndex(d => d.year === refAreaRight);
    if (leftIndex === -1 || rightIndex === -1) {
        setRefAreaLeft('');
        setRefAreaRight('');
        return;
    }
    let newStart = Math.min(leftIndex, rightIndex);
    let newEnd = Math.max(leftIndex, rightIndex);
    setZoomDomain({ startIndex: newStart, endIndex: newEnd });
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const handleZoomOut = () => {
    setZoomDomain({ startIndex: undefined, endIndex: undefined });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Year Selector Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-skin-card p-4 rounded-xl shadow-sm border border-skin-border">
         <div className="flex items-center gap-2">
            <div className="bg-skin-primary p-2 rounded-lg text-skin-primary-fg">
                <Calendar size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-skin-text-base">年度股息分析</h2>
                <p className="text-xs text-skin-text-muted">追蹤除息與入帳時程</p>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-skin-text-muted">選擇年度:</span>
            <div className="relative">
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="appearance-none bg-skin-base border border-skin-border text-skin-text-base text-sm font-bold py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-primary cursor-pointer transition-all hover:border-skin-primary"
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year} 年</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-skin-text-muted">
                    <Filter size={14} />
                </div>
            </div>
         </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-border flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 text-skin-text-muted mb-2">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600 dark:text-yellow-400">
                    <Coins size={20} />
                </div>
                <h3 className="font-medium text-sm">歷史登記總股息 (累計)</h3>
            </div>
            <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                ${formatCurrency(totalDividendsAllTime)}
            </p>
            <p className="text-xs text-skin-text-muted mt-1">含所有年度</p>
        </div>
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-border flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 text-skin-text-muted mb-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={20} />
                </div>
                <h3 className="font-medium text-sm">歷史實領股息 (累計)</h3>
            </div>
            <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                ${formatCurrency(totalReceivedAllTime)}
            </p>
            <p className="text-xs text-skin-text-muted mt-1">已入帳總額</p>
        </div>
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-border flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 text-skin-text-muted mb-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                    <TrendingUp size={20} />
                </div>
                <h3 className="font-medium text-sm">累積領息殖利率 (All Time)</h3>
            </div>
            <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                {allTimeYield.toFixed(2)}%
            </p>
            <p className="text-xs text-skin-text-muted mt-1">總領息 / 總成本</p>
        </div>
      </div>
      
      {/* Selected Year Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-primary ring-1 ring-skin-primary/20 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <span className="text-4xl font-bold text-skin-primary">{selectedYear}</span>
            </div>
            <div className="flex items-center gap-3 text-skin-text-muted mb-2 relative">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <Calendar size={20} />
                </div>
                <h3 className="font-medium text-sm text-skin-primary">{selectedYear} 年度總領</h3>
            </div>
            <div className="relative">
                <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                    ${formatCurrency(totalInSelectedYear)}
                </p>
                <div className="mt-3 w-full bg-skin-base rounded-full h-1.5 overflow-hidden">
                     <div 
                        className="bg-blue-500 h-full transition-all duration-500" 
                        style={{ width: `${totalInSelectedYear > 0 ? (receivedInSelectedYear / totalInSelectedYear) * 100 : 0}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-skin-text-muted mt-1 font-mono">
                    <span>達成率: {totalInSelectedYear > 0 ? Math.round((receivedInSelectedYear / totalInSelectedYear) * 100) : 0}%</span>
                </div>
            </div>
        </div>
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-primary ring-1 ring-skin-primary/20 flex flex-col justify-between relative">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 text-skin-text-muted">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                        <DollarSign size={20} />
                    </div>
                    <h3 className="font-medium text-sm text-skin-primary">{selectedYear} 平均月領</h3>
                </div>
                <button onClick={() => setIsEditingGoal(!isEditingGoal)} className="text-skin-text-muted hover:text-skin-primary">
                    <Target size={16} />
                </button>
            </div>
            {isEditingGoal ? (
                <div className="animate-fade-in mt-1">
                    <label className="text-[10px] text-skin-text-muted block mb-1">設定月領目標</label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            className="w-full bg-skin-base border border-skin-border rounded px-2 py-1 text-sm font-mono"
                            value={tempGoal}
                            onChange={(e) => setTempGoal(e.target.value)}
                            autoFocus
                        />
                        <button onClick={handleSaveGoal} className="px-2 bg-skin-primary text-white rounded text-xs">OK</button>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                            ${formatCurrency(Math.round(avgMonthlyIncome))}
                        </p>
                        <span className="text-xs text-skin-text-muted mb-1.5">/ 目標 ${formatCurrency(monthlyGoal)}</span>
                    </div>
                    <div className="mt-2 w-full bg-skin-base rounded-full h-2 overflow-hidden relative">
                         <div 
                            className={`h-full transition-all duration-700 ${goalProgress >= 100 ? 'bg-skin-success' : 'bg-skin-primary'}`} 
                            style={{ width: `${Math.min(goalProgress, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
        <div className="bg-skin-card p-5 rounded-xl shadow-sm border border-skin-primary ring-1 ring-skin-primary/20 flex flex-col justify-between">
             <div className="flex items-center gap-3 text-skin-text-muted mb-2">
                <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400">
                    <Percent size={20} />
                </div>
                <h3 className="font-medium text-sm text-skin-primary">{selectedYear} 年化殖利率</h3>
            </div>
            <div>
                <p className="text-2xl font-extrabold text-skin-text-base font-mono mt-1">
                    {yieldOnCost.toFixed(2)}%
                </p>
                <p className="text-xs text-skin-text-muted mt-1">YoC (成本殖利率)</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-skin-card p-6 rounded-xl shadow-sm border border-skin-border flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-skin-text-base flex items-center gap-2">
                        {chartView === 'monthly' ? <BarChart3 size={20} className="text-skin-primary" /> : <TrendingUp size={20} className="text-skin-primary" />}
                        {chartView === 'monthly' ? `${selectedYear} 月度股息分佈` : '歷年股息成長趨勢'}
                    </h3>
                    {chartView === 'yearly' && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select 
                                    value={trendTicker}
                                    onChange={(e) => setTrendTicker(e.target.value)}
                                    className="appearance-none bg-skin-base border border-skin-border text-skin-text-base text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-skin-primary cursor-pointer transition-all"
                                >
                                    <option value="ALL">全部標的</option>
                                    {holdings.map(h => (
                                        <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-skin-text-muted">
                                    <Filter size={12} />
                                </div>
                            </div>
                            {(zoomDomain.startIndex !== undefined || zoomDomain.endIndex !== undefined) && (
                                <button 
                                    onClick={handleZoomOut}
                                    className="flex items-center gap-1 px-2 py-1.5 bg-skin-primary/10 text-skin-primary rounded-lg text-xs font-bold hover:bg-skin-primary/20 transition-colors animate-fade-in"
                                >
                                    <ZoomOut size={12} />
                                    <span>重置</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex bg-skin-base p-1 rounded-lg border border-skin-border">
                    <button 
                        onClick={() => setChartView('monthly')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'monthly' ? 'bg-skin-card shadow-sm text-skin-primary' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                    >
                        {selectedYear} 月度
                    </button>
                    <button 
                        onClick={() => setChartView('yearly')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartView === 'yearly' ? 'bg-skin-card shadow-sm text-skin-primary' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                    >
                        歷年趨勢
                    </button>
                </div>
            </div>

            <div className="h-[300px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    {chartView === 'monthly' ? (
                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.GRID} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: CHART_COLORS.TEXT, fontSize: 12}} dy={10} />
                            <YAxis hide />
                            <Tooltip 
                                cursor={{fill: 'transparent'}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div style={{ backgroundColor: CHART_COLORS.TOOLTIP_BG, borderColor: CHART_COLORS.GRID, color: CHART_COLORS.TOOLTIP_TEXT }} className="p-2 border rounded shadow-lg text-sm">
                                                <div className="font-bold mb-1">{payload[0].payload.name}</div>
                                                <div className="font-mono text-skin-primary font-bold">
                                                    ${formatCurrency(payload[0].value as number)}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1000} activeBar={{ fill: CHART_COLORS.BAR_HOVER, opacity: 0.8 }}>
                                {monthlyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? CHART_COLORS.BAR : CHART_COLORS.GRID} />
                                ))}
                            </Bar>
                        </BarChart>
                    ) : (
                        <LineChart data={yearlyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.GRID} />
                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: CHART_COLORS.TEXT, fontSize: 12}} dy={10} />
                            <YAxis hide domain={chartYDomain} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', backgroundColor: CHART_COLORS.TOOLTIP_BG, borderColor: CHART_COLORS.GRID, color: CHART_COLORS.TOOLTIP_TEXT }}
                                labelStyle={{ fontWeight: 'bold', color: CHART_COLORS.TOOLTIP_TEXT }}
                                formatter={(val: number) => [`$${formatCurrency(val)}`, trendTicker === 'ALL' ? '年度總領' : `${trendTicker} 股息`]}
                            />
                            <Line type="monotone" dataKey="amount" stroke={CHART_COLORS.LINE} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.LINE_DOT, strokeWidth: 2, stroke: theme === 'dark' ? '#000' : '#fff' }} />
                            {refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={CHART_COLORS.SELECTION} />}
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-skin-card p-6 rounded-xl shadow-sm border border-skin-border h-[400px] flex flex-col transition-all duration-300">
            <h3 className="text-sm font-bold text-skin-text-muted mb-4 flex items-center gap-2 border-b border-skin-border pb-2">
                {chartView === 'monthly' ? (
                    <>
                        <GripHorizontal size={16} /> {selectedYear} 標的貢獻
                    </>
                ) : (
                    <>
                        <TrendingUp size={16} /> 歷年績效表
                    </>
                )}
            </h3>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {chartView === 'monthly' ? (
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tickerData.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                            <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 11, fill: CHART_COLORS.TEXT}} axisLine={false} tickLine={false} />
                            <XAxis type="number" hide />
                            <Tooltip cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                                {tickerData.map((entry, index) => {
                                    const holding = holdings.find(h => h.code === entry.name);
                                    return <Cell key={`cell-${index}`} fill={holding?.type === AssetType.BOND ? customColors.bond : customColors.stock} />;
                                })}
                            </Bar>
                        </BarChart>
                   </ResponsiveContainer>
                ) : (
                    <table className="w-full text-xs">
                        <thead className="text-skin-text-muted sticky top-0 bg-skin-card z-10">
                            <tr>
                                <th className="text-left py-2 font-medium">年度</th>
                                <th className="text-right py-2 font-medium">總領股息</th>
                                <th className="text-right py-2 font-medium">YoY 成長</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-skin-border/50">
                            {yearlyPerformance.map((row) => (
                                <tr key={row.year} className="group hover:bg-skin-base/50 transition-colors">
                                    <td className="py-2.5 font-bold text-skin-text-base">{row.year}</td>
                                    <td className="py-2.5 text-right font-mono text-skin-text-base">${formatCurrency(row.amount)}</td>
                                    <td className="py-2.5 text-right font-mono">
                                        {row.hasPrev ? (
                                            <div className={`flex items-center justify-end gap-1 ${row.growth >= 0 ? 'text-skin-success' : 'text-skin-danger'}`}>
                                                <span>{row.growth.toFixed(1)}%</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Updated Add Form with Dual Dates */}
        <div className="lg:col-span-1 bg-skin-card p-6 rounded-xl shadow-sm border border-skin-border h-fit">
          <h3 className="font-bold text-skin-text-base mb-4 flex items-center gap-2 border-b border-skin-border pb-3">
            <Plus className="w-4 h-4 text-skin-primary" /> 新增股息紀錄
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1 flex items-center gap-1">
                        <Calendar size={12} className="text-blue-500" /> 除息日期
                    </label>
                    <input 
                        type="date" 
                        className="w-full px-3 py-2 border border-skin-border bg-skin-base text-skin-text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono"
                        value={formData.exDividendDate}
                        onChange={e => handleExDateChange(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-500" /> 入帳日期
                    </label>
                    <input 
                        type="date" 
                        required
                        className="w-full px-3 py-2 border border-skin-border bg-skin-base text-skin-text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-xs font-mono"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                </div>
            </div>
            
            <div className="bg-skin-base/50 p-2 rounded text-[10px] text-skin-text-muted flex items-start gap-2 border border-skin-border/50">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>小提醒：選擇除息日後，入帳日會預設帶入 30 天後（台灣 ETF 常見週期），您可以再手動微調。</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">標的代號</label>
                    <select 
                        className="w-full px-3 py-2 border border-skin-border bg-skin-base text-skin-text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-primary text-sm"
                        value={formData.ticker}
                        onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    >
                        {holdings.map(h => (
                            <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">金額 (TWD)</label>
                    <input 
                        type="number" 
                        required
                        min="0"
                        placeholder="0"
                        className="w-full px-3 py-2 border border-skin-border bg-skin-base text-skin-text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-primary text-sm font-mono"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                    />
                </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-skin-text-muted mb-1">備註 (選填)</label>
              <input 
                type="text" 
                placeholder="例如: 2024 Q1 配息"
                className="w-full px-3 py-2 border border-skin-border bg-skin-base text-skin-text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-primary text-sm"
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-skin-primary hover:opacity-90 text-skin-primary-fg font-bold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 shadow-md"
            >
              <Plus size={18} /> 儲存股息紀錄
            </button>
          </form>
        </div>

        {/* Updated Table with Dual Dates and Editable Amount */}
        <div className="lg:col-span-2 bg-skin-card rounded-xl shadow-sm border border-skin-border overflow-hidden flex flex-col">
            <div className="p-4 bg-skin-base border-b border-skin-border flex justify-between items-center">
                <h3 className="font-bold text-skin-text-base flex items-center gap-2">
                    <ArrowRight size={16} className="text-skin-text-muted" /> 詳細領息紀錄
                </h3>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-skin-base sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 text-skin-text-muted font-medium">日程時序</th>
                            <th className="px-6 py-3 text-skin-text-muted font-medium">標的</th>
                            <th className="px-6 py-3 text-right text-skin-text-muted font-medium">金額</th>
                            <th className="px-6 py-3 text-skin-text-muted font-medium hidden sm:table-cell">備註</th>
                            <th className="px-6 py-3 text-right w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-skin-border">
                        {records.map((r, index) => {
                            const holding = holdings.find(h => h.code === r.ticker);
                            const accentColor = holding?.type === AssetType.BOND ? customColors.bond : customColors.stock;
                            const isSelectedYear = new Date(r.date).getFullYear() === selectedYear;
                            
                            return (
                                <tr 
                                    key={r.id} 
                                    className={`hover:bg-skin-base/80 transition-colors group ${isSelectedYear ? 'bg-skin-primary/5' : ''}`}
                                    style={{ borderLeft: `4px solid ${accentColor}` }}
                                >
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                                <span className="text-skin-text-muted">除息:</span>
                                                <span className="font-mono text-skin-text-base">{r.exDividendDate || '--'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className={`w-2 h-2 rounded-full ${r.date <= today ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                                                <span className="text-skin-text-muted">入帳:</span>
                                                <span className={`font-mono font-bold ${r.date <= today ? 'text-skin-text-base' : 'text-yellow-600'}`}>
                                                    {r.date}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="font-bold text-skin-text-base">{r.ticker}</div>
                                                <div className="text-[10px] text-skin-text-muted">{holding?.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-skin-text-base">
                                        <div className="flex items-center justify-end">
                                            <span className="mr-1 text-skin-text-muted text-xs">$</span>
                                            <input 
                                                type="number"
                                                className="bg-transparent border-b border-transparent hover:border-skin-border focus:border-skin-primary focus:outline-none text-right w-24 no-spinner transition-all font-mono font-bold text-sm text-skin-text-base"
                                                value={r.amount}
                                                onFocus={handleFocus}
                                                onChange={(e) => handleUpdateRecord(r.id, 'amount', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 hidden sm:table-cell">
                                        <div className="max-w-[120px] truncate text-[11px] text-skin-text-muted" title={r.note}>
                                            {r.note || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button 
                                            onClick={() => handleDelete(r.id)}
                                            className="text-skin-text-muted hover:text-skin-danger opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};