import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Package, CheckCircle2, AlertCircle, Loader, Printer, Edit, Trash2, Image as ImageIcon, History, ChevronLeft } from 'lucide-react';
import { store } from '../store';
import { Bill } from '../types';
import { db, storage } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getBlob } from 'firebase/storage';
import { InvoiceModal } from './InvoiceModal';

// Helper component to load image securely
const SnapshotImage = ({ url, billId, hasSnapshot }: { url?: string, billId?: string, hasSnapshot?: boolean }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showFullscreen, setShowFullscreen] = useState(false);

    useEffect(() => {
        const loadImage = async () => {
            try {
                setLoading(true);
                setError(false);
                if (hasSnapshot && billId) {
                    try {
                        const docRef = doc(db, 'bill_snapshots', billId);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists() && docSnap.data()?.image) {
                            setImageUrl(docSnap.data().image);
                            setLoading(false);
                            return;
                        }
                    } catch (e) { console.error(e); }
                }
                if (url) {
                    const imageRef = ref(storage, url);
                    const blob = await getBlob(imageRef);
                    setImageUrl(URL.createObjectURL(blob));
                }
            } catch (err) {
                console.error(err);
                if (url) { setImageUrl(url); setError(true); }
            } finally { setLoading(false); }
        };
        loadImage();
        return () => { if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl); };
    }, [url, billId, hasSnapshot]);

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader size={24} className="animate-spin" /></div>;
    if (error) return <div className="flex flex-col items-center justify-center h-full text-red-400"><AlertCircle size={24} /><span className="text-xs mt-2">Failed to load</span></div>;
    if (!imageUrl) return <div className="flex flex-col items-center justify-center h-full text-gray-300"><ImageIcon size={32} /><span className="text-xs mt-2">No snapshot</span></div>;

    return (
        <>
            {showFullscreen && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowFullscreen(false)}>
                    <button onClick={() => setShowFullscreen(false)} className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center"><X size={24} /></button>
                    <img src={imageUrl} alt="Snapshot" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}
            <img src={imageUrl} alt="Snapshot" className="w-full h-full object-cover cursor-pointer" onClick={() => setShowFullscreen(true)} />
        </>
    );
};

interface BillDetailModalProps {
    bill: Bill | null;
    onClose: () => void;
    onEdit?: (bill: Bill) => void;
    isSpManagerContext?: boolean;
}

