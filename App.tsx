import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INITIAL_HOLDINGS, INITIAL_CASH } from './constants';
import { enrichHolding } from './utils/calculations';
import { fetchLivePrices } from './utils/api';
import { PortfolioSummary, AssetType, Holding, DividendRecord, ThemeColors } from './types';
import { Dashboard } from './components/Dashboard';
import { DividendTracker } from './components/DividendTracker';
import { LayoutDashboard, Coins, WalletCards, Download, Upload, Sun, Moon, Eye, Palette, X, RotateCcw, Check, BarChart3, GripHorizontal, Droplet, Type, Monitor, Settings, ChevronRight, FileJson, FileSpreadsheet } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'contrast' | 'classic' | 'vibrant' | 'monochrome';

const DEFAULT_COLORS: ThemeColors = {
  primary: '#4f46e5',
  stock: '#ef4444',
  bond: '#3b82f6',
  cash: '#10b981',
};

const CONTRAST_COLORS: ThemeColors = {
  primary: '#ffff00',
  stock: '#ff00ff',
  bond: '#00ffff',
  cash: '#00ff00',
};

const CLASSIC_COLORS: ThemeColors = {
  primary: '#2c3e50',
  stock: '#c0392b',
  bond: '#2980b9',
  cash: '#27ae60',
};

const VIBRANT_COLORS: ThemeColors = {
  primary: '#ec4899', // Pink
  stock: '#f472b6',   // Light Pink/Red
  bond: '#60a5fa',    // Bright Blue
  cash: '#34d399',    // Bright Teal
};

const MONOCHROME_COLORS: ThemeColors = {
  primary: '#404040',
  stock: '#171717',
  bond: '#737373',
  cash: '#a3a3a3',
};

const THEME_PRESETS: Record<Theme, ThemeColors> = {
  light: DEFAULT_COLORS,
  dark: DEFAULT_COLORS, // Dark mode re-uses default colors unless customized
  contrast: CONTRAST_COLORS,
  classic: CLASSIC_COLORS,
  vibrant: VIBRANT_COLORS,
  monochrome: MONOCHROME_COLORS,
};

