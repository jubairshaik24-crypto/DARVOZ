// ==============================
// DARVOZ SERVER
// ==============================

require("dotenv").config();

const admin = require("./config/firebaseAdmin");

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");

const { Server } = require("socket.io");

const db = require("./config/db");

const dispatchService = require("./services/dispatchService");

const {
    startOrderTimeoutChecker
} = require("./services/orderTimeoutService");

const app = express();

const server = http.createServer(app);


// ==============================
// SOCKET.IO
// ==============================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make Socket.IO available to routes
app.set("io", io);


// ==============================
// SOCKET CONNECTION
// ==============================

io.on("connection", (socket) => {

    console.log("=================================");
    console.log("🔌 SOCKET CONNECTED:", socket.id);
    console.log("=================================");


    // ==============================
    // PARTNER JOIN
    // ==============================

    socket.on("joinPartner", (partnerId) => {

        const room = `partner_${Number(partnerId)}`;

        socket.join(room);

        console.log("=================================");
        console.log("🏪 PARTNER JOINED");
        console.log("Socket ID:", socket.id);
        console.log("Partner ID:", partnerId);
        console.log("Room:", room);

        console.log(
            "Room Members:",
            Array.from(
                io.sockets.adapter.rooms.get(room) || []
            )
        );

        console.log("=================================");

    });


    // ==============================
    // DELIVERY JOIN
    // ==============================

    socket.on("joinDelivery", (deliveryId) => {

        const room = `delivery_${Number(deliveryId)}`;

        socket.join(room);

        console.log("=================================");
        console.log("🚴 DELIVERY JOINED");
        console.log("Socket ID:", socket.id);
        console.log("Delivery ID:", deliveryId);
        console.log("Room:", room);
        console.log("=================================");

    });


    // ==============================
    // CUSTOMER JOIN
    // ==============================

    socket.on("joinCustomer", (customerId) => {

        const room = `customer_${Number(customerId)}`;

        socket.join(room);

        console.log("=================================");
        console.log("👤 CUSTOMER JOINED");
        console.log("Socket ID:", socket.id);
        console.log("Customer ID:", customerId);
        console.log("Room:", room);
        console.log("=================================");

    });


    // ==============================
    // DISCONNECT
    // ==============================

    socket.on("disconnect", () => {

        console.log("=================================");
        console.log("❌ SOCKET DISCONNECTED:", socket.id);
        console.log("=================================");

    });

});


// ==============================
// MIDDLEWARE
// ==============================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ==============================
// STATIC FILES
// ==============================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);


// ==============================
// ROUTES
// ==============================

const whatsappRoutes =
    require("./routes/whatsapp");

const restaurantsRoutes =
    require("./routes/restaurants");

const supportRoutes =
    require("./routes/supportRoutes");

console.log("RESTAURANTS ROUTES LOADED");

const reviewRoutes =
    require("./routes/reviews");

const searchRoutes =
    require("./routes/search");

console.log(
    "searchRoutes =",
    searchRoutes
);

console.log(
    "typeof searchRoutes =",
    typeof searchRoutes
);

const adminRoutes =
    require("./routes/admin");

const customerRoutes =
    require("./routes/customer");

const walletRoutes =
    require("./routes/wallet");

const deliveryPartnerRoutes =
    require("./routes/deliveryPartnerRoutes");

const adminDeliveryRoutes =
    require("./routes/adminDelivery");

    const deliveryOrdersRoutes =
    require("./routes/deliveryOrders");

const partnerOrderRoutes =
    require("./routes/partnerOrders");

const orderRoutes =
    require("./routes/orders");

console.log("Loading partner routes...");

const partnerRoutes =
    require("./routes/partner");

const importMenuRoutes =
    require("./routes/importMenu");

const productRoutes =
    require("./routes/products");

const adminRestaurantRoutes =
    require("./routes/adminRestaurants");

const restaurantRoutes =
    require("./routes/restaurant");

const cartRoutes =
    require("./routes/cart");

const addressRoutes =
    require("./routes/address");

const paymentRoutes =
    require("./routes/payment");

const {
    sendPushNotification
} = require("./services/fcmService");


// ==============================
// APIs
// ==============================

console.log(
    "whatsappRoutes =",
    whatsappRoutes
);

console.log(
    "typeof whatsappRoutes =",
    typeof whatsappRoutes
);


app.use(
    "/api/whatsapp",
    whatsappRoutes
);

app.use(
    "/delivery-orders",
    deliveryOrdersRoutes
);


app.use(
    "/api/support",
    supportRoutes
);


app.use(
    "/restaurants",
    restaurantsRoutes
);


app.use(
    "/admin",
    adminRoutes
);


app.use(
    "/address",
    addressRoutes
);


app.use(
    "/customer",
    customerRoutes
);


app.use(
    "/api/customer",
    customerRoutes
);


app.use(
    "/wallet",
    walletRoutes
);


