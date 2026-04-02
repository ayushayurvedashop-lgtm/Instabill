import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import Razorpay from "razorpay";

dotenv.config();

admin.initializeApp();

// Allow specific origins or just true for all (for development)
// Simplified: Return the API key directly (for development/testing)
// In production, consider implementing ephemeral keys with proper admin permissions
export const getDeepgramApiKey = onCall({ cors: true }, async (request) => {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
        logger.error("Deepgram API Key is missing from environment variables");
        throw new HttpsError('internal', "Deepgram API Key not configured");
    }

    logger.info("Returning Deepgram API key");
    return { key: deepgramApiKey };
});

export const getSpeechmaticsToken = onCall({ cors: true }, async (request) => {
    // In production, use process.env.SPEECHMATICS_API_KEY
    const apiKey = "3shXawKz4LZmjhVtdXu1o3NiF6R3VcYL";

    try {
        // Note: type=rt MUST be in query string, not body
        const response = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ttl: 3600 // 1 hour
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Speechmatics API Error", errorText);
            throw new HttpsError('internal', `Speechmatics Auth Failed: ${errorText}`);
        }

        const data = await response.json();
        return { token: data.key_value };

    } catch (error) {
        logger.error("Fetch Error", error);
        throw new HttpsError('internal', "Failed to fetch token");
    }
});