const THEME_OPTIONS: { id: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'light', label: '明亮簡約', icon: <Sun size={20} />, desc: '清晰、標準的淺色模式' },
    { id: 'dark', label: '深色護眼', icon: <Moon size={20} />, desc: '適合低光源環境' },
    { id: 'vibrant', label: '霓虹動感', icon: <Droplet size={20} />, desc: '高飽和度的現代風格' },
    { id: 'classic', label: '經典金融', icon: <Type size={20} />, desc: '穩重的米色與深藍配色' },
    { id: 'monochrome', label: '極簡灰階', icon: <Monitor size={20} />, desc: '專注於數據的無色干擾' },
    { id: 'contrast', label: '高對比', icon: <Eye size={20} />, desc: '黑底亮色，極致可讀性' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'dividends'>('overview');
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app_theme') as Theme) || 'light';
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'appearance' | 'data'>('appearance');
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Custom Colors from LocalStorage
  const [customColors, setCustomColors] = useState<ThemeColors>(() => {
    try {
      const saved = localStorage.getItem('app_colors');
      return saved ? JSON.parse(saved) : DEFAULT_COLORS;
    } catch {
      return DEFAULT_COLORS;
    }
  });
  
  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Apply custom colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', customColors.primary);
    root.style.setProperty('--color-stock', customColors.stock);
    root.style.setProperty('--color-bond', customColors.bond);
    root.style.setProperty('--color-cash', customColors.cash);
    
    localStorage.setItem('app_colors', JSON.stringify(customColors));
  }, [customColors]);

  // Handle color change
  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setCustomColors(prev => ({ ...prev, [key]: value }));
  };

  const handleThemeSelect = (newTheme: Theme) => {
    setTheme(newTheme);
    // Auto-apply preset colors for the new theme
    setCustomColors(THEME_PRESETS[newTheme]);
  };

  const handleResetColors = () => {
    const defaultForTheme = THEME_PRESETS[theme] || DEFAULT_COLORS;
    setCustomColors(defaultForTheme);
  };
  
  // Initialize Holdings from LocalStorage or use default
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_holdings');
      return saved ? JSON.parse(saved) : INITIAL_HOLDINGS;
    } catch (e) {
      console.error('Failed to load holdings:', e);
      return INITIAL_HOLDINGS;
    }
  });

  // Initialize Cash from LocalStorage or use default
  const [cash, setCash] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('portfolio_cash');
      return saved ? parseFloat(saved) : INITIAL_CASH;
    } catch (e) {
      console.error('Failed to load cash:', e);
      return INITIAL_CASH;
    }
  });

  // Initialize Dividend Records from LocalStorage
  const [dividendRecords, setDividendRecords] = useState<DividendRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dividend_records');
      if (saved) return JSON.parse(saved);
      return [
        { id: '1', date: '2023-10-20', ticker: '0056', amount: 24000, note: 'Q3配息' },
        { id: '2', date: '2023-11-15', ticker: '00878', amount: 12000, note: '' },
      ];
    } catch (e) {
      console.error('Failed to load dividend records:', e);
      return [];
    }
  });

  // Auto-save effects
  useEffect(() => {
    localStorage.setItem('portfolio_holdings', JSON.stringify(holdings));
  }, [holdings]);

  useEffect(() => {
    localStorage.setItem('portfolio_cash', cash.toString());
  }, [cash]);

  useEffect(() => {
    localStorage.setItem('dividend_records', JSON.stringify(dividendRecords));
  }, [dividendRecords]);

  // Handlers
  const handleUpdateHolding = (id: string, field: 'avgPrice' | 'currentPrice' | 'quantity', value: number) => {
    setHoldings(prev => prev.map(h => {
      if (h.id === id) {
        return { ...h, [field]: value };
      }
      return h;
    }));
  };

  const handleAddHolding = (newHolding: Holding) => {
    setHoldings(prev => [...prev, newHolding]);
  };

  const handleDeleteHolding = (id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  const handleUpdateCash = (value: number) => {
    setCash(value);
  };

  const handleUpdateRecords = (records: DividendRecord[]) => {
    setDividendRecords(records);
  };

  const handleRefreshPrices = async () => {
    if (holdings.length === 0) return;
    
    setIsUpdatingPrices(true);
    try {
      const codes = holdings.map(h => h.code);
      const newPrices = await fetchLivePrices(codes);
      
      let updatedCount = 0;
      setHoldings(prev => prev.map(h => {
        if (newPrices[h.code]) {
          updatedCount++;
          return { ...h, currentPrice: newPrices[h.code] };
        }
        return h;
      }));

      if (updatedCount > 0) {
        // Small delay to let the user see the spinner
        setTimeout(() => alert(`成功更新 ${updatedCount} 檔標的價格`), 500);
      } else {
        alert('未能取得最新價格，請稍後再試');
      }
    } catch (error: any) {
      alert(`更新失敗：無法連線至報價服務 (${error.message || 'Unknown Error'})`);
      console.error(error);
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const calculatedHoldings = useMemo(() => {
    const customOrder = ['0050', '0056', '00919', '00679B', '00720B', '00937B'];
    
    return holdings.map(enrichHolding).sort((a, b) => {
      const indexA = customOrder.indexOf(a.code);
      const indexB = customOrder.indexOf(b.code);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return 0;
    });
  }, [holdings]);

  const summary: PortfolioSummary = useMemo(() => {
    const stockHoldings = calculatedHoldings.filter(h => h.type === AssetType.STOCK);
    const bondHoldings = calculatedHoldings.filter(h => h.type === AssetType.BOND);

    const stockValue = stockHoldings.reduce((sum, h) => sum + h.presentValue, 0);
    const bondValue = bondHoldings.reduce((sum, h) => sum + h.presentValue, 0);
    const totalCost = calculatedHoldings.reduce((sum, h) => sum + h.cost, 0);
    
    const totalInvestedValue = stockValue + bondValue;
    const totalAssets = totalInvestedValue + cash;
    const totalProfit = totalInvestedValue - totalCost;
    const totalRoi = totalCost === 0 ? 0 : (totalProfit / totalCost) * 100;

    const stockRatio = totalInvestedValue === 0 ? 0 : (stockValue / totalInvestedValue) * 100;
    const bondRatio = totalInvestedValue === 0 ? 0 : (bondValue / totalInvestedValue) * 100;

    return {
      totalAssets,
      stockValue,
      bondValue,
      cashValue: cash,
      totalCost,
      totalProfit,
      totalRoi,
      stockRatio,
      bondRatio
    };
  }, [calculatedHoldings, cash]);

  // Export Data
  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    let content = BOM;

    content += '[SUMMARY]\n';
    content += 'Total Assets,Stock Value,Bond Value,Cash Value,Total Cost,Total Profit,Total ROI,Stock Ratio,Bond Ratio\n';
    content += `${summary.totalAssets},${summary.stockValue},${summary.bondValue},${summary.cashValue},${summary.totalCost},${summary.totalProfit},${summary.totalRoi.toFixed(2)}%,${summary.stockRatio.toFixed(2)}%,${summary.bondRatio.toFixed(2)}%\n\n`;

    content += '[CASH]\n';
    content += `${cash}\n\n`;

    content += '[HOLDINGS]\n';
    content += 'id,name,code,type,quantity,avgPrice,currentPrice,cost,presentValue,profit,roi\n';
    // Use calculatedHoldings to export enriched data
    calculatedHoldings.forEach(h => {
        content += `${h.id},${h.name},${h.code},${h.type},${h.quantity},${h.avgPrice},${h.currentPrice},${h.cost},${h.presentValue},${h.profit},${h.roi.toFixed(2)}%\n`;
    });
    content += '\n';

    content += '[YEARLY_PERFORMANCE]\n';
    content += 'Year,Total Amount,YoY Growth,YoY Diff\n';
    
    const yearlyMap = new Map<number, number>();
    dividendRecords.forEach(r => {
        const year = new Date(r.date).getFullYear();
        yearlyMap.set(year, (yearlyMap.get(year) || 0) + r.amount);
    });
    
    const sortedYears = Array.from(yearlyMap.keys()).sort((a, b) => a - b);
    
    sortedYears.forEach((year, index) => {
        const amount = yearlyMap.get(year) || 0;
        let growthStr = '-';
        let diffStr = '-';
        
        if (index > 0) {
            const prevYear = sortedYears[index - 1];
            const prevAmount = yearlyMap.get(prevYear) || 0;
            const diff = amount - prevAmount;
            diffStr = diff.toString();
            
            if (prevAmount > 0) {
                 const growth = ((amount - prevAmount) / prevAmount) * 100;
                 growthStr = growth.toFixed(2) + '%';
            }
        }
        content += `${year},${amount},${growthStr},${diffStr}\n`;
    });
    content += '\n';

    content += '[DIVIDENDS]\n';
    content += 'id,date,ticker,amount,note\n';
    dividendRecords.forEach(r => {
        const safeNote = `"${(r.note || '').replace(/"/g, '""')}"`;
        content += `${r.id},${r.date},${r.ticker},${r.amount},${safeNote}\n`;
    });

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    link.download = `portfolio_backup_${dateStr}_${timeStr}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Data
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);
        
        let section = '';
        let tempCash: number | null = null;
        const tempHoldings: Holding[] = [];
        const tempDividends: DividendRecord[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (trimmed === '[SUMMARY]') { section = 'SUMMARY'; return; }
            if (trimmed === '[CASH]') { section = 'CASH'; return; }
            if (trimmed === '[HOLDINGS]') { section = 'HOLDINGS'; return; }
            if (trimmed === '[DIVIDENDS]') { section = 'DIVIDENDS'; return; }
            if (trimmed === '[YEARLY_PERFORMANCE]') { section = 'YEARLY_PERFORMANCE'; return; }

            if (section === 'SUMMARY' || section === 'YEARLY_PERFORMANCE') {
                // Ignore summary and computed lines during import
                return;
            } else if (section === 'CASH') {
                const val = parseFloat(trimmed);
                if (!isNaN(val)) tempCash = val;
            } else if (section === 'HOLDINGS') {
                if (trimmed.startsWith('id,')) return; 
                const parts = trimmed.split(',');
                // Ensure we have at least the base fields required for import
                if (parts.length >= 7) {
                    tempHoldings.push({
                        id: parts[0],
                        name: parts[1],
                        code: parts[2],
                        type: parts[3] as AssetType,
                        quantity: parseFloat(parts[4]),
                        avgPrice: parseFloat(parts[5]),
                        currentPrice: parseFloat(parts[6])
                        // Extra columns (cost, presentValue...) are ignored here as they are recalculated
                    });
                }
            } else if (section === 'DIVIDENDS') {
                if (trimmed.startsWith('id,')) return; 
                
                let commaCount = 0;
                let splitIndex = -1;
                for(let i=0; i<trimmed.length; i++) {
                    if(trimmed[i] === ',') {
                        commaCount++;
                        if(commaCount === 4) {
                            splitIndex = i;
                            break;
                        }
                    }
                }

                if (splitIndex !== -1) {
                    const firstPart = trimmed.substring(0, splitIndex);
                    const parts = firstPart.split(',');
                    
                    let note = trimmed.substring(splitIndex + 1);
                    if (note.startsWith('"') && note.endsWith('"')) {
                        note = note.slice(1, -1).replace(/""/g, '"');
                    }

                    if (parts.length === 4) {
                        tempDividends.push({
                            id: parts[0],
                            date: parts[1],
                            ticker: parts[2],
                            amount: parseFloat(parts[3]),
                            note: note
                        });
                    }
                }
            }
        });

        if (tempHoldings.length === 0 && !tempCash && tempDividends.length === 0) {
             throw new Error("無法解析有效的資料區塊");
        }

        const stats = `
          持股資料: ${tempHoldings.length} 筆
          股息紀錄: ${tempDividends.length} 筆
          現金部位: ${tempCash !== null ? '$' + tempCash : '未變更'}
        `;

        if (confirm(`確定匯入 CSV 資料？\n這將覆蓋您目前的設定。\n${stats}`)) {
            setHoldings(tempHoldings);
            setDividendRecords(tempDividends);
            if (tempCash !== null) setCash(tempCash);
            alert('匯入成功！');
            setShowSettingsModal(false); // Close modal on success
        }

      } catch (err) {
        console.error(err);
        alert('匯入失敗：格式不正確。請確認使用本系統匯出的 CSV 檔案。');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-skin-base text-skin-text-base font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-skin-card border-b border-skin-border sticky top-0 z-20 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-skin-primary p-2 rounded-lg text-skin-primary-fg transition-colors duration-200">
                <WalletCards size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-skin-text-base tracking-tight">ETF 投資組合管理</h1>
                <p className="text-xs text-skin-text-muted hidden sm:block">目標資產: 800萬 | 股債配置: 60/40</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                {/* Desktop Navigation */}
                <nav className="hidden md:flex space-x-1 mr-2">
                <TabButton 
                    active={activeTab === 'overview'} 
                    onClick={() => setActiveTab('overview')} 
                    icon={<LayoutDashboard size={18} />} 
                    label="總覽 & 持股" 
                />
                <TabButton 
                    active={activeTab === 'dividends'} 
                    onClick={() => setActiveTab('dividends')} 
                    icon={<Coins size={18} />} 
                    label="股息儀表板" 
                />
                </nav>
                
                {/* Unified Settings Button */}
                <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="flex items-center gap-2 px-3 py-2 text-skin-text-muted hover:text-skin-primary hover:bg-skin-base rounded-full sm:rounded-lg transition-all"
                    title="設定與資料管理"
                >
                    <Settings size={20} />
                    <span className="hidden sm:inline text-sm font-medium">設定</span>
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <Dashboard 
            summary={summary} 
            holdings={calculatedHoldings} 
            cash={cash}
            theme={theme as any}
            customColors={customColors}
            onUpdateHolding={handleUpdateHolding}
            onAddHolding={handleAddHolding}
            onDeleteHolding={handleDeleteHolding}
            onUpdateCash={handleUpdateCash}
            onRefreshPrices={handleRefreshPrices}
            isUpdatingPrices={isUpdatingPrices}
          />
        )}

        {activeTab === 'dividends' && (
          <DividendTracker 
            holdings={holdings} 
            records={dividendRecords}
            onUpdateRecords={handleUpdateRecords}
            theme={theme as any} 
            customColors={customColors}
          />
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-skin-card border-t border-skin-border pb-safe z-30">
        <div className="flex justify-around items-center h-16">
            <MobileTabButton 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
                icon={<LayoutDashboard size={20} />} 
                label="總覽" 
            />
            <MobileTabButton 
                active={activeTab === 'dividends'} 
                onClick={() => setActiveTab('dividends')} 
                icon={<Coins size={20} />} 
                label="股息" 
            />
        </div>
      </div>

      {/* Unified Settings & Data Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-skin-card w-full max-w-2xl rounded-2xl shadow-xl border border-skin-border overflow-hidden transform transition-all max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-skin-border flex justify-between items-center bg-skin-base sticky top-0 z-10 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2 text-skin-text-base">
                <Settings size={20} className="text-skin-primary" />
                設定與資料管理
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-skin-text-muted hover:text-skin-text-base rounded-full hover:bg-skin-card p-1">
                <X size={22} />
              </button>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex border-b border-skin-border shrink-0">
                <button 
                    onClick={() => setActiveSettingsTab('appearance')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeSettingsTab === 'appearance' 
                            ? 'border-skin-primary text-skin-primary bg-skin-primary-bg/10' 
                            : 'border-transparent text-skin-text-muted hover:text-skin-text-base hover:bg-skin-base'
                    }`}
                >
                    <Palette size={16} /> 外觀主題
                </button>
                <button 
                    onClick={() => setActiveSettingsTab('data')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeSettingsTab === 'data' 
                            ? 'border-skin-primary text-skin-primary bg-skin-primary-bg/10' 
                            : 'border-transparent text-skin-text-muted hover:text-skin-text-base hover:bg-skin-base'
                    }`}
                >
                    <FileSpreadsheet size={16} /> 資料備份
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-6 space-y-8 flex-1">
               
               {activeSettingsTab === 'appearance' && (
                   <div className="space-y-8 animate-fade-in">
                        {/* Theme Grid Selector */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-skin-text-muted uppercase tracking-wider">選擇主題風格</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {THEME_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleThemeSelect(opt.id)}
                                        className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
                                            theme === opt.id 
                                                ? 'border-skin-primary bg-skin-primary-bg/10 shadow-md scale-[1.02]' 
                                                : 'border-skin-border bg-skin-base hover:border-skin-text-muted/50 hover:bg-skin-card'
                                        }`}
                                    >
                                        <div className={`mb-2 p-2 rounded-full ${theme === opt.id ? 'text-skin-primary bg-skin-primary/10' : 'text-skin-text-muted bg-skin-card'}`}>
                                            {opt.icon}
                                        </div>
                                        <span className={`text-sm font-bold ${theme === opt.id ? 'text-skin-primary' : 'text-skin-text-base'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="text-[10px] text-skin-text-muted mt-1 text-center">{opt.desc}</span>
                                        
                                        {theme === opt.id && (
                                            <div className="absolute top-2 right-2 text-skin-primary">
                                                <Check size={14} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Colors Section */}
                        <div className="space-y-4 pt-4 border-t border-skin-border">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-skin-text-muted uppercase tracking-wider">自訂細部配色</h4>
                                <button 
                                    onClick={handleResetColors}
                                    className="text-xs flex items-center gap-1 text-skin-text-muted hover:text-skin-primary hover:underline"
                                >
                                    <RotateCcw size={12} /> 重置回主題預設
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                <ColorPickerItem 
                                    label="主要顏色 (Primary)" 
                                    desc="按鈕、圖示、強調色"
                                    color={customColors.primary} 
                                    onChange={(v) => handleColorChange('primary', v)} 
                                />
                                <ColorPickerItem 
                                    label="股票 ETF 顏色" 
                                    desc="股票部位、股息收入"
                                    color={customColors.stock} 
                                    onChange={(v) => handleColorChange('stock', v)} 
                                />
                                <ColorPickerItem 
                                    label="債券 ETF 顏色" 
                                    desc="債券部位、配息來源"
                                    color={customColors.bond} 
                                    onChange={(v) => handleColorChange('bond', v)} 
                                />
                                <ColorPickerItem 
                                    label="現金/定存顏色" 
                                    desc="現金、預備金"
                                    color={customColors.cash} 
                                    onChange={(v) => handleColorChange('cash', v)} 
                                />
                            </div>
                        </div>
                   </div>
               )}

               {activeSettingsTab === 'data' && (
                   <div className="space-y-6 animate-fade-in">
                        <div className="bg-skin-base/50 p-4 rounded-xl border border-skin-border">
                            <h4 className="font-bold text-skin-text-base flex items-center gap-2 mb-2">
                                <Upload size={18} className="text-skin-primary" />
                                匯出資料備份
                            </h4>
                            <p className="text-xs text-skin-text-muted mb-4">
                                將您目前的持股設定、現金部位與股息紀錄下載為 CSV 檔案。建議定期備份以防資料遺失。
                            </p>
                            <button 
                                onClick={handleExportCSV}
                                className="w-full sm:w-auto px-4 py-2 bg-skin-card border border-skin-border hover:border-skin-primary hover:text-skin-primary rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                下載備份檔案 (.csv)
                            </button>
                        </div>

                        <div className="bg-skin-base/50 p-4 rounded-xl border border-skin-border">
                            <h4 className="font-bold text-skin-text-base flex items-center gap-2 mb-2">
                                <Download size={18} className="text-skin-primary" />
                                匯入還原資料
                            </h4>
                            <p className="text-xs text-skin-text-muted mb-4">
                                上傳先前匯出的 CSV 檔案以還原資料。請注意，這將會<span className="text-skin-danger font-bold">完全覆蓋</span>目前的現有資料。
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={triggerFileInput}
                                    className="w-full sm:w-auto px-4 py-2 bg-skin-primary text-skin-primary-fg rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    選擇檔案匯入
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImportCSV} 
                                    accept=".csv" 
                                    className="hidden" 
                                />
                            </div>
                        </div>
                        
                        <div className="text-[10px] text-skin-text-muted text-center pt-4">
                            系統會自動將資料儲存於您的瀏覽器 (LocalStorage) 中。<br/>
                            若清除瀏覽器快取，資料可能會遺失，請善用匯出功能。
                        </div>
                   </div>
               )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-skin-base border-t border-skin-border flex justify-end shrink-0">
               <button 
                 onClick={() => setShowSettingsModal(false)}
                 className="flex items-center gap-2 px-6 py-2 bg-skin-primary text-skin-primary-fg rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity"
               >
                 <Check size={18} /> 完成設定
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ... Helper Components (TabButton, MobileTabButton, ColorPickerItem) ...
const TabButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active 
        ? 'bg-skin-primary-bg text-skin-primary' 
        : 'text-skin-text-muted hover:text-skin-text-base hover:bg-skin-base'
    }`}
  >
    {icon}
    {label}
  </button>
);

