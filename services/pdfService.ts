import { Bill } from '../types';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import { store } from '../store';

/**
 * Generates a simple text-based PDF invoice and uploads to Firebase Storage.
 * Returns the public download URL.
 */
export const generateAndUploadInvoicePDF = async (bill: Bill): Promise<string | null> => {
    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();

        // Header
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Invoice ${bill.id}`, 20, 25);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Date: ${new Date(bill.date).toLocaleDateString()}`, pageWidth - 60, 25);

        // Shop Name
        const settings = store.getSettings();
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(settings.shopName, pageWidth - 60, 35);

        // Customer Info
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Customer: ${bill.customerName || 'Walk-in Customer'}`, 20, 45);

        // Divider
        pdf.setDrawColor(200);
        pdf.line(20, 50, pageWidth - 20, 50);

        // Table Headers
        let y = 60;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Sr.', 20, y);
        pdf.text('Product Name', 30, y);
        pdf.text('Rate', 110, y);
        pdf.text('Qty', 130, y);
        pdf.text('Amount', 150, y);

        // Items
        pdf.setFont('helvetica', 'normal');
        y += 8;

        bill.items.forEach((item, index) => {
            if (y > 270) {
                pdf.addPage();
                y = 20;
            }

            pdf.text(`${index + 1}.`, 20, y);
            // Truncate long names
            const name = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;
            pdf.text(name, 30, y);
            pdf.text(`Rs.${item.currentPrice}`, 110, y);
            pdf.text(`${item.quantity}`, 130, y);
            pdf.text(`Rs.${item.currentPrice * item.quantity}`, 150, y);
            y += 6;
        });

        // Footer
        y += 10;
        pdf.setDrawColor(200);
        pdf.line(20, y, pageWidth - 20, y);
        y += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Total Amount: Rs. ${bill.totalAmount}`, pageWidth - 70, y);
        y += 7;
        pdf.text(`Total SP: ${Math.round(bill.totalSp * 100) / 100}`, pageWidth - 70, y);

        y += 15;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Thanks for visiting ${settings.shopName}!`, 20, y);

        // Convert to Blob
        const pdfBlob = pdf.output('blob');

        // Upload to Firebase Storage
        const fileName = `invoices/${bill.id.replace('#', '')}_${Date.now()}.pdf`;
        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, pdfBlob, {
            contentType: 'application/pdf'
        });

        const downloadURL = await getDownloadURL(storageRef);
        console.log('PDF uploaded successfully:', downloadURL);

        return downloadURL;

    } catch (error) {
        console.error('Error generating/uploading PDF:', error);
        return null;
    }
};
