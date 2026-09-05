const {
    initializeApp,
    getApps,
    getApp,
    cert
} = require("firebase-admin/app");

const {
    getMessaging
} = require("firebase-admin/messaging");

let firebaseApp;

if (getApps().length === 0) {

    const privateKey = Buffer.from(
        process.env.FIREBASE_PRIVATE_KEY_BASE64,
        "base64"
    ).toString("utf8");

    firebaseApp = initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        })
    });

    console.log("🔥 DARVOZ Firebase Admin initialized");

} else {

    firebaseApp = getApp();

    console.log("🔥 DARVOZ Firebase Admin already initialized");
}

const messaging = getMessaging(firebaseApp);

module.exports = {
    app: firebaseApp,
    messaging
};