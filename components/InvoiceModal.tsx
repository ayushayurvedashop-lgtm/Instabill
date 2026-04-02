import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
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
    externalPrintMode?: 'single' | 'double';
}

// Ref handle type so BillReviewModal can call print/download directly
export interface InvoiceModalHandle {
    handlePrint: () => void;
    handleDownload: () => Promise<void>;
}

// Constants for layout calculations
const MAX_ITEMS_DOUBLE_MODE = 14;
const MAX_ITEMS_HALF_PAGE = 14; // Max items that fit in half-page format
const ITEMS_PER_PAGE_FULL = 30; // Increased to 30 items per page as requested

// Unified styles for half-page bill format
const styles = {
    page: {
        width: '210mm',
        background: 'white',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,

    halfPageBill: {
        height: '138mm',
        padding: '8mm 12mm 4mm 12mm',
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
        fontSize: '10px',
        fontWeight: 600,
        color: '#000',
    } as React.CSSProperties,

    infoBox: {
        background: '#E5E7EB',
        padding: '1px 6px',
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
        padding: '0 2px 4px 2px',
        fontSize: '10px',
        fontWeight: 600,
        color: '#111',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.2px',
        borderBottom: '1px solid #E5E7EB',
        textAlign: 'left' as const,
    } as React.CSSProperties,

    td: {
        padding: '1px 2px',
        color: '#374151',
        fontWeight: 600,
        borderBottom: '1px solid #F3F4F6',
        fontSize: '9px',
        verticalAlign: 'middle' as const,
    } as React.CSSProperties,

    statusBadge: {
        display: 'inline-block',
        fontSize: '7px',
        padding: '1px 4px',
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
        padding: '3px 6px',
        borderRadius: '5px',
        fontSize: '10px',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
    } as React.CSSProperties,

    dashedDivider: {
        borderTop: '2px dashed #9CA3AF',
        margin: 0,
    } as React.CSSProperties,
};

// ============================================================
// Standalone Print/Download utilities (used by BillReviewModal)
// ============================================================

function generateBillHTML(bill: any, settings: any): string {
    const showSp = bill.showSpOnBill !== false;

    // Calculate row height similarly to the React component
    const availableTableHeight = 105; // mm (Expanded further into bottom margin space)
    const rowHeightMm = bill.items.length > 0 ? Math.min(availableTableHeight / bill.items.length, 6.5) : 6.5;
    const rowHeightPx = rowHeightMm * 3.78;

    const generateBillItemRowHTML = (item: any, index: number, showSp: boolean) => {
        const statusClass = item.status === 'Given' ? 'status-badge status-given' : 'status-badge status-pending';
        const statusText = item.status === 'Pending' && item.pendingQuantity && item.pendingQuantity < item.quantity
            ? `${item.pendingQuantity} P`
            : item.status === 'Pending' ? 'All Pending' : item.status;

        return `
        <tr style="height: ${rowHeightPx}px;">
            <td>${String(index + 1).padStart(2, '0')}.</td>
            <td class="product-name">${item.name}</td>
            <td>₹${item.currentPrice}</td>
            <td class="text-center"><span class="${statusClass}">${statusText}</span></td>
            <td class="text-center font-bold">${String(item.quantity).padStart(2, '0')}</td>
            ${showSp ? `<td class="text-center font-bold">${Math.round(item.totalSp * 100) / 100}</td>` : ''}
            <td class="text-right font-bold">₹${item.currentPrice * item.quantity}</td>
        </tr>
        `;
    };

    const rows = bill.items.map((item: any, i: number) => generateBillItemRowHTML(item, i, showSp)).join('');
    return `<div class="page"><div class="half-page-bill">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <h1 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; letter-spacing: -0.3px;">
                    Invoice <span style="color: #64748b; font-weight: 500;">#{bill.id.replace(/^#/, '')}</span>
                </h1>
                <div style="background: #f8fafc; padding: 3px 6px; border-radius: 6px; min-width: 200px;">
                    <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px;">Bill To:</div>
                    <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${bill.customerName || 'Walk-in Customer'}</div>
                    ${bill.customerPhone ? `<div style="font-size: 10px; color: #475569; margin-top: 1px;">${bill.customerPhone}</div>` : ''}
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
                <div style="font-size: 10px; font-weight: 500; color: #64748b; margin-bottom: 1px;">
                    Date: <span style="color: #1e293b; font-weight: 600;">${new Date(bill.date).toLocaleDateString()}</span>
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 1px;">${settings.shopName}</div>
                <div style="font-size: 9px; color: #64748b; line-height: 1.3; max-width: 320px;">${settings.shopAddress}</div>
            </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column">
            <table class="bill-table">
                <thead><tr>
                    <th style="width:4%">Sr.</th>
                    <th style="width:36%">Product Name</th>
                    <th style="width:10%">Rate</th>
                    <th style="width:11%;text-align:center" class="text-center">Status</th>
                    <th style="width:7%;text-align:center" class="text-center">Qty</th>
                    ${showSp ? `<th style="width:10%;text-align:center" class="text-center">SP</th>` : ''}
                    <th style="width:12%;text-align:right" class="text-right">Amount</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="bill-footer" style="flex-direction: column; align-items: stretch; gap: 2px;">
            ${bill.discountAmount > 0 ? `
            <div style="display:flex; justify-content: flex-end; width:100%; border-bottom: 1px dashed #D1D5DB; padding-bottom: 1px;">
                <div style="display:flex; gap: 12px;">
                    <span style="font-size: 9px; font-weight: 600;">Subtotal: ₹${bill.subTotalAmount || bill.totalAmount + bill.discountAmount}</span>
                    <span style="font-size: 9px; font-weight: 600; color: #4B5563;">Discount: -₹${bill.discountAmount}</span>
                </div>
            </div>` : ''}
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <div class="footer-note">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" style="margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div class="footer-note-text" style="font-size:6px">Kindly check the products before leaving the counter.<br/>काउंटर सोडण्यापूर्वी कृपया उत्पादने तपासा.</div>
                </div>
                <div class="totals-section" style="display:flex;align-items:center;gap:8px">
                    ${showSp ? `
                    <div style="display:flex;align-items:center;gap:4px">
                        <span class="total-label" style="font-size:9px">Total SP:</span>
                        <div class="total-value-sp">${Math.round(bill.totalSp * 100) / 100}</div>
                    </div>` : ''}
                    <div style="display:flex;align-items:center;gap:4px">
                        <span class="total-label-grand" style="font-size:10px">Grand Total:</span>
                        <div class="total-value">₹${bill.totalAmount}</div>
                    </div>
                </div>
            </div>
        </div>
    </div></div>`;
}

// The comprehensive print CSS (same as InvoiceModal's handlePrint) - exported for BillReviewModal
export const INVOICE_PRINT_CSS = `
* { margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important; }
@page { size:A4;margin:0!important; }
html,body { margin:0!important;padding:0!important;width:210mm!important;min-height:297mm!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background-color:white!important; }
.page { width:210mm!important;height:297mm!important;background:white!important;position:relative;page-break-after:always;page-break-inside:avoid;overflow:hidden!important; }
.page:last-child { page-break-after:auto; }
.half-page-bill { height:138mm!important;max-height:138mm!important;padding:8mm 12mm 4mm 12mm!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important;overflow:hidden!important; }
.bill-header { display:flex!important;justify-content:space-between!important;align-items:flex-start!important;margin-bottom:1px!important; }
.invoice-title { font-size:18px!important;font-weight:700!important;color:#000!important;margin:0!important; }
.invoice-date { font-size:10px!important;font-weight:600!important;color:#000!important; }
.info-box { background:#E5E7EB!important;padding:1px 6px!important;border-radius:6px!important;display:flex!important;justify-content:space-between!important;margin-bottom:1px!important; }
.info-label { font-size:8px!important;font-weight:700!important;color:#6B7280!important;text-transform:uppercase!important;letter-spacing:0.4px!important;margin-bottom:1px!important; }
.customer-name { font-size:11px!important;font-weight:700!important;color:#111!important; }
.customer-phone { font-size:10px!important;color:#4B5563!important;margin-top:1px!important; }
.id-box { background:white!important;height:12px!important;width:100px!important;border:1px solid #D1D5DB!important;border-radius:3px!important;margin-top:1px!important; }
.shop-name { font-size:13px!important;font-weight:800!important;color:#111!important;margin-bottom:1px!important;text-align:right!important; }
.shop-address { font-size:8px!important;color:#4B5563!important;line-height:1.2!important;white-space:pre-line!important;text-align:right!important;max-width:160px!important; }
.bill-table { width:100%!important;border-collapse:collapse!important; }
.bill-table th { padding:0 1px 2px 1px!important;font-size:9px!important;font-weight:600!important;color:#111!important;text-transform:uppercase!important;letter-spacing:0.1px!important;border-bottom:1px solid #E5E7EB!important;text-align:left!important; }
.bill-table td { padding:1px 1px!important;color:#374151!important;font-weight:600!important;border-bottom:1px solid #F3F4F6!important;font-size:9px!important;vertical-align:middle!important; }
.bill-table .product-name { font-weight:700!important;color:#111!important; }
.bill-table .text-center { text-align:center!important; }
.bill-table .text-right { text-align:right!important; }
.bill-table .font-bold { font-weight:700!important;color:#111!important; }
.status-badge { display:inline-block!important;font-size:6px!important;padding:1px 3px!important;border-radius:6px!important;font-weight:700!important;text-transform:uppercase!important; }
.status-given { background:#E5E7EB!important;color:#4B5563!important; }
.status-pending { background:#000!important;color:#fff!important; }
.bill-footer { margin-top:0px!important;padding-top:1px!important;border-top:1px solid #D1D5DB!important;display:flex!important;justify-content:space-between!important;align-items:center!important; }
.footer-note { display:flex!important;align-items:flex-start!important;gap:3px!important;max-width:45%!important; }
.footer-note-text { font-size:6.5px!important;color:#6B7280!important;line-height:1.2!important; }
.total-label { font-size:9px!important;font-weight:700!important;color:#111!important; }
.total-label-grand { font-size:10px!important;font-weight:700!important;color:#111!important; }
.total-value { background:#333!important;color:white!important;font-weight:700!important;padding:3px 6px!important;border-radius:5px!important;font-size:10px!important; }
.total-value-sp { background:#333!important;color:white!important;font-weight:700!important;padding:2px 4px!important;border-radius:5px!important;font-size:9px!important; }
svg { flex-shrink:0!important; }
@media print { * { -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important; } html,body { margin:0!important;padding:0!important;width:210mm!important; } .page { margin:0!important;padding:0!important; } .info-box{background:#E5E7EB!important;} .total-value,.total-value-sp{background:#333!important;color:white!important;} .status-pending{background:#000!important;color:#fff!important;} .status-given{background:#E5E7EB!important;} }
`;

/** Print a bill directly using the OS print dialog (no UI needed) */
export function printBillDirect(bill: any) {
    const settings = store.getSettings();
    const content = generateBillHTML(bill, settings);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>Invoice #${bill.id}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${INVOICE_PRINT_CSS}</style></head><body>${content}</body></html>`);
    doc.close();

    iframe.onload = () => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 3000);
            }, 800);
        });
    };
}

