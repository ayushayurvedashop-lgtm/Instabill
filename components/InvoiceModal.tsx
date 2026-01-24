import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Printer, Copy, AlertCircle, CheckCircle, Download, Loader, Edit } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Bill } from '../types';
import { store } from '../store';

interface InvoiceModalProps {
    bill: Bill;
    onClose: () => void;
    onEdit: () => void;
    isFullScreenSlide?: boolean;
}

// Constants for layout calculations
const MAX_ITEMS_DOUBLE_MODE = 14;
const MAX_ITEMS_HALF_PAGE = 14; // Max items that fit in half-page format
const ITEMS_PER_PAGE_FULL = 23; // For multi-page single mode

// Unified styles for half-page bill format
const styles = {
    page: {
        width: '210mm',
        background: 'white',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,

    halfPageBill: {
        height: '145mm',
        padding: '12mm 12mm 10mm 12mm',
        display: 'flex',
        flexDirection: 'column' as const,
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1px',
    } as React.CSSProperties,

    invoiceTitle: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#000',
        margin: 0,
    } as React.CSSProperties,

    invoiceDate: {
        fontSize: '11px',
        fontWeight: 600,
        color: '#000',
    } as React.CSSProperties,

    infoBox: {
        background: '#E5E7EB',
        padding: '2px 8px',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2px',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    } as React.CSSProperties,

    infoLabel: {
        fontSize: '8px',
        fontWeight: 700,
        color: '#6B7280',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.4px',
        marginBottom: '2px',
    } as React.CSSProperties,

    customerName: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#111',
    } as React.CSSProperties,

    customerPhone: {
        fontSize: '10px',
        color: '#4B5563',
        marginTop: '1px',
    } as React.CSSProperties,

    idBox: {
        background: 'white',
        height: '12px',
        width: '100px',
        border: '1px solid #D1D5DB',
        borderRadius: '3px',
        marginTop: '2px',
    } as React.CSSProperties,

    shopName: {
        fontSize: '14px',
        fontWeight: 800,
        color: '#111',
        marginBottom: '3px',
        textAlign: 'right' as const,
    } as React.CSSProperties,

    shopAddress: {
        fontSize: '8px',
        color: '#4B5563',
        lineHeight: 1.3,
        whiteSpace: 'pre-line' as const,
        textAlign: 'right' as const,
        maxWidth: '160px',
    } as React.CSSProperties,

    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
    } as React.CSSProperties,

    th: {
        padding: '2px 2px',
        fontSize: '9px',
        fontWeight: 700,
        color: '#111',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.2px',
        borderBottom: '1.5px solid #000',
        textAlign: 'left' as const,
    } as React.CSSProperties,

    td: {
        padding: '0 2px',
        color: '#374151',
        fontWeight: 500,
        borderBottom: '1px solid #E5E7EB',
        fontSize: '10px',
        verticalAlign: 'middle' as const,
    } as React.CSSProperties,

    statusBadge: {
        display: 'inline-block',
        fontSize: '7px',
        padding: '2px 6px',
        borderRadius: '8px',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    } as React.CSSProperties,

    statusGiven: {
        background: '#E5E7EB',
        color: '#4B5563',
    } as React.CSSProperties,

    statusPending: {
        background: '#000',
        color: '#fff',
    } as React.CSSProperties,

    footer: {
        marginTop: '0px',
        paddingTop: '2px',
        borderTop: '1px solid #D1D5DB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    } as React.CSSProperties,

    footerNote: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
        maxWidth: '45%',
    } as React.CSSProperties,

    footerNoteText: {
        fontSize: '7px',
        color: '#6B7280',
        lineHeight: 1.3,
    } as React.CSSProperties,

    totalLabel: {
        fontSize: '10px',
        fontWeight: 700,
        color: '#111',
    } as React.CSSProperties,

    totalValue: {
        background: '#333',
        color: 'white',
        fontWeight: 700,
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    } as React.CSSProperties,

    dashedDivider: {
        borderTop: '2px dashed #9CA3AF',
        margin: 0,
    } as React.CSSProperties,
};

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ bill, onClose, onEdit, isFullScreenSlide = false }) => {
    const [printMode, setPrintMode] = useState<'single' | 'double'>('single');
    const [isDownloading, setIsDownloading] = useState(false);
    const [scale, setScale] = useState(1);
    const printRef = useRef<HTMLDivElement>(null);

    const [settings, setSettings] = useState(store.getSettings());

    // Check if double mode should be disabled
    const isDoubleModeDisabled = bill.items.length > MAX_ITEMS_DOUBLE_MODE;

    // Check if we can use half-page format (≤12 items) or need full-page with pagination
    const useHalfPageFormat = bill.items.length <= MAX_ITEMS_HALF_PAGE;

    useEffect(() => {
        return store.subscribe(() => {
            setSettings(store.getSettings());
        });
    }, []);

    useEffect(() => {
        const calculateScale = () => {
            const viewportWidth = window.innerWidth;
            const targetWidth = 794;
            const availableWidth = viewportWidth - 48;

            if (availableWidth < targetWidth) {
                setScale(availableWidth / targetWidth);
            } else {
                setScale(1);
            }
        };

        calculateScale();
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, []);

    useEffect(() => {
        if (isDoubleModeDisabled && printMode === 'double') {
            setPrintMode('single');
        }
    }, [isDoubleModeDisabled, printMode]);

    const handlePrint = () => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc || !printRef.current) return;

        // Get the HTML content
        const content = printRef.current.innerHTML;

        doc.open();
        doc.write(`
<!DOCTYPE html>
<html>
<head>
    <title>Invoice #${bill.id}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        /* Force background colors */
        html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        body { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            background-color: white;
        }
        
        @page {
            size: A4;
            margin: 0 !important;
        }
        
        /* Mobile specific fixes */
        @media print {
            html, body { 
                margin: 0 !important; 
                padding: 0 !important;
                width: 210mm !important;
                min-height: 297mm !important;
            }
            
            .page {
                page-break-after: always;
                page-break-inside: avoid;
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                overflow: hidden !important;
                position: relative;
            }
            
            .page:last-child {
                page-break-after: auto;
            }
            
            /* Ensure half-page bills fit properly */
            .half-page-bill {
                height: 148.5mm !important; /* Exact A5 height */
                max-height: 148.5mm !important;
                overflow: hidden !important;
                position: relative;
            }
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>
        `);
        doc.close();

        iframe.onload = () => {
            // Use requestAnimationFrame to ensure DOM is painted
            requestAnimationFrame(() => {
                // Extended timeout for mobile rendering stability - especially for bills with many items
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    // Extended cleanup timeout to ensure print dialog doesn't lose context on some mobile browsers
                    setTimeout(() => document.body.removeChild(iframe), 3000);
                }, 800); // Increased from 500ms to 800ms for more complex bills
            });
        };
    };

    const handleDownload = async () => {
        if (!printRef.current) return;

        setIsDownloading(true);

        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = 210;
            const pdfHeight = 297;

            const pageElements = printRef.current.querySelectorAll('.page');

            for (let i = 0; i < pageElements.length; i++) {
                const page = pageElements[i] as HTMLElement;

                const clone = page.cloneNode(true) as HTMLElement;
                clone.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:white;';
                document.body.appendChild(clone);

                const canvas = await html2canvas(clone, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 794,
                });

                document.body.removeChild(clone);

                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                if (i > 0) pdf.addPage();

                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));
            }

            pdf.save(`Invoice_${bill.id}.pdf`);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to generate PDF. Please use Print → Save as PDF.');
        } finally {
            setIsDownloading(false);
        }
    };

    // Half-page Bill Component (used for both single and double when ≤12 items)
    const HalfPageBill = ({ items }: { items: typeof bill.items }) => {
        // Calculate dynamic row height to distribute items vertically
        // Available height for table: ~90mm (148.5mm - header ~25mm - footer ~15mm - padding 18mm)
        const availableTableHeight = 82; // mm
        const rowHeightMm = items.length > 0 ? Math.min(availableTableHeight / items.length, 7.5) : 7;
        const rowHeightPx = rowHeightMm * 3.78; // Convert mm to px (approximate)

        return (
            <div className="half-page-bill" style={styles.halfPageBill}>
                {/* Header */}
                <div style={styles.header}>
                    <h1 style={styles.invoiceTitle}>Invoice #{bill.id}</h1>
                    <div style={styles.invoiceDate}>Date: {new Date(bill.date).toLocaleDateString()}</div>
                </div>

                {/* Info Box */}
                <div style={styles.infoBox}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '40%' }}>
                        <div>
                            <div style={styles.infoLabel}>Bill To:</div>
                            <div style={styles.customerName}>{bill.customerName || 'Walk-in Customer'}</div>
                            {bill.customerPhone && <div style={styles.customerPhone}>{bill.customerPhone}</div>}
                        </div>
                        <div>
                            <div style={styles.infoLabel}>ID Info:</div>
                            <div style={styles.idBox}></div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '55%' }}>
                        <div style={styles.shopName}>{settings.shopName}</div>
                        <div style={styles.shopAddress}>{settings.shopAddress}</div>
                    </div>
                </div>

                {/* Items Table - fills available space */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '4%' }}>Sr.</th>
                                <th style={{ ...styles.th, width: '36%' }}>Product Name</th>
                                <th style={{ ...styles.th, width: '10%' }}>Rate</th>
                                <th style={{ ...styles.th, width: '11%', textAlign: 'center' }}>Status</th>
                                <th style={{ ...styles.th, width: '7%', textAlign: 'center' }}>Qty</th>
                                <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>SP</th>
                                <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const statusStyle = item.status === 'Given'
                                    ? { ...styles.statusBadge, ...styles.statusGiven }
                                    : { ...styles.statusBadge, ...styles.statusPending };

                                return (
                                    <tr key={index} style={{ height: `${rowHeightPx}px` }}>
                                        <td style={styles.td}>
                                            {String(index + 1).padStart(2, '0')}.
                                        </td>
                                        <td style={{ ...styles.td, fontWeight: 600, color: '#111' }}>{item.name}</td>
                                        <td style={styles.td}>₹{item.currentPrice}</td>
                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                            <span style={statusStyle}>
                                                {item.status === 'Pending' && item.pendingQuantity && item.pendingQuantity < item.quantity
                                                    ? `${item.pendingQuantity} P`
                                                    : item.status}
                                            </span>
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, color: '#111' }}>{String(item.quantity).padStart(2, '0')}</td>
                                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, color: '#111' }}>{Math.round(item.totalSp * 100) / 100}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#111' }}>₹{item.currentPrice * item.quantity}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <div style={styles.footerNote}>
                        <AlertCircle size={10} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div style={styles.footerNoteText}>
                            Kindly check the products before leaving the counter.<br />
                            काउंटर सोडण्यापूर्वी कृपया उत्पादने तपासा.
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={styles.totalLabel}>Total SP:</span>
                            <div style={{ ...styles.totalValue, fontSize: '10px', padding: '3px 6px' }}>
                                {Math.round(bill.totalSp * 100) / 100}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ ...styles.totalLabel, fontSize: '11px' }}>Grand Total:</span>
                            <div style={styles.totalValue}>
                                ₹{bill.totalAmount}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Full-page Bill Component (for >12 items, single mode only with pagination)
    const FullPageBill = ({ items, pageNum, totalPages, isFirstPage, showFooter }: {
        items: typeof bill.items;
        pageNum: number;
        totalPages: number;
        isFirstPage: boolean;
        showFooter: boolean;
    }) => (
        <div style={{ padding: '20mm', display: 'flex', flexDirection: 'column', minHeight: '257mm' }}>
            {/* Header - Only on first page */}
            {isFirstPage && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#000', margin: 0 }}>Invoice #{bill.id}</h1>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#000' }}>Date: {new Date(bill.date).toLocaleDateString()}</div>
                    </div>

                    <div style={{ ...styles.infoBox, padding: '12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '40%' }}>
                            <div>
                                <div style={{ ...styles.infoLabel, fontSize: '9px' }}>Bill To:</div>
                                <div style={{ ...styles.customerName, fontSize: '13px' }}>{bill.customerName || 'Walk-in Customer'}</div>
                                {bill.customerPhone && <div style={{ ...styles.customerPhone, fontSize: '11px' }}>{bill.customerPhone}</div>}
                            </div>
                            <div>
                                <div style={{ ...styles.infoLabel, fontSize: '9px' }}>ID Info:</div>
                                <div style={{ ...styles.idBox, height: '20px', width: '140px' }}></div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '55%' }}>
                            <div style={{ ...styles.shopName, fontSize: '16px' }}>{settings.shopName}</div>
                            <div style={{ ...styles.shopAddress, fontSize: '9px', maxWidth: '200px' }}>{settings.shopAddress}</div>
                        </div>
                    </div>
                </>
            )}

            {/* Continuation header */}
            {!isFirstPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #D1D5DB' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>Invoice #{bill.id} (Continued)</span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>Page {pageNum} of {totalPages}</span>
                </div>
            )}

            {/* Items Table */}
            <div style={{ flex: 1 }}>
                <table style={{ ...styles.table, fontSize: '11px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '5%' }}>Sr.</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '35%' }}>Product Name</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '10%' }}>Rate</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '12%', textAlign: 'center' }}>Status</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '8%', textAlign: 'center' }}>Qty</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '10%', textAlign: 'center' }}>SP</th>
                            <th style={{ ...styles.th, padding: '8px 4px', fontSize: '10px', width: '12%', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const globalIndex = isFirstPage ? index : (ITEMS_PER_PAGE_FULL + (pageNum - 2) * ITEMS_PER_PAGE_FULL + index);
                            const statusStyle = item.status === 'Given'
                                ? { ...styles.statusBadge, ...styles.statusGiven, fontSize: '8px', padding: '2px 8px' }
                                : { ...styles.statusBadge, ...styles.statusPending, fontSize: '8px', padding: '2px 8px' };

                            return (
                                <tr key={index}>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px' }}>
                                        {String(globalIndex + 1).padStart(2, '0')}.
                                    </td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', fontWeight: 600, color: '#111' }}>{item.name}</td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px' }}>₹{item.currentPrice}</td>
                                    <td style={{ ...styles.td, padding: '6px 4px', textAlign: 'center' }}>
                                        <span style={statusStyle}>
                                            {item.status === 'Pending' && item.pendingQuantity && item.pendingQuantity < item.quantity
                                                ? `${item.pendingQuantity} P`
                                                : item.status}
                                        </span>
                                    </td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'center', fontWeight: 700, color: '#111' }}>{String(item.quantity).padStart(2, '0')}</td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'center', fontWeight: 700, color: '#111' }}>{Math.round(item.totalSp * 100) / 100}</td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'right', fontWeight: 700, color: '#111' }}>₹{item.currentPrice * item.quantity}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer - Only on last page */}
            {showFooter && (
                <div style={{ ...styles.footer, paddingTop: '12px' }}>
                    <div style={styles.footerNote}>
                        <AlertCircle size={12} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ ...styles.footerNoteText, fontSize: '8px' }}>
                            Kindly check the products before leaving the counter.<br />
                            काउंटर सोडण्यापूर्वी कृपया उत्पादने तपासा.
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ ...styles.totalLabel, fontSize: '11px' }}>Total SP:</span>
                            <div style={{ ...styles.totalValue, fontSize: '12px', padding: '5px 10px' }}>
                                {Math.round(bill.totalSp * 100) / 100}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ ...styles.totalLabel, fontSize: '13px' }}>Grand Total:</span>
                            <div style={{ ...styles.totalValue, fontSize: '14px', padding: '6px 12px' }}>
                                ₹{bill.totalAmount}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Page number */}
            {totalPages > 1 && (
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#6B7280', paddingTop: '8px', marginTop: '8px' }}>
                    Page {pageNum} of {totalPages}
                </div>
            )}
        </div>
    );

    // Calculate pages for full-page mode (>12 items)
    const fullPagePages = useMemo(() => {
        if (useHalfPageFormat) return [];

        const allItems = bill.items;
        const result: typeof allItems[] = [];

        if (allItems.length <= ITEMS_PER_PAGE_FULL) {
            result.push(allItems);
        } else {
            result.push(allItems.slice(0, ITEMS_PER_PAGE_FULL));
            let remaining = allItems.slice(ITEMS_PER_PAGE_FULL);
            while (remaining.length > 0) {
                result.push(remaining.slice(0, ITEMS_PER_PAGE_FULL));
                remaining = remaining.slice(ITEMS_PER_PAGE_FULL);
            }
        }

        return result;
    }, [bill.items, useHalfPageFormat]);

    return (
        <div
            id="invoice-modal-print-container"
            className={`fixed inset-0 z-[100] bg-gray-100 flex items-center justify-center p-0 md:p-8 ${isFullScreenSlide ? 'animate-slide-in-right' : 'animate-fade-in'}`}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-[110] bg-white text-gray-700 p-2.5 rounded-full shadow-lg hover:bg-gray-50 transition-all border border-gray-100 no-print"
            >
                <X size={24} className="text-gray-600" />
            </button>

            {/* Modal Card */}
            <div id="invoice-modal-card" className="bg-white md:rounded-3xl w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl shadow-2xl flex flex-col overflow-hidden animate-modal-in">

                {/* Success Banner */}
                <div className="bg-green-500 text-white px-6 py-3 flex items-center justify-center gap-2 font-bold text-sm md:text-base shadow-sm overflow-hidden relative no-print">
                    <div className="absolute inset-0 bg-green-600/20" style={{ animation: 'shimmer 1.5s infinite' }}></div>
                    <div className="flex items-center justify-center bg-white rounded-full p-0.5" style={{ animation: 'checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                        <CheckCircle size={20} className="text-green-600" />
                    </div>
                    <span className="relative z-10">Success! Bill Generated Successfully</span>
                    <style>{`
                        @keyframes checkmark-pop {
                            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
                            70% { transform: scale(1.2) rotate(0deg); }
                            100% { transform: scale(1) rotate(0deg); opacity: 1; }
                        }
                        @keyframes shimmer {
                            0% { transform: translateX(-100%); }
                            100% { transform: translateX(100%); }
                        }
                    `}</style>
                </div>

                {/* Toolbar */}
                <div className="bg-white border-b border-gray-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4 no-print">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <h2 className="font-bold text-base sm:text-lg text-gray-800">Print Preview</h2>
                        <div className="hidden sm:block h-6 w-px bg-gray-200"></div>

                        {/* Single/Double Toggle - only show for ≤12 items */}
                        {useHalfPageFormat && (
                            <>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setPrintMode('single')}
                                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center gap-1 sm:gap-2 ${printMode === 'single' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <Copy size={12} /> Single
                                    </button>
                                    <button
                                        onClick={() => !isDoubleModeDisabled && setPrintMode('double')}
                                        disabled={isDoubleModeDisabled}
                                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all flex items-center gap-1 sm:gap-2 ${printMode === 'double'
                                            ? 'bg-white shadow-sm text-gray-900'
                                            : isDoubleModeDisabled
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        title={isDoubleModeDisabled ? `More than ${MAX_ITEMS_DOUBLE_MODE} products` : 'Two copies on one page'}
                                    >
                                        <Copy size={12} className="rotate-180" /> Double
                                    </button>
                                </div>

                                {isDoubleModeDisabled && (
                                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                        <AlertCircle size={12} />
                                        <span>More than {MAX_ITEMS_DOUBLE_MODE} Products</span>
                                    </div>
                                )}
                            </>
                        )}

                        {!useHalfPageFormat && (
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                <AlertCircle size={12} />
                                <span>Full page mode ({bill.items.length} items)</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 sm:px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 text-xs sm:text-sm"
                        >
                            <Edit size={14} />
                            <span className="hidden sm:inline">Edit Bill</span>
                            <span className="sm:hidden">Edit</span>
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className={`bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 sm:px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 text-xs sm:text-sm ${isDownloading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isDownloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                            <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'Download'}</span>
                            <span className="sm:hidden">{isDownloading ? '...' : 'PDF'}</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 sm:px-6 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2 text-xs sm:text-sm"
                        >
                            <Printer size={16} /> Print
                        </button>
                    </div>
                </div>

                {/* Preview Area */}
                <div id="invoice-modal-preview-area" className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8 flex justify-center items-start">
                    <div
                        className="print-scale-wrapper"
                        style={{ transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: `calc((1 - ${scale}) * -100%)` }}
                    >
                        <div ref={printRef} className="printable-content">
                            {useHalfPageFormat ? (
                                // Half-page format (≤12 items)
                                printMode === 'single' ? (
                                    // Single Mode - Just top half of page
                                    <div className="page" style={{ ...styles.page, height: '297mm', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                        <HalfPageBill items={bill.items} />
                                        {/* Bottom half is empty for single mode */}
                                        <div style={{ height: '148.5mm' }}></div>
                                    </div>
                                ) : (
                                    // Double Mode - Two identical bills
                                    <div className="page" style={{ ...styles.page, height: '297mm', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                        <HalfPageBill items={bill.items} />
                                        <div style={styles.dashedDivider}></div>
                                        <HalfPageBill items={bill.items} />
                                    </div>
                                )
                            ) : (
                                // Full-page format (>12 items) - with pagination
                                fullPagePages.map((pageItems, pageIndex) => (
                                    <div
                                        key={pageIndex}
                                        className="page"
                                        style={{ ...styles.page, minHeight: '297mm', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', marginBottom: '32px' }}
                                    >
                                        <FullPageBill
                                            items={pageItems}
                                            pageNum={pageIndex + 1}
                                            totalPages={fullPagePages.length}
                                            isFirstPage={pageIndex === 0}
                                            showFooter={pageIndex === fullPagePages.length - 1}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
