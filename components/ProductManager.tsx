import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from "@/lib/utils";
import { LayoutGrid, Plus, Clock, AlertCircle, CheckCircle2, TrendingUp, Calendar, Search, Check, Package, History } from 'lucide-react';
import ProductPending from './ProductPending';
import ProductCompleted from './ProductCompleted';
import { Bill, ProductStatus } from '../types';
import { store } from '../store';
import { Item, ItemContent, ItemTitle } from './ui/item-menu';
import { DateRangePickerRac } from './ui/date-range-picker-rac';
import { parseDate } from "@internationalized/date";

const ProductManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [bills, setBills] = useState<Bill[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Date range filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [filterType, setFilterType] = useState<'Select' | 'Today' | 'This Week' | 'This Month'>('Select');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchBills = () => setBills(store.getBills());
        fetchBills();
        const unsubscribe = store.subscribe(fetchBills);

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

    // First, deduplicate bills by ID to prevent duplicate rendering
    const uniqueBills = useMemo(() => {
        const seen = new Set<string>();
        return bills.filter(bill => {
            if (seen.has(bill.id)) return false;
            seen.add(bill.id);
            return true;
        });
    }, [bills]);

    const searchFilteredBills = useMemo(() => {
        return uniqueBills.filter(bill => {
            if (searchTerm) {
                const lowerSearch = searchTerm.toLowerCase();
                const matches = bill.customerName.toLowerCase().includes(lowerSearch) ||
                    bill.id.toLowerCase().includes(lowerSearch);
                if (!matches) return false;
            }
            return true;
        });
    }, [uniqueBills, searchTerm]);

    const getCompletionTime = (bill: Bill) => {
        let latestTime = new Date(bill.date).getTime(); // Default to bill date
        bill.items.forEach(item => {
            if (item.handoverLog) {
                item.handoverLog.forEach(log => {
                    const logTime = new Date(log.date).getTime();
                    if (logTime > latestTime) latestTime = logTime;
                });
            }
        });
        return latestTime;
    };

    // Calculate stats - memoized to prevent stale state
    const pendingBillsList = useMemo(() => {
        const pending = searchFilteredBills.filter(b => b.items.some(i => i.status === ProductStatus.PENDING));

        if (!startDate && !endDate) return pending;

        return pending.filter(bill => {
            const billDate = new Date(bill.date);
            billDate.setHours(12, 0, 0, 0);

            const start = startDate ? new Date(startDate) : null;
            if (start) start.setHours(0, 0, 0, 0);

            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);

            if (start && end) return billDate >= start && billDate <= end;
            if (start) return billDate >= start;
            if (end) return billDate <= end;
            return true;
        });
    }, [searchFilteredBills, startDate, endDate]);

    const completedBillsList = useMemo(() => {
        const completed = searchFilteredBills.filter(b => {
            const hasPendingItems = b.items.some(i => i.status === ProductStatus.PENDING);
            const hasHandoverHistory = b.items.some(i => i.handoverLog && i.handoverLog.length > 0);
            return !hasPendingItems && b.items.length > 0 && hasHandoverHistory;
        });

        const filtered = (!startDate && !endDate) ? completed : completed.filter(bill => {
            const completionEpoch = getCompletionTime(bill);
            const compDate = new Date(completionEpoch);

            const start = startDate ? new Date(startDate) : null;
            if (start) start.setHours(0, 0, 0, 0);

            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);

            if (start && end) return compDate >= start && compDate <= end;
            if (start) return compDate >= start;
            if (end) return compDate <= end;
            return true;
        });

        return filtered.sort((a, b) => getCompletionTime(b) - getCompletionTime(a));
    }, [searchFilteredBills, startDate, endDate]);

    // Global Stats
    const totalPendingItems = useMemo(() => {
        return uniqueBills.reduce((sum, b) => { // Use uniqueBills for global stats, not filtered
            return sum + b.items.reduce((itemSum, item) => {
                if (item.status === ProductStatus.PENDING) {
                    return itemSum + (item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity);
                }
                return itemSum;
            }, 0);
        }, 0);
    }, [uniqueBills]);

    const totalGivenItems = useMemo(() => {
        return uniqueBills.reduce((sum, b) => {
            return sum + b.items.reduce((itemSum, item) => {
                const originalQty = item.quantity;
                const pending = item.pendingQuantity !== undefined ? item.pendingQuantity : (item.status === ProductStatus.PENDING ? item.quantity : 0);
                return itemSum + (originalQty - pending);
            }, 0);
        }, 0);
    }, [uniqueBills]);

    // Filtered Counts
    const pendingCount = pendingBillsList.length;
    const completedCount = completedBillsList.length;

    // Helper to format date as YYYY-MM-DD in LOCAL time
    const toLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Filter Logic
    const handleFilterSelect = (type: 'Select' | 'Today' | 'This Week' | 'This Month') => {
        setFilterType(type);
        setIsDropdownOpen(false);
        // setSearchTerm(''); // Don't clear search

        const today = new Date(); // Local time check

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
            // Cycle: Thursday to Next Wednesday
            // If today is Thu, Fri, Sat, Sun, Mon, Tue, Wed -> Show the CURRENT cycle
            // Logic: Find the most recent Thursday (start) and the next Wednesday (end)

            const currentDay = today.getDay(); // 0-6 Sun-Sat local
            const diffToThursday = (currentDay - 4 + 7) % 7; // How many days passed since Thursday

            const start = new Date(today);
            start.setDate(today.getDate() - diffToThursday); // Move back to most recent Thursday

            // End date is capped at Today
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

    return (
        <div className="flex flex-col h-full bg-[#F3F4F6] text-gray-800 font-sans overflow-hidden">
            <main className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-2 pb-0 md:py-6">

                {/* Stats & Filters Row */}
                <div className="flex flex-col lg:flex-row items-center justify-between gap-3 md:gap-4 mb-3 md:mb-6 shrink-0">
                    {/* Stats Bar */}
                    <div className="hidden md:flex flex-col sm:flex-row gap-4 sm:gap-8 w-full lg:w-auto bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        {/* Pending Items */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                                <Package size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending Items</p>
                                <p className="text-lg font-bold text-gray-900">{totalPendingItems}</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-gray-200"></div>

                        {/* Delivered Items */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Delivered Items</p>
                                <p className="text-lg font-bold text-gray-900">{totalGivenItems}</p>
                            </div>
                        </div>
                    </div>

                    {/* Date Filters & Dropdown - Mobile Optimized */}
                    <div className="flex flex-row items-center gap-2 relative w-full md:w-auto justify-center md:justify-end" ref={dropdownRef}>
                        <div className="w-full md:w-[320px] bg-white rounded-full shadow-sm md:shadow-none md:rounded-xl">
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
                                            <div className={cn("p-1.5 rounded-lg", filterType === 'Today' ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500")}>
                                                <Clock size={14} />
                                            </div>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'Today' ? 'text-emerald-600' : ''}>Today</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'Today' && <Check size={14} className="text-emerald-600 ml-auto" />}
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
                                                <Package size={14} />
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

                {/* Main Content Area */}
                <div className="flex flex-col flex-1 min-h-0 bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden">

                    {/* Mobile Only: Underline Tabs */}
                    <div className="flex md:hidden w-full border-b border-gray-200 mb-4 px-1">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex-1 justify-center pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'pending'
                                ? 'text-[#00d084] border-b-2 border-[#00d084]'
                                : 'text-gray-500 border-b-2 border-transparent'
                                }`}
                        >
                            Pending
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-orange-50 text-orange-400'}`}>
                                {pendingCount}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`flex-1 justify-center pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'completed'
                                ? 'text-[#00d084] border-b-2 border-[#00d084]'
                                : 'text-gray-500 border-b-2 border-transparent'
                                }`}
                        >
                            Completed
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500`}>
                                {completedCount}
                            </span>
                        </button>
                    </div>

                    {/* Desktop Tabs & Mobile Search */}
                    <div className="flex-none px-1 md:px-5 mb-4 md:mb-0 bg-transparent md:bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">

                        {/* Desktop Only Tabs */}
                        <div className="hidden md:flex bg-gray-200 p-1 rounded-lg w-auto">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex-none justify-center px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'pending'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Pending
                                {pendingCount > 0 && (
                                    <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`flex-none justify-center px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'completed'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Completed
                                {completedCount > 0 && (
                                    <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded font-bold">
                                        {completedCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-96 group">
                            <span className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Search className="text-gray-400 group-focus-within:text-[#00d084] transition-colors" size={18} />
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-12 pr-5 py-3 md:py-2 bg-white border-0 md:border md:border-gray-200 rounded-full md:rounded-lg shadow-sm md:shadow-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00d084]/50 md:focus:ring-green-400 text-sm transition-shadow"
                                placeholder="Search by name or bill ID..."
                            />
                        </div>
                    </div>

                    {/* Table Header - HIDDEN ON MOBILE */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-y border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider flex-none">
                        <div className="col-span-1 text-center">Select</div>
                        <div className="col-span-4">Client Details</div>
                        <div className="col-span-4">Delivery Progress</div>
                        <div className="col-span-3 text-right pr-4">Action</div>
                    </div>

                    {/* Scrollable List Area */}
                    <div className="overflow-y-auto flex-1 px-0 md:px-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
                        {activeTab === 'pending' ? (
                            <div key="pending-container" className="md:divide-y md:divide-gray-200 pb-28 md:pb-0">
                                <ProductPending bills={pendingBillsList} searchTerm={searchTerm} />
                            </div>
                        ) : (
                            <div key="completed-container" className="md:divide-y md:divide-gray-200 pb-28 md:pb-0">
                                <ProductCompleted bills={completedBillsList} searchTerm={searchTerm} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ProductManager;
