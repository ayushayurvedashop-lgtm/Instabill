/// <reference types="vite/client" />
import { Bill } from '../types';
import { store } from '../store';

// TextBee API Configuration
const API_KEY = import.meta.env.VITE_TEXTBEE_API_KEY;
const DEVICE_ID = import.meta.env.VITE_TEXTBEE_DEVICE_ID;
const BASE_URL = 'https://api.textbee.dev/api/v1';


import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

export const sendBillWhatsapp = async (bill: Bill, customerPhone: string, pdfUrl: string, isUpdate: boolean = false): Promise<boolean> => {
    try {
        // Check if WhatsApp is enabled in settings
        const settings = store.getSettings();
        if (settings.whatsappEnabled === false) {
            console.log('WhatsApp notifications are disabled in settings');
            return false;
        }

        // --- Client-Side Validation ---
        if (!bill || !bill.id) {
            console.error('WhatsApp Error: Invalid Bill ID');
            return false;
        }
        if (!pdfUrl || typeof pdfUrl !== 'string' || !pdfUrl.trim()) {
            console.error('WhatsApp Error: Invalid PDF URL');
            return false;
        }
        if (!customerPhone) {
            console.error('WhatsApp Error: Invalid Phone Number');
            return false;
        }
        // -----------------------------

        const sendWhatsapp = httpsCallable(functions, 'sendWhatsappNotification');

        // Format phone (remove +91 or spaces, api expects pure numbers usually, but let's ensure 91 prefix if needed)
        // AiSensy usually expects country code.
        let formattedPhone = customerPhone.replace(/\D/g, '');
        if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

        const response = await sendWhatsapp({
            destination: formattedPhone,
            billReference: bill.id,
            billUrl: pdfUrl,
            totalAmount: bill.totalAmount,
            totalSp: bill.totalSp,
            isUpdate,
            shopName: settings.shopName
        });

        const result = response.data as any;
        if (result.success) {
            console.log('WhatsApp sent successfully:', result);
            return true;
        } else {
            console.error('WhatsApp failed:', result);
            return false;
        }
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        return false;
    }
};

// Send WhatsApp notification when products are handed over
export const sendProductUpdateWhatsapp = async (
    customerPhone: string,
    billReference: string,
    productsGiven: string,
    billUrl: string
): Promise<boolean> => {
    try {
        // Check if WhatsApp is enabled in settings
        const settings = store.getSettings();
        if (settings.whatsappEnabled === false) {
            console.log('WhatsApp notifications are disabled in settings');
            return false;
        }

        // --- Client-Side Validation ---
        if (!customerPhone) {
            console.error('WhatsApp Error: Invalid Phone Number');
            return false;
        }
        if (!billReference) {
            console.error('WhatsApp Error: Invalid Bill Reference');
            return false;
        }
        if (!productsGiven) {
            console.error('WhatsApp Error: No products given');
            return false;
        }
        if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
            console.error('WhatsApp Error: Invalid PDF URL');
            return false;
        }
        // -----------------------------

        const sendNotification = httpsCallable(functions, 'sendProductUpdateNotification');

        // Format phone
        let formattedPhone = customerPhone.replace(/\D/g, '');
        if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

        const response = await sendNotification({
            destination: formattedPhone,
            billReference,
            productsGiven,
            billUrl,
            shopName: settings.shopName
        });

        const result = response.data as any;
        if (result.success) {
            console.log('Product Update WhatsApp sent successfully:', result);
            return true;
        } else {
            console.error('Product Update WhatsApp failed:', result);
            return false;
        }
    } catch (error) {
        console.error('Error sending Product Update WhatsApp:', error);
        return false;
    }
};

// Send WhatsApp notification when SP is marked as done/completed
export const sendSPDoneWhatsapp = async (
    customerPhone: string,
    billReference: string,
    totalSp: number,
    billUrl: string
): Promise<boolean> => {
    try {
        // Check if WhatsApp is enabled in settings
        const settings = store.getSettings();
        if (settings.whatsappEnabled === false) {
            console.log('WhatsApp notifications are disabled in settings');
            return false;
        }

        // --- Client-Side Validation ---
        if (!customerPhone) {
            console.error('WhatsApp Error: Invalid Phone Number');
            return false;
        }
        if (!billReference) {
            console.error('WhatsApp Error: Invalid Bill Reference');
            return false;
        }
        if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
            console.error('WhatsApp Error: Invalid PDF URL');
            return false;
        }
        // -----------------------------

        const sendNotification = httpsCallable(functions, 'sendSPDoneNotification');

        // Format phone
        let formattedPhone = customerPhone.replace(/\D/g, '');
        if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

        const response = await sendNotification({
            destination: formattedPhone,
            billReference,
            totalSp,
            billUrl
        });

        const result = response.data as any;
        if (result.success) {
            console.log('SP Done WhatsApp sent successfully:', result);
            return true;
        } else {
            console.error('SP Done WhatsApp failed:', result);
            return false;
        }
    } catch (error) {
        console.error('Error sending SP Done WhatsApp:', error);
        return false;
    }
};

export const sendBillSMS = async (bill: Bill, customerPhone: string, pdfUrl?: string, isUpdate: boolean = false): Promise<boolean> => {
    if (!API_KEY || !DEVICE_ID) {
        console.warn('TextBee API Key or Device ID not configured');
        return false;
    }

    const settings = store.getSettings();

    // Ensure phone number has country code
    let formattedPhone = customerPhone.replace(/\s+/g, '');
    if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
    } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+${formattedPhone}`;
    }

    // Use PDF URL if available, otherwise fallback to web link
    const invoiceLink = pdfUrl || `${window.location.origin}/?billId=${encodeURIComponent(bill.id)}`;

    // Different messages for Generated vs Updated
    let message: string;

    if (isUpdate) {
        // Bill Updated message
        message = `${settings.shopName}
Bill ${bill.id} Updated ✓

Amount: Rs.${bill.totalAmount}
SP: ${Math.round(bill.totalSp * 100) / 100}

View Bill:
${invoiceLink}`;
    } else {
        // Bill Generated message
        message = `${settings.shopName}
Bill ${bill.id} Generated ✓

Amount: Rs.${bill.totalAmount}
SP: ${Math.round(bill.totalSp * 100) / 100}

View Bill:
${invoiceLink}`;
    }

    const requestUrl = `${BASE_URL}/gateway/devices/${DEVICE_ID}/send-sms`;
    const requestBody = {
        recipients: [formattedPhone],
        message: message,
    };

    console.log('=== SMS Debug Info ===');
    console.log('URL:', requestUrl);
    console.log('Device ID:', DEVICE_ID);
    console.log('Phone:', formattedPhone);
    console.log('Message:', message);
    console.log('Is Update:', isUpdate);

    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
            },
            body: JSON.stringify(requestBody),
        });

        console.log('Response Status:', response.status);

        const responseText = await response.text();
        console.log('Response Body:', responseText);

        if (!response.ok) {
            console.error('TextBee SMS Error:', response.status, responseText);
            return false;
        }

        console.log('SMS sent successfully!');
        return true;

    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
};