export const sendWhatsappNotification = onCall({ cors: true }, async (request) => {
    logger.info("--- START sendWhatsappNotification ---");
    try {
        // 1. MSG91 Credentials & Config (set MSG91_AUTH_KEY in Firebase config for production)
        const authKey = process.env.MSG91_AUTH_KEY || "489901AythCbMOfajU6973c03eP1";
        const { destination, billReference, billUrl, totalAmount, totalSp, isUpdate, shopName } = request.data;
        const actualShopName = shopName || "Instabill";
        // Campaign slugs: bill-generated1 for new bills, bill-updated1 for updates
        const campaignSlug = isUpdate ? "bill-updated1" : "bill-generated1";

        logger.info("Inputs received:", { destination, billReference, billUrl, totalAmount, totalSp, isUpdate, campaignSlug });

        // --- STRICT VALIDATION ---
        if (!destination || typeof destination !== 'string' || !destination.trim()) {
            logger.error("Invalid Destination:", destination);
            throw new HttpsError('invalid-argument', "Validation Error: Destination cannot be empty");
        }

        if (!billReference) {
            logger.error("Invalid BillReference:", billReference);
            throw new HttpsError('invalid-argument', "Validation Error: Bill Reference cannot be empty");
        }

        if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
            logger.error("Invalid BillURL:", billUrl);
            throw new HttpsError('invalid-argument', "Validation Error: Bill URL is invalid or empty");
        }

        // 2. Map to template placeholders:
        // body_1 = Shop name (e.g., "Ayush Ayurveda")
        // body_2 = Bill Number (e.g., "#617")
        // body_3 = Amount | SP (e.g., "₹765,000 | 32")
        // button_1 = path after /o/ for PDF URL (only for bill-generated1)
        const billNumber = (typeof billReference === 'string' && billReference.startsWith('#')) ? billReference : `#${billReference}`;

        // Format amount and SP for body_3
        const formattedAmount = totalAmount ? `₹${Number(totalAmount).toLocaleString('en-IN')}` : '₹0';
        const formattedSp = totalSp ? Math.round(Number(totalSp) * 100) / 100 : 0;
        const amountSpInfo = `${formattedAmount} | ${formattedSp}`;

        // Template URL is .../o/{{1}} → pass only the path part (e.g. bills%2Fxyz.pdf?alt=media&token=...)
        const oIndex = billUrl.indexOf("/o/");
        const buttonPath = oIndex >= 0 ? billUrl.substring(oIndex + 3) : billUrl;

        // 3. Prepare MSG91 Campaign Payload with new variable format
        // bill-generated1: body_1 (shop), body_2 (bill no), body_3 (amount|sp), button_1 (path)
        // bill-updated1: body_1 (shop), body_2 (bill no), body_3 (amount|sp) - no button
        const variables: Record<string, { type: string; value: string }> = {
            "body_1": {
                "type": "text",
                "value": actualShopName
            },
            "body_2": {
                "type": "text",
                "value": billNumber
            },
            "body_3": {
                "type": "text",
                "value": amountSpInfo
            }
        };

        // Only add button_1 for bill-generated1 template
        if (!isUpdate) {
            variables["button_1"] = {
                "type": "text",
                "value": buttonPath
            };
        }

        const payload = {
            data: {
                sendTo: [
                    {
                        to: [
                            {
                                mobiles: destination,
                                variables: variables
                            }
                        ]
                    }
                ]
            }
        };

        logger.info("Payload to MSG91:", JSON.stringify(payload));

        // 4. Send Request to Campaign Run API
        const url = `https://control.msg91.com/api/v5/campaign/api/campaigns/${campaignSlug}/run`;
        logger.info("Requesting URL:", url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'authkey': authKey,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        logger.info("MSG91 Response Status:", response.status);

        const responseText = await response.text();
        logger.info("MSG91 Response Text:", responseText);

        if (!response.ok) {
            logger.error("MSG91 API Error Status:", response.status, responseText);
            let hint = "";
            if (response.status === 401) {
                try {
                    const err = JSON.parse(responseText);
                    if (err.apiError === "418" || (err.errors && /unauthorized|418|whitelist/i.test(String(err.errors))))
                        hint = " (Tip: 418 = IP not whitelisted. In MSG91 dashboard, disable IP restriction or whitelist your server IPs.)";
                    else
                        hint = " (Check: auth key is correct, has WhatsApp permission, and is not restricted.)";
                } catch (_) { /* ignore */ }
            }
            throw new Error(`MSG91 API returned ${response.status}: ${responseText}${hint}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: "Success", raw: responseText };
        }

        logger.info("--- SUCCESS sendWhatsappNotification ---");
        return { success: true, data };

    } catch (error: any) {
        logger.error("CRITICAL ERROR in sendWhatsappNotification:", {
            message: error.message,
            stack: error.stack,
            fullError: error
        });

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Function failed: ${error.message || 'Unknown error'}`);
    }
});

// New function for Pending Products Updated notification
export const sendProductUpdateNotification = onCall({ cors: true }, async (request) => {
    logger.info("--- START sendProductUpdateNotification ---");
    try {
        const authKey = process.env.MSG91_AUTH_KEY || "489901AythCbMOfajU6973c03eP1";
        const campaignSlug = "pending-products-updated";
        const { destination, billReference, productsGiven, billUrl, shopName } = request.data;
        const actualShopName = shopName || "Instabill";

        logger.info("Inputs received:", { destination, billReference, productsGiven, billUrl });

        // --- STRICT VALIDATION ---
        if (!destination || typeof destination !== 'string' || !destination.trim()) {
            logger.error("Invalid Destination:", destination);
            throw new HttpsError('invalid-argument', "Validation Error: Destination cannot be empty");
        }

        if (!billReference) {
            logger.error("Invalid BillReference:", billReference);
            throw new HttpsError('invalid-argument', "Validation Error: Bill Reference cannot be empty");
        }

        if (!productsGiven || typeof productsGiven !== 'string' || !productsGiven.trim()) {
            logger.error("Invalid productsGiven:", productsGiven);
            throw new HttpsError('invalid-argument', "Validation Error: Products Given cannot be empty");
        }

        if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
            logger.error("Invalid BillURL:", billUrl);
            throw new HttpsError('invalid-argument', "Validation Error: Bill URL is invalid or empty");
        }

        // Format bill reference
        const billNumber = (typeof billReference === 'string' && billReference.startsWith('#')) ? billReference : `#${billReference}`;

        // Template URL is .../o/{{1}} → pass only the path part
        const oIndex = billUrl.indexOf("/o/");
        const buttonPath = oIndex >= 0 ? billUrl.substring(oIndex + 3) : billUrl;

        // Prepare MSG91 Campaign Payload
        // body_1 = Shop name (e.g., "Ayush Ayurveda")
        // body_2 = Bill No (e.g., "#655")
        // body_3 = Updated Items (e.g., "Panchatulsi (2), Dentodoc (1)")
        // button_1 = PDF path
        const payload = {
            data: {
                sendTo: [
                    {
                        to: [
                            {
                                mobiles: destination,
                                variables: {
                                    "body_1": {
                                        "type": "text",
                                        "value": actualShopName
                                    },
                                    "body_2": {
                                        "type": "text",
                                        "value": billNumber
                                    },
                                    "body_3": {
                                        "type": "text",
                                        "value": productsGiven
                                    },
                                    "button_1": {
                                        "type": "text",
                                        "value": buttonPath
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        };

        logger.info("Payload to MSG91:", JSON.stringify(payload));

        const url = `https://control.msg91.com/api/v5/campaign/api/campaigns/${campaignSlug}/run`;
        logger.info("Requesting URL:", url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'authkey': authKey,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        logger.info("MSG91 Response Status:", response.status);

        const responseText = await response.text();
        logger.info("MSG91 Response Text:", responseText);

        if (!response.ok) {
            logger.error("MSG91 API Error Status:", response.status, responseText);
            throw new Error(`MSG91 API returned ${response.status}: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: "Success", raw: responseText };
        }

        logger.info("--- SUCCESS sendProductUpdateNotification ---");
        return { success: true, data };

    } catch (error: any) {
        logger.error("CRITICAL ERROR in sendProductUpdateNotification:", {
            message: error.message,
            stack: error.stack,
            fullError: error
        });

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Function failed: ${error.message || 'Unknown error'}`);
    }
});

// SP Done notification - sent when bill is marked complete in SP Manager
export const sendSPDoneNotification = onCall({ cors: true }, async (request) => {
    logger.info("--- START sendSPDoneNotification ---");
    try {
        const authKey = process.env.MSG91_AUTH_KEY || "489901AythCbMOfajU6973c03eP1";
        const campaignSlug = "sp-done";

        const { destination, billReference, totalSp, billUrl } = request.data;

        logger.info("Inputs received:", { destination, billReference, totalSp, billUrl });

        // --- STRICT VALIDATION ---
        if (!destination || typeof destination !== 'string' || !destination.trim()) {
            logger.error("Invalid Destination:", destination);
            throw new HttpsError('invalid-argument', "Validation Error: Destination cannot be empty");
        }

        if (!billReference) {
            logger.error("Invalid BillReference:", billReference);
            throw new HttpsError('invalid-argument', "Validation Error: Bill Reference cannot be empty");
        }

        if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
            logger.error("Invalid BillURL:", billUrl);
            throw new HttpsError('invalid-argument', "Validation Error: Bill URL is invalid or empty");
        }

        // Format bill reference
        const billNumber = (typeof billReference === 'string' && billReference.startsWith('#')) ? billReference : `#${billReference}`;

        // Format SP value
        const spValue = totalSp ? Math.round(Number(totalSp) * 100) / 100 : 0;

        // Template URL is .../o/{{1}} → pass only the path part
        const oIndex = billUrl.indexOf("/o/");
        const buttonPath = oIndex >= 0 ? billUrl.substring(oIndex + 3) : billUrl;

        // Prepare MSG91 Campaign Payload
        // body_1 = Bill No (e.g., "#617")
        // body_2 = Total SP Updated (e.g., "27")
        // button_1 = PDF path
        const payload = {
            data: {
                sendTo: [
                    {
                        to: [
                            {
                                mobiles: destination,
                                variables: {
                                    "body_1": {
                                        "type": "text",
                                        "value": billNumber
                                    },
                                    "body_2": {
                                        "type": "text",
                                        "value": String(spValue)
                                    },
                                    "button_1": {
                                        "type": "text",
                                        "value": buttonPath
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        };

        logger.info("Payload to MSG91:", JSON.stringify(payload));

        const url = `https://control.msg91.com/api/v5/campaign/api/campaigns/${campaignSlug}/run`;
        logger.info("Requesting URL:", url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'authkey': authKey,
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        logger.info("MSG91 Response Status:", response.status);

        const responseText = await response.text();
        logger.info("MSG91 Response Text:", responseText);

        if (!response.ok) {
            logger.error("MSG91 API Error Status:", response.status, responseText);
            throw new Error(`MSG91 API returned ${response.status}: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: "Success", raw: responseText };
        }

        logger.info("--- SUCCESS sendSPDoneNotification ---");
        return { success: true, data };

    } catch (error: any) {
        logger.error("CRITICAL ERROR in sendSPDoneNotification:", {
            message: error.message,
            stack: error.stack,
            fullError: error
        });

        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError('internal', `Function failed: ${error.message || 'Unknown error'}`);
    }
});

// ============================================
// Admin: Reset Shop Password
// ============================================
// Callable function that allows a super admin to change a shop's password.
// Firebase client SDK cannot change another user's password, so this must be server-side.
const SUPER_ADMIN_EMAILS = ["admin@veda.admin", "9423791137@veda.admin"];

export const resetShopPassword = onCall({ cors: true }, async (request) => {
    logger.info("--- START resetShopPassword ---");

    // 1. Verify caller is authenticated
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // 2. Verify caller is a super admin
    const callerEmail = request.auth.token.email || '';
    if (!SUPER_ADMIN_EMAILS.includes(callerEmail)) {
        logger.warn("Non-admin tried to reset password:", callerEmail);
        throw new HttpsError('permission-denied', 'Only super admins can reset passwords');
    }

    // 3. Validate input
    const { uid, newPassword } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new HttpsError('invalid-argument', 'Shop UID is required');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }

    // 4. Update the user's password
    try {
        await admin.auth().updateUser(uid, { password: newPassword });
        logger.info(`Password reset successful for UID: ${uid}`);
        return { success: true, message: 'Password updated successfully' };
    } catch (error: any) {
        logger.error("Failed to reset password:", error);
        if (error.code === 'auth/user-not-found') {
            throw new HttpsError('not-found', 'User not found');
        }
        throw new HttpsError('internal', `Failed to reset password: ${error.message}`);
    }
});

// ============================================
// Razorpay Integration
// ============================================

export const createRazorpayOrder = onCall({ cors: true }, async (request) => {
    logger.info("--- START createRazorpayOrder ---");

    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be logged in to create a subscription order');
        }

        const { planId, enterpriseMonths } = request.data;
        
        if (!['basic', 'pro', 'enterprise'].includes(planId)) {
            throw new HttpsError('invalid-argument', 'Invalid plan ID');
        }

        // Fetch prices from Firestore config
        const plansDoc = await admin.firestore().collection('config').doc('plans').get();
        if (!plansDoc.exists) {
            throw new HttpsError('internal', 'Pricing configuration not found');
        }

        const prices = plansDoc.data() as any;
        let amountInRupees = 0;

        if (planId === 'basic') {
            amountInRupees = prices.basicPrice || 499;
        } else if (planId === 'pro') {
            amountInRupees = prices.proPrice || 3999;
        } else if (planId === 'enterprise') {
            const months = parseInt(enterpriseMonths) || 1;
            const monthlyPrice = prices.enterpriseMonthlyPrice || 399;
            amountInRupees = months * monthlyPrice;
        }

        // Convert to paise (₹1 = 100 paise)
        const amountInPaise = Math.round(amountInRupees * 100);

        logger.info(`Creating Razorpay order for plan: ${planId}, amount: ₹${amountInRupees}`);

        // Initialize Razorpay
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;

        if (!key_id || !key_secret) {
            logger.error("Razorpay API Keys missing from environment");
            throw new HttpsError('internal', 'Payment gateway misconfigured');
        }

        const instance = new Razorpay({ key_id, key_secret });

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `re_${request.auth.uid.substring(0, 10)}_${Date.now()}`,
            notes: {
                shopUid: request.auth.uid,
                planId: planId,
                enterpriseMonths: enterpriseMonths || 0
            }
        };

        const order = await instance.orders.create(options);
        
        logger.info(`Successfully created Razorpay order: ${order.id}`);
        
        return {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: key_id // Send public key to client
        };

    } catch (error: any) {
        logger.error("Error creating Razorpay order:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `Failed to create order: ${error.message}`);
    }
});
