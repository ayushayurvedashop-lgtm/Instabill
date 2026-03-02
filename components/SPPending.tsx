import React, { useState, useMemo } from 'react';
import { Pencil, X, ArrowRight } from 'lucide-react';
import { Bill } from '../types';
import { store } from '../store';
import BillDetailModal from './BillDetailModal';

interface SPPendingProps {
    bills: Bill[];
    searchTerm: string;
    onUpdate: () => void;
    selectedBillIds: Set<string>;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
    handleBulkComplete: () => Promise<void>;
    isBulkCompleting: boolean;
}

const SPPending: React.FC<SPPendingProps> = ({
    bills,
    searchTerm,
    onUpdate,
    selectedBillIds,
    toggleSelection,
    clearSelection,
    handleBulkComplete,
    isBulkCompleting
}) => {

    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);


    // Derived selected bill ensures we always have the latest version from props
    const selectedBill = useMemo(() =>
        selectedBillId ? bills.find(b => b.id === selectedBillId) || null : null
        , [bills, selectedBillId]);

    // Bills are already filtered for "Pending" status by parent.
    // We only need to sort and search.
    const sortedBills = useMemo(() => {
        return [...bills].sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
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

    // Simplified selection logic using props


    return (
        <>
            {filteredBills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <p>No pending bills found.</p>
                </div>
            ) : (
                (Object.entries(filteredBills.reduce((groups, bill) => {
                    const date = new Date(bill.date);
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
                            {/* Desktop Header content (hidden on mobile via CSS rules above/below or existing logic) */}
                            <span className="hidden md:block">{dateLabel}</span>
                        </div>

                        {groupBills.map((bill) => {
                            const spUpdated = bill.spUpdatedAmount || 0;
                            const spRemaining = Math.max(0, Math.round((bill.totalSp - spUpdated) * 1000) / 1000);
                            const isSelected = selectedBillIds.has(bill.id);

                            // Visualize "Remaining" as valid SP work needed
                            const remainingPercent = bill.totalSp > 0 ? (spRemaining / bill.totalSp) * 100 : 0;

                            return (
                                <div key={bill.id} className="relative bg-white p-4 border border-gray-100 shadow-sm rounded-2xl mb-3 hover:shadow-md transition-shadow md:grid md:grid-cols-12 md:gap-4 md:px-6 md:py-4 md:shadow-none md:mb-0 md:border-0 md:border-b md:border-gray-100 md:rounded-none md:hover:bg-gray-50 group">
                                    {/* Mobile: Top Row (Checkbox + Details + Price) */}
                                    <div className="flex items-start justify-between mb-4 md:contents">

                                        {/* Left Side: Checkbox + Info */}
                                        <div className="flex gap-3 md:contents">
                                            {/* Checkbox (Mobile: Square Border / Desktop: Col 1) */}
                                            <div className="md:col-span-1 md:flex md:justify-center mt-0.5 md:mt-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(bill.id)}
                                                    className="w-5 h-5 rounded border-2 border-gray-300 text-[#141e26] focus:ring-[#141e26] cursor-pointer accent-[#141e26]"
                                                />
                                            </div>

                                            {/* Details (Name, Badge, Date) */}
                                            <div className="md:col-span-4 md:pl-0">
                                                <h3 className="text-[15px] font-bold text-gray-900 leading-tight md:text-base md:font-semibold md:truncate md:max-w-[200px]" title={bill.customerName}>
                                                    {bill.customerName}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1.5 md:mt-1">
                                                    <span className="text-[11px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded md:text-xs">
                                                        #{bill.id}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-gray-500 md:text-sm md:text-gray-500">
                                                        {bill.date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Price (Mobile Only - Desktop has own col) */}
                                        <div className="text-right md:hidden">
                                            <div className="font-bold text-gray-900 text-[15px]">₹{bill.totalAmount.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    {/* Desktop Price Col (Hidden Mobile) */}
                                    {/* We need to insert the desktop price into the grid flow. In previous grid it was part of "Client Details". 
                                        Here we have 12 cols. 
                                        1: Select
                                        4: Client Details (Name/ID/Date/Price)
                                        4: Progress
                                        3: Action
                                        
                                        Wait, in previous layout Price was under Client Details.
                                        So "md:col-span-4" covers visual space. The price needs to be part of that block for desktop.
                                        I should re-add the hidden desktop price in the Details block above? 
                                        Actually, my previous code had Price inside the Details block for desktop.
                                        Let's inject it back into the Details block above with `hidden md:block`.
                                    */}

                                    {/* Mobile: Bottom Row (Progress + Button) */}
                                    <div className="flex items-center gap-3 md:contents">

                                        {/* SP Progress (Mobile: Flex-1 / Desktop: Col 4) */}
                                        <div className="flex-1 md:col-span-4">
                                            <div className="flex justify-between items-center text-[13px] font-semibold mb-1.5 md:text-xs md:mb-1.5">
                                                <span className="font-medium text-gray-500 md:text-gray-700">
                                                    SP Status
                                                </span>
                                                <span>
                                                    <span className="text-orange-500">{Math.round(remainingPercent)}% left</span> <span className="text-gray-400 md:uppercase md:font-semibold">({spRemaining} / {bill.totalSp})</span>
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden md:bg-gray-200">
                                                <div
                                                    className={`h-full rounded-full ${remainingPercent < 30 ? 'bg-success' : remainingPercent < 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${remainingPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Action Button (Mobile: Right / Desktop: Col 3 Right) */}
                                        <div className="shrink-0 md:col-span-3 md:flex md:justify-end">
                                            <button
                                                onClick={() => setSelectedBillId(bill.id)}
                                                className="bg-[#141e26] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 md:text-sm md:font-medium md:bg-gray-900 md:hover:bg-gray-700 md:px-4 md:py-2"
                                            >
                                                <Pencil size={14} className="md:w-3.5 md:h-3.5" />
                                                Update
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))
            )}

            {selectedBillIds.size > 0 && (
                <div className="fixed bottom-24 left-0 right-0 mx-auto w-fit z-50 flex items-center justify-center gap-3 animate-slide-up max-w-[90vw]">
                    {/* Close/Deselect Button */}
                    <button
                        onClick={clearSelection}
                        className="bg-white text-red-500 w-14 h-14 rounded-full shadow-xl hover:bg-gray-50 border border-gray-100 transition-transform hover:scale-105 flex items-center justify-center shrink-0"
                    >
                        <X size={24} />
                    </button>



                    <button
                        onClick={handleBulkComplete}
                        disabled={isBulkCompleting}
                        className="relative group bg-success hover:bg-success-hover text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-success/30 hover:shadow-success/50 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-3 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {isBulkCompleting ? 'Updating...' : 'Mark as Completed'}
                            {!isBulkCompleting && (
                                <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-medium">
                                    {selectedBillIds.size} Selected
                                </span>
                            )}
                        </span>
                        {!isBulkCompleting && <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />}

                        {/* Shimmer Effect */}
                        {!isBulkCompleting && <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>}
                    </button>
                </div>
            )}

            {selectedBill && (
                <BillDetailModal
                    bill={selectedBill}
                    onClose={() => { setSelectedBillId(null); onUpdate(); }}
                    onEdit={() => { }}
                    isSpManagerContext={true}
                />
            )}
        </>
    );
};

export default SPPending;
