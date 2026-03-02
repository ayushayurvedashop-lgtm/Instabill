import React, { useState, useEffect } from 'react';
import { Search, FileText, Calendar, Clock, User, IndianRupee, X, Image as ImageIcon, Loader, AlertCircle } from 'lucide-react';
import { store } from '../store';
import { Bill } from '../types';
import { storage, db } from '../firebaseConfig';
import { ref, getBlob } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import BillDetailModal from './BillDetailModal';

// Helper component to load image securely via Blob or Firestore
interface BillHistoryProps {
    onEditBill?: (bill: Bill) => void;
}

const BillHistory: React.FC<BillHistoryProps> = ({ onEditBill }) => {
    const [bills, setBills] = useState<Bill[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

    useEffect(() => {
        const updateBills = () => {
            const allBills = store.getBills();
            // Sort by date/time descending (newest first)
            // Assuming id has timestamp or we use date/time fields
            // For now, reverse the array as typically new bills are added to end? 
            // Or better, sort by date and time if available.
            // Since IDs are timestamp based (INV-YYYY-timestamp), we can sort by ID descending.
            const sortedBills = [...allBills].sort((a, b) => {
                // Robust Date Parser (Date Only)
                const getDateTimestamp = (dateStr: string) => {
                    try {
                        let datePart = dateStr;
                        // Normalize DD-MM-YYYY to YYYY-MM-DD
                        if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
                            const [d, m, y] = dateStr.split(/[-/]/);
                            datePart = `${y}-${m}-${d}`;
                        }
                        const d = new Date(datePart);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    } catch { return 0; }
                };

                const dateA = getDateTimestamp(a.date);
                const dateB = getDateTimestamp(b.date);

                // 1. Primary Sort: Date Descending
                if (dateA !== dateB) return dateB - dateA;

                // 2. Secondary Sort (Same Date Strategy)
                const isHashA = a.id.startsWith('#');
                const isHashB = b.id.startsWith('#');

                // Extract numeric ID helper
                const extractNum = (id: string) => {
                    const match = id.match(/(\d+)/);
                    return match ? parseInt(match[0]) : 0;
                };

                // If both are '#' IDs on the same date, Strict Numeric Sort Descending
                if (isHashA && isHashB) {
                    return extractNum(b.id) - extractNum(a.id);
                }

                // 3. Fallback: Time Sort
                const getTimeMinutes = (timeStr: string) => {
                    try {
                        let hour = 0, minute = 0;
                        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                        if (timeMatch) {
                            let [_, h, m, amp] = timeMatch;
                            hour = parseInt(h);
                            minute = parseInt(m);
                            if (amp) {
                                if (amp.toUpperCase() === 'PM' && hour < 12) hour += 12;
                                if (amp.toUpperCase() === 'AM' && hour === 12) hour = 0;
                            }
                        }
                        return hour * 60 + minute;
                    } catch { return 0; }
                };

                const timeA = getTimeMinutes(a.time);
                const timeB = getTimeMinutes(b.time);

                if (timeA !== timeB) return timeB - timeA;

                // 4. Final Tie-breaker: ID Sort
                if (isHashA && !isHashB) return -1;
                if (!isHashA && isHashB) return 1;

                return extractNum(b.id) - extractNum(a.id);
            });
            setBills(sortedBills);
        };

        updateBills();
        const unsubscribe = store.subscribe(updateBills);
        return () => unsubscribe();
    }, []);

    const filteredBills = bills.filter(bill =>
        bill.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0 animate-slide-down">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by customer or bill ID..."
                        className="w-full pl-12 pr-4 py-3 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Bills List */}
            <div className="flex-1 bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col animate-slide-up opacity-0 [animation-delay:100ms]">
                {/* Desktop Table View - Hidden on Mobile */}
                <div className="hidden md:block overflow-y-auto flex-1 p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider rounded-tl-xl">Bill ID</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date & Time</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center rounded-tr-xl">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredBills.length > 0 ? (
                                filteredBills.map((bill) => (
                                    <tr
                                        key={bill.id}
                                        onClick={() => setSelectedBill(bill)}
                                        className="hover:bg-gray-50 transition-all group cursor-pointer active:scale-[0.99]"
                                    >
                                        <td className="p-4 font-bold text-[#111617]">{bill.id}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-[#daf4d7] flex items-center justify-center text-[#111617] font-bold text-xs ring-2 ring-transparent group-hover:ring-[#88de7d] transition-all">
                                                    {bill.customerName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-[#111617]">{bill.customerName}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500 text-sm">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-[#88de7d]" /> {bill.date}</span>
                                                {bill.time && <span className="flex items-center gap-1.5 text-xs text-gray-400"><Clock size={13} /> {bill.time}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-[#111617] text-lg">₹{bill.totalAmount}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${bill.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {bill.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        No bills found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View - Visible on Mobile Only */}
                <div className="md:hidden overflow-y-auto flex-1 p-4 space-y-3">
                    {filteredBills.length > 0 ? (
                        filteredBills.map((bill) => (
                            <div
                                key={bill.id}
                                onClick={() => setSelectedBill(bill)}
                                className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group"
                            >
                                {/* Header Row */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#daf4d7] flex items-center justify-center text-[#111617] font-bold text-sm ring-2 ring-transparent group-hover:ring-[#88de7d] transition-all">
                                            {bill.customerName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#111617] text-base leading-tight">{bill.customerName}</p>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5">{bill.id}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${bill.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                        {bill.isPaid ? 'Paid' : 'Unpaid'}
                                    </span>
                                </div>

                                {/* Details Row */}
                                <div className="flex items-end justify-between pt-2 border-t border-gray-50">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
                                            <Calendar size={14} className="text-[#88de7d]" /> {bill.date}
                                        </span>
                                        {bill.time && (
                                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Clock size={14} /> {bill.time}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-[#111617]">₹{bill.totalAmount}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-400">
                            No bills found matching your search.
                        </div>
                    )}
                </div>
            </div>

            {/* Bill Details Modal */}
            <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} onEdit={onEditBill} />
        </div>
    );
};

export default BillHistory;
