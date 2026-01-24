import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutGrid, Plus, Clock, AlertCircle, CheckCircle2, TrendingUp, Calendar, Search, ChevronDown, Check } from 'lucide-react';
import SPPending from './SPPending';
import SPCompleted from './SPCompleted';
import { Bill } from '../types';
import { store } from '../store';
import { Item, ItemContent, ItemTitle } from './ui/item-menu';
import { DateRangePickerRac } from './ui/date-range-picker-rac';
import { parseDate } from "@internationalized/date";

const SPManager: React.FC = () => {
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

    const filteredBills = useMemo(() => {
        return uniqueBills.filter(bill => {
            if (!startDate && !endDate) return true;
            const billDate = new Date(bill.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);
            if (start && end) return billDate >= start && billDate <= end;
            if (start) return billDate >= start;
            if (end) return billDate <= end;
            return true;
        });
    }, [uniqueBills, startDate, endDate]);

    // Calculate stats - memoized to prevent stale state
    const pendingBillsList = useMemo(() => {
        return filteredBills.filter(b => {
            const remaining = b.totalSp - (b.spUpdatedAmount || 0);
            // Strict Pending: Must have remaining SP AND not be marked as Completed
            return b.totalSp > 0 && remaining > 0.005 && b.spStatus !== 'Completed';
        });
    }, [filteredBills]);

    const completedBillsList = useMemo(() => {
        return filteredBills.filter(b => {
            const remaining = b.totalSp - (b.spUpdatedAmount || 0);
            // Strict Completed: Marked Completed OR no remaining SP
            return b.totalSp > 0 && (b.spStatus === 'Completed' || remaining <= 0.005);
        });
    }, [filteredBills]);

    const pendingCount = pendingBillsList.length;
    const completedCount = completedBillsList.length;

    const totalPendingSP = useMemo(() => {
        return pendingBillsList.reduce((sum, b) => {
            const remaining = b.totalSp - (b.spUpdatedAmount || 0);
            return sum + Math.max(0, remaining);
        }, 0);
    }, [pendingBillsList]);

    const totalUpdatedSP = useMemo(() => {
        return filteredBills.reduce((sum, b) => sum + (b.spUpdatedAmount || 0), 0);
    }, [filteredBills]);

    // Filter Logic
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
        setSearchTerm(''); // Clear search when changing date filter

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
            <main className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">

                {/* Stats & Filters Row */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6 shrink-0">
                    {/* Stats Bar */}
                    <div className="hidden md:flex flex-col sm:flex-row gap-4 sm:gap-8 w-full lg:w-auto bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        {/* Pending */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending</p>
                                <p className="text-lg font-bold text-gray-900">{pendingCount}</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-gray-200"></div>

                        {/* SP Left */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100 text-red-600">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">SP Left</p>
                                <p className="text-lg font-bold text-gray-900">{Math.round(totalPendingSP).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-gray-200"></div>

                        {/* Completed */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Completed</p>
                                <p className="text-lg font-bold text-gray-900">{completedCount}</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-gray-200"></div>

                        {/* SP Updated */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">SP Updated</p>
                                <p className="text-lg font-bold text-gray-900">{Math.round(totalUpdatedSP).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Date Filters & Dropdown - Mobile Optimized */}
                    <div className="flex flex-row items-center gap-2 mb-1 md:mb-6">
                        <div className="flex-1 md:w-[260px] md:flex-none bg-white md:bg-transparent rounded-xl md:rounded-none shadow-sm md:shadow-none border border-gray-200 md:border-none p-1 md:p-0">
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
                            />
                        </div>
                        {/* Dropdown - Now visible on mobile */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-md transition-colors min-w-[100px] justify-between h-9 border border-input"
                            >
                                {filterType === 'Select' ? 'Select' : filterType}
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="flex flex-col gap-1">
                                        <Item onClick={() => handleFilterSelect('Select')}>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'Select' ? 'text-blue-600' : ''}>Select (All)</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'Select' && <Check size={14} className="text-blue-600" />}
                                        </Item>
                                        <div className="h-px bg-gray-100 my-0.5" />
                                        <Item onClick={() => handleFilterSelect('Today')}>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'Today' ? 'text-blue-600' : ''}>Today</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'Today' && <Check size={14} className="text-blue-600" />}
                                        </Item>
                                        <Item onClick={() => handleFilterSelect('This Week')}>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'This Week' ? 'text-blue-600' : ''}>This Week</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'This Week' && <Check size={14} className="text-blue-600" />}
                                        </Item>
                                        <Item onClick={() => handleFilterSelect('This Month')}>
                                            <ItemContent>
                                                <ItemTitle className={filterType === 'This Month' ? 'text-blue-600' : ''}>This Month</ItemTitle>
                                            </ItemContent>
                                            {filterType === 'This Month' && <Check size={14} className="text-blue-600" />}
                                        </Item>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Main Content Area */}
                <div className="flex flex-col flex-1 min-h-0 bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden">
                    {/* Tabs & Search Card (Mobile: Separate Card, Desktop: Header) */}
                    <div className="flex-none p-2 md:p-5 bg-white md:bg-gray-50/50 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-gray-100 md:border-b md:border-gray-200 md:border-t-0 md:border-x-0 mb-1 md:mb-0 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
                        <div className="flex bg-gray-100 md:bg-gray-200 p-1 rounded-xl md:rounded-lg w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex-1 md:flex-none justify-center px-4 py-1.5 rounded-lg md:rounded-md text-sm font-semibold md:font-medium transition-all flex items-center gap-2 ${activeTab === 'pending'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Pending
                                {pendingCount > 0 && (
                                    <span className="bg-orange-100 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`flex-1 md:flex-none justify-center px-4 py-1.5 rounded-lg md:rounded-md text-sm font-semibold md:font-medium transition-all flex items-center gap-2 ${activeTab === 'completed'
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

                        <div className="relative w-full md:w-96 group">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="text-gray-400 group-focus-within:text-[#D9F99D] transition-colors" size={20} />
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 bg-gray-50 md:bg-white border-none md:border md:border-gray-200 rounded-xl md:rounded-lg leading-5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/50 md:focus:ring-[#D9F99D] sm:text-sm transition-shadow"
                                placeholder="Search by name or bill ID..."
                            />
                        </div>
                    </div>

                    {/* Table Header - HIDDEN ON MOBILE */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider flex-none">
                        <div className="col-span-1 text-center">Select</div>
                        <div className="col-span-5 md:col-span-4">Client Details</div>
                        <div className="col-span-3 md:col-span-4">SP Progress</div>
                        <div className="col-span-3 md:col-span-3 text-right pr-4">Action</div>
                    </div>

                    {/* Scrollable List Area */}
                    <div className="divide-y divide-gray-200 overflow-y-auto flex-1 pb-32 md:pb-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400">
                        {activeTab === 'pending' ? (
                            <div key="pending-container">
                                <SPPending bills={pendingBillsList} searchTerm={searchTerm} onUpdate={() => setBills(store.getBills())} />
                            </div>
                        ) : (
                            <div key="completed-container">
                                <SPCompleted bills={completedBillsList} searchTerm={searchTerm} onUpdate={() => setBills(store.getBills())} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SPManager;
