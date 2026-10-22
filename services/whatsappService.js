const axios = require("axios");

const sendWhatsAppOTP = async (phone, otp) => {
    try {
        console.log("SENDING OTP TO:", phone);
        console.log("USING TEMPLATE: darvoz_otp");

        const response = await axios.post(
            `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                   name: "darvoz_otp",
language: { code: "en" },
                    components: [
    {
        type: "body",
        parameters: [
            {
                type: "text",
                text: otp
            }
        ]
    },
    {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [
            {
                type: "text",
                text: otp
            }
        ]
    }
]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(
            "WHATSAPP SUCCESS:",
            JSON.stringify(response.data, null, 2)
        );

        return {
            success: true,
            data: response.data
        };

    } catch (error) {

        console.log("=================================");
        console.log("WHATSAPP API FULL ERROR:");
        console.log(
            JSON.stringify(
                error.response?.data || error.message,
                null,
                2
            )
        );
        console.log("=================================");

        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

// ==============================
// SEND WHATSAPP SUPPORT MESSAGE
// ==============================


const sendWhatsAppMessage = async (phone, message) => {
    try {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

        if (!phone || !phoneNumberId || !accessToken) {
            throw new Error(
                "Missing recipient number, WHATSAPP_PHONE_NUMBER_ID, or WHATSAPP_ACCESS_TOKEN"
            );
        }

        // WhatsApp recipient format: country code + number, digits only.
        const recipient = String(phone).replace(/\D/g, "");

        console.log("📤 Support WhatsApp request starting");
        console.log("Recipient:", recipient);
        console.log("Phone Number ID configured:", Boolean(phoneNumberId));
        console.log("Access token configured:", Boolean(accessToken));

        const response = await axios.post(
            `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: recipient,
                type: "text",
                text: {
                    preview_url: false,
                    body: message
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        console.log(
            "✅ WhatsApp API accepted request:",
            JSON.stringify(response.data, null, 2)
        );

        return { success: true, data: response.data };

    } catch (error) {
        const details = error.response?.data || error.message;

        console.error(
            "❌ WhatsApp support notification failed:",
            JSON.stringify(details, null, 2)
        );

        return { success: false, error: details };
    }
};


const checkTemplates = async () => {
    try {

        const response = await axios.get(
            `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
            {
                headers: {
                    Authorization:
                        `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
                }
            }
        );

        console.log("========== META TEMPLATES ==========");
        console.log(
            JSON.stringify(response.data, null, 2)
        );
        console.log("====================================");

    } catch (error) {

        console.log(
            "TEMPLATE CHECK ERROR:",
            JSON.stringify(
                error.response?.data || error.message,
                null,
                2
            )
        );
    }
    
};


checkTemplates();

module.exports = {
    sendWhatsAppOTP,
    sendWhatsAppMessage
};