app.use(
    "/deliveryPartner",
    deliveryPartnerRoutes
);


app.use(
    "/orders",
    orderRoutes
);


app.use(
    "/partner",
    partnerRoutes
);


app.use(
    "/partner-orders",
    partnerOrderRoutes
);


app.use(
    "/restaurant",
    restaurantRoutes
);


app.use(
    "/products",
    productRoutes
);


app.use(
    "/cart",
    cartRoutes
);


app.use(
    "/import-menu",
    importMenuRoutes
);


app.use(
    "/admin",
    adminRestaurantRoutes
);


app.use(
    "/admin",
    adminDeliveryRoutes
);


app.use(
    "/reviews",
    reviewRoutes
);


app.use(
    "/search",
    searchRoutes
);


app.use(
    "/payment",
    paymentRoutes
);


// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {

    res.send(
        "🚀 DARVOZ Server Running"
    );

});


// ==============================
// CUSTOMER PROFILE
// ==============================

app.get(
    "/user/profile",
    (req, res) => {

        try {

            const customerId =
                req.query.customerId;

            if (!customerId) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Customer ID is required"
                });

            }


            const sql = `
                SELECT city, state
                FROM customers
                WHERE id = ?
                LIMIT 1
            `;


            db.query(
                sql,
                [customerId],
                (error, results) => {

                    if (error) {

                        console.error(
                            "CUSTOMER PROFILE ERROR:",
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Database Error"
                        });

                    }


                    if (
                        !results ||
                        results.length === 0
                    ) {

                        return res.json({});

                    }


                    const customer =
                        results[0];


                    return res.json({

                        city:
                            customer.city || "",

                        state:
                            customer.state || ""

                    });

                }
            );

        }
        catch (error) {

            console.error(
                "CUSTOMER PROFILE ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Database Error"

            });

        }

    }
);


// ==============================
// META WHATSAPP WEBHOOK
// ==============================

const VERIFY_TOKEN =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "darvoz_whatsapp_verify_2026";


// ==============================
// WEBHOOK VERIFICATION
// ==============================

app.get(
    "/webhook",
    (req, res) => {

        const mode =
            req.query["hub.mode"];

        const token =
            req.query["hub.verify_token"];

        const challenge =
            req.query["hub.challenge"];


        console.log(
            "Webhook verification request received"
        );


        if (
            mode === "subscribe" &&
            token === VERIFY_TOKEN
        ) {

            console.log(
                "Webhook verified successfully"
            );

            return res
                .status(200)
                .send(challenge);

        }


        console.log(
            "Webhook verification failed"
        );

        return res.sendStatus(403);

    }
);


// ==============================
// RECEIVE WHATSAPP WEBHOOK
// ==============================

