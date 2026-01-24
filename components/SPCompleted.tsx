import React, { useState, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Bill } from '../types';
import { store } from '../store';
import BillDetailModal from './BillDetailModal';

interface SPCompletedProps {
    bills: Bill[];
    searchTerm: string;
    onUpdate: () => void;
}

const SPCompleted: React.FC<SPCompletedProps> = ({ bills, searchTerm, onUpdate }) => {
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

    // Derived selected bill ensures we always have the latest version from props
    const selectedBill = useMemo(() =>
        selectedBillId ? bills.find(b => b.id === selectedBillId) || null : null
        , [bills, selectedBillId]);

    // Helper to get completion date from spHistory (last entry)
    const getCompletionDate = (bill: Bill): Date => {
        if (bill.spHistory && bill.spHistory.length > 0) {
            return new Date(bill.spHistory[bill.spHistory.length - 1].date);
        }
        // Fallback to bill date if no history
        return new Date(bill.date);
    };

    // Bills are already filtered for "Completed" status by parent.
    // Sort by completion date (most recent first)
    const sortedBills = useMemo(() => {
        return [...bills].sort((a, b) => {
            const dateA = getCompletionDate(a).getTime();
            const dateB = getCompletionDate(b).getTime();
            if (dateA !== dateB) return dateB - dateA; // Descending (newest first)
            // Tie-breaker: bill ID
            return (parseInt(b.id.replace(/\D/g, '')) || 0) - (parseInt(a.id.replace(/\D/g, '')) || 0);
        });
    }, [bills]);

    const filteredBills = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedBills;

        // Filter AND sort by relevance (best match first)
        return sortedBills
            .filter(b =>
                b.customerName.toLowerCase().includes(term) ||
                b.id.toLowerCase().includes(term)
            )
            .sort((a, b) => {
                const aName = a.customerName.toLowerCase();
                const bName = b.customerName.toLowerCase();
                const aId = a.id.toLowerCase();
                const bId = b.id.toLowerCase();

                // Priority 1: Exact match on name
                if (aName === term && bName !== term) return -1;
                if (bName === term && aName !== term) return 1;

                // Priority 2: Name starts with search term
                const aStarts = aName.startsWith(term);
                const bStarts = bName.startsWith(term);
                if (aStarts && !bStarts) return -1;
                if (bStarts && !aStarts) return 1;

                // Priority 3: ID match
                if (aId.includes(term) && !bId.includes(term)) return -1;
                if (bId.includes(term) && !aId.includes(term)) return 1;

                // Priority 4: Earlier position of match in name
                const aIndex = aName.indexOf(term);
                const bIndex = bName.indexOf(term);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

                return 0;
            });
    }, [sortedBills, searchTerm]);

    const handleUndo = async (e: React.MouseEvent, bill: Bill) => {
        e.stopPropagation();
        if (!confirm("Move back to Pending? This will clear all SP history.")) return;
        // Reset SP and clear history completely
        await store.updateBill({ ...bill, spUpdatedAmount: 0, spStatus: 'Pending', spHistory: [] });
        onUpdate();
    };

    // Format date for display
    const formatCompletionDate = (bill: Bill): string => {
        // If we have history, show the date
        if (bill.spHistory && bill.spHistory.length > 0) {
            const date = getCompletionDate(bill);
            return `Completed ${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
        // If no history (legacy/bug), don't show a misleading date, just "Completed"
        return "Completed";
    };

    return (
        <>
            {filteredBills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <p>No completed updates found.</p>
                </div>
            ) : (
                (Object.entries(filteredBills.reduce((groups, bill) => {
                    const date = getCompletionDate(bill);
                    const today = new Date();
                    const yesterday = new Date();
                    yesterday.setDate(today.getDate() - 1);

                    let label = date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

                    if (date.toDateString() === today.toDateString()) label = "Today";
                    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";

                    if (!groups[label]) groups[label] = [];
                    groups[label].push(bill);
                    return groups;
                }, {} as Record<string, Bill[]>)) as [string, Bill[]][]).map(([dateLabel, groupBills]) => (
                    <div key={dateLabel}>
                        {/* Date Header: Text + Line */}
                        <div className="flex items-center gap-3 mb-1 px-1 mt-1 first:mt-0 md:mt-0 sticky top-0 bg-[#F3F4F6] z-10 py-2 md:static md:bg-transparent md:py-0 md:bg-gray-100 md:px-6 md:text-xs md:font-bold md:text-gray-500 md:uppercase md:tracking-wider">
                            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase md:hidden">{dateLabel}</span>
                            <div className="flex-1 h-px bg-gray-200 md:hidden"></div>
                            {/* Desktop Header content */}
                            <span className="hidden md:block">{dateLabel}</span>
                        </div>

                        {groupBills.map((bill) => (
                            <div key={bill.id} className="relative bg-white rounded-xl p-3 border border-gray-100 shadow-sm mb-2 hover:shadow-md transition-shadow md:grid md:grid-cols-12 md:gap-4 md:px-6 md:py-4 md:shadow-none md:mb-0 md:border-0 md:border-b md:border-gray-100 md:rounded-none md:hover:bg-gray-50 group cursor-pointer" onClick={() => setSelectedBillId(bill.id)}>
                                {/* Mobile: Top Row (Indicator + Details + Price) */}
                                <div className="flex items-start justify-between mb-2 md:contents">

                                    {/* Left Side: Indicator + Info */}
                                    <div className="flex gap-3 md:contents">
                                        {/* Green Dot Indicator (Mobile: Square Border context / Desktop: Col 1) */}
                                        <div className="md:col-span-1 md:flex md:justify-center mt-0.5 md:mt-0">
                                            <div className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-50 flex items-center justify-center md:border-gray-200 md:bg-gray-50">
                                                <span className="block w-2 h-2 bg-green-500 rounded-full"></span>
                                            </div>
                                        </div>

                                        {/* Details (Name, Badge, Date) */}
                                        <div className="md:col-span-4 md:pl-0">
                                            <h3 className="font-bold text-gray-800 leading-tight md:text-gray-900 md:text-base md:font-semibold md:truncate md:max-w-[200px]">
                                                {bill.customerName}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded md:text-xs">
                                                    #{bill.id}
                                                </span>
                                                <div className="flex items-center gap-2 md:hidden">
                                                    <span className="text-[10px] text-gray-400">{formatCompletionDate(bill)}</span>
                                                </div>
                                                {/* Desktop Date + Price Row */}
                                                <div className="hidden md:flex items-center gap-2 mt-1 text-sm text-gray-500">
                                                    <span className="text-emerald-600 font-medium">{formatCompletionDate(bill)}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span className="font-medium">₹{bill.totalAmount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Price (Mobile Only) */}
                                    <div className="text-right md:hidden">
                                        <div className="font-bold text-gray-900">₹{bill.totalAmount.toLocaleString()}</div>
                                    </div>
                                </div>

                                {/* Mobile: Bottom Row (Progress + Button) */}
                                <div className="flex items-center gap-3 md:contents">

                                    {/* SP Progress (Mobile: Flex-1 / Desktop: Col 4) */}
                                    <div className="flex-1 md:col-span-4">
                                        <div className="flex justify-between items-center text-[10px] mb-1 md:text-xs md:mb-1.5">
                                            <span className="font-bold text-green-600">
                                                Completed
                                            </span>
                                            <span className="text-gray-400 md:uppercase md:font-semibold">
                                                {bill.totalSp} TOTAL
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden md:bg-gray-200">
                                            <div className="bg-green-500 h-full w-full rounded-full"></div>
                                        </div>
                                    </div>

                                    {/* Action Button (Mobile: Right / Desktop: Col 3 Right) */}
                                    <div className="shrink-0 md:col-span-3 md:flex md:justify-end">
                                        <button
                                            onClick={(e) => handleUndo(e, bill)}
                                            className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold md:text-sm md:font-medium md:border-transparent transition-colors"
                                        >
                                            <RotateCcw size={14} />
                                            Undo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}

            {selectedBill && (
                <BillDetailModal
                    bill={selectedBill}
                    onClose={() => setSelectedBillId(null)}
                    onEdit={() => { }}
                    isSpManagerContext={true}
                />
            )}
        </>
    );
};

export default SPCompleted;
