"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsappNotification = exports.getSpeechmaticsToken = exports.getDeepgramApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
admin.initializeApp();
// Allow specific origins or just true for all (for development)
// Simplified: Return the API key directly (for development/testing)
// In production, consider implementing ephemeral keys with proper admin permissions
exports.getDeepgramApiKey = (0, https_1.onCall)({ cors: true }, async (request) => {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
        logger.error("Deepgram API Key is missing from environment variables");
        throw new https_1.HttpsError('internal', "Deepgram API Key not configured");
    }
    logger.info("Returning Deepgram API key");
    return { key: deepgramApiKey };
});
exports.getSpeechmaticsToken = (0, https_1.onCall)({ cors: true }, async (request) => {
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
            throw new https_1.HttpsError('internal', `Speechmatics Auth Failed: ${errorText}`);
        }
        const data = await response.json();
        return { token: data.key_value };
    }
    catch (error) {
        logger.error("Fetch Error", error);
        throw new https_1.HttpsError('internal', "Failed to fetch token");
    }
});
exports.sendWhatsappNotification = (0, https_1.onCall)({ cors: true }, async (request) => {
    // 1. Validate Auth & Inputs
    // MSG91 Credentials
    const authKey = "489901AythCbMOfajU6973c03eP1";
    const integratedNumber = "15558365545";
    const templateName = "bill_notification";
    const { destination, billReference, updateMessage, billUrl } = request.data;
    const storageBaseUrl = "https://firebasestorage.googleapis.com/v0/b/ayush-ayurveda-8623a.firebasestorage.app/o/";
    // --- STRICT VALIDATION ---
    // 1. Check for required non-empty string fields
    if (!destination || typeof destination !== 'string' || !destination.trim()) {
        logger.error("Invalid Destination:", destination);
        throw new https_1.HttpsError('invalid-argument', "Validation Error: Destination cannot be empty");
    }
    if (!billReference || typeof billReference !== 'string' || !billReference.trim()) {
        logger.error("Invalid BillReference:", billReference);
        throw new https_1.HttpsError('invalid-argument', "Validation Error: Bill Reference cannot be empty");
    }
    if (!updateMessage || typeof updateMessage !== 'string' || !updateMessage.trim()) {
        logger.error("Invalid UpdateMessage:", updateMessage);
        throw new https_1.HttpsError('invalid-argument', "Validation Error: Update Message cannot be empty");
    }
    // 2. Strict Bill URL Validation
    if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
        logger.error("Invalid BillURL (Empty/Null/Type):", billUrl);
        throw new https_1.HttpsError('invalid-argument', "Validation Error: Bill URL is invalid or empty");
    }
    // 3. Ensure Bill URL matches the expected Storage format to allow stripping
    if (!billUrl.startsWith(storageBaseUrl)) {
        logger.error("Invalid BillURL Format:", billUrl, "Expected prefix:", storageBaseUrl);
        // We reject unexpected URLs to prevent sending bad links that won't work with the template's hardcoded base
        throw new https_1.HttpsError('invalid-argument', "Validation Error: Bill URL does not match expected Firebase Storage format");
    }
    // --- END VALIDATION ---
    // 4. Log params for debugging
    logger.info("WhatsApp Request Params Validated (MSG91):", { destination, billReference, updateMessage });
    // 5. Transform URL
    // User requested full URL format. We do NOT strip the base URL.
    const finalBillUrlParam = billUrl;
    // Safety check: Ensure it looks like a URL
    if (!finalBillUrlParam || !finalBillUrlParam.startsWith('http')) {
        logger.error("BillURL Invalid:", finalBillUrlParam);
        throw new https_1.HttpsError('internal', "Validation Error: Bill URL must be a valid http link");
    }
    // 6. Prepare MSG91 Payload
    const payload = {
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en",
                    policy: "deterministic"
                },
                to_and_components: [
                    {
                        to: [destination],
                        components: {
                            body_1: {
                                type: "text",
                                value: billReference.replace('##', '#')
                            },
                            body_2: {
                                type: "text",
                                value: updateMessage
                            },
                            button_1: {
                                subtype: "url",
                                type: "text",
                                value: finalBillUrlParam
                            }
                        }
                    }
                ]
            },
            messaging_product: "whatsapp"
        }
    };
    // DEBUG LOGGING
    logger.info("MSG91 Payload Prepared:", JSON.stringify(payload));
    logger.info("MSG91 Headers:", { authkey: "REDACTED", accept: 'application/json', 'content-type': 'application/json' });
    try {
        // 7. Send Request
        // Append authkey to query string as fallback/primary method for authentication
        const response = await fetch(`https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/?authkey=${authKey}`, {
            method: 'POST',
            headers: {
                'authkey': authKey, // Keep header just in case
                'accept': 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        logger.info("MSG91 Response Status:", response.status);
        const responseText = await response.text();
        logger.info("MSG91 Response Body:", responseText);
        if (!response.ok) {
            // Check for specific error codes or messages
            logger.error("MSG91 API Error Detail:", { status: response.status, body: responseText });
            throw new https_1.HttpsError('internal', `MSG91 Failed: ${responseText}`);
        }
        // 8. Return Success
        let data;
        try {
            data = JSON.parse(responseText);
        }
        catch (e) {
            data = { message: "Success", raw: responseText };
        }
        logger.info("WhatsApp Sent Successfully (MSG91)", { destination, messageId: data === null || data === void 0 ? void 0 : data.messageId });
        return { success: true, data };
    }
    catch (error) {
        logger.error("WhatsApp Send Exception (MSG91)", { message: error.message, stack: error.stack });
        throw new https_1.HttpsError('internal', `Failed to send WhatsApp message via MSG91: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map