const MobileTabButton = ({ active, onClick, icon, label }: any) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full ${
        active ? 'text-skin-primary' : 'text-skin-text-muted'
      }`}
    >
      {icon}
      <span className="text-[10px] mt-1">{label}</span>
    </button>
  );

const ColorPickerItem = ({ label, desc, color, onChange }: { label: string, desc: string, color: string, onChange: (val: string) => void }) => {
  const PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4', 
    '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#64748b',
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-skin-text-base text-sm">{label}</p>
          <p className="text-[10px] text-skin-text-muted">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-skin-text-muted uppercase">{color}</span>
            <div 
                className="w-5 h-5 rounded-full shadow-sm border border-skin-border"
                style={{ backgroundColor: color }}
            />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 items-center">
        {PRESETS.map((c) => (
            <button
                key={c}
                onClick={() => onChange(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none ${
                    color.toLowerCase() === c.toLowerCase() 
                        ? 'border-skin-text-base scale-110 shadow-sm' 
                        : 'border-transparent hover:border-skin-border'
                }`}
                style={{ backgroundColor: c }}
                title={c}
                aria-label={`Select color ${c}`}
            />
        ))}
        <div className="w-px h-5 bg-skin-border mx-1"></div>
        <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-skin-border hover:border-skin-text-muted transition-colors group cursor-pointer shadow-sm" title="自訂顏色">
            <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-200 dark:from-gray-700 dark:to-gray-900 flex items-center justify-center">
                <Palette size={14} className="text-skin-text-muted group-hover:text-skin-text-base" />
            </div>
            <input 
                type="color" 
                value={color} 
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
      </div>
    </div>
  );
};