/** Download a bill directly as a PDF (no UI needed) */
export async function downloadBillDirect(bill: any) {
    const settings = store.getSettings();
    const content = generateBillHTML(bill, settings);

    // Render off-screen to capture with html2canvas
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:white;';
    container.innerHTML = content;
    document.body.appendChild(container);

    const pageEl = container.querySelector('.page') as HTMLElement;
    if (!pageEl) {
        document.body.removeChild(container);
        return;
    }

    // Apply inline styles for the page dimensions
    pageEl.style.width = '210mm';
    pageEl.style.height = '297mm';
    pageEl.style.background = 'white';
    pageEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    try {
        const canvas = await html2canvas(pageEl, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            windowWidth: 794,
        });

        document.body.removeChild(container);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = 210;
        const pdfHeight = 297;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));
        pdf.save(`Invoice_${bill.id}.pdf`);
    } catch (error) {
        document.body.removeChild(container);
        console.error('Download failed:', error);
        alert('Failed to generate PDF. Please use Print → Save as PDF.');
    }
}

export const InvoiceModal = forwardRef<InvoiceModalHandle, InvoiceModalProps>(({ bill, onClose, onEdit, isFullScreenSlide = false, externalPrintMode }, ref) => {
    const [printMode, setPrintMode] = useState<'single' | 'double'>(externalPrintMode || 'single');
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

    // Sync with external print mode when controlled from outside
    useEffect(() => {
        if (externalPrintMode) {
            setPrintMode(externalPrintMode);
        }
    }, [externalPrintMode]);

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

    useImperativeHandle(ref, () => ({
        handlePrint,
        handleDownload
    }));

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
        /* ==========================================
           COMPREHENSIVE PRINT STYLESHEET
           Ensures identical output across all devices
           ========================================== */
        
        /* Global Reset & Color Forcing */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        
        /* Page Setup */
        @page {
            size: A4;
            margin: 0 !important;
        }
        
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        /* ==========================================
           PAGE STRUCTURE
           ========================================== */
        .page {
            width: 210mm !important;
            height: 297mm !important;
            background: white !important;
            position: relative;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden !important;
        }
        
        .page:last-child {
            page-break-after: auto;
        }
        
        /* ==========================================
           HALF-PAGE BILL (≤14 items)
           ========================================== */
        .half-page-bill {
            height: 138mm !important;
            max-height: 138mm !important;
            padding: 8mm 12mm 4mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        
        /* ==========================================
           HEADER SECTION
           ========================================== */
        .bill-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-bottom: 1px !important;
        }
        
        .invoice-title {
            font-size: 18px !important;
            font-weight: 700 !important;
            color: #000 !important;
            margin: 0 !important;
        }
        
        .invoice-date {
            font-size: 11px !important;
            font-weight: 600 !important;
            color: #000 !important;
        }
        
        /* ==========================================
           INFO BOX (Customer & Shop Details)
           ========================================== */
        .info-box {
            background: #E5E7EB !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: flex !important;
            justify-content: space-between !important;
            margin-bottom: 2px !important;
        }
        
        .info-label {
            font-size: 8px !important;
            font-weight: 700 !important;
            color: #6B7280 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.4px !important;
            margin-bottom: 2px !important;
        }
        
        .customer-name {
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #111 !important;
        }
        
        .customer-phone {
            font-size: 10px !important;
            color: #4B5563 !important;
            margin-top: 1px !important;
        }
        
        .id-box {
            background: white !important;
            height: 12px !important;
            width: 100px !important;
            border: 1px solid #D1D5DB !important;
            border-radius: 3px !important;
            margin-top: 2px !important;
        }
        
        .shop-name {
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #111 !important;
            margin-bottom: 3px !important;
            text-align: right !important;
        }
        
        .shop-address {
            font-size: 8px !important;
            color: #4B5563 !important;
            line-height: 1.3 !important;
            white-space: pre-line !important;
            text-align: right !important;
            max-width: 160px !important;
        }
        
        /* ==========================================
           TABLE STYLES
           ========================================== */
        .bill-table {
            width: 100% !important;
            border-collapse: collapse !important;
        }
        
        .bill-table th {
            padding: 0 1px 2px 1px !important;
            font-size: 9px !important;
            font-weight: 600 !important;
            color: #111 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1px !important;
            border-bottom: 1px solid #E5E7EB !important;
            text-align: left !important;
        }
        
        .bill-table td {
            padding: 1px 1px !important;
            color: #374151 !important;
            font-weight: 600 !important;
            border-bottom: 1px solid #F3F4F6 !important;
            font-size: 9px !important;
            vertical-align: middle !important;
        }
        
        .bill-table .product-name {
            font-weight: 700 !important;
            color: #111 !important;
        }
        
        .bill-table .text-center {
            text-align: center !important;
        }
        
        .bill-table .text-right {
            text-align: right !important;
        }
        
        .bill-table .font-bold {
            font-weight: 700 !important;
            color: #111 !important;
        }
        
        /* ==========================================
           STATUS BADGES
           ========================================== */
        .status-badge {
            display: inline-block !important;
            font-size: 7px !important;
            padding: 2px 6px !important;
            border-radius: 8px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
        }
        
        .status-given {
            background: #E5E7EB !important;
            color: #4B5563 !important;
        }
        
        .status-pending {
            background: #000 !important;
            color: #fff !important;
        }
        
        /* ==========================================
           FOOTER SECTION
           ========================================== */
        .bill-footer {
            margin-top: 0px !important;
            padding-top: 2px !important;
            border-top: 1px solid #D1D5DB !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        
        .footer-note {
            display: flex !important;
            align-items: flex-start !important;
            gap: 4px !important;
            max-width: 45% !important;
        }
        
        .footer-note-text {
            font-size: 7px !important;
            color: #6B7280 !important;
            line-height: 1.3 !important;
        }
        
        .totals-section {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
        }
        
        .total-label {
            font-size: 9px !important;
            font-weight: 700 !important;
            color: #111 !important;
        }
        
        .total-label-grand {
            font-size: 10px !important;
            font-weight: 700 !important;
            color: #111 !important;
        }
        
        .total-value {
            background: #333 !important;
            color: white !important;
            font-weight: 700 !important;
            padding: 3px 6px !important;
            border-radius: 5px !important;
            font-size: 10px !important;
        }
        
        .total-value-sp {
            background: #333 !important;
            color: white !important;
            font-weight: 700 !important;
            padding: 2px 4px !important;
            border-radius: 5px !important;
            font-size: 9px !important;
        }
        
        /* ==========================================
           DIVIDERS
           ========================================== */
        .dashed-divider {
            border-top: 2px dashed #9CA3AF !important;
            margin: 0 !important;
        }
        
        /* ==========================================
           FULL-PAGE BILL (>14 items)
           ========================================== */
        .full-page-bill {
            padding: 10mm 8mm 6mm 8mm !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 257mm !important;
        }
        
        .full-page-bill .invoice-title {
            font-size: 22px !important;
        }
        
        .full-page-bill .info-box {
            padding: 12px !important;
            margin-bottom: 12px !important;
        }
        
        .full-page-bill .info-label {
            font-size: 9px !important;
        }
        
        .full-page-bill .customer-name {
            font-size: 13px !important;
        }
        
        .full-page-bill .customer-phone {
            font-size: 11px !important;
        }
        
        .full-page-bill .id-box {
            height: 20px !important;
            width: 140px !important;
        }
        
        .full-page-bill .shop-name {
            font-size: 16px !important;
        }
        
        .full-page-bill .shop-address {
            font-size: 9px !important;
            max-width: 200px !important;
        }
        
        .full-page-bill .bill-table th {
            padding: 4px 4px 14px 4px !important;
            font-size: 10px !important;
        }
        
        .full-page-bill .bill-table td {
            padding: 6px 4px !important;
            font-size: 11px !important;
        }
        
        .full-page-bill .status-badge {
            font-size: 8px !important;
            padding: 2px 8px !important;
        }
        
        .full-page-bill .bill-footer {
            padding-top: 12px !important;
        }
        
        .full-page-bill .footer-note-text {
            font-size: 8px !important;
        }
        
        .full-page-bill .total-label {
            font-size: 11px !important;
        }
        
        .full-page-bill .total-label-grand {
            font-size: 13px !important;
        }
        
        .full-page-bill .total-value {
            font-size: 14px !important;
            padding: 6px 12px !important;
        }
        
        .full-page-bill .total-value-sp {
            font-size: 12px !important;
            padding: 5px 10px !important;
        }
        
        /* Continuation header */
        .continuation-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 12px !important;
            padding-bottom: 10px !important;
            border-bottom: 1px solid #D1D5DB !important;
        }
        
        .continuation-title {
            font-size: 14px !important;
            font-weight: 700 !important;
            color: #374151 !important;
        }
        
        .page-indicator {
            font-size: 11px !important;
            color: #6B7280 !important;
        }
        
        .page-number {
            text-align: center !important;
            font-size: 10px !important;
            color: #6B7280 !important;
            padding-top: 8px !important;
            margin-top: 8px !important;
        }
        
        /* ==========================================
           SVG ICONS
           ========================================== */
        svg {
            flex-shrink: 0 !important;
        }
        
        /* ==========================================
           PRINT MEDIA OVERRIDES
           ========================================== */
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
            }
            
            .page {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Force backgrounds to print */
            .info-box { background: #E5E7EB !important; }
            .total-value, .total-value-sp { background: #333 !important; color: white !important; }
            .status-pending { background: #000 !important; color: #fff !important; }
            .status-given { background: #E5E7EB !important; }
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
        const availableTableHeight = 105; // mm (Expanded further into bottom margin space)
        const rowHeightMm = items.length > 0 ? Math.min(availableTableHeight / items.length, 6.5) : 6.5;
        const rowHeightPx = rowHeightMm * 3.78; // Convert mm to px (approximate)

        return (
            <div className="half-page-bill" style={{ ...styles.halfPageBill, padding: '8mm 12mm 4mm 12mm' }}>
                {/* Dynamic Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    {/* Left Side: Invoice # & Bill To */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: 0, letterSpacing: '-0.3px' }}>
                            Invoice <span style={{ color: '#64748b', fontWeight: 500 }}>#{bill.id.replace(/^#/, '')}</span>
                        </h1>
                        <div style={{ background: '#f8fafc', padding: '3px 6px', borderRadius: '6px', minWidth: '200px' }}>
                            <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1px' }}>Bill To:</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{bill.customerName || 'Walk-in Customer'}</div>
                            {bill.customerPhone && <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>{bill.customerPhone}</div>}
                        </div>
                    </div>

                    {/* Right Side: Date & Shop Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: '#64748b', marginBottom: '1px' }}>Date: <span style={{ color: '#1e293b', fontWeight: 600 }}>{new Date(bill.date).toLocaleDateString()}</span></div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '1px' }}>{settings.shopName}</div>
                        <div style={{ fontSize: '9px', color: '#64748b', lineHeight: 1.3, maxWidth: '320px', whiteSpace: 'pre-line' }}>{settings.shopAddress}</div>
                    </div>
                </div>

                {/* Items Table - fills available space */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <table className="bill-table" style={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '4%' }}>Sr.</th>
                                <th style={{ ...styles.th, width: '36%' }}>Product Name</th>
                                <th style={{ ...styles.th, width: '10%' }}>Rate</th>
                                <th style={{ ...styles.th, width: '11%', textAlign: 'center' }} className="text-center">Status</th>
                                <th style={{ ...styles.th, width: '7%', textAlign: 'center' }} className="text-center">Qty</th>
                                {bill.showSpOnBill !== false && <th style={{ ...styles.th, width: '10%', textAlign: 'center' }} className="text-center">SP</th>}
                                <th style={{ ...styles.th, width: '12%', textAlign: 'right' }} className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const statusClass = item.status === 'Given' ? 'status-badge status-given' : 'status-badge status-pending';
                                const statusStyle = item.status === 'Given'
                                    ? { ...styles.statusBadge, ...styles.statusGiven }
                                    : { ...styles.statusBadge, ...styles.statusPending };

                                return (
                                    <tr key={index} style={{ height: `${rowHeightPx}px` }}>
                                        <td style={styles.td}>
                                            {String(index + 1).padStart(2, '0')}.
                                        </td>
                                        <td className="product-name" style={{ ...styles.td, fontWeight: 700, color: '#111' }}>{item.name}</td>
                                        <td style={styles.td}>₹{item.currentPrice}</td>
                                        <td className="text-center" style={{ ...styles.td, textAlign: 'center' }}>
                                            <span className={statusClass} style={statusStyle}>
                                                {item.status === 'Pending' && item.pendingQuantity && item.pendingQuantity < item.quantity
                                                    ? `${item.pendingQuantity} P`
                                                    : item.status === 'Pending' ? 'All Pending' : item.status}
                                            </span>
                                        </td>
                                        <td className="text-center font-bold" style={{ ...styles.td, textAlign: 'center', fontWeight: 700, color: '#111' }}>{String(item.quantity).padStart(2, '0')}</td>
                                        {bill.showSpOnBill !== false && <td className="text-center font-bold" style={{ ...styles.td, textAlign: 'center', fontWeight: 700, color: '#111' }}>{Math.round(item.totalSp * 100) / 100}</td>}
                                        <td className="text-right font-bold" style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#111' }}>₹{item.currentPrice * item.quantity}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="bill-footer" style={{ ...styles.footer, flexDirection: 'column', alignItems: 'stretch' }}>
                    {(bill.discountAmount ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', borderBottom: '1px dashed #D1D5DB', paddingBottom: '1px', marginBottom: '2px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ fontSize: '9px', fontWeight: 600 }}>Subtotal: ₹{bill.subTotalAmount || bill.totalAmount + bill.discountAmount!}</span>
                                <span style={{ fontSize: '9px', fontWeight: 600, color: '#4B5563' }}>Discount: -₹{bill.discountAmount}</span>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="footer-note" style={styles.footerNote}>
                            <AlertCircle size={8} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <div className="footer-note-text" style={{ ...styles.footerNoteText, fontSize: '6px' }}>
                                Kindly check the products before leaving the counter.<br />
                                काउंटर सोडण्यापूर्वी कृपया उत्पादने तपासा.
                            </div>
                        </div>
                        <div className="totals-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {bill.showSpOnBill !== false && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className="total-label" style={{ ...styles.totalLabel, fontSize: '9px' }}>Total SP:</span>
                                    <div className="total-value-sp" style={{ ...styles.totalValue, fontSize: '9px', padding: '2px 4px' }}>
                                        {Math.round(bill.totalSp * 100) / 100}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="total-label-grand" style={{ ...styles.totalLabel, fontSize: '10px' }}>Grand Total:</span>
                                <div className="total-value" style={styles.totalValue}>
                                    ₹{bill.totalAmount}
                                </div>
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
        <div className="full-page-bill" style={{ padding: '10mm 8mm 6mm 8mm', display: 'flex', flexDirection: 'column', minHeight: '257mm' }}>
            {/* Header - Only on first page */}
            {isFirstPage && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        {/* Left Side: Invoice # & Bill To */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0, letterSpacing: '-0.3px' }}>
                                Invoice <span style={{ color: '#64748b', fontWeight: 500 }}>#{bill.id.replace(/^#/, '')}</span>
                            </h1>
                            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', minWidth: '260px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Bill To:</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{bill.customerName || 'Walk-in Customer'}</div>
                                {bill.customerPhone && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{bill.customerPhone}</div>}
                            </div>
                        </div>

                        {/* Right Side: Date & Shop Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Date: <span style={{ color: '#1e293b', fontWeight: 600 }}>{new Date(bill.date).toLocaleDateString()}</span></div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{settings.shopName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, maxWidth: '360px', whiteSpace: 'pre-line' }}>{settings.shopAddress}</div>
                        </div>
                    </div>
                </>
            )}

            {/* Continuation header */}
            {!isFirstPage && (
                <div className="continuation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #D1D5DB' }}>
                    <span className="continuation-title" style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>Invoice #{bill.id} (Continued)</span>
                    <span className="page-indicator" style={{ fontSize: '11px', color: '#6B7280' }}>Page {pageNum} of {totalPages}</span>
                </div>
            )}

            {/* Items Table */}
            <div style={{ flex: 1 }}>
                <table className="bill-table" style={{ ...styles.table, fontSize: '11px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '5%' }}>Sr.</th>
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '35%' }}>Product Name</th>
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '10%' }}>Rate</th>
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '12%', textAlign: 'center' }} className="text-center">Status</th>
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '8%', textAlign: 'center' }} className="text-center">Qty</th>
                            {bill.showSpOnBill !== false && <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '10%', textAlign: 'center' }} className="text-center">SP</th>}
                            <th style={{ ...styles.th, padding: '2px 4px 14px 4px', fontSize: '10px', width: '12%', textAlign: 'right' }} className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const globalIndex = isFirstPage ? index : (ITEMS_PER_PAGE_FULL + (pageNum - 2) * ITEMS_PER_PAGE_FULL + index);
                            const statusClass = item.status === 'Given' ? 'status-badge status-given' : 'status-badge status-pending';
                            const statusStyle = item.status === 'Given'
                                ? { ...styles.statusBadge, ...styles.statusGiven, fontSize: '8px', padding: '2px 8px' }
                                : { ...styles.statusBadge, ...styles.statusPending, fontSize: '8px', padding: '2px 8px' };

                            return (
                                <tr key={index}>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px' }}>
                                        {String(globalIndex + 1).padStart(2, '0')}.
                                    </td>
                                    <td className="product-name" style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', fontWeight: 700, color: '#111' }}>{item.name}</td>
                                    <td style={{ ...styles.td, padding: '6px 4px', fontSize: '11px' }}>₹{item.currentPrice}</td>
                                    <td className="text-center" style={{ ...styles.td, padding: '6px 4px', textAlign: 'center' }}>
                                        <span className={statusClass} style={statusStyle}>
                                            {item.status === 'Pending' && item.pendingQuantity && item.pendingQuantity < item.quantity
                                                ? `${item.pendingQuantity} P`
                                                : item.status === 'Pending' ? 'All Pending' : item.status}
                                        </span>
                                    </td>
                                    <td className="text-center font-bold" style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'center', fontWeight: 700, color: '#111' }}>{String(item.quantity).padStart(2, '0')}</td>
                                    {bill.showSpOnBill !== false && <td className="text-center font-bold" style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'center', fontWeight: 700, color: '#111' }}>{Math.round(item.totalSp * 100) / 100}</td>}
                                    <td className="text-right font-bold" style={{ ...styles.td, padding: '6px 4px', fontSize: '11px', textAlign: 'right', fontWeight: 700, color: '#111' }}>₹{item.currentPrice * item.quantity}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer - Only on last page */}
            {showFooter && (
                <div className="bill-footer" style={{ ...styles.footer, paddingTop: '12px', flexDirection: 'column', alignItems: 'stretch' }}>
                    {(bill.discountAmount ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', borderBottom: '1px dashed #D1D5DB', paddingBottom: '4px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>Subtotal: ₹{bill.subTotalAmount || bill.totalAmount + bill.discountAmount!}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>Discount: -₹{bill.discountAmount}</span>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="footer-note" style={styles.footerNote}>
                            <AlertCircle size={12} color="#9CA3AF" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div className="footer-note-text" style={{ ...styles.footerNoteText, fontSize: '8px' }}>
                                Kindly check the products before leaving the counter.<br />
                                काउंटर सोडण्यापूर्वी कृपया उत्पादने तपासा.
                            </div>
                        </div>
                        <div className="totals-section" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {bill.showSpOnBill !== false && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="total-label" style={{ ...styles.totalLabel, fontSize: '11px' }}>Total SP:</span>
                                    <div className="total-value-sp" style={{ ...styles.totalValue, fontSize: '12px', padding: '5px 10px' }}>
                                        {Math.round(bill.totalSp * 100) / 100}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="total-label-grand" style={{ ...styles.totalLabel, fontSize: '13px' }}>Grand Total:</span>
                                <div className="total-value" style={{ ...styles.totalValue, fontSize: '14px', padding: '6px 12px' }}>
                                    ₹{bill.totalAmount}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Page number */}
            {totalPages > 1 && (
                <div className="page-number" style={{ textAlign: 'center', fontSize: '10px', color: '#6B7280', paddingTop: '8px', marginTop: '8px' }}>
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
                    <div className="absolute inset-0 bg-[#5abc8b]/20" style={{ animation: 'shimmer 1.5s infinite' }}></div>
                    <div className="flex items-center justify-center bg-white rounded-full p-0.5" style={{ animation: 'checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                        <CheckCircle size={20} className="text-[#5abc8b]" />
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
                                        <div className="dashed-divider" style={styles.dashedDivider}></div>
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
        </div >
    );
});
