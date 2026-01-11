import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AssetType, CalculatedHolding, ThemeColors, Holding } from '../types';
import { formatCurrency } from '../utils/calculations';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ListFilter, X, Filter, Trash2, Plus, Save, RefreshCw, Check, ListOrdered, ChevronUp, ChevronDown, MoreHorizontal, Edit2 } from 'lucide-react';

interface HoldingsTableProps {
  holdings: CalculatedHolding[];
  customColors: ThemeColors;
  onUpdateHolding?: (id: string, field: 'avgPrice' | 'currentPrice' | 'quantity', value: number) => void;
  onAddHolding?: (holding: Holding) => void;
  onDeleteHolding?: (id: string) => void;
  onRefreshPrices?: () => void;
  isUpdatingPrices?: boolean;
}

// Multi-sort configuration
interface SortConfig {
  field: keyof CalculatedHolding | 'weight';
  direction: 'asc' | 'desc';
}

type FilterType = 'ALL' | AssetType;
type FilterField = keyof CalculatedHolding | 'weight';

// Range Filter configuration
interface RangeFilter {
  id: string;
  field: FilterField;
  label: string;
  min?: number;
  max?: number;
}

// Internal component for handling price updates visual feedback
const PriceInput = ({ 
    value, 
    onChange, 
    onFocus,
    align = 'right'
}: { 
    value: number, 
    onChange: (val: number) => void,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => void,
    align?: 'left' | 'right'
}) => {
    const [flashState, setFlashState] = useState<'idle' | 'up' | 'down'>('idle');
    const isFirstRender = useRef(true);
    const prevValue = useRef(value);

    useEffect(() => {
        // Skip flash on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Only flash if value actually changed
        if (prevValue.current !== value) {
            const direction = value > prevValue.current ? 'up' : 'down';
            setFlashState(direction);
            const timer = setTimeout(() => setFlashState('idle'), 1000); // 1 second flash
            prevValue.current = value;
            return () => clearTimeout(timer);
        }
    }, [value]);

    const getFlashStyles = () => {
        if (flashState === 'up') return 'bg-skin-success/20 ring-1 ring-skin-success/30';
        if (flashState === 'down') return 'bg-skin-danger/20 ring-1 ring-skin-danger/30';
        return 'bg-transparent';
    };

    return (
        <div className={`relative rounded-md transition-colors duration-500 ${getFlashStyles()}`}>
            {flashState !== 'idle' && (
                <span className={`absolute ${align === 'right' ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-ping ${flashState === 'up' ? 'bg-skin-success' : 'bg-skin-danger'}`} />
            )}
            <input 
                type="number"
                step="0.01"
                className={`w-full ${align === 'right' ? 'text-right' : 'text-left'} bg-transparent border-b border-transparent hover:border-skin-border focus:border-skin-primary px-0 py-1 font-bold text-skin-text-base font-mono transition-all no-spinner focus:outline-none ${flashState !== 'idle' ? (align === 'right' ? 'pl-3' : 'pr-3') : ''}`}
                value={value}
                onFocus={onFocus}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            />
        </div>
    );
};