const BillDetailModal: React.FC<BillDetailModalProps> = ({ bill, onClose, onEdit, isSpManagerContext }) => {
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [updateSpAmount, setUpdateSpAmount] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [manualInputValue, setManualInputValue] = useState<string>('');
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [viewMode, setViewMode] = useState<'update' | 'history'>('update');

    // For Circular Progress
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        if (bill) {
            const remaining = Math.max(0, Math.round((bill.totalSp - (bill.spUpdatedAmount || 0)) * 1000) / 1000);
            setUpdateSpAmount(remaining); // Default to full remaining
            setManualInputValue(formatSp(remaining));
            setViewMode('update');
        }
    }, [bill]);

    // Track Ctrl key for slider snap behavior
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    if (!bill) return null;

    const spUpdated = bill.spUpdatedAmount || 0;
    const spRemaining = Math.max(0, Math.round((bill.totalSp - spUpdated) * 1000) / 1000);
    const isSpPending = spRemaining > 0;
    const showSpUpdater = isSpManagerContext === true;

    // Progress for the ring (based on Already Updated vs Total)
    const progressPercent = bill.totalSp > 0 ? (spUpdated / bill.totalSp) * 100 : 0;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    const handleUpdateSP = async () => {
        if (updateSpAmount <= 0) return;
        setIsUpdating(true);
        try {
            const newUpdated = Math.round((spUpdated + updateSpAmount) * 1000) / 1000;

            // Create History Entry
            const historyEntry = {
                date: new Date().toISOString(),
                amount: updateSpAmount, // The amount ADDED in this transaction
                total: newUpdated
            };
            const newHistory = [...(bill.spHistory || []), historyEntry];

            await store.updateBill({
                ...bill,
                spUpdatedAmount: newUpdated,
                spStatus: newUpdated >= bill.totalSp ? 'Completed' : 'Pending',
                spHistory: newHistory
            });
            onClose();
        } catch (e) {
            alert("Failed to update. Please try again.");
        } finally { setIsUpdating(false); }
    };

    const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseFloat(e.target.value);
        if (isCtrlPressed) {
            // Fine-tune with 0.05
            const step = 0.05;
            val = Math.round(val / step) * step;
        } else {
            // Default step 1
            val = Math.round(val);
        }

        // Ensure within bounds
        if (val > spRemaining) val = spRemaining;

        const finalVal = Math.round(val * 1000) / 1000;

        setUpdateSpAmount(finalVal);
        setManualInputValue(formatSp(finalVal));
    };

    const handleQuickAdd = (amount: number) => {
        // Snap to value (not add), but cap at remaining SP
        let newVal = Math.min(amount, spRemaining);
        newVal = Math.round(newVal * 1000) / 1000;
        setUpdateSpAmount(newVal);
        setManualInputValue(formatSp(newVal));
    };

    const handleSelectAll = () => {
        setUpdateSpAmount(spRemaining);
        setManualInputValue(formatSp(spRemaining));
    };

    const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setManualInputValue(e.target.value);
    };

    const handleManualInputBlur = () => {
        let val = parseFloat(manualInputValue);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > spRemaining) val = spRemaining;
        val = Math.round(val * 1000) / 1000;
        setUpdateSpAmount(val);
        setManualInputValue(formatSp(val));
    };

    const formatSp = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

    // Slider Background Gradient Calculation
    const sliderPercent = spRemaining > 0 ? (updateSpAmount / spRemaining) * 100 : 0;

    return (
        <>
            {showInvoiceModal && <InvoiceModal bill={bill} onClose={() => setShowInvoiceModal(false)} onEdit={() => { setShowInvoiceModal(false); onEdit?.(bill); onClose(); }} />}

            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-[Plus_Jakarta_Sans,sans-serif]" style={{ display: showInvoiceModal ? 'none' : 'flex' }}>

                {/* Modal Container */}
                <div className="bg-white rounded-3xl shadow-2xl w-[90vw] md:w-full max-w-[560px] relative overflow-hidden flex flex-col max-h-[75vh] md:max-h-[90vh] mb-24 md:mb-0">

                    {/* Close Button */}
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors z-10">
                        <X size={24} />
                    </button>

                    {showSpUpdater && isSpPending ? (
                        /* V3 SP UPDATE UI */
                        <>
                            {/* Header Section */}
                            <div className="p-5 pb-3 md:p-8 md:pb-4 flex items-start justify-between border-b border-gray-100">
                                <div className="flex-1 pr-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${bill.isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                                            {bill.isPaid ? <CheckCircle2 size={24} /> : '!'}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900 leading-tight">{bill.customerName}</h2>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">#{bill.id} · {bill.date}</p>
                                        </div>
                                    </div>

                                    {viewMode === 'update' ? (
                                        <p className="text-sm text-gray-500 mt-4 leading-relaxed">
                                            Update the SP (Service Points) progress for this client.
                                            <button
                                                onClick={() => setViewMode('history')}
                                                className="text-emerald-600 font-semibold cursor-pointer hover:underline ml-1 focus:outline-none"
                                            >
                                                View History
                                            </button>
                                        </p>
                                    ) : (
                                        <button
                                            onClick={() => setViewMode('update')}
                                            className="text-sm text-gray-500 mt-4 leading-relaxed flex items-center gap-1 hover:text-gray-900 font-medium"
                                        >
                                            <ChevronLeft size={16} /> Back to Update
                                        </button>
                                    )}
                                </div>
                                <div className="relative flex flex-col items-center justify-center">
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                            <circle className="text-gray-100 stroke-current" cx="50" cy="50" fill="transparent" r={radius} strokeWidth="8"></circle>
                                            <circle
                                                className="text-emerald-500 stroke-current transition-all duration-300 ease-out"
                                                cx="50" cy="50"
                                                fill="transparent"
                                                r={radius}
                                                strokeWidth="8"
                                                strokeDasharray={circumference}
                                                strokeDashoffset={strokeDashoffset}
                                                strokeLinecap="round"
                                            ></circle>
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-sm font-bold text-gray-900">{formatSp(spUpdated)}</span>
                                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">of {formatSp(bill.totalSp)}</span>
                                        </div>
                                    </div>
                                    <span className="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Remaining: {formatSp(spRemaining)}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 pt-4 md:p-8 md:pt-6 relative">
                                {viewMode === 'update' ? (
                                    <>
                                        {/* Editable Large Value */}
                                        <div className="flex flex-col items-center justify-center mb-8">
                                            <label className="text-sm font-medium text-gray-500 mb-2">How much SP did you update?</label>
                                            <div className="flex items-baseline gap-2 justify-center">
                                                <input
                                                    type="text"
                                                    value={manualInputValue}
                                                    onChange={handleManualInput}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={handleManualInputBlur}
                                                    className="text-6xl font-bold text-emerald-600 tracking-tight text-center bg-transparent border-none focus:ring-0 focus:outline-none w-64 placeholder-emerald-200"
                                                    placeholder="0.00"
                                                />
                                                <span className="text-xl font-medium text-gray-400">SP</span>
                                            </div>
                                        </div>

                                        {/* Modern Slider */}
                                        <div className="relative w-full h-12 flex items-center mb-8 group">
                                            {/* Slider Standard Input styling override */}
                                            <input
                                                type="range"
                                                min="0"
                                                max={spRemaining}
                                                step={isCtrlPressed ? "0.05" : "1"}
                                                value={updateSpAmount}
                                                onChange={handleSlider}
                                                className="absolute z-20 w-full h-full opacity-0 cursor-pointer"
                                            />

                                            {/* Custom Track */}
                                            <div className="absolute w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-300 to-emerald-600 rounded-l-full transition-all duration-75 ease-out"
                                                    style={{ width: `${sliderPercent}%` }}
                                                />
                                            </div>

                                            {/* Custom Thumb handle */}
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] border-4 border-white cursor-grab transition-transform duration-75 ease-out pointer-events-none z-10"
                                                style={{ left: `${sliderPercent}%`, transform: 'translate(-50%, -50%) scale(1)' }}
                                            >
                                                {/* Tooltip above thumb */}
                                                <div className="mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap">
                                                    {formatSp(updateSpAmount)}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                </div>
                                            </div>

                                            <div className="absolute top-9 w-full flex justify-between px-1 text-xs font-medium text-gray-400 pointer-events-none">
                                                <span>0</span>
                                                <span>{formatSp(spRemaining)}</span>
                                            </div>
                                        </div>

                                        {/* Quick Add Buttons */}
                                        <div className="grid grid-cols-4 gap-3 mb-8">
                                            <button onClick={() => handleQuickAdd(27)} className="py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all">+27</button>
                                            <button onClick={() => handleQuickAdd(52)} className="py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all">+52</button>
                                            <button onClick={() => handleQuickAdd(100)} className="py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all">+100</button>
                                            <button onClick={handleSelectAll} className="py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 border border-transparent text-sm font-bold text-white shadow-md hover:shadow-orange-500/30 transition-all">All</button>
                                        </div>

                                        {/* Bill Items Section */}
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                            <div className="flex items-center justify-between mb-3 px-1">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                                    <Package size={16} /> Bill Items
                                                </h3>
                                                <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{bill.items.length}</span>
                                            </div>
                                            <ul className="space-y-0 text-sm">
                                                {bill.items.map((item, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <li className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg transition-colors cursor-default group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                                                                    {idx + 1}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-900">{item.name}</p>
                                                                    <p className="text-[10px] text-gray-500">Qty: {item.quantity} • ₹{item.currentPrice}</p>
                                                                </div>
                                                            </div>
                                                            <span className="font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">
                                                                ₹{item.currentPrice * item.quantity}
                                                            </span>
                                                        </li>
                                                        {idx < bill.items.length - 1 && <li className="h-px w-full bg-gray-200 my-1 mx-2 w-[calc(100%-16px)]"></li>}
                                                    </React.Fragment>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                ) : (
                                    /* HISTORY VIEW MODE */
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                                <History size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900">Update History</h3>
                                        </div>

                                        {/* Show empty if no history OR if spUpdatedAmount is 0 (stale history from before undo) */}
                                        {!bill.spHistory || bill.spHistory.length === 0 || spUpdated === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                <History size={48} className="mb-3 opacity-20" />
                                                <p className="text-sm font-medium">No history available yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Reverse map to show latest first */}
                                                {[...bill.spHistory].reverse().map((entry, i) => {
                                                    // Calculate original index because we reversed the array for display
                                                    const originalIndex = (bill.spHistory?.length || 0) - 1 - i;

                                                    return (
                                                        <div key={i} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                                                            <div className="flex items-start gap-4">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>
                                                                    {i < (bill.spHistory?.length || 0) - 1 && <div className="w-px h-full bg-gray-200 my-1"></div>}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between items-baseline gap-4">
                                                                        <p className="font-bold text-gray-900">Updated +{formatSp(entry.amount)} SP</p>
                                                                    </div>
                                                                    <p className="text-sm text-gray-500 mt-1">
                                                                        Total updated reached <span className="font-medium text-gray-700">{formatSp(entry.total)} SP</span>
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString()}</span>
                                                                        <span className="text-[10px] text-gray-400 uppercase tracking-wide px-1.5 py-0.5 bg-gray-200 rounded-md">
                                                                            {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!confirm(`Undo this update of +${formatSp(entry.amount)} SP?`)) return;

                                                                    // Remove this specific entry
                                                                    const newHistory = [...(bill.spHistory || [])];
                                                                    newHistory.splice(originalIndex, 1);

                                                                    // Recalculate totalUpdated amount based on remaining history
                                                                    // Or simply subtract the amount of this entry from current total
                                                                    // Ideally, we should recalculate from history to be safe
                                                                    const newTotalUpdated = newHistory.reduce((sum, h) => sum + h.amount, 0);

                                                                    await store.updateBill({
                                                                        ...bill,
                                                                        spUpdatedAmount: newTotalUpdated,
                                                                        spStatus: newTotalUpdated >= bill.totalSp ? 'Completed' : 'Pending',
                                                                        spHistory: newHistory
                                                                    });
                                                                    // Force view update implicitly via props change
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded border border-red-100"
                                                            >
                                                                Undo
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Content */}
                            {viewMode === 'update' && (
                                <div className="p-5 pt-2 pb-5 md:p-8 md:pt-2 md:pb-8">
                                    <button
                                        onClick={handleUpdateSP}
                                        disabled={isUpdating || updateSpAmount <= 0}
                                        className="w-full relative group bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            {isUpdating ? 'Updating...' : 'Confirm Update'}
                                            {!isUpdating && <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-medium">{formatSp(updateSpAmount)} SP</span>}
                                        </span>
                                        {!isUpdating && <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />}

                                        {/* Shimmer Effect */}
                                        {!isUpdating && <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Normal View Mode (Preserved from previous, just wrapped in new container style) */
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900">Bill Details</h2>
                            </div>
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                {/* Quick Info */}
                                <div className="flex gap-4 text-sm">
                                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500">Amount</p>
                                        <p className="font-bold text-gray-900 text-lg">₹{bill.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500">SP</p>
                                        <p className="font-bold text-gray-900 text-lg">{formatSp(bill.totalSp)}</p>
                                    </div>
                                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500">Method</p>
                                        <p className="font-bold text-gray-900">{bill.paymentMethod}</p>
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Package size={16} className="text-gray-400" />
                                        Items ({bill.items.length})
                                    </h3>
                                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                                            {bill.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                                                        <p className="text-xs text-gray-500">₹{item.currentPrice} × {item.quantity}</p>
                                                    </div>
                                                    <p className="font-bold text-gray-900">₹{item.currentPrice * item.quantity}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Snapshot */}
                                {(bill.hasSnapshot || bill.snapshotUrl) && (
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <ImageIcon size={16} className="text-gray-400" />
                                            Proof of Delivery
                                        </h3>
                                        <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                                            <SnapshotImage url={bill.snapshotUrl} billId={bill.id} hasSnapshot={bill.hasSnapshot} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                                <button
                                    onClick={() => setShowInvoiceModal(true)}
                                    className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Print
                                </button>
                                {onEdit && (
                                    <>
                                        <button onClick={() => { onEdit(bill); onClose(); }} className="p-3 bg-white border border-gray-200 text-gray-600 hover:border-gray-300 rounded-xl transition-colors">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={async () => { if (confirm("Delete this bill?")) { await store.deleteBill(bill.id); onClose(); } }} className="p-3 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Global Styles for Keyframes */}
            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </>
    );
};

export default BillDetailModal;
