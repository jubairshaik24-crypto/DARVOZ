const axios = require("axios");

const sendWhatsAppOTP = async (phone, otp) => {
    try {
        console.log("SENDING OTP TO:", phone);
        console.log("USING TEMPLATE: darvoz_otp");
        console.log("OTP:", otp);

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

const sendWhatsAppMessage = async (
    phone,
    message
) => {

    try {

        console.log(
            "📤 SENDING WHATSAPP MESSAGE TO:",
            phone
        );

        const response =
            await axios.post(

                `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,

                {
                    messaging_product: "whatsapp",

                    to: phone,

                    type: "text",

                    text: {
                        body: message
                    }
                },

                {
                    headers: {
                        Authorization:
                            `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,

                        "Content-Type":
                            "application/json"
                    }
                }

            );


        console.log(
            "✅ WHATSAPP MESSAGE SENT:",
            JSON.stringify(
                response.data,
                null,
                2
            )
        );


        return {
            success: true,
            data: response.data
        };


    }
    catch (error) {

        console.error(
            "================================="
        );

        console.error(
            "❌ WHATSAPP SEND ERROR:"
        );

        console.error(
            JSON.stringify(
                error.response?.data ||
                error.message,
                null,
                2
            )
        );

        console.error(
            "================================="
        );


        return {
            success: false,
            error:
                error.response?.data ||
                error.message
        };

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