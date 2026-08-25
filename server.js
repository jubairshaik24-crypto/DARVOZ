// ==============================
// DARVOZ SERVER
// ==============================

require("dotenv").config();

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

app.set("io", io);

io.on("connection", (socket) => {

    console.log("Socket Connected:", socket.id);

    socket.on("joinPartner", (partnerId) => {
        socket.join(`partner_${partnerId}`);
        console.log(`Partner ${partnerId} Joined`);
    });

    // ==========================
// DELIVERY JOIN
// ==========================

socket.on("joinDelivery",(deliveryId)=>{

    socket.join(`delivery_${deliveryId}`);

    console.log(

        "Delivery Joined :",

        deliveryId

    );

});

    socket.on("joinCustomer", (customerId) => {
        socket.join(`customer_${customerId}`);
    });

    socket.on("disconnect", () => {
        console.log("Socket Disconnected:", socket.id);
    });

});

// ==============================
// MIDDLEWARE
// ==============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(path.join(__dirname, "public")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==============================
// DATABASE
// ==============================

db.getConnection((err, connection) => {

    if (err) {
        console.log("MySQL Connection Failed");
        console.log(err);
    } else {
        console.log("MySQL Connected");
        connection.release();
    }

});

// ==============================
// ROUTES
// ==============================

const whatsappRoutes = require("./routes/whatsapp");
const restaurantsRoutes =require("./routes/restaurants");
const supportRoutes =
    require("./routes/supportRoutes");
console.log("RESTAURANTS ROUTES LOADED");
const reviewRoutes = require("./routes/reviews");
const searchRoutes = require("./routes/search");
console.log("searchRoutes =", searchRoutes);
console.log("typeof searchRoutes =", typeof searchRoutes);
const adminRoutes = require("./routes/admin");
const customerRoutes = require("./routes/customer");
const walletRoutes = require("./routes/wallet");
const deliveryOrderRoutes = require("./routes/deliveryOrders");
const deliveryRoutes = require("./routes/delivery");
const adminDeliveryRoutes = require("./routes/adminDelivery");
const partnerOrderRoutes = require("./routes/partnerOrders");
const orderRoutes = require("./routes/orders");
console.log("Loading partner routes...");
const partnerRoutes = require("./routes/partner");
const importMenuRoutes = require("./routes/importMenu"); // change if your file is import-menu.js
const productRoutes = require("./routes/products");
const adminRestaurantRoutes = require("./routes/adminRestaurants");
const restaurantRoutes = require("./routes/restaurant");
const cartRoutes = require("./routes/cart");
const addressRoutes = require("./routes/address");
const paymentRoutes = require("./routes/payment");

// APIs

app.use(
    "/api/support",
    supportRoutes
);
app.use("/restaurants",restaurantsRoutes);
app.use("/admin", adminRoutes);
app.use("/address", addressRoutes);

app.use("/customer", customerRoutes);

app.use("/api/whatsapp", whatsappRoutes);

app.use("/wallet", walletRoutes);

app.use("/delivery", deliveryRoutes);

app.use("/orders", deliveryOrderRoutes);

app.use("/orders", orderRoutes);

app.use("/partner", partnerRoutes);

app.use("/partner-orders", partnerOrderRoutes);

app.use("/restaurant", restaurantRoutes);

app.use("/products", productRoutes);

app.use("/cart", cartRoutes);

app.use("/import-menu", importMenuRoutes);

app.use("/admin", adminRestaurantRoutes);

app.use("/admin", adminDeliveryRoutes);

app.use("/reviews", reviewRoutes);
app.use("/search", searchRoutes);
app.use("/payment", paymentRoutes);
// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {

    res.send("🚀 DARVOZ Server Running");

});

// ==============================
// CUSTOMER PROFILE
// ==============================

app.get("/user/profile", (req, res) => {

    const customerId = req.query.customerId;

    db.query(

        "SELECT city,state FROM customers WHERE id=?",

        [customerId],

        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            if (result.length === 0) {
                return res.json({});
            }

            res.json(result[0]);

        }

    );

});

// ==============================
// META WHATSAPP WEBHOOK
// ==============================

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "darvoz_whatsapp_verify_2026";

// Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("Webhook verification request received");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully");
        return res.status(200).send(challenge);
    }

    console.log("Webhook verification failed");
    return res.sendStatus(403);
});

// Receive WhatsApp messages and status updates
app.post("/webhook", (req, res) => {
    console.log(
        "WhatsApp Webhook:",
        JSON.stringify(req.body, null, 2)
    );

    // Meta requires a quick 200 response
    res.sendStatus(200);
});

// ==============================
// 404
// ==============================

app.use((req, res) => {

    res.status(404).json({

        success: false,
        message: "API Not Found"

    });

});


// ==============================
// START SERVER
// ==============================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

    console.log("=================================");
    console.log(`🚀 DARVOZ Server Running`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log("=================================");

    startOrderTimeoutChecker(io);

});