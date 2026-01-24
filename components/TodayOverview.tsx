import React, { useState, useEffect } from 'react';
import { TrendingUp, Banknote, Smartphone, PieChart, ShoppingCart, Users, Printer, Plus, X, Trash2, MinusCircle } from 'lucide-react';
import { store } from '../store';
import { CashDeduction } from '../types';
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
            const today = new Date().toISOString().split('T')[0];

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
            date: today.toISOString().split('T')[0],
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
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-[#12332A] text-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Today's Overview</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDailyStats(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all"
                        >
                            <Printer size={16} />
                            <span className="hidden sm:inline">Print Stats</span>
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Date */}
                <p className="text-white/70 text-sm">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-gradient-to-br from-[#D4F34A]/20 to-[#D4F34A]/5 p-4 rounded-2xl border border-[#D4F34A]/30">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={18} className="text-[#12332A]" />
                            <span className="text-xs font-bold text-gray-500 uppercase">Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-[#12332A]">₹{stats.revenue.toLocaleString()}</p>
                    </div>

                    {/* Cash Collection */}
                    <div className="bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-2xl border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote size={18} className="text-green-600" />
                            <span className="text-xs font-bold text-gray-500 uppercase">Cash</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700">₹{stats.cashTotal.toLocaleString()}</p>
                    </div>

                    {/* Online */}
                    <div className="bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Smartphone size={18} className="text-blue-600" />
                            <span className="text-xs font-bold text-gray-500 uppercase">Online</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">₹{stats.onlineTotal.toLocaleString()}</p>
                    </div>

                    {/* Total SP */}
                    <div className="bg-gradient-to-br from-purple-100 to-purple-50 p-4 rounded-2xl border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                            <PieChart size={18} className="text-purple-600" />
                            <span className="text-xs font-bold text-gray-500 uppercase">SP</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">{Math.round(stats.totalSp).toLocaleString()}</p>
                    </div>

                    {/* Bills */}
                    <div className="bg-gradient-to-br from-orange-100 to-orange-50 p-4 rounded-2xl border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart size={18} className="text-orange-600" />
                            <span className="text-xs font-bold text-gray-500 uppercase">Bills</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-700">{stats.billCount}</p>
                    </div>

                    {/* Customers */}
                    <div className="bg-gradient-to-br from-cyan-100 to-cyan-50 p-4 rounded-2xl border border-cyan-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={18} className="text-cyan-600" />
                            <span className="text-xs font-bold text-gray-500 uppercase">Customers</span>
                        </div>
                        <p className="text-2xl font-bold text-cyan-700">{stats.activeClients}</p>
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
                    <div className="mt-4 bg-[#BCE32D] rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[#12332A] text-xs font-bold uppercase tracking-wide">Net Cash in Hand</p>
                                <p className="text-xs text-[#12332A]/60 mt-0.5">Cash Collection - Deductions</p>
                            </div>
                            <p className={`text-3xl font-bold ${netCash >= 0 ? 'text-[#12332A]' : 'text-red-600'}`}>
                                ₹{netCash.toLocaleString()}
                            </p>
                        </div>
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
