import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, CheckCircle2, Clock, AlertCircle, Loader, ChevronDown, ChevronUp, BarChart3, History, Calendar, Check, TrendingUp } from 'lucide-react';
import { store } from '../store';
import { Bill, PaymentMethod } from '../types';
import { DateRangePickerRac } from './ui/date-range-picker-rac';
import { Item, ItemContent, ItemTitle } from './ui/item-menu';
import { parseDate } from "@internationalized/date";
import { cn } from "@/lib/utils";

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// --- Shared Logic Hook ---
const useBillPayment = (bill: Bill) => {
    const [cashInput, setCashInput] = useState(bill.cashAmount?.toString() || '0');
    const [onlineInput, setOnlineInput] = useState(bill.onlineAmount?.toString() || '0');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setCashInput(bill.cashAmount?.toString() || '0');
        setOnlineInput(bill.onlineAmount?.toString() || '0');
    }, [bill.cashAmount, bill.onlineAmount]);

    const handleStatusToggle = async () => {
        setIsUpdating(true);
        try {
            const newStatus = !bill.isPaid;
            let updates: Partial<Bill> = { isPaid: newStatus };

            if (newStatus) {
                // If marking as PAID, checks if 0, then potential auto-fill logic could go here
                // But generally we just mark it paid.
                const currentTotal = (bill.cashAmount || 0) + (bill.onlineAmount || 0);
                if (currentTotal === 0) {
                    updates.cashAmount = bill.totalAmount;
                    updates.onlineAmount = 0;
                    updates.paymentMethod = PaymentMethod.CASH;
                }
            }

            await store.updateBill({ ...bill, ...updates });
        } catch (e) {
            console.error("Failed to toggle status", e);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAmountBlur = async () => {
        const cash = parseFloat(cashInput) || 0;
        const online = parseFloat(onlineInput) || 0;

        if (cash === (bill.cashAmount || 0) && online === (bill.onlineAmount || 0)) return;

        setIsUpdating(true);
        try {
            await store.updateBill({
                ...bill,
                cashAmount: cash,
                onlineAmount: online,
                isPaid: bill.isPaid // Preserve status, don't auto-flip unless desired
            });
        } catch (e) {
            console.error("Failed to update amounts", e);
            setCashInput(bill.cashAmount?.toString() || '0');
            setOnlineInput(bill.onlineAmount?.toString() || '0');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCashChange = (val: string) => {
        setCashInput(val);
        // Auto-fill logic: Only if PAID
        if (bill.isPaid) {
            const cashNum = parseFloat(val) || 0;
            const remaining = Math.max(0, bill.totalAmount - cashNum);
            setOnlineInput(remaining.toString());
        }
    };

    const handleOnlineChange = (val: string) => {
        setOnlineInput(val);
        // Auto-fill logic: Only if PAID
        if (bill.isPaid) {
            const onlineNum = parseFloat(val) || 0;
            const remaining = Math.max(0, bill.totalAmount - onlineNum);
            setCashInput(remaining.toString());
        }
    };

    const totalEntered = (parseFloat(cashInput) || 0) + (parseFloat(onlineInput) || 0);
    const isMismatch = Math.abs(totalEntered - bill.totalAmount) > 1;

    return {
        cashInput,
        onlineInput,
        isUpdating,
        totalEntered,
        isMismatch,
        handleStatusToggle,
        handleAmountBlur,
        handleCashChange,
        handleOnlineChange
    };
};

// --- Desktop Row Component ---
const BillRow = ({ bill }: { bill: Bill; key?: string }) => {
    const {
        cashInput,
        onlineInput,
        isUpdating,
        totalEntered,
        isMismatch,
        handleStatusToggle,
        handleAmountBlur,
        handleCashChange,
        handleOnlineChange
    } = useBillPayment(bill);

    return (
        <tr className="hover:bg-gray-50/50 transition-colors group">
            <td className="p-4">
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{bill.customerName}</span>
                    <span className="text-xs text-gray-400">#{bill.id}</span>
                </div>
            </td>
            <td className="p-4">
                <div className="flex flex-col text-sm text-gray-500">
                    <span>{bill.date}</span>
                    <span className="text-xs text-gray-400">{bill.time}</span>
                </div>
            </td>
            <td className="p-4 text-center">
                <button
                    onClick={handleStatusToggle}
                    disabled={isUpdating}
                    className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 disabled:opacity-70 ${bill.isPaid
                        ? 'bg-success/10 text-emerald-700 border-success/20 hover:bg-success/20'
                        : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                        }`}
                >
                    {isUpdating ? <Loader size={12} className="animate-spin" /> : (
                        bill.isPaid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />
                    )}
                    {bill.isPaid ? 'PAID' : 'UNPAID'}
                </button>
            </td>
            <td className="p-4">
                <div className="relative max-w-[100px]">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                    <input
                        type="number"
                        value={cashInput}
                        onChange={(e) => handleCashChange(e.target.value)}
                        onBlur={handleAmountBlur}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                        className={`w-full pl-5 pr-2 py-1.5 bg-white border rounded-lg text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 transition-all ${bill.isPaid && isMismatch ? 'border-red-300 ring-red-100' : 'border-gray-200 focus:ring-success/20 focus:border-success'
                            }`}
                        placeholder="0"
                    />
                </div>
            </td>
            <td className="p-4">
                <div className="relative max-w-[100px]">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                    <input
                        type="number"
                        value={onlineInput}
                        onChange={(e) => handleOnlineChange(e.target.value)}
                        onBlur={handleAmountBlur}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                        className={`w-full pl-5 pr-2 py-1.5 bg-white border rounded-lg text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 transition-all ${bill.isPaid && isMismatch ? 'border-red-300 ring-red-100' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                            }`}
                        placeholder="0"
                    />
                </div>
            </td>
            <td className="p-4 text-right">
                <div className="flex flex-col items-end">
                    <p className={`font-bold text-sm ${isMismatch ? 'text-red-500' : 'text-gray-900'}`}>
                        ₹{bill.totalAmount}
                    </p>
                    {isMismatch && (
                        <span className="text-[10px] text-red-500 font-medium">
                            Diff: {totalEntered - bill.totalAmount}
                        </span>
                    )}
                </div>
            </td>
        </tr>
    );
};

// --- Mobile Card Component ---
const MobileBillCard = ({ bill }: { bill: Bill; key?: string }) => {
    const {
        cashInput,
        onlineInput,
        isUpdating,
        totalEntered,
        isMismatch,
        handleStatusToggle,
        handleAmountBlur,
        handleCashChange,
        handleOnlineChange
    } = useBillPayment(bill);

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
            {/* Header: Name, Date, Status */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="font-bold text-gray-900 text-base">{bill.customerName}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        #{bill.id} • {bill.date} {bill.time}
                    </p>
                </div>
                <button
                    onClick={handleStatusToggle}
                    disabled={isUpdating}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${bill.isPaid
                        ? 'bg-success/10 text-emerald-700 border-success/20'
                        : 'bg-orange-50 text-orange-700 border-orange-100'
                        }`}
                >
                    {isUpdating ? <Loader size={10} className="animate-spin" /> : (
                        bill.isPaid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />
                    )}
                    {bill.isPaid ? 'PAID' : 'UNPAID'}
                </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-3 gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100/50">
                {/* Cash */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cash</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₹</span>
                        <input
                            type="number"
                            value={cashInput}
                            onChange={(e) => handleCashChange(e.target.value)}
                            onBlur={handleAmountBlur}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-5 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Online */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Online</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₹</span>
                        <input
                            type="number"
                            value={onlineInput}
                            onChange={(e) => handleOnlineChange(e.target.value)}
                            onBlur={handleAmountBlur}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-5 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Total */}
                <div className="flex flex-col gap-1 text-right">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total</label>
                    <p className={`text-base font-bold py-1.5 ${isMismatch ? 'text-red-500' : 'text-gray-900'}`}>
                        ₹{bill.totalAmount}
                    </p>
                </div>
            </div>
            {isMismatch && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium">
                    <AlertCircle size={14} />
                    <span>Difference: ₹{totalEntered - bill.totalAmount}</span>
                </div>
            )}
        </div>
    );
};

// --- Main Page Component ---
const PaymentManagerPage: React.FC = () => {
    const [bills, setBills] = useState<Bill[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [isStatsOpen, setIsStatsOpen] = useState(false);

    // Date range filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [filterType, setFilterType] = useState<'Select' | 'Today' | 'This Week' | 'This Month'>('Select');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateBills = () => {
            setBills(store.getBills());
        };
        updateBills();
        const unsubscribe = store.subscribe(updateBills);

        // Click outside to close dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter Logic
    const toLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleFilterSelect = (type: 'Select' | 'Today' | 'This Week' | 'This Month') => {
        setFilterType(type);
        setIsDropdownOpen(false);
        const today = new Date();

        if (type === 'Select') {
            setStartDate('');
            setEndDate('');
            return;
        }

        if (type === 'Today') {
            const dateStr = toLocalDateString(today);
            setStartDate(dateStr);
            setEndDate(dateStr);
            return;
        }

        if (type === 'This Week') {
            const currentDay = today.getDay();
            const diffToThursday = (currentDay - 4 + 7) % 7;
            const start = new Date(today);
            start.setDate(today.getDate() - diffToThursday);
            const end = new Date(today);
            setStartDate(toLocalDateString(start));
            setEndDate(toLocalDateString(end));
            return;
        }

        if (type === 'This Month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setStartDate(toLocalDateString(start));
            setEndDate(toLocalDateString(end));
            return;
        }
    };

    const normalizeDateStr = (dateStr: string): string => {
        try {
            if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
                const [d, m, y] = dateStr.split(/[-/]/);
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            return dateStr;
        } catch { return dateStr; }
    };

    const filteredBills = useMemo(() => {
        return bills.filter(bill => {
            const matchesSearch =
                bill.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                bill.id.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ? true :
                    statusFilter === 'paid' ? bill.isPaid :
                        !bill.isPaid;

            if (!matchesSearch || !matchesStatus) return false;

            // Date Range Filter
            if (startDate || endDate) {
                const billDate = new Date(normalizeDateStr(bill.date));
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                if (end) end.setHours(23, 59, 59, 999);

                if (start && end) {
                    if (billDate < start || billDate > end) return false;
                } else if (start) {
                    if (billDate < start) return false;
                } else if (end) {
                    if (billDate > end) return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // 1. Sort by Date (Descending)
            const dateA = new Date(normalizeDateStr(a.date)).getTime();
            const dateB = new Date(normalizeDateStr(b.date)).getTime();
            if (dateA !== dateB) {
                return dateB - dateA;
            }

            // 2. Sort by ID (Descending)
            // Strip non-numeric characters to handle "#123" or "Bill-123"
            const idStringA = String(a.id).replace(/\D/g, '');
            const idStringB = String(b.id).replace(/\D/g, '');
            const idA = parseInt(idStringA) || 0;
            const idB = parseInt(idStringB) || 0;
            return idB - idA;
        });
    }, [bills, searchTerm, statusFilter, startDate, endDate]);

    // Stats
    const stats = useMemo(() => {
        const totalOutstanding = filteredBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.totalAmount, 0);
        const totalCollected = filteredBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.totalAmount, 0);
        const unpaidCount = filteredBills.filter(b => !b.isPaid).length;

        return { totalOutstanding, totalCollected, unpaidCount };
    }, [filteredBills]);

    return (
        <div className="flex flex-col h-full w-full gap-4 md:gap-6 animate-fade-in text-gray-800 overflow-hidden">
            {/* Header / Stats - Shrink-0 prevents it from taking list space */}
            <div className="shrink-0 space-y-3">
                {/* Mobile Toggle Button */}
                <button
                    onClick={() => setIsStatsOpen(!isStatsOpen)}
                    className="md:hidden w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 transition-all active:scale-[0.98]"
                >
                    <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <BarChart3 size={18} className="text-success-hover" />
                        <span>Payment Overview</span>
                    </div>
                    {isStatsOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>

                {/* Stats Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300 ${!isStatsOpen ? 'hidden md:grid' : 'grid animate-in slide-in-from-top-2'}`}>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-50 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Outstanding</p>
                            <h3 className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</h3>
                        </div>
                        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                            <AlertCircle size={20} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-success/10 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Collected</p>
                            <h3 className="text-2xl font-bold text-success-hover">{formatCurrency(stats.totalCollected)}</h3>
                        </div>
                        <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center text-success">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-50 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Unpaid Bills</p>
                            <h3 className="text-2xl font-bold text-orange-600">{stats.unpaidCount}</h3>
                        </div>
                        <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-500">
                            <Clock size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls - Shrink-0 */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search customer or bill..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-success/50"
                        />
                    </div>

                    {/* Date Filters & Dropdown - Mobile Optimized */}
                    <div className="flex flex-row items-center gap-2 relative w-full md:w-auto" ref={dropdownRef}>
                        <div className="flex-1 md:w-[320px] md:flex-none">
                            <DateRangePickerRac
                                value={startDate && endDate ? { start: parseDate(startDate), end: parseDate(endDate) } : null}
                                onChange={(range) => {
                                    if (range) {
                                        setStartDate(range.start.toString());
                                        setEndDate(range.end.toString());
                                        setFilterType('Select');
                                    } else {
                                        setStartDate('');
                                        setEndDate('');
                                        setFilterType('Select');
                                    }
                                }}
                                onDropdownTrigger={() => setIsDropdownOpen(!isDropdownOpen)}
                                isDropdownOpen={isDropdownOpen}
                            />
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute top-[calc(100%+4px)] right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex flex-col gap-1">
                                    <Item onClick={() => handleFilterSelect('Select')}>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={cn("p-1.5 rounded-lg", filterType === 'Select' ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-500")}>
                                                <History size={14} />
                                            </div>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'Select' ? 'text-blue-600' : ''}>Select (All)</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'Select' && <Check size={14} className="text-blue-600 ml-auto" />}
                                        </div>
                                    </Item>
                                    <div className="h-px bg-gray-100 my-0.5" />
                                    <Item onClick={() => handleFilterSelect('Today')}>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={cn("p-1.5 rounded-lg", filterType === 'Today' ? "bg-success/10 text-success-hover" : "bg-gray-50 text-gray-500")}>
                                                <Clock size={14} />
                                            </div>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'Today' ? 'text-success-hover' : ''}>Today</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'Today' && <Check size={14} className="text-success-hover ml-auto" />}
                                        </div>
                                    </Item>
                                    <Item onClick={() => handleFilterSelect('This Week')}>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={cn("p-1.5 rounded-lg", filterType === 'This Week' ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-500")}>
                                                <Calendar size={14} />
                                            </div>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'This Week' ? 'text-orange-600' : ''}>This Week</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'This Week' && <Check size={14} className="text-orange-600 ml-auto" />}
                                        </div>
                                    </Item>
                                    <Item onClick={() => handleFilterSelect('This Month')}>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={cn("p-1.5 rounded-lg", filterType === 'This Month' ? "bg-purple-50 text-purple-600" : "bg-gray-50 text-gray-500")}>
                                                <TrendingUp size={14} />
                                            </div>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'This Month' ? 'text-purple-600' : ''}>This Month</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'This Month' && <Check size={14} className="text-purple-600 ml-auto" />}
                                        </div>
                                    </Item>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                    {(['all', 'paid', 'unpaid'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${statusFilter === tab
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* List - Flex-1 and Min-H-0 are CRITICAL for flexbox scrolling */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Mobile Cards List */}
                <div className="md:hidden overflow-y-auto flex-1 p-1 space-y-3 pb-20 custom-scrollbar">
                    {filteredBills.length > 0 ? (
                        filteredBills.map((bill) => (
                            <MobileBillCard key={bill.id} bill={bill} />
                        ))
                    ) : (
                        <div className="text-center py-10 text-gray-400">No bills found.</div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:flex flex-1 flex-col min-h-0 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-xl border-b border-gray-100 bg-gray-50">
                                        Bill Details
                                        <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full ml-1" title="v3-scrolling-fix"></span>
                                    </th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50">Date</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center border-b border-gray-100 bg-gray-50">Status</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32 border-b border-gray-100 bg-gray-50">Cash</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32 border-b border-gray-100 bg-gray-50">Online</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right rounded-tr-xl border-b border-gray-100 bg-gray-50">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredBills.length > 0 ? (
                                    filteredBills.map((bill) => (
                                        <BillRow key={bill.id} bill={bill} />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <Search size={24} className="opacity-20" />
                                                </div>
                                                <p>No bills found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentManagerPage;
