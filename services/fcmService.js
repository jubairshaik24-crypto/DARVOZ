const { messaging } = require("../config/firebaseAdmin");
// ==========================================
// DARVOZ SEND PUSH NOTIFICATION
// ==========================================

async function sendPushNotification(
    fcmToken,
    title,
    body,
    data = {}
) {

    if (!fcmToken) {
        console.log("⚠️ No FCM token provided");
        return {
            success: false,
            message: "No FCM token"
        };
    }

    try {

        const message = {
            token: fcmToken,

            notification: {
                title: title,
                body: body
            },

            data: Object.fromEntries(
                Object.entries(data).map(
                    ([key, value]) => [
                        key,
                        String(value)
                    ]
                )
            ),

            webpush: {
                notification: {
                    title: title,
                    body: body,
                    icon: "/icon-192.png"
                }
            }
        };
const response =
    await messaging.send(message);
        console.log(
            "🔥 DARVOZ PUSH SENT:",
            response
        );

        return {
            success: true,
            messageId: response
        };

    } catch (error) {

        console.error(
            "❌ DARVOZ PUSH ERROR:",
            error
        );

        return {
            success: false,
            message: error.message,
            code: error.code
        };
    }
}

module.exports = {
    sendPushNotification
};