export const HoldingsTable: React.FC<HoldingsTableProps> = ({ 
  holdings, 
  customColors, 
  onUpdateHolding, 
  onAddHolding, 
  onDeleteHolding, 
  onRefreshPrices,
  isUpdatingPrices
}) => {
  // --- State: Sorting ---
  // We use an array to support multi-column sorting
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([{ field: 'weight', direction: 'desc' }]);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  
  // --- State: Basic Filters ---
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // --- State: Advanced Filters ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<RangeFilter[]>([]);
  
  // Temporary state for the filter inputs
  const [tempFilterField, setTempFilterField] = useState<FilterField>('profit');
  const [tempMin, setTempMin] = useState<string>('');
  const [tempMax, setTempMax] = useState<string>('');

  // --- State: Add Modal ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHoldingData, setNewHoldingData] = useState<Partial<Holding>>({
    name: '',
    code: '',
    type: AssetType.STOCK,
    quantity: 0,
    avgPrice: 0,
    currentPrice: 0
  });

  // Calculate Grand Total for Weight calculation
  const grandTotalValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.presentValue, 0);
  }, [holdings]);

  // --- Definitions: Sort Options ---
  const sortFieldOptions: { value: SortConfig['field']; label: string }[] = [
    { value: 'name', label: '名稱/代號' },
    { value: 'type', label: '類別' },
    { value: 'weight', label: '資產占比' },
    { value: 'quantity', label: '股數' },
    { value: 'avgPrice', label: '均價' },
    { value: 'currentPrice', label: '市價' },
    { value: 'cost', label: '成本' },
    { value: 'presentValue', label: '現值' },
    { value: 'profit', label: '損益' },
    { value: 'roi', label: '報酬率' },
  ];

  // --- Handlers: Sorting Logic ---
  const handleSort = (field: SortConfig['field'], event: React.MouseEvent) => {
    setSortConfig(prevConfig => {
      const existingIndex = prevConfig.findIndex(c => c.field === field);
      
      // Multi-sort logic (Shift key)
      if (event.shiftKey) {
        if (existingIndex !== -1) {
          // Toggle direction if exists
          const newConfig = [...prevConfig];
          newConfig[existingIndex] = {
            ...newConfig[existingIndex],
            direction: newConfig[existingIndex].direction === 'asc' ? 'desc' : 'asc'
          };
          return newConfig;
        } else {
          // Add new field to the end of the priority list
          return [...prevConfig, { field, direction: 'desc' }];
        }
      } else {
        // Single sort logic (replace existing)
        if (existingIndex !== -1 && prevConfig.length === 1) {
          // Toggle direction
          return [{ field, direction: prevConfig[0].direction === 'asc' ? 'desc' : 'asc' }];
        } else {
          // Replace sort
          return [{ field, direction: 'desc' }];
        }
      }
    });
  };

  const getSortIndicator = (field: SortConfig['field']) => {
    const index = sortConfig.findIndex(c => c.field === field);
    if (index === -1) return null;
    
    const config = sortConfig[index];
    return {
      direction: config.direction,
      priority: sortConfig.length > 1 ? index + 1 : null
    };
  };

  // --- Handlers: Sort Panel ---
  const addSortCriteria = () => {
    // Default to a field not already in use, or 'profit'
    const usedFields = sortConfig.map(c => c.field);
    const nextField = sortFieldOptions.find(f => !usedFields.includes(f.value))?.value || 'profit';
    setSortConfig([...sortConfig, { field: nextField, direction: 'desc' }]);
  };

  const removeSortCriteria = (index: number) => {
    setSortConfig(sortConfig.filter((_, i) => i !== index));
  };

  const updateSortCriteria = (index: number, updates: Partial<SortConfig>) => {
    const newConfig = [...sortConfig];
    newConfig[index] = { ...newConfig[index], ...updates };
    setSortConfig(newConfig);
  };

  const moveSortCriteria = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sortConfig.length - 1) return;
    
    const newConfig = [...sortConfig];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
    setSortConfig(newConfig);
  };

  // --- Handlers: Filtering ---
  const addFilter = () => {
    if (!tempMin && !tempMax) return;
    
    const fieldLabel = fieldOptions.find(f => f.value === tempFilterField)?.label || tempFilterField;
    const minVal = tempMin ? parseFloat(tempMin) : undefined;
    const maxVal = tempMax ? parseFloat(tempMax) : undefined;

    const newFilter: RangeFilter = {
        id: Date.now().toString(),
        field: tempFilterField,
        label: fieldLabel,
        min: minVal,
        max: maxVal
    };

    setActiveFilters([...activeFilters, newFilter]);
    setTempMin('');
    setTempMax('');
  };

  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (tempMin || tempMax)) {
        addFilter();
    }
  };

  // --- Handlers: Add Holding ---
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddHolding && newHoldingData.name && newHoldingData.code) {
        onAddHolding({
            id: Date.now().toString(),
            name: newHoldingData.name,
            code: newHoldingData.code,
            type: newHoldingData.type || AssetType.STOCK,
            quantity: newHoldingData.quantity || 0,
            avgPrice: newHoldingData.avgPrice || 0,
            currentPrice: newHoldingData.currentPrice || 0,
        });
        setIsAddModalOpen(false);
        setNewHoldingData({
            name: '',
            code: '',
            type: AssetType.STOCK,
            quantity: 0,
            avgPrice: 0,
            currentPrice: 0
        });
    }
  };

  // --- Logic: Filtering ---
  const filteredHoldings = useMemo(() => {
    return holdings.filter(h => {
      // 1. Type Filter
      if (filterType !== 'ALL' && h.type !== filterType) return false;

      // 2. Search Filter
      const searchLower = searchTerm.toLowerCase();
      if (searchTerm && !h.name.toLowerCase().includes(searchLower) && !h.code.toLowerCase().includes(searchLower)) {
          return false;
      }

      // 3. Advanced Range Filters
      if (activeFilters.length > 0) {
        const passesAll = activeFilters.every(filter => {
            let itemValue: number;

            // Handle calculated fields or weight
            if (filter.field === 'weight') {
                itemValue = grandTotalValue > 0 ? (h.presentValue / grandTotalValue) * 100 : 0;
            } else {
                itemValue = h[filter.field] as number;
            }

            // Min Check
            if (filter.min !== undefined && itemValue < filter.min) return false;
            // Max Check
            if (filter.max !== undefined && itemValue > filter.max) return false;

            return true;
        });
        if (!passesAll) return false;
      }

      return true;
    });
  }, [holdings, filterType, searchTerm, activeFilters, grandTotalValue]);

  // --- Logic: Sorting ---
  const sortedHoldings = useMemo(() => {
    let data = [...filteredHoldings];

    if (sortConfig.length > 0) {
        data.sort((a, b) => {
            for (const config of sortConfig) {
                let diff = 0;
                
                // Weight Special Case
                if (config.field === 'weight') {
                    diff = a.presentValue - b.presentValue;
                } else {
                    const aValue = a[config.field as keyof CalculatedHolding];
                    const bValue = b[config.field as keyof CalculatedHolding];
                    
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                        diff = aValue.localeCompare(bValue);
                    } else {
                        diff = (aValue as number) - (bValue as number);
                    }
                }

                if (diff !== 0) {
                    return config.direction === 'asc' ? diff : -diff;
                }
            }
            return 0;
        });
    }
    return data;
  }, [filteredHoldings, sortConfig]);

  // Totals Calculation
  const totalCost = sortedHoldings.reduce((sum, h) => sum + h.cost, 0);
  const totalValue = sortedHoldings.reduce((sum, h) => sum + h.presentValue, 0);
  const totalProfit = totalValue - totalCost;
  const totalRoi = totalCost === 0 ? 0 : (totalProfit / totalCost) * 100;
  const totalWeight = grandTotalValue === 0 ? 0 : (totalValue / grandTotalValue) * 100;

  // Helper for filter options
  const fieldOptions: { value: FilterField; label: string }[] = [
    { value: 'profit', label: '損益 ($)' },
    { value: 'roi', label: '報酬率 (%)' },
    { value: 'presentValue', label: '現值 ($)' },
    { value: 'cost', label: '成本 ($)' },
    { value: 'weight', label: '權重 (%)' },
    { value: 'quantity', label: '股數' },
    { value: 'currentPrice', label: '市價' },
  ];

  // Helper to render Profit/ROI with visual indicators
  const renderTrendValue = (value: number, isPercent: boolean) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    
    // Taiwan Logic: Positive = Red + Up, Negative = Green + Down
    // Note: CSS Variable 'success' is mapped to Red, 'danger' is mapped to Green in index.html
    const colorClass = isPositive 
        ? 'text-skin-success bg-red-50 dark:bg-red-900/20' 
        : (isNegative ? 'text-skin-danger bg-green-50 dark:bg-green-900/20' : 'text-skin-text-muted');

    const formatted = isPercent 
        ? `${value.toFixed(2)}%` 
        : formatCurrency(value);
        
    const prefix = isPositive ? '+' : '';

    return (
        <div className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md transition-colors w-full ${colorClass}`}>
            {isPositive && <ArrowUp size={14} />}
            {isNegative && <ArrowDown size={14} />}
            <span>{prefix}{formatted}</span>
        </div>
    );
  };

  const SortHeader = ({ field, label, align = 'right', className = '' }: { field: FilterField, label: string, align?: 'left' | 'center' | 'right', className?: string }) => {
    const indicator = getSortIndicator(field);
    const ariaSort = indicator ? (indicator.direction === 'asc' ? 'ascending' : 'descending') : 'none';
    
    return (
        <th 
            className={`px-4 py-4 cursor-pointer hover:bg-skin-base/80 transition-colors group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
            onClick={(e) => handleSort(field, e)}
            title="按住 Shift 可多欄位排序"
            aria-sort={ariaSort}
        >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
            {label}
            <div className={`flex items-center text-xs transition-opacity ${indicator ? 'opacity-100 text-skin-primary' : 'opacity-0 group-hover:opacity-40 text-skin-text-muted'}`}>
                {indicator ? (
                    <>
                        {indicator.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        {indicator.priority && <span className="ml-0.5 font-bold text-[10px]">{indicator.priority}</span>}
                    </>
                ) : (
                    <ArrowUpDown size={14} />
                )}
            </div>
        </div>
        </th>
    );
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className="bg-skin-card rounded-xl shadow-sm border border-skin-border overflow-hidden flex flex-col transition-all duration-300 relative">
      {/* Top Header & Basic Controls */}
      <div className="p-5 border-b border-skin-border flex flex-col gap-4 bg-skin-card">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-skin-text-base flex items-center gap-2">
                    持股明細
                    {(activeFilters.length > 0) && <span className="text-xs font-normal text-skin-primary bg-skin-primary-bg px-2 py-0.5 rounded-full">{activeFilters.length} 個篩選條件</span>}
                </h3>
                <span className="text-xs text-skin-text-muted">
                    {filteredHoldings.length !== holdings.length 
                        ? `顯示 ${filteredHoldings.length} 筆 (共 ${holdings.length} 筆)` 
                        : 'Shift+點擊表頭 或 使用排序面板進行多欄排序'}
                </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Search Input */}
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-skin-text-muted" />
                    <input 
                        type="text" 
                        placeholder="搜尋名稱或代號..." 
                        className="w-full sm:w-48 pl-9 pr-3 py-1.5 text-sm bg-skin-base border border-skin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-primary transition-all placeholder:text-skin-text-muted/70"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Add Button */}
                {onAddHolding && (
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-skin-primary text-skin-primary-fg rounded-lg font-medium text-sm hover:opacity-90 flex items-center gap-1 shadow-sm transition-all"
                    >
                        <Plus size={16} /> <span className="hidden sm:inline">新增</span>
                    </button>
                )}

                {/* Type Filter Buttons */}
                <div className="flex bg-skin-base p-1 rounded-lg border border-skin-border w-full sm:w-auto">
                    <button 
                        onClick={() => setFilterType('ALL')}
                        className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'ALL' ? 'bg-skin-card text-skin-primary shadow-sm' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                    >
                        全部
                    </button>
                    <button 
                        onClick={() => setFilterType(AssetType.STOCK)}
                        style={filterType === AssetType.STOCK ? { color: customColors.stock, borderColor: customColors.stock } : {}}
                        className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === AssetType.STOCK ? 'bg-skin-card shadow-sm' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                    >
                        股票
                    </button>
                    <button 
                        onClick={() => setFilterType(AssetType.BOND)}
                        style={filterType === AssetType.BOND ? { color: customColors.bond, borderColor: customColors.bond } : {}}
                        className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === AssetType.BOND ? 'bg-skin-card shadow-sm' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                    >
                        債券
                    </button>
                </div>

                <div className="flex items-center bg-skin-base rounded-lg border border-skin-border p-0.5">
                    {/* Sort Toggle */}
                    <button 
                        onClick={() => {
                            setIsSortPanelOpen(!isSortPanelOpen);
                            setIsFilterOpen(false); // Exclusive
                        }}
                        className={`p-2 rounded-md transition-colors ${isSortPanelOpen ? 'bg-skin-card text-skin-primary shadow-sm' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                        title="排序設定"
                    >
                        <ListOrdered size={18} />
                    </button>
                    <div className="w-px h-4 bg-skin-border mx-1"></div>
                    {/* Advanced Filter Toggle */}
                    <button 
                        onClick={() => {
                            setIsFilterOpen(!isFilterOpen);
                            setIsSortPanelOpen(false); // Exclusive
                        }}
                        className={`p-2 rounded-md transition-colors ${isFilterOpen ? 'bg-skin-card text-skin-primary shadow-sm' : 'text-skin-text-muted hover:text-skin-text-base'}`}
                        title="進階篩選"
                    >
                        <ListFilter size={18} />
                    </button>
                </div>
            </div>
        </div>

        {/* Sort Manager Panel */}
        {isSortPanelOpen && (
            <div className="pt-4 mt-2 border-t border-skin-border animate-fade-in">
                <div className="bg-skin-base p-4 rounded-xl border border-skin-border shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm text-skin-text-muted font-bold">
                            <ListOrdered size={16} />
                            <span>多欄位排序設定</span>
                        </div>
                        <button 
                            onClick={() => setSortConfig([])} 
                            className="text-xs text-skin-text-muted hover:text-skin-danger underline"
                        >
                            清除全部
                        </button>
                    </div>

                    <div className="space-y-2">
                        {sortConfig.map((config, index) => (
                            <div key={index} className="flex flex-wrap items-center gap-2 bg-skin-card p-2 rounded-lg border border-skin-border shadow-sm">
                                {/* Priority Badge */}
                                <div className="w-6 h-6 flex items-center justify-center bg-skin-base rounded-full text-xs font-mono font-bold text-skin-text-muted border border-skin-border">
                                    {index + 1}
                                </div>
                                
                                {/* Field Select */}
                                <select 
                                    className="bg-skin-base border border-skin-border text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-skin-primary min-w-[120px]"
                                    value={config.field}
                                    onChange={(e) => updateSortCriteria(index, { field: e.target.value as SortConfig['field'] })}
                                >
                                    {sortFieldOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>

                                {/* Direction Toggle */}
                                <button 
                                    onClick={() => updateSortCriteria(index, { direction: config.direction === 'asc' ? 'desc' : 'asc' })}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold border transition-colors ${config.direction === 'asc' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}
                                >
                                    {config.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                    {config.direction === 'asc' ? '升冪 (小→大)' : '降冪 (大→小)'}
                                </button>

                                {/* Reorder Controls */}
                                <div className="flex items-center border-l border-r border-skin-border px-1 gap-1 mx-1">
                                    <button 
                                        onClick={() => moveSortCriteria(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-skin-text-muted hover:text-skin-primary disabled:opacity-30 disabled:hover:text-skin-text-muted"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button 
                                        onClick={() => moveSortCriteria(index, 'down')}
                                        disabled={index === sortConfig.length - 1}
                                        className="p-1 text-skin-text-muted hover:text-skin-primary disabled:opacity-30 disabled:hover:text-skin-text-muted"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>

                                {/* Remove Button */}
                                <button 
                                    onClick={() => removeSortCriteria(index)}
                                    className="p-1.5 text-skin-text-muted hover:text-skin-danger hover:bg-skin-base rounded transition-colors ml-auto"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}

                        {sortConfig.length === 0 && (
                            <div className="text-center py-4 text-xs text-skin-text-muted border border-dashed border-skin-border rounded-lg bg-skin-card">
                                目前無排序條件，請點擊下方按鈕新增
                            </div>
                        )}

                        <button 
                            onClick={addSortCriteria}
                            className="w-full py-2 border border-dashed border-skin-primary/50 text-skin-primary rounded-lg text-xs font-bold hover:bg-skin-primary-bg/50 transition-colors flex items-center justify-center gap-1"
                        >
                            <Plus size={14} /> 新增排序欄位
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Advanced Filter Panel */}
        {isFilterOpen && (
            <div className="pt-4 mt-2 border-t border-skin-border animate-fade-in">
                <div className="flex flex-col gap-3">
                    <div className="bg-skin-base p-4 rounded-xl border border-skin-border shadow-inner">
                        <div className="flex items-center gap-2 text-sm text-skin-text-muted mb-3 font-bold">
                            <Filter size={16} />
                            <span>新增篩選條件</span>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
                            
                            {/* Field Selector */}
                            <div className="flex-shrink-0 w-full lg:w-48">
                                <label className="block text-xs font-bold text-skin-text-muted mb-1.5 ml-1">篩選欄位</label>
                                <div className="relative">
                                    <select 
                                        className="appearance-none w-full bg-skin-card border border-skin-border rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-skin-primary focus:border-transparent h-[38px] shadow-sm font-medium text-skin-text-base cursor-pointer hover:border-skin-primary/50 transition-colors"
                                        value={tempFilterField}
                                        onChange={(e) => setTempFilterField(e.target.value as FilterField)}
                                    >
                                        {fieldOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-skin-text-muted">
                                        <ArrowDown size={12} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>

                            {/* Range Inputs */}
                            <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4">
                                {/* Min Input */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-skin-text-muted mb-1.5 ml-1">最小值</label>
                                    <input 
                                        type="number" 
                                        placeholder="不限"
                                        className="w-full pl-3 pr-3 py-2 bg-skin-card border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono shadow-sm h-[38px]"
                                        value={tempMin}
                                        onChange={(e) => setTempMin(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>

                                {/* Max Input */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-skin-text-muted mb-1.5 ml-1">最大值</label>
                                    <input 
                                        type="number" 
                                        placeholder="不限"
                                        className="w-full pl-3 pr-3 py-2 bg-skin-card border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono shadow-sm h-[38px]"
                                        value={tempMax}
                                        onChange={(e) => setTempMax(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                            </div>

                            {/* Add Button */}
                            <div className="flex-shrink-0">
                                <button 
                                    onClick={addFilter}
                                    disabled={!tempMin && !tempMax}
                                    className="w-full lg:w-auto h-[38px] mt-1 lg:mt-0 px-6 bg-skin-primary text-skin-primary-fg rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm transition-all"
                                >
                                    <Plus size={18} strokeWidth={2.5} /> 
                                    <span>加入篩選</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Filters List */}
                    {activeFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {activeFilters.map(filter => (
                                <div key={filter.id} className="inline-flex items-center gap-2 bg-skin-primary-bg text-skin-primary px-3 py-1.5 rounded-lg text-xs border border-skin-primary/20 shadow-sm animate-fade-in">
                                    <span className="font-bold">{filter.label}</span>
                                    <div className="w-px h-3 bg-skin-primary/30"></div>
                                    <span className="font-mono">
                                        {filter.min !== undefined ? filter.min : '∞'} 
                                        {' ~ '} 
                                        {filter.max !== undefined ? filter.max : '∞'}
                                    </span>
                                    <button 
                                        onClick={() => removeFilter(filter.id)}
                                        className="hover:text-skin-danger hover:bg-white/50 p-0.5 rounded-full transition-colors ml-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => setActiveFilters([])}
                                className="text-xs text-skin-text-muted hover:text-skin-text-base underline ml-2 decoration-dotted"
                            >
                                清除全部
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* --- Responsive View Switcher --- */}

      {/* 1. Desktop/Tablet Table View (Hidden on small screens) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-skin-base text-skin-text-muted font-medium border-b border-skin-border">
            <tr>
              <SortHeader field="name" label="名稱/代號" align="left" className="min-w-[140px]" />
              <SortHeader field="type" label="類別" align="center" className="min-w-[80px]" />
              <SortHeader field="weight" label="資產占比" align="right" className="min-w-[100px]" />
              <SortHeader field="quantity" label="股數" className="min-w-[100px]" />
              <SortHeader field="avgPrice" label="均價" className="min-w-[100px]" />
              <SortHeader field="cost" label="成本" className="min-w-[110px]" />
              <th 
                className="px-4 py-4 text-right min-w-[120px] cursor-pointer hover:bg-skin-base/80 transition-colors group"
                onClick={(e) => handleSort('currentPrice', e)}
                aria-sort={getSortIndicator('currentPrice') ? (getSortIndicator('currentPrice')?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-1 justify-end">
                    市價
                    <div className={`flex items-center text-xs transition-opacity ${getSortIndicator('currentPrice') ? 'opacity-100 text-skin-primary' : 'opacity-0 group-hover:opacity-40 text-skin-text-muted'}`}>
                         {getSortIndicator('currentPrice') ? (
                            <>
                                {getSortIndicator('currentPrice')?.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                {getSortIndicator('currentPrice')?.priority && <span className="ml-0.5 font-bold text-[10px]">{getSortIndicator('currentPrice')?.priority}</span>}
                            </>
                         ) : <ArrowUpDown size={14} />}
                    </div>
                  </div>
                  {onRefreshPrices && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onRefreshPrices();
                        }}
                        disabled={isUpdatingPrices}
                        className={`p-1 rounded-full text-skin-text-muted hover:text-skin-primary hover:bg-skin-base transition-all ${isUpdatingPrices ? 'animate-spin text-skin-primary' : ''}`}
                        title="更新即時股價"
                    >
                        <RefreshCw size={14} />
                    </button>
                  )}
                </div>
              </th>
              <SortHeader field="presentValue" label="現值" className="min-w-[110px]" />
              <SortHeader field="profit" label="損益" className="min-w-[110px]" />
              <SortHeader field="roi" label="報酬率" className="min-w-[100px]" />
              {onDeleteHolding && <th className="px-4 py-4 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-skin-border">
            {sortedHoldings.length > 0 ? (
                sortedHoldings.map((h) => {
                    const weight = grandTotalValue > 0 ? (h.presentValue / grandTotalValue) * 100 : 0;
                    const accentColor = h.type === AssetType.STOCK ? customColors.stock : customColors.bond;

                    return (
                        <tr key={h.id} className="hover:bg-skin-base/50 transition-colors group">
                            {/* Name & Code */}
                            <td className="px-4 py-3">
                                <div className="font-bold text-skin-text-base">{h.name}</div>
                                <div className="text-xs text-skin-text-muted font-mono">{h.code}</div>
                            </td>
                            
                            {/* Type Badge */}
                            <td className="px-4 py-3 text-center">
                                <span 
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border"
                                    style={{ 
                                        color: accentColor, 
                                        backgroundColor: accentColor + '15',
                                        borderColor: accentColor + '30'
                                    }}
                                >
                                    {h.type === AssetType.STOCK ? '股票' : '債券'}
                                </span>
                            </td>

                            {/* Weight Progress */}
                            <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold text-skin-text-base font-mono">{weight.toFixed(1)}%</span>
                                    <div className="w-20 h-1.5 bg-skin-base rounded-full overflow-hidden border border-skin-border/50">
                                        <div 
                                            className="h-full rounded-full" 
                                            style={{ width: `${weight}%`, backgroundColor: accentColor }}
                                        />
                                    </div>
                                </div>
                            </td>
                            
                            {/* Quantity Input */}
                            <td className="px-4 py-3 text-right">
                                <input 
                                    type="number"
                                    className="w-full text-right bg-transparent border-b border-transparent hover:border-skin-border focus:border-skin-primary px-0 py-1 font-mono text-skin-text-base transition-all no-spinner focus:outline-none"
                                    value={h.quantity}
                                    onFocus={handleFocus}
                                    onChange={(e) => onUpdateHolding?.(h.id, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                            </td>

                            {/* Avg Price Input */}
                            <td className="px-4 py-3 text-right">
                                <input 
                                    type="number"
                                    step="0.01"
                                    className="w-full text-right bg-transparent border-b border-transparent hover:border-skin-border focus:border-skin-primary px-0 py-1 text-skin-text-muted font-mono transition-all no-spinner focus:outline-none"
                                    value={h.avgPrice}
                                    onFocus={handleFocus}
                                    onChange={(e) => onUpdateHolding?.(h.id, 'avgPrice', parseFloat(e.target.value) || 0)}
                                />
                            </td>
                            
                            {/* Cost (Moved) */}
                            <td className="px-4 py-3 text-right text-skin-text-muted font-mono text-sm">
                                {formatCurrency(h.cost)}
                            </td>

                            {/* Current Price Input (Use Custom Component) */}
                            <td className="px-4 py-3 text-right">
                                <PriceInput 
                                    value={h.currentPrice}
                                    onFocus={handleFocus}
                                    onChange={(val) => onUpdateHolding?.(h.id, 'currentPrice', val)}
                                />
                            </td>

                            {/* Present Value */}
                            <td className="px-4 py-3 text-right font-bold text-skin-text-base font-mono">
                                {formatCurrency(h.presentValue)}
                            </td>

                            {/* Profit with Icon & Background */}
                            <td className="px-4 py-3 text-right font-bold font-mono">
                                {renderTrendValue(h.profit, false)}
                            </td>

                            {/* ROI with Icon & Background */}
                            <td className="px-4 py-3 text-right font-medium font-mono">
                                {renderTrendValue(h.roi, true)}
                            </td>

                             {/* Delete Action */}
                             {onDeleteHolding && (
                                <td className="px-4 py-3 text-center">
                                    <button 
                                        onClick={() => onDeleteHolding(h.id)}
                                        className="text-skin-text-muted hover:text-skin-danger opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover:bg-skin-base"
                                        title="刪除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    );
                })
            ) : (
                <tr>
                    <td colSpan={onDeleteHolding ? 11 : 10} className="px-4 py-12 text-center text-skin-text-muted flex flex-col items-center justify-center">
                        <div className="bg-skin-base p-4 rounded-full mb-3">
                            <Search className="w-6 h-6 text-skin-text-muted" />
                        </div>
                        <p className="font-medium">找不到符合條件的持股</p>
                        <p className="text-xs mt-1">請嘗試調整搜尋關鍵字、篩選類別或進階數值條件</p>
                    </td>
                </tr>
            )}
          </tbody>
          <tfoot className="bg-skin-base/50 font-bold text-skin-text-base border-t-2 border-skin-border">
            <tr>
              <td className="px-4 py-4" colSpan={2}>
                {(filterType === 'ALL' && !searchTerm && (activeFilters.length === 0)) ? '投資組合總計' : '篩選結果總計'}
              </td>
              <td className="px-4 py-4 text-right font-mono text-skin-text-muted">
                 {totalWeight.toFixed(1)}%
              </td>
              <td className="px-4 py-4" colSpan={2}></td>
              <td className="px-4 py-4 text-right font-mono">{formatCurrency(totalCost)}</td>
              <td></td>
              <td className="px-4 py-4 text-right font-mono text-skin-primary">{formatCurrency(totalValue)}</td>
              
              {/* Total Profit */}
              <td className="px-4 py-4 text-right font-mono">
                 {renderTrendValue(totalProfit, false)}
              </td>

              {/* Total ROI */}
              <td className="px-4 py-4 text-right font-mono">
                 {renderTrendValue(totalRoi, true)}
              </td>
              {onDeleteHolding && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 2. Mobile Card View (Visible only on small screens) */}
      <div className="md:hidden flex flex-col bg-skin-base/30">
        <div className="divide-y divide-skin-border">
            {sortedHoldings.length > 0 ? (
                sortedHoldings.map((h) => {
                    const weight = grandTotalValue > 0 ? (h.presentValue / grandTotalValue) * 100 : 0;
                    const accentColor = h.type === AssetType.STOCK ? customColors.stock : customColors.bond;

                    return (
                        <div key={h.id} className="p-4 bg-skin-card hover:bg-skin-base/50 transition-colors">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: accentColor }}></div>
                                    <div>
                                        <div className="font-bold text-base text-skin-text-base">{h.name}</div>
                                        <div className="text-xs text-skin-text-muted font-mono">{h.code}</div>
                                    </div>
                                </div>
                                <span 
                                    className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                    style={{ 
                                        color: accentColor, 
                                        backgroundColor: accentColor + '15',
                                        borderColor: accentColor + '30'
                                    }}
                                >
                                    {h.type === AssetType.STOCK ? '股票' : '債券'}
                                </span>
                            </div>

                            {/* Weight Bar */}
                            <div className="mb-4 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-skin-base rounded-full overflow-hidden">
                                    <div className="h-full" style={{ width: `${weight}%`, backgroundColor: accentColor }}></div>
                                </div>
                                <span className="text-[10px] font-bold text-skin-text-muted font-mono">{weight.toFixed(1)}%</span>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-xs text-skin-text-muted">股數</p>
                                    <input 
                                        type="number" 
                                        className="w-full bg-transparent border-b border-skin-border/50 py-0.5 font-mono font-medium focus:border-skin-primary focus:outline-none"
                                        value={h.quantity}
                                        onFocus={handleFocus}
                                        onChange={(e) => onUpdateHolding?.(h.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-skin-text-muted">均價</p>
                                    <input 
                                        type="number" 
                                        className="w-full bg-transparent border-b border-skin-border/50 py-0.5 font-mono font-medium focus:border-skin-primary focus:outline-none"
                                        value={h.avgPrice}
                                        onFocus={handleFocus}
                                        onChange={(e) => onUpdateHolding?.(h.id, 'avgPrice', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-skin-text-muted flex justify-between">
                                        市價 
                                        {onRefreshPrices && (
                                            <button onClick={onRefreshPrices} disabled={isUpdatingPrices} className="text-skin-primary">
                                                <RefreshCw size={12} className={isUpdatingPrices ? 'animate-spin' : ''} />
                                            </button>
                                        )}
                                    </p>
                                    <PriceInput 
                                        align="left"
                                        value={h.currentPrice}
                                        onFocus={handleFocus}
                                        onChange={(val) => onUpdateHolding?.(h.id, 'currentPrice', val)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-skin-text-muted">持有現值</p>
                                    <p className="font-bold text-skin-text-base font-mono py-1 border-b border-transparent">
                                        ${formatCurrency(h.presentValue)}
                                    </p>
                                </div>
                            </div>

                            {/* Footer: Profit & Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-skin-border/50">
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="flex-1">
                                        {renderTrendValue(h.profit, false)}
                                    </div>
                                    <div className="flex-1">
                                        {renderTrendValue(h.roi, true)}
                                    </div>
                                </div>
                                
                                {onDeleteHolding && (
                                    <button 
                                        onClick={() => onDeleteHolding(h.id)}
                                        className="ml-2 p-2 text-skin-text-muted hover:text-skin-danger hover:bg-skin-base rounded-full"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="p-8 text-center text-skin-text-muted">
                    <p>找不到符合條件的持股</p>
                </div>
            )}
        </div>
        
        {/* Mobile Footer Total */}
        <div className="bg-skin-card border-t border-skin-border p-4 shadow-up sticky bottom-0 z-10">
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-skin-text-base">組合總覽</span>
                <span className="text-2xl font-bold font-mono text-skin-primary">${formatCurrency(totalValue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-skin-base/50 p-2 rounded flex flex-col items-center">
                    <span className="text-[10px] text-skin-text-muted mb-1">總損益</span>
                    {renderTrendValue(totalProfit, false)}
                </div>
                <div className="bg-skin-base/50 p-2 rounded flex flex-col items-center">
                    <span className="text-[10px] text-skin-text-muted mb-1">報酬率</span>
                    {renderTrendValue(totalRoi, true)}
                </div>
            </div>
        </div>
      </div>

       {/* Add Holding Modal */}
       {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-skin-card w-full max-w-sm rounded-xl shadow-xl border border-skin-border overflow-hidden transform transition-all">
            <div className="p-4 border-b border-skin-border flex justify-between items-center bg-skin-base">
              <h3 className="font-bold flex items-center gap-2 text-skin-text-base">
                <Plus size={18} className="text-skin-primary" />
                新增持股
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-skin-text-muted hover:text-skin-text-base">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
               <div>
                  <label className="block text-xs font-medium text-skin-text-muted mb-1">名稱</label>
                  <input 
                    type="text" 
                    required
                    placeholder="例如: 元大台灣50"
                    className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm"
                    value={newHoldingData.name}
                    onChange={e => setNewHoldingData({...newHoldingData, name: e.target.value})}
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">代號</label>
                    <input 
                        type="text" 
                        required
                        placeholder="例如: 0050"
                        className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono"
                        value={newHoldingData.code}
                        onChange={e => setNewHoldingData({...newHoldingData, code: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">類別</label>
                    <select 
                        className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm"
                        value={newHoldingData.type}
                        onChange={e => setNewHoldingData({...newHoldingData, type: e.target.value as AssetType})}
                    >
                        <option value={AssetType.STOCK}>股票型</option>
                        <option value={AssetType.BOND}>債券型</option>
                    </select>
                  </div>
               </div>
               
               <div className="h-px bg-skin-border my-2"></div>
               
               <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">股數</label>
                    <input 
                        type="number" 
                        min="0"
                        className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono"
                        value={newHoldingData.quantity}
                        onChange={e => setNewHoldingData({...newHoldingData, quantity: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">均價</label>
                    <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono"
                        value={newHoldingData.avgPrice}
                        onChange={e => setNewHoldingData({...newHoldingData, avgPrice: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-skin-text-muted mb-1">現價</label>
                    <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-skin-base border border-skin-border rounded-lg focus:ring-2 focus:ring-skin-primary focus:outline-none text-sm font-mono"
                        value={newHoldingData.currentPrice}
                        onChange={e => setNewHoldingData({...newHoldingData, currentPrice: parseFloat(e.target.value) || 0})}
                    />
                  </div>
               </div>

               <button 
                type="submit"
                className="w-full bg-skin-primary text-skin-primary-fg py-2.5 rounded-lg font-bold shadow-sm hover:opacity-90 transition-opacity mt-2 flex items-center justify-center gap-2"
               >
                 <Save size={18} /> 儲存新增
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};