app.post(
    "/webhook",
    async (req, res) => {

        try {

            console.log("=================================");
            console.log("📩 WHATSAPP WEBHOOK RECEIVED");
            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );
            console.log("=================================");


            // Meta requires quick 200 response
            res.sendStatus(200);


            // ==============================
            // GET MESSAGE DATA
            // ==============================

            const entry =
                req.body?.entry?.[0];

            const changes =
                entry?.changes?.[0];

            const value =
                changes?.value;

            const message =
                value?.messages?.[0];


            // Ignore status updates,
            // delivery receipts, etc.
            if (!message) {

                console.log(
                    "ℹ️ No incoming customer message"
                );

                return;

            }


            // ==============================
            // CUSTOMER WHATSAPP NUMBER
            // ==============================

            const whatsappPhone =
                String(
                    message.from || ""
                ).replace(/\D/g, "");


            if (!whatsappPhone) {

                console.log(
                    "❌ WhatsApp sender number missing"
                );

                return;

            }


            // ==============================
            // CONVERT INDIA NUMBER
            // 918333995837
            //        ↓
            // 8333995837
            // ==============================

            const customerMobile =
                (
                    whatsappPhone.startsWith("91") &&
                    whatsappPhone.length === 12
                )
                    ? whatsappPhone.substring(2)
                    : whatsappPhone;


            // ==============================
            // MESSAGE TEXT
            // ==============================

            let messageText = "";


            if (
                message.type === "text" &&
                message.text?.body
            ) {

                messageText =
                    String(
                        message.text.body
                    ).trim();

            }
            else {

                messageText =
                    `[${message.type || "unknown"} message]`;

            }


            if (!messageText) {

                console.log(
                    "❌ Empty WhatsApp message"
                );

                return;

            }


            console.log(
                "📱 WhatsApp:",
                whatsappPhone
            );

            console.log(
                "📱 Customer Mobile:",
                customerMobile
            );

            console.log(
                "💬 Message:",
                messageText
            );


            // ==============================
            // FIND CUSTOMER
            // ==============================

            const customerResult =
                await db.promise().query(
                    `
                    SELECT
                        id,
                        mobile,
                        name
                    FROM customers
                    WHERE mobile = ?
                    LIMIT 1
                    `,
                    [
                        customerMobile
                    ]
                );


            let customerId = null;

            let customerName =
                "WhatsApp Customer";


            if (
                customerResult[0] &&
                customerResult[0].length > 0
            ) {

                const customer =
                    customerResult[0][0];

                customerId =
                    customer.id;

                customerName =
                    customer.name ||
                    "WhatsApp Customer";


                console.log(
                    "👤 CUSTOMER FOUND:",
                    customerId
                );

            }
            else {

                console.log(
                    "⚠️ WhatsApp number is not registered:",
                    customerMobile
                );

            }


            // ==============================
            // FIND OPEN SUPPORT CHAT
            // ==============================

            let existingChatResult;


            if (customerId) {

                [
                    existingChatResult
                ] =
                    await db.promise().query(
                        `
                        SELECT
                            chat_id,
                            order_id,
                            customer_id,
                            customer_name,
                            whatsapp_phone,
                            status
                        FROM support_chats
                        WHERE status IN ('waiting', 'active')
                        AND customer_id = ?
                        ORDER BY id DESC
                        LIMIT 1
                        `,
                        [
                            customerId
                        ]
                    );

            }
            else {

                [
                    existingChatResult
                ] =
                    await db.promise().query(
                        `
                        SELECT
                            chat_id,
                            order_id,
                            customer_id,
                            customer_name,
                            whatsapp_phone,
                            status
                        FROM support_chats
                        WHERE status IN ('waiting', 'active')
                        AND whatsapp_phone = ?
                        ORDER BY id DESC
                        LIMIT 1
                        `,
                        [
                            whatsappPhone
                        ]
                    );

            }


            let chatId = null;


            // ==============================
            // EXISTING CHAT
            // ==============================

            if (
                existingChatResult &&
                existingChatResult.length > 0
            ) {

                chatId =
                    existingChatResult[0].chat_id;


                console.log(
                    "♻️ EXISTING SUPPORT CHAT:",
                    chatId
                );

            }


            // ==============================
            // CREATE NEW CHAT
            // ==============================

            else {

                chatId =
                    "SUP-" +
                    Date.now()
                        .toString(36)
                        .toUpperCase() +
                    "-" +
                    Math.random()
                        .toString(36)
                        .substring(2, 7)
                        .toUpperCase();


                await db.promise().query(
                    `
                    INSERT INTO support_chats
                    (
                        chat_id,
                        order_id,
                        customer_id,
                        customer_name,
                        whatsapp_phone,
                        status
                    )
                    VALUES (?, NULL, ?, ?, ?, 'waiting')
                    `,
                    [
                        chatId,
                        customerId,
                        customerName,
                        whatsappPhone
                    ]
                );


                console.log(
                    "🆕 NEW SUPPORT CHAT:",
                    chatId
                );

            }


            // ==============================
            // SAVE MESSAGE
            // ==============================

            await db.promise().query(
                `
                INSERT INTO support_messages
                (
                    chat_id,
                    sender,
                    message
                )
                VALUES (?, 'customer', ?)
                `,
                [
                    chatId,
                    messageText
                ]
            );


            console.log(
                "✅ WHATSAPP MESSAGE SAVED"
            );

            console.log(
                "💬 CHAT ID:",
                chatId
            );

            console.log(
                "================================="
            );


        }
        catch (error) {

            console.error(
                "❌ WHATSAPP WEBHOOK ERROR:",
                error
            );

        }

    }
);


// ==============================
// TEST FCM NOTIFICATION
// ==============================

app.post(
    "/api/test-fcm",
    async (req, res) => {

        try {

            const customerId =
                req.body.customerId;


            if (!customerId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "customerId is required"

                });

            }


            // Get customer's FCM token
            db.query(

                `SELECT fcm_token
                 FROM customers
                 WHERE id = ?
                 LIMIT 1`,

                [customerId],

                async (
                    error,
                    results
                ) => {

                    if (error) {

                        console.error(
                            "FCM TOKEN DB ERROR:",
                            error
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Database error"

                        });

                    }


                    if (
                        !results ||
                        results.length === 0
                    ) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "Customer not found"

                        });

                    }


                    const fcmToken =
                        results[0].fcm_token;


                    if (!fcmToken) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "Customer has no FCM token"

                        });

                    }


                    const result =
                        await sendPushNotification(

                            fcmToken,

                            "🔥 DARVOZ TEST",

                            "Push notifications are working!",

                            {
                                type: "test",
                                customerId:
                                    customerId
                            }

                        );


                    return res.json(result);

                }

            );

        }
        catch (error) {

            console.error(
                "TEST FCM ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ==============================
// 404
// ==============================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API Not Found"

        });

    }
);


// ==============================
// START SERVER
// ==============================

const PORT =
    process.env.PORT || 5000;


server.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "🚀 DARVOZ Server Running"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            "📡 Socket.IO Ready"
        );

        console.log(
            "================================="
        );


        startOrderTimeoutChecker(io);

    }
);