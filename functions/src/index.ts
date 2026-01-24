import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

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
        throw new HttpsError('invalid-argument', "Validation Error: Destination cannot be empty");
    }

    if (!billReference || typeof billReference !== 'string' || !billReference.trim()) {
        logger.error("Invalid BillReference:", billReference);
        throw new HttpsError('invalid-argument', "Validation Error: Bill Reference cannot be empty");
    }

    if (!updateMessage || typeof updateMessage !== 'string' || !updateMessage.trim()) {
        logger.error("Invalid UpdateMessage:", updateMessage);
        throw new HttpsError('invalid-argument', "Validation Error: Update Message cannot be empty");
    }

    // 2. Strict Bill URL Validation
    if (!billUrl || typeof billUrl !== 'string' || !billUrl.trim()) {
        logger.error("Invalid BillURL (Empty/Null/Type):", billUrl);
        throw new HttpsError('invalid-argument', "Validation Error: Bill URL is invalid or empty");
    }

    // 3. Ensure Bill URL matches the expected Storage format to allow stripping
    if (!billUrl.startsWith(storageBaseUrl)) {
        logger.error("Invalid BillURL Format:", billUrl, "Expected prefix:", storageBaseUrl);
        // We reject unexpected URLs to prevent sending bad links that won't work with the template's hardcoded base
        throw new HttpsError('invalid-argument', "Validation Error: Bill URL does not match expected Firebase Storage format");
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
        throw new HttpsError('internal', "Validation Error: Bill URL must be a valid http link");
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
            throw new HttpsError('internal', `MSG91 Failed: ${responseText}`);
        }

        // 8. Return Success
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { message: "Success", raw: responseText };
        }

        logger.info("WhatsApp Sent Successfully (MSG91)", { destination, messageId: data?.messageId });
        return { success: true, data };

    } catch (error: any) {
        logger.error("WhatsApp Send Exception (MSG91)", { message: error.message, stack: error.stack });
        throw new HttpsError('internal', `Failed to send WhatsApp message via MSG91: ${error.message}`);
    }
});
