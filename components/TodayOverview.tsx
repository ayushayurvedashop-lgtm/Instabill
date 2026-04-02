import React, { useState, useEffect } from 'react';
import { TrendingUp, Banknote, Smartphone, PieChart, ShoppingCart, Users, Printer, Plus, X, Trash2, MinusCircle } from 'lucide-react';
import { store } from '../store';
import { CashDeduction } from '../types';
import { getLocalDateString } from '../lib/utils';
import DailyStatsModal from './DailyStatsModal';

interface TodayOverviewProps {
    onClose?: () => void;
}

const TodayOverview: React.FC<TodayOverviewProps> = ({ onClose }) => {
    const [showDailyStats, setShowDailyStats] = useState(false);
    const [showAddDeduction, setShowAddDeduction] = useState(false);
    const [deductionName, setDeductionName] = useState('');
    const [deductionAmount, setDeductionAmount] = useState('');
    const [todayDeductions, setTodayDeductions] = useState<CashDeduction[]>([]);

    const [stats, setStats] = useState({
        revenue: 0,
        cashTotal: 0,
        onlineTotal: 0,
        totalSp: 0,
        billCount: 0,
        activeClients: 0,
    });

    useEffect(() => {
        const updateStats = () => {
            const allBills = store.getBills();
            const today = getLocalDateString();

            // Normalize date for comparison
            const normalizeDateStr = (dateStr: string): string => {
                try {
                    if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
                        const [d, m, y] = dateStr.split(/[-/]/);
                        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    return dateStr;
                } catch { return dateStr; }
            };

            const todayBills = allBills.filter(b => normalizeDateStr(b.date) === today);
            const todayRevenue = todayBills.reduce((acc, b) => acc + b.totalAmount, 0);

            // Calculate cash/online with backward compatibility for old bills
            const todayCash = todayBills.reduce((acc, b) => {
                // If cashAmount is explicitly set, use it
                if (b.cashAmount !== undefined && b.cashAmount !== null) {
                    return acc + b.cashAmount;
                }
                // Fallback for old bills: if paymentMethod is Cash, use totalAmount
                if (b.paymentMethod === 'Cash') {
                    return acc + b.totalAmount;
                }
                return acc;
            }, 0);

            const todayOnline = todayBills.reduce((acc, b) => {
                // If onlineAmount is explicitly set, use it
                if (b.onlineAmount !== undefined && b.onlineAmount !== null) {
                    return acc + b.onlineAmount;
                }
                // Fallback for old bills: if paymentMethod is Online, use totalAmount
                if (b.paymentMethod === 'Online') {
                    return acc + b.totalAmount;
                }
                return acc;
            }, 0);
            const todaySp = todayBills.reduce((acc, b) => acc + b.totalSp, 0);
            const uniqueClients = new Set(todayBills.map(b => b.customerName));

            setStats({
                revenue: todayRevenue,
                cashTotal: todayCash,
                onlineTotal: todayOnline,
                totalSp: todaySp,
                billCount: todayBills.length,
                activeClients: uniqueClients.size,
            });

            // Get today's deductions
            setTodayDeductions(store.getTodayCashDeductions());
        };

        updateStats();
        const unsubscribe = store.subscribe(updateStats);
        return () => unsubscribe();
    }, []);

    const totalDeductions = todayDeductions.reduce((sum, d) => sum + d.amount, 0);
    const netCash = stats.cashTotal - totalDeductions; // Cash Collection - Deductions

    const handleAddDeduction = async () => {
        if (!deductionName.trim() || !deductionAmount) return;

        const amount = parseFloat(deductionAmount);
        if (isNaN(amount) || amount <= 0) return;

        const today = new Date();
        await store.addCashDeduction({
            name: deductionName.trim(),
            amount,
            date: getLocalDateString(today),
            time: today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        });

        setDeductionName('');
        setDeductionAmount('');
        setShowAddDeduction(false);
    };

    const handleDeleteDeduction = async (id: string) => {
        if (window.confirm('Delete this deduction?')) {
            await store.deleteCashDeduction(id);
        }
    };

    // Preset names for quick entry
    const presetNames = ['Wife', 'Son', 'Daughter', 'Self', 'Other'];

    return (
        <div className="bg-white rounded-[2rem] p-6 px-4 md:px-8 md:p-8 shadow-sm border border-gray-100 overflow-hidden mb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-[#02575c] leading-tight tracking-tight mb-1 whitespace-nowrap">
                        Today's <span className="text-[#5abc8b]">Overview</span>
                    </h2>
                    <p className="text-[#02575c]/60 text-xs md:text-sm font-semibold">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDailyStats(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E2F5F6] hover:bg-[#c2eff2] text-[#00747B] rounded-full text-xs font-bold transition-all"
                    >
                        <Printer size={14} />
                        <span className="hidden sm:inline">Print Stats</span>
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 mb-4">
                {/* Total Revenue */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <Banknote size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">Revenue</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">₹{stats.revenue.toLocaleString()}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Cash Collection */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <Banknote size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">Cash</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">₹{stats.cashTotal.toLocaleString()}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Online */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <Smartphone size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">Online</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">₹{stats.onlineTotal.toLocaleString()}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Total SP */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <PieChart size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">SP Gen</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">{Math.round(stats.totalSp).toLocaleString()}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Bills */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <ShoppingCart size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">Bills</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">{stats.billCount}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Customers */}
                <div className="bg-white p-2.5 px-3 md:p-4 md:px-5 rounded-[1.25rem] md:rounded-3xl flex items-center justify-between border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transform transition-all hover:scale-[1.02] hover:shadow-md hover:border-gray-200 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1 md:mb-0.5 bg-gray-50 inline-flex px-1.5 py-0.5 rounded-md border border-gray-100/50 max-w-full">
                            <Users size={10} strokeWidth={2.5} className="text-gray-500 shrink-0" />
                            <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider truncate">Clients</p>
                        </div>
                        <p className="text-base md:text-2xl font-extrabold text-gray-800 pl-0.5 truncate">{stats.activeClients}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[0.85rem] bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 shrink-0 ml-1.5 md:ml-2">
                        <TrendingUp size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                </div>
            </div>

                {/* Deductions Section */}
                <div className="border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <MinusCircle size={18} className="text-red-500" />
                            <h3 className="font-bold text-gray-800">Cash Deductions</h3>
                        </div>
                        <button
                            onClick={() => setShowAddDeduction(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-bold transition-all"
                        >
                            <Plus size={14} />
                            Add
                        </button>
                    </div>

                    {/* Add Deduction Form */}
                    {showAddDeduction && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-red-700">New Deduction</span>
                                <button onClick={() => setShowAddDeduction(false)} className="p-1 hover:bg-red-100 rounded">
                                    <X size={16} className="text-red-500" />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={deductionName}
                                    onChange={(e) => setDeductionName(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                />
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        value={deductionAmount}
                                        onChange={(e) => setDeductionAmount(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAddDeduction}
                                disabled={!deductionName.trim() || !deductionAmount}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold rounded-xl transition-all"
                            >
                                Add Deduction
                            </button>
                        </div>
                    )}

                    {/* Deductions List */}
                    {todayDeductions.length > 0 ? (
                        <div className="space-y-2">
                            {todayDeductions.map(d => (
                                <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-red-600">{d.name[0]}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{d.name}</p>
                                            <p className="text-[10px] text-gray-400">{d.time} {d.note && `• ${d.note}`}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-red-600">-₹{d.amount.toLocaleString()}</span>
                                        <button
                                            onClick={() => handleDeleteDeduction(d.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} className="text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Total Deductions */}
                            <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-2">
                                <span className="font-bold text-red-700 text-sm">Total Deductions</span>
                                <span className="font-bold text-red-700">-₹{totalDeductions.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-4">No deductions today</p>
                    )}

                    {/* Net Cash Summary */}
                    <div className="mt-6 bg-[#e4f595] rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <p className="text-[#02575c] text-sm md:text-base font-semibold uppercase tracking-wide">Net Cash in Hand</p>
                                <p className="text-xs text-[#02575c]/70 mt-1 font-medium">Cash Collection - Deductions</p>
                            </div>
                            <p className={`text-4xl font-extrabold ${netCash >= 0 ? 'text-[#02575c]' : 'text-red-500'}`}>
                                ₹{netCash.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>


            {/* Daily Stats Modal */}
            <DailyStatsModal
                isOpen={showDailyStats}
                onClose={() => setShowDailyStats(false)}
                stats={{
                    revenue: stats.revenue,
                    cashTotal: stats.cashTotal,
                    onlineTotal: stats.onlineTotal,
                    totalSp: stats.totalSp,
                    billCount: stats.billCount,
                    activeClients: stats.activeClients,
                    totalDeductions: totalDeductions,
                    netCash: netCash,
                }}
            />
        </div>
    );
};

export default TodayOverview;
