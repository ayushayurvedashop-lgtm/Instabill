import jsPDF from 'jspdf';
import { SubscriptionTransaction, ShopProfile } from '../types';

const BRAND_COLOR: [number, number, number] = [2, 87, 92]; // #02575c
const ACCENT_COLOR: [number, number, number] = [0, 116, 123]; // #00747B
const LIGHT_BG: [number, number, number] = [240, 250, 240]; // #F0FAF0
const GRAY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [17, 22, 23];

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'new_subscription': return 'New Subscription';
    case 'renewal': return 'Subscription Renewal';
    case 'extension': return 'Subscription Extension';
    case 'upgrade': return 'Plan Upgrade';
    default: return 'Subscription Payment';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch { return dateStr; }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateSubscriptionInvoice(
  transaction: SubscriptionTransaction,
  shopProfile: ShopProfile
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Header Bar ---
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTABILL', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subscription Invoice', margin, 28);

  // Invoice number on right
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const invoiceNum = `INV-${transaction.id.substring(0, 8).toUpperCase()}`;
  doc.text(invoiceNum, pageWidth - margin, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(transaction.date), pageWidth - margin, 28, { align: 'right' });

  y = 52;

  // --- Bill To / Invoice Details Grid ---
  // Left: Bill To
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, y);

  y += 6;
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(shopProfile.shopName || 'Shop', margin, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  if (shopProfile.address) {
    doc.text(shopProfile.address, margin, y);
    y += 4;
  }
  if (shopProfile.phone) {
    doc.text(`Phone: ${shopProfile.phone}`, margin, y);
    y += 4;
  }
  doc.text(`Shop ID: ${shopProfile.id}`, margin, y);

  // Right: Invoice details
  const rightX = pageWidth - margin;
  let ry = 52;

  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS', rightX, ry, { align: 'right' });

  ry += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(`Invoice: ${invoiceNum}`, rightX, ry, { align: 'right' });

  ry += 5;
  doc.text(`Date: ${formatDate(transaction.date)}`, rightX, ry, { align: 'right' });

  ry += 5;
  doc.text(`Type: ${getTransactionTypeLabel(transaction.type)}`, rightX, ry, { align: 'right' });

  if (transaction.razorpayPaymentId) {
    ry += 5;
    doc.text(`Payment ID: ${transaction.razorpayPaymentId}`, rightX, ry, { align: 'right' });
  }
  if (transaction.razorpayOrderId) {
    ry += 5;
    doc.text(`Order ID: ${transaction.razorpayOrderId}`, rightX, ry, { align: 'right' });
  }

  y = Math.max(y, ry) + 14;

  // --- Divider ---
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Table Header ---
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y - 4, contentWidth, 12, 2, 2, 'F');

  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', margin + 4, y + 3);
  doc.text('PERIOD', margin + 90, y + 3);
  doc.text('DURATION', margin + 130, y + 3);
  doc.text('AMOUNT', pageWidth - margin - 4, y + 3, { align: 'right' });

  y += 14;

  // --- Table Row ---
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const planLabel = `${capitalize(transaction.planId)} Plan`;
  doc.text(planLabel, margin + 4, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(getTransactionTypeLabel(transaction.type), margin + 4, y + 5);

  // Period
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  const periodStart = formatDate(transaction.periodStart);
  const periodEnd = formatDate(transaction.periodEnd);
  doc.text(periodStart, margin + 90, y);
  doc.text(`to ${periodEnd}`, margin + 90, y + 5);

  // Duration
  doc.text(`${transaction.durationMonths} month${transaction.durationMonths > 1 ? 's' : ''}`, margin + 130, y + 2);

  // Amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`₹${transaction.amount.toLocaleString('en-IN')}.00`, pageWidth - margin - 4, y + 2, { align: 'right' });

  y += 16;

  // --- Row Divider ---
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Totals ---
  const totalsX = pageWidth - margin - 4;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Subtotal:', totalsX - 40, y);
  doc.setTextColor(...DARK);
  doc.text(`₹${transaction.amount.toLocaleString('en-IN')}.00`, totalsX, y, { align: 'right' });

  y += 6;
  doc.setTextColor(...GRAY);
  doc.text('Tax (Included):', totalsX - 40, y);
  doc.setTextColor(...DARK);
  doc.text('₹0.00', totalsX, y, { align: 'right' });

  y += 8;
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 55, y - 2, totalsX, y - 2);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_COLOR);
  doc.text('Total:', totalsX - 40, y + 4);
  doc.text(`₹${transaction.amount.toLocaleString('en-IN')}.00`, totalsX, y + 4, { align: 'right' });

  y += 20;

  // --- Status Badge ---
  doc.setFillColor(218, 244, 215); // #DAF4D7
  doc.roundedRect(margin, y, 30, 8, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 119, 106);
  doc.text('PAID', margin + 15, y + 5.5, { align: 'center' });

  y += 20;

  // --- Footer ---
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('Payments processed securely by Razorpay. For support, contact your Instabill administrator.', pageWidth / 2, y, { align: 'center' });

  // --- Open PDF in new tab ---
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}
