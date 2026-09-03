const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// =====================================================
// OFFER IMAGE UPLOAD - CLOUDINARY
// =====================================================

const offerUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {

        if (
            file.mimetype &&
            file.mimetype.startsWith("image/")
        ) {

            cb(null, true);

        } else {

            cb(
                new Error(
                    "Only image files are allowed."
                )
            );

        }

    }

});

// =====================================================
// CLOUDINARY BUFFER UPLOAD HELPER
// =====================================================

function uploadOfferToCloudinary(buffer) {

    return new Promise((resolve, reject) => {

        const uploadStream =
            cloudinary.uploader.upload_stream(
                {
                    folder: "darvoz/offers",
                    resource_type: "image"
                },
                (error, result) => {

                    if (error) {
                        return reject(error);
                    }

                    resolve(result);

                }
            );

        uploadStream.end(buffer);

    });

}

// =====================================================
// DELETE CLOUDINARY OFFER IMAGE
// =====================================================

async function deleteOfferImage(imageUrl) {

    try {

        if (!imageUrl) {
            return;
        }

        // Ignore old local images
        if (
            imageUrl.startsWith("/uploads/") ||
            imageUrl.startsWith("uploads/")
        ) {
            return;
        }

        if (
            !imageUrl.includes("res.cloudinary.com")
        ) {
            return;
        }

        const parsedUrl =
            new URL(imageUrl);

        let publicId =
            parsedUrl.pathname;

        // Remove beginning slash
        publicId =
            publicId.replace(/^\/+/, "");

        // Find /upload/
        const uploadIndex =
            publicId.indexOf("/upload/");

        if (uploadIndex !== -1) {

            publicId =
                publicId.substring(
                    uploadIndex + 8
                );

        }

        // Remove version, e.g. v1234567890/
        publicId =
            publicId.replace(
                /^v\d+\//,
                ""
            );

        // Remove extension
        publicId =
            publicId.replace(
                /\.[^/.]+$/,
                ""
            );

        if (!publicId) {
            return;
        }

        await cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: "image"
            }
        );

        console.log(
            "CLOUDINARY OFFER IMAGE DELETED:",
            publicId
        );

    } catch (err) {

        console.error(
            "DELETE CLOUDINARY OFFER IMAGE ERROR:",
            err
        );

    }

}

// =====================================================
// DASHBOARD
// =====================================================

router.get("/dashboard", async (req, res) => {

    try {

        const [[restaurants]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM restaurants"
            );

        const [[pending]] =
            await db.promise().query(`
                SELECT COUNT(*) AS total
                FROM restaurants
                WHERE status='Pending'
            `);

        const [[orders]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM orders"
            );

        const [[customers]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM customers"
            );

        const [[delivery]] =
            await db.promise().query(
                "SELECT COUNT(*) AS total FROM delivery_partners"
            );

        const [[revenue]] =
            await db.promise().query(`
                SELECT IFNULL(SUM(grand_total), 0) AS total
                FROM orders
                WHERE status='Delivered'
            `);

        const [[adminWallet]] =
            await db.promise().query(`
                SELECT IFNULL(balance, 0) AS balance
                FROM wallets
                WHERE user_type='admin'
                AND user_id=1
                LIMIT 1
            `);

        res.json({

            totalRestaurants:
                Number(restaurants.total || 0),

            pending:
                Number(pending.total || 0),

            totalOrders:
                Number(orders.total || 0),

            totalCustomers:
                Number(customers.total || 0),

            totalDeliveryPartners:
                Number(delivery.total || 0),

            revenue:
                Number(revenue.total || 0),

            adminWalletBalance:
                Number(
                    adminWallet?.balance || 0
                )

        });

    } catch (err) {

        console.error(
            "DASHBOARD ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Dashboard Error"
        });

    }

});

// =====================================================
// ADMIN WALLET
// =====================================================

router.get("/wallet", async (req, res) => {

    try {

        const [[wallet]] =
            await db.promise().query(`
                SELECT id, balance
                FROM wallets
                WHERE user_type='admin'
                AND user_id=1
                LIMIT 1
            `);

        res.json({

            success: true,

            balance:
                Number(wallet?.balance || 0)

        });

    } catch (err) {

        console.error(
            "ADMIN WALLET ERROR:",
            err
        );

        res.status(500).json({

            success: false,
            balance: 0,

            message:
                "Unable to load admin wallet."

        });

    }

});

// =====================================================
// LATEST ORDERS
// =====================================================

router.get("/latest-orders", async (req, res) => {

    try {

        const [orders] =
            await db.promise().query(`
                SELECT
                    id,
                    restaurant_name,
                    customer_name,
                    grand_total,
                    status
                FROM orders
                ORDER BY id DESC
                LIMIT 10
            `);

        res.json(orders);

    } catch (err) {

        console.error(
            "LATEST ORDERS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Database Error"
        });

    }

});

// =====================================================
// PENDING RESTAURANTS
// =====================================================

router.get("/pending-partners", async (req, res) => {

    try {

        const [restaurants] =
            await db.promise().query(`
                SELECT
                    id,
                    restaurant_name,
                    owner_name,
                    mobile,
                    city,
                    logo,
                    status
                FROM restaurants
                WHERE status='Pending'
                ORDER BY id DESC
            `);

        res.json(restaurants);

    } catch (err) {

        console.error(
            "PENDING PARTNERS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Database Error"
        });

    }

});

// =====================================================
// APPROVE RESTAURANT + SET COMMISSION
// =====================================================

router.put(
    "/approve-partner/:id",
    async (req, res) => {

        try {

            const restaurantId =
                Number(req.params.id);

            const commissionPercent =
                Number(
                    req.body.commission_percent
                );

            if (
                !Number.isInteger(restaurantId) ||
                restaurantId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid restaurant ID"
                });

            }

            if (
                !Number.isFinite(
                    commissionPercent
                ) ||
                commissionPercent < 0 ||
                commissionPercent > 100
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Commission must be between 0% and 100%"
                });

            }

            const [result] =
                await db.promise().query(`
                    UPDATE restaurants
                    SET
                        status='Approved',
                        commission_percent=?
                    WHERE id=?
                `, [
                    commissionPercent,
                    restaurantId
                ]);

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Restaurant not found"
                });

            }

            res.json({

                success: true,

                message:
                    `Restaurant approved with ${commissionPercent}% commission.`,

                commission_percent:
                    commissionPercent

            });

        } catch (err) {

            console.error(
                "APPROVE PARTNER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// REJECT RESTAURANT
// =====================================================

router.delete(
    "/reject-partner/:id",
    async (req, res) => {

        try {

            const [result] =
                await db.promise().query(
                    "DELETE FROM restaurants WHERE id=?",
                    [req.params.id]
                );

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Restaurant not found"
                });

            }

            res.json({
                success: true,
                message:
                    "Restaurant Deleted"
            });

        } catch (err) {

            console.error(
                "REJECT PARTNER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// ALL RESTAURANTS
// =====================================================

router.get("/restaurants", async (req, res) => {

    try {

        const [restaurants] =
            await db.promise().query(`
                SELECT
                    id,
                    restaurant_name,
                    owner_name,
                    mobile,
                    city,
                    logo,
                    status,
                    rating,
                    delivery_time,
                    commission_percent
                FROM restaurants
                ORDER BY id DESC
            `);

        res.json(restaurants);

    } catch (err) {

        console.error(
            "RESTAURANTS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Database Error"
        });

    }

});

// =====================================================
// UPDATE RESTAURANT
// =====================================================

router.put(
    "/restaurant/:id",
    async (req, res) => {

        try {

            const {
                restaurant_name,
                owner_name,
                mobile,
                email,
                address,
                city,
                state,
                pincode,
                delivery_time,
                rating,
                commission_percent
            } = req.body;

            const commissionPercent =
                Number(commission_percent);

            if (
                !Number.isFinite(
                    commissionPercent
                ) ||
                commissionPercent < 0 ||
                commissionPercent > 100
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Commission must be between 0% and 100%"
                });

            }

            const [result] =
                await db.promise().query(`
                    UPDATE restaurants
                    SET
                        restaurant_name=?,
                        owner_name=?,
                        mobile=?,
                        email=?,
                        address=?,
                        city=?,
                        state=?,
                        pincode=?,
                        delivery_time=?,
                        rating=?,
                        commission_percent=?
                    WHERE id=?
                `, [

                    restaurant_name,
                    owner_name,
                    mobile,
                    email,
                    address,
                    city,
                    state,
                    pincode,
                    delivery_time,
                    rating,
                    commissionPercent,
                    req.params.id

                ]);

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Restaurant not found"
                });

            }

            res.json({

                success: true,

                message:
                    "Restaurant Updated Successfully",

                commission_percent:
                    commissionPercent

            });

        } catch (err) {

            console.error(
                "UPDATE RESTAURANT ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// BLOCK / UNBLOCK RESTAURANT
// =====================================================

router.put(
    "/toggle-restaurant/:id",
    async (req, res) => {

        try {

            const [restaurants] =
                await db.promise().query(
                    "SELECT status FROM restaurants WHERE id=?",
                    [req.params.id]
                );

            if (restaurants.length === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Restaurant Not Found"
                });

            }

            const newStatus =
                restaurants[0].status ===
                "Approved"
                    ? "Pending"
                    : "Approved";

            await db.promise().query(
                "UPDATE restaurants SET status=? WHERE id=?",
                [
                    newStatus,
                    req.params.id
                ]
            );

            res.json({
                success: true,
                status: newStatus
            });

        } catch (err) {

            console.error(
                "TOGGLE RESTAURANT ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// DELETE RESTAURANT
// =====================================================

router.delete(
    "/delete-restaurant/:id",
    async (req, res) => {

        try {

            const [result] =
                await db.promise().query(
                    "DELETE FROM restaurants WHERE id=?",
                    [req.params.id]
                );

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Restaurant not found"
                });

            }

            res.json({
                success: true,
                message:
                    "Restaurant Deleted"
            });

        } catch (err) {

            console.error(
                "DELETE RESTAURANT ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// ALL ORDERS
// =====================================================

router.get("/orders", async (req, res) => {

    try {

        const [orders] =
            await db.promise().query(`
                SELECT
                    id,
                    customer_name,
                    restaurant_name,
                    mobile,
                    address,
                    payment,
                    food_total,
                    delivery_fee,
                    platform_fee,
                    grand_total,
                    status,
                    partner_id,
                    delivery_partner_id,
                    commission_percent
                FROM orders
                ORDER BY id DESC
            `);

        res.json(orders);

    } catch (err) {

        console.error(
            "ORDERS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Database Error"
        });

    }

});

// =====================================================
// SINGLE ORDER + ITEMS
// =====================================================

router.get(
    "/order/:id",
    async (req, res) => {

        try {

            const id = req.params.id;

            const [orders] =
                await db.promise().query(
                    "SELECT * FROM orders WHERE id=?",
                    [id]
                );

            if (orders.length === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Order Not Found"
                });

            }

            const [items] =
                await db.promise().query(
                    "SELECT * FROM order_items WHERE order_id=?",
                    [id]
                );

            const order = orders[0];

            order.items = items;

            res.json(order);

        } catch (err) {

            console.error(
                "ORDER DETAILS ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Server Error"
            });

        }

    }
);

// =====================================================
// CUSTOMER / ORDER LOOKUP
// SEARCH BY ORDER ID OR CUSTOMER MOBILE
// =====================================================

router.get(
    "/customer-order-lookup",
    async (req, res) => {

        try {

            const search =
                String(req.query.search || "").trim();

            if (!search) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order ID or customer mobile is required."

                });

            }

            // =================================================
            // SEARCH BY ORDER ID
            // =================================================

            if (/^\d+$/.test(search)) {

                const orderId =
                    Number(search);

                const [orderRows] =
                    await db.promise().query(
                        `
                        SELECT *
                        FROM orders
                        WHERE id=?
                        LIMIT 1
                        `,
                        [orderId]
                    );

                if (orderRows.length > 0) {

                    const order =
                        orderRows[0];

                    // =========================================
                    // ORDER ITEMS
                    // =========================================

                    const [items] =
                        await db.promise().query(
                            `
                            SELECT *
                            FROM order_items
                            WHERE order_id=?
                            ORDER BY id ASC
                            `,
                            [orderId]
                        );

                    // =========================================
                    // CUSTOMER
                    // =========================================

                    let customer = null;

                    if (order.customer_id) {

                        const [customerRows] =
                            await db.promise().query(
                                `
                                SELECT *
                                FROM customers
                                WHERE id=?
                                LIMIT 1
                                `,
                                [order.customer_id]
                            );

                        if (customerRows.length > 0) {

                            customer =
                                customerRows[0];

                        }

                    }

                    // =========================================
                    // FALLBACK CUSTOMER BY MOBILE
                    // =========================================

                    if (
                        !customer &&
                        order.mobile
                    ) {

                        const [customerRows] =
                            await db.promise().query(
                                `
                                SELECT *
                                FROM customers
                                WHERE mobile=?
                                LIMIT 1
                                `,
                                [order.mobile]
                            );

                        if (customerRows.length > 0) {

                            customer =
                                customerRows[0];

                        }

                    }

                    // =========================================
                    // DELIVERY PARTNER
                    // =========================================

                    let deliveryPartner = null;

                    if (
                        order.delivery_partner_id
                    ) {

                        const [deliveryRows] =
                            await db.promise().query(
                                `
                                SELECT *
                                FROM delivery_partners
                                WHERE id=?
                                LIMIT 1
                                `,
                                [
                                    order.delivery_partner_id
                                ]
                            );

                        if (
                            deliveryRows.length > 0
                        ) {

                            deliveryPartner =
                                deliveryRows[0];

                        }

                    }

                    // =========================================
                    // SUPPORT HISTORY
                    // =========================================

                    const [supportChats] =
                        await db.promise().query(
                            `
                            SELECT
                                chat_id,
                                order_id,
                                customer_id,
                                customer_name,
                                status,
                                support_joined_at,
                                created_at,
                                updated_at
                            FROM support_chats
                            WHERE order_id=?
                            ORDER BY created_at DESC
                            `,
                            [orderId]
                        );

                    // =========================================
                    // SUPPORT MESSAGES
                    // =========================================

                    for (
                        const chat
                        of supportChats
                    ) {

                        const [messages] =
                            await db.promise().query(
                                `
                                SELECT
                                    id,
                                    sender,
                                    message,
                                    created_at
                                FROM support_messages
                                WHERE chat_id=?
                                ORDER BY created_at ASC
                                `,
                                [chat.chat_id]
                            );

                        chat.messages =
                            messages;

                    }

// =========================================
// PAYMENT INFORMATION
// =========================================

const paymentStatus =
    order.payment_status ||
    order.paymentStatus ||
    order.transaction_status ||
    order.transactionStatus ||
    (
        order.payment_id
            ? "Paid"
            : (
                String(order.payment || "")
                    .trim()
                    .toUpperCase() === "COD"
                    ? "Cash on Delivery"
                    : "Not stored"
            )
    );

const payment = {

    method:
        order.payment || null,

    status:
        paymentStatus,

    transaction_id:
        order.payment_id || null,

    payment_id:
        order.payment_id || null,

    payment_order_id:
        order.payment_order_id || null

};

                    return res.json({

                        success: true,

                        searchType: "order",

                        order: {

                            ...order,

                            items

                        },

                        customer,

                        deliveryPartner,

                        payment,

                        supportChats

                    });

                }

            }

            // =================================================
            // SEARCH CUSTOMER BY MOBILE
            // =================================================

            const mobileSearch =
                search.replace(
                    /[\s\-()+]/g,
                    ""
                );

            const [customers] =
                await db.promise().query(
                    `
                    SELECT *
                    FROM customers
                    WHERE
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(mobile, ' ', ''),
                                    '-',
                                    ''
                                ),
                                '+',
                                ''
                            ),
                            '(',
                            ''
                        ) LIKE ?
                    ORDER BY id DESC
                    `,
                    [
                        `%${mobileSearch}%`
                    ]
                );

            if (customers.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "No order or customer found."

                });

            }

            const customerResults = [];

            for (
                const customer
                of customers
            ) {

                // =============================================
// ALL CUSTOMER ORDERS
// =============================================

const normalizedCustomerMobile =
    String(customer.mobile || "")
        .replace(/[\s\-()+]/g, "");

const [orders] =
    await db.promise().query(
        `
        SELECT *
        FROM orders
        WHERE
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(mobile, ' ', ''),
                        '-',
                        ''
                    ),
                    '+',
                    ''
                ),
                '(',
                ''
            ) LIKE ?
        ORDER BY id DESC
        `,
        [
            `%${normalizedCustomerMobile}%`
        ]
    );
                

                for (
                    const order
                    of orders
                ) {

                    // =========================================
                    // ITEMS
                    // =========================================

                    const [items] =
                        await db.promise().query(
                            `
                            SELECT *
                            FROM order_items
                            WHERE order_id=?
                            ORDER BY id ASC
                            `,
                            [order.id]
                        );

                    order.items =
                        items;

                    // =========================================
                    // DELIVERY PARTNER
                    // =========================================

                    order.deliveryPartner =
                        null;

                    if (
                        order.delivery_partner_id
                    ) {

                        const [deliveryRows] =
                            await db.promise().query(
                                `
                                SELECT *
                                FROM delivery_partners
                                WHERE id=?
                                LIMIT 1
                                `,
                                [
                                    order.delivery_partner_id
                                ]
                            );

                        if (
                            deliveryRows.length > 0
                        ) {

                            order.deliveryPartner =
                                deliveryRows[0];

                        }

                    }
                    

 // =========================================
// PAYMENT DETAILS
// =========================================

const paymentStatus =
    order.payment_status ||
    order.paymentStatus ||
    order.transaction_status ||
    order.transactionStatus ||
    (
        order.payment_id
            ? "Paid"
            : (
                String(order.payment || "")
                    .trim()
                    .toUpperCase() === "COD"
                    ? "Cash on Delivery"
                    : "Not stored"
            )
    );

order.paymentDetails = {

    method:
        order.payment || null,

    status:
        paymentStatus,

    transaction_id:
        order.payment_id || null,

    payment_id:
        order.payment_id || null,

    payment_order_id:
        order.payment_order_id || null

};

                    // =========================================
                    // SUPPORT HISTORY FOR THIS ORDER
                    // =========================================

                    const [supportChats] =
                        await db.promise().query(
                            `
                            SELECT
                                chat_id,
                                order_id,
                                customer_id,
                                customer_name,
                                status,
                                support_joined_at,
                                created_at,
                                updated_at
                            FROM support_chats
                            WHERE order_id=?
                            ORDER BY created_at DESC
                            `,
                            [order.id]
                        );

                    for (
                        const chat
                        of supportChats
                    ) {

                        const [messages] =
                            await db.promise().query(
                                `
                                SELECT
                                    id,
                                    sender,
                                    message,
                                    created_at
                                FROM support_messages
                                WHERE chat_id=?
                                ORDER BY created_at ASC
                                `,
                                [chat.chat_id]
                            );

                        chat.messages =
                            messages;

                    }

                    order.supportChats =
                        supportChats;

                }

                customerResults.push({

                    customer,

                    orders

                });

            }

            return res.json({

                success: true,

                searchType: "mobile",

                results:
                    customerResults

            });

        } catch (err) {

            console.error(
                "CUSTOMER / ORDER LOOKUP ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to perform customer/order lookup."

            });

        }

    }
);

// =====================================================
// UPDATE ORDER STATUS + WALLET CREDIT / CANCELLATION
// =====================================================

router.put(
    "/update-order/:id",
    async (req, res) => {

        let connection;

        try {

            const orderId =
                Number(req.params.id);

            const { status } =
                req.body;

            if (
                !Number.isInteger(orderId) ||
                orderId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid order ID"
                });

            }

            if (!status) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Status is required"
                });

            }

            connection =
                await db.promise().getConnection();

            await connection.beginTransaction();

            const [orders] =
                await connection.query(`
                    SELECT
                        id,
                        partner_id,
                        delivery_partner_id,
                        food_total,
                        delivery_fee,
                        platform_fee,
                        commission_percent,
                        status,
                        partner_wallet_credited,
                        admin_commission_credited,
                        delivery_wallet_credited
                    FROM orders
                    WHERE id=?
                    FOR UPDATE
                `, [orderId]);

            if (orders.length === 0) {

                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        "Order not found"
                });

            }

            const order = orders[0];

            const foodTotal =
                Number(order.food_total || 0);

            const deliveryFee =
                Number(order.delivery_fee || 0);

            const commissionPercent =
                Number(
                    order.commission_percent || 0
                );

            const commissionAmount =
                foodTotal *
                commissionPercent /
                100;

            const partnerAmount =
                foodTotal -
                commissionAmount;

            // ============================================
            // CANCEL ORDER
            // ============================================

            if (status === "Cancelled") {

                if (
                    order.status === "Cancelled"
                ) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            "Order is already cancelled."
                    });

                }

                // ========================================
                // REVERSE PARTNER CREDIT
                // ========================================

                if (
                    Number(
                        order.partner_wallet_credited
                    ) === 1 &&
                    partnerAmount > 0
                ) {

                    if (!order.partner_id) {

                        await connection.rollback();

                        return res.status(400).json({
                            success: false,
                            message:
                                "Partner is missing for this order."
                        });

                    }

                    const [walletRows] =
                        await connection.query(`
                            SELECT id, balance
                            FROM wallets
                            WHERE user_type='partner'
                            AND user_id=?
                            FOR UPDATE
                        `, [
                            order.partner_id
                        ]);

                    if (
                        walletRows.length === 0
                    ) {

                        await connection.rollback();

                        return res.status(404).json({
                            success: false,
                            message:
                                "Partner wallet not found."
                        });

                    }

                    const wallet =
                        walletRows[0];

                    if (
                        Number(wallet.balance || 0) <
                        partnerAmount
                    ) {

                        await connection.rollback();

                        return res.status(400).json({
                            success: false,
                            message:
                                "Partner wallet does not have enough balance to reverse this order."
                        });

                    }

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance - ?
                        WHERE id=?
                    `, [
                        partnerAmount,
                        wallet.id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'partner',
                            ?,
                            ?,
                            ?,
                            'Debit',
                            'Order Cancellation'
                        )
                    `, [
                        order.partner_id,
                        orderId,
                        partnerAmount
                    ]);

                }

                // ========================================
                // REVERSE ADMIN COMMISSION
                // ========================================

                if (
                    Number(
                        order.admin_commission_credited
                    ) === 1 &&
                    commissionAmount > 0
                ) {

                    const [walletRows] =
                        await connection.query(`
                            SELECT id, balance
                            FROM wallets
                            WHERE user_type='admin'
                            AND user_id=1
                            FOR UPDATE
                        `);

                    if (
                        walletRows.length === 0
                    ) {

                        await connection.rollback();

                        return res.status(404).json({
                            success: false,
                            message:
                                "Admin wallet not found."
                        });

                    }

                    const wallet =
                        walletRows[0];

                    if (
                        Number(wallet.balance || 0) <
                        commissionAmount
                    ) {

                        await connection.rollback();

                        return res.status(400).json({
                            success: false,
                            message:
                                "Admin wallet does not have enough balance to reverse this commission."
                        });

                    }

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance - ?
                        WHERE id=?
                    `, [
                        commissionAmount,
                        wallet.id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'admin',
                            1,
                            ?,
                            ?,
                            'Debit',
                            'Order Cancellation'
                        )
                    `, [
                        orderId,
                        commissionAmount
                    ]);

                }

                // ========================================
                // REVERSE DELIVERY CREDIT
                // ========================================

                if (
                    Number(
                        order.delivery_wallet_credited
                    ) === 1 &&
                    deliveryFee > 0
                ) {

                    if (
                        !order.delivery_partner_id
                    ) {

                        await connection.rollback();

                        return res.status(400).json({
                            success: false,
                            message:
                                "Delivery partner is missing for this order."
                        });

                    }

                    const [walletRows] =
                        await connection.query(`
                            SELECT id, balance
                            FROM wallets
                            WHERE user_type='delivery'
                            AND user_id=?
                            FOR UPDATE
                        `, [
                            order.delivery_partner_id
                        ]);

                    if (
                        walletRows.length === 0
                    ) {

                        await connection.rollback();

                        return res.status(404).json({
                            success: false,
                            message:
                                "Delivery partner wallet not found."
                        });

                    }

                    const wallet =
                        walletRows[0];

                    if (
                        Number(wallet.balance || 0) <
                        deliveryFee
                    ) {

                        await connection.rollback();

                        return res.status(400).json({
                            success: false,
                            message:
                                "Delivery partner wallet does not have enough balance to reverse this order."
                        });

                    }

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance - ?
                        WHERE id=?
                    `, [
                        deliveryFee,
                        wallet.id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'delivery',
                            ?,
                            ?,
                            ?,
                            'Debit',
                            'Order Cancellation'
                        )
                    `, [
                        order.delivery_partner_id,
                        orderId,
                        deliveryFee
                    ]);

                }

                await connection.query(`
                    UPDATE orders
                    SET
                        partner_wallet_credited=0,
                        admin_commission_credited=0,
                        delivery_wallet_credited=0,
                        status='Cancelled'
                    WHERE id=?
                `, [orderId]);

                await connection.commit();

                return res.json({
                    success: true,
                    message:
                        "Order cancelled and wallet amounts reversed successfully."
                });

            }

            // ============================================
            // PICKED UP
            // CREDIT PARTNER + ADMIN
            // ============================================

            if (
                (
                    status === "Picked Up" ||
                    status === "Picked"
                ) &&
                Number(
                    order.partner_wallet_credited
                ) === 0
            ) {

                if (!order.partner_id) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            "Partner is not assigned to this order."
                    });

                }

                if (
                    !Number.isFinite(
                        partnerAmount
                    ) ||
                    partnerAmount < 0
                ) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid partner wallet amount."
                    });

                }

                const [partnerWallets] =
                    await connection.query(`
                        SELECT id
                        FROM wallets
                        WHERE user_type='partner'
                        AND user_id=?
                        FOR UPDATE
                    `, [
                        order.partner_id
                    ]);

                if (
                    partnerWallets.length === 0
                ) {

                    await connection.rollback();

                    return res.status(404).json({
                        success: false,
                        message:
                            "Partner wallet not found."
                    });

                }

                if (partnerAmount > 0) {

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance + ?
                        WHERE id=?
                    `, [
                        partnerAmount,
                        partnerWallets[0].id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'partner',
                            ?,
                            ?,
                            ?,
                            'Credit',
                            'Order Payment'
                        )
                    `, [
                        order.partner_id,
                        orderId,
                        partnerAmount
                    ]);

                }

                const [adminWallets] =
                    await connection.query(`
                        SELECT id
                        FROM wallets
                        WHERE user_type='admin'
                        AND user_id=1
                        FOR UPDATE
                    `);

                if (
                    adminWallets.length === 0
                ) {

                    await connection.rollback();

                    return res.status(404).json({
                        success: false,
                        message:
                            "Admin wallet not found."
                    });

                }

                if (commissionAmount > 0) {

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance + ?
                        WHERE id=?
                    `, [
                        commissionAmount,
                        adminWallets[0].id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'admin',
                            1,
                            ?,
                            ?,
                            'Credit',
                            'Order Commission'
                        )
                    `, [
                        orderId,
                        commissionAmount
                    ]);

                }

                await connection.query(`
                    UPDATE orders
                    SET
                        partner_wallet_credited=1,
                        admin_commission_credited=1
                    WHERE id=?
                `, [orderId]);

            }

            // ============================================
            // DELIVERED
            // CREDIT DELIVERY PARTNER
            // ============================================

            if (
                status === "Delivered" &&
                Number(
                    order.delivery_wallet_credited
                ) === 0
            ) {

                if (
                    !order.delivery_partner_id
                ) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            "Delivery partner is not assigned."
                    });

                }

                const [deliveryWallets] =
                    await connection.query(`
                        SELECT id
                        FROM wallets
                        WHERE user_type='delivery'
                        AND user_id=?
                        FOR UPDATE
                    `, [
                        order.delivery_partner_id
                    ]);

                if (
                    deliveryWallets.length === 0
                ) {

                    await connection.rollback();

                    return res.status(404).json({
                        success: false,
                        message:
                            "Delivery partner wallet not found."
                    });

                }

                if (deliveryFee > 0) {

                    await connection.query(`
                        UPDATE wallets
                        SET balance = balance + ?
                        WHERE id=?
                    `, [
                        deliveryFee,
                        deliveryWallets[0].id
                    ]);

                    await connection.query(`
                        INSERT INTO wallet_transactions
                        (
                            user_type,
                            user_id,
                            order_id,
                            amount,
                            type,
                            transaction_type
                        )
                        VALUES
                        (
                            'delivery',
                            ?,
                            ?,
                            ?,
                            'Credit',
                            'Delivery Earnings'
                        )
                    `, [
                        order.delivery_partner_id,
                        orderId,
                        deliveryFee
                    ]);

                }

                await connection.query(`
                    UPDATE orders
                    SET delivery_wallet_credited=1
                    WHERE id=?
                `, [orderId]);

            }

            // ============================================
            // UPDATE STATUS
            // ============================================

            await connection.query(`
                UPDATE orders
                SET status=?
                WHERE id=?
            `, [
                status,
                orderId
            ]);

            await connection.commit();

            return res.json({
                success: true,
                message:
                    "Order status updated successfully."
            });

        } catch (err) {

            if (connection) {

                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        "ROLLBACK ERROR:",
                        rollbackError
                    );
                }

            }

            console.error(
                "UPDATE ORDER + WALLET ERROR:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to update order."
            });

        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);

// =====================================================
// ALL CUSTOMERS
// =====================================================

router.get("/customers", async (req, res) => {

    try {

        const [customers] =
            await db.promise().query(`
                SELECT
                    id,
                    name,
                    mobile,
                    email,
                    city,
                    state,
                    profile_image,
                    is_verified,
                    created_at
                FROM customers
                ORDER BY id DESC
            `);

        res.json(customers);

    } catch (err) {

        console.error(
            "CUSTOMERS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Database Error"
        });

    }

});

// =====================================================
// SINGLE CUSTOMER
// =====================================================

router.get(
    "/customer/:id",
    async (req, res) => {

        try {

            const [customers] =
                await db.promise().query(
                    "SELECT * FROM customers WHERE id=?",
                    [req.params.id]
                );

            if (
                customers.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Customer Not Found"
                });

            }

            res.json(customers[0]);

        } catch (err) {

            console.error(
                "CUSTOMER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// DELETE CUSTOMER
// =====================================================

router.delete(
    "/customer/:id",
    async (req, res) => {

        try {

            const [result] =
                await db.promise().query(
                    "DELETE FROM customers WHERE id=?",
                    [req.params.id]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Customer not found."
                });

            }

            res.json({
                success: true,
                message:
                    "Customer deleted successfully."
            });

        } catch (err) {

            console.error(
                "DELETE CUSTOMER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Server Error"
            });

        }

    }
);

// =====================================================
// ALL DELIVERY PARTNERS
// =====================================================

router.get(
    "/delivery-partners",
    async (req, res) => {

        try {

            const [partners] =
                await db.promise().query(`
                    SELECT
                        id,
                        name,
                        mobile,
                        email,
                        vehicle,
                        status,
                        account_status,
                        online_status,
                        latitude,
                        longitude,
                        created_at
                    FROM delivery_partners
                    ORDER BY id DESC
                `);

            res.json(partners);

        } catch (err) {

            console.error(
                "DELIVERY PARTNERS ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// SINGLE DELIVERY PARTNER
// =====================================================

router.get(
    "/delivery-partner/:id",
    async (req, res) => {

        try {

            const [partners] =
                await db.promise().query(
                    "SELECT * FROM delivery_partners WHERE id=?",
                    [req.params.id]
                );

            if (
                partners.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Delivery Partner Not Found"
                });

            }

            res.json(partners[0]);

        } catch (err) {

            console.error(
                "DELIVERY PARTNER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// DELETE DELIVERY PARTNER
// =====================================================

router.delete(
    "/delete-delivery-partner/:id",
    async (req, res) => {

        try {

            const [result] =
                await db.promise().query(
                    "DELETE FROM delivery_partners WHERE id=?",
                    [req.params.id]
                );

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Delivery Partner Not Found"
                });

            }

            res.json({
                success: true,
                message:
                    "Delivery Partner Deleted"
            });

        } catch (err) {

            console.error(
                "DELETE DELIVERY PARTNER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Database Error"
            });

        }

    }
);

// =====================================================
// AVAILABLE DELIVERY PARTNERS
// =====================================================

router.get(
    "/available-delivery-partners",
    async (req, res) => {

        try {

            const [partners] =
                await db.promise().query(`
                    SELECT
                        id,
                        name,
                        mobile
                    FROM delivery_partners
                    WHERE account_status='Approved'
                    AND online_status='Online'
                    ORDER BY name
                `);

            res.json(partners);

        } catch (err) {

            console.error(
                "AVAILABLE DELIVERY PARTNERS ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Server Error"
            });

        }

    }
);

// =====================================================
// REVENUE
// =====================================================

router.get("/revenue", async (req, res) => {

    try {

        const [[total]] =
            await db.promise().query(`
                SELECT
                    COUNT(*) AS totalOrders,
                    IFNULL(SUM(food_total),0)
                        AS foodSales,
                    IFNULL(SUM(delivery_fee),0)
                        AS deliveryIncome,
                    IFNULL(SUM(platform_fee),0)
                        AS platformIncome,
                    IFNULL(SUM(grand_total),0)
                        AS totalRevenue
                FROM orders
                WHERE status='Delivered'
            `);

        const [[today]] =
            await db.promise().query(`
                SELECT
                    IFNULL(SUM(grand_total),0)
                        AS todayRevenue
                FROM orders
                WHERE DATE(created_at)=CURDATE()
                AND status='Delivered'
            `);

        res.json({

            totalOrders:
                Number(total.totalOrders || 0),

            foodSales:
                Number(total.foodSales || 0),

            deliveryIncome:
                Number(total.deliveryIncome || 0),

            platformIncome:
                Number(total.platformIncome || 0),

            totalRevenue:
                Number(total.totalRevenue || 0),

            todayRevenue:
                Number(today.todayRevenue || 0)

        });

    } catch (err) {

        console.error(
            "REVENUE ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

// =====================================================
// ORDER STATUS REPORT
// =====================================================

router.get(
    "/order-report",
    async (req, res) => {

        try {

            const [report] =
                await db.promise().query(`
                    SELECT
                        status,
                        COUNT(*) AS total
                    FROM orders
                    GROUP BY status
                `);

            res.json(report);

        } catch (err) {

            console.error(
                "ORDER REPORT ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message: "Server Error"
            });

        }

    }
);

// =====================================================
// REPORTS
// =====================================================

router.get("/reports", async (req, res) => {

    try {

        const [[restaurants]] =
            await db.promise().query(
                "SELECT COUNT(*) AS restaurants FROM restaurants"
            );

        const [[customers]] =
            await db.promise().query(
                "SELECT COUNT(*) AS customers FROM customers"
            );

        const [[delivery]] =
            await db.promise().query(
                "SELECT COUNT(*) AS deliveryPartners FROM delivery_partners"
            );

        const [[orders]] =
            await db.promise().query(
                "SELECT COUNT(*) AS orders FROM orders"
            );

        const [[delivered]] =
            await db.promise().query(`
                SELECT COUNT(*) AS delivered
                FROM orders
                WHERE status='Delivered'
            `);

        const [[cancelled]] =
            await db.promise().query(`
                SELECT COUNT(*) AS cancelled
                FROM orders
                WHERE status='Cancelled'
            `);

        const [[revenue]] =
            await db.promise().query(`
                SELECT
                    IFNULL(SUM(grand_total),0)
                    AS revenue
                FROM orders
                WHERE status='Delivered'
            `);

        res.json({

            restaurants:
                Number(
                    restaurants.restaurants || 0
                ),

            customers:
                Number(
                    customers.customers || 0
                ),

            deliveryPartners:
                Number(
                    delivery.deliveryPartners || 0
                ),

            orders:
                Number(
                    orders.orders || 0
                ),

            delivered:
                Number(
                    delivered.delivered || 0
                ),

            cancelled:
                Number(
                    cancelled.cancelled || 0
                ),

            revenue:
                Number(
                    revenue.revenue || 0
                )

        });

    } catch (err) {

        console.error(
            "REPORTS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

// =====================================================
// GET ALL WITHDRAWAL REQUESTS
// =====================================================

router.get(
    "/withdrawals",
    async (req, res) => {

        try {

            const [rows] =
                await db.promise().query(`

                    SELECT

                        w.id,

                        w.user_type,

                        w.user_id,

                        w.amount,

                        w.status,

                        w.requested_at,

                        w.processed_at,

                        CASE

                            WHEN w.user_type='partner'
                            THEN r.restaurant_name

                            WHEN w.user_type='delivery'
                            THEN d.name

                            ELSE 'Unknown'

                        END AS name,

                        CASE

                            WHEN w.user_type='partner'
                            THEN r.owner_name

                            WHEN w.user_type='delivery'
                            THEN d.name

                            ELSE '-'

                        END AS owner_name,

                        CASE

                            WHEN w.user_type='partner'
                            THEN r.mobile

                            WHEN w.user_type='delivery'
                            THEN d.mobile

                            ELSE '-'

                        END AS mobile,

                        COALESCE(
                            wallet.balance,
                            0
                        ) AS wallet_balance

                    FROM withdrawal_requests w

                    LEFT JOIN restaurants r
                        ON w.user_type='partner'
                        AND w.user_id=r.id

                    LEFT JOIN delivery_partners d
                        ON w.user_type='delivery'
                        AND w.user_id=d.id

                    LEFT JOIN wallets wallet
                        ON wallet.user_type=w.user_type
                        AND wallet.user_id=w.user_id

                    ORDER BY w.id DESC

                `);

            res.json({
                success: true,
                withdrawals: rows
            });

        } catch (err) {

            console.error(
                "GET WITHDRAWALS ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                withdrawals: [],

                message:
                    "Failed to load withdrawals."

            });

        }

    }
);

// =====================================================
// APPROVE / REJECT WITHDRAWAL
// =====================================================

router.put(
    "/withdrawal/:id",
    async (req, res) => {

        let connection;

        try {

            const withdrawalId =
                Number(req.params.id);

            const { status } =
                req.body;

            if (
                !Number.isInteger(
                    withdrawalId
                ) ||
                withdrawalId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal ID."
                });

            }

            if (
                status !== "Approved" &&
                status !== "Rejected"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal status."
                });

            }

            connection =
                await db.promise().getConnection();

            await connection.beginTransaction();

            const [requests] =
                await connection.query(`
                    SELECT
                        id,
                        user_type,
                        user_id,
                        amount,
                        status
                    FROM withdrawal_requests
                    WHERE id=?
                    FOR UPDATE
                `, [
                    withdrawalId
                ]);

            if (
                requests.length === 0
            ) {

                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        "Withdrawal request not found."
                });

            }

            const request =
                requests[0];

            if (
                request.status !== "Pending"
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "This withdrawal has already been processed."
                });

            }

            const userType =
                request.user_type;

            const userId =
                request.user_id;

            const amount =
                Number(request.amount);

            if (
                !["partner", "delivery"].includes(
                    userType
                )
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal user type."
                });

            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid withdrawal amount."
                });

            }

            const [walletRows] =
                await connection.query(`
                    SELECT
                        id,
                        balance
                    FROM wallets
                    WHERE user_type=?
                    AND user_id=?
                    FOR UPDATE
                `, [
                    userType,
                    userId
                ]);

            if (
                walletRows.length === 0
            ) {

                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message:
                        "Wallet not found."
                });

            }

            const wallet =
                walletRows[0];

            // ============================================
            // REJECT WITHDRAWAL
            // ============================================

            if (
                status === "Rejected"
            ) {

                await connection.query(`
                    UPDATE wallets
                    SET balance=balance+?
                    WHERE id=?
                `, [
                    amount,
                    wallet.id
                ]);

                await connection.query(`
                    INSERT INTO wallet_transactions
                    (
                        user_type,
                        user_id,
                        order_id,
                        amount,
                        type,
                        transaction_type
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        NULL,
                        ?,
                        'Credit',
                        'Withdrawal Refund'
                    )
                `, [
                    userType,
                    userId,
                    amount
                ]);

                await connection.query(`
                    UPDATE withdrawal_requests
                    SET
                        status='Rejected',
                        processed_at=NOW()
                    WHERE id=?
                `, [
                    withdrawalId
                ]);

                await connection.commit();

                return res.json({

                    success: true,

                    message:
                        `Withdrawal rejected and ₹${amount.toFixed(2)} refunded to wallet.`

                });

            }

            // ============================================
            // APPROVE WITHDRAWAL
            // ============================================

            const balance =
                Number(
                    wallet.balance || 0
                );

            if (amount > balance) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Insufficient wallet balance."
                });

            }

            await connection.query(`
                UPDATE wallets
                SET balance=balance-?
                WHERE id=?
            `, [
                amount,
                wallet.id
            ]);

            await connection.query(`
                INSERT INTO wallet_transactions
                (
                    user_type,
                    user_id,
                    order_id,
                    amount,
                    type,
                    transaction_type
                )
                VALUES
                (
                    ?,
                    ?,
                    NULL,
                    ?,
                    'Debit',
                    'Withdrawal'
                )
            `, [
                userType,
                userId,
                amount
            ]);

            await connection.query(`
                UPDATE withdrawal_requests
                SET
                    status='Approved',
                    processed_at=NOW()
                WHERE id=?
            `, [
                withdrawalId
            ]);

            await connection.commit();

            return res.json({

                success: true,

                message:
                    "Withdrawal approved successfully."

            });

        } catch (err) {

            if (connection) {

                try {

                    await connection.rollback();

                } catch (rollbackError) {

                    console.error(
                        "ROLLBACK ERROR:",
                        rollbackError
                    );

                }

            }

            console.error(
                "WITHDRAWAL PROCESS ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to process withdrawal."

            });

        } finally {

            if (connection) {
                connection.release();
            }

        }

    }
);

// =====================================================
// GET ALL OFFERS
// =====================================================

router.get(
    "/offers",
    async (req, res) => {

        try {

            const [offers] =
                await db.promise().query(`
                    SELECT
                        id,
                        title,
                        image_url,
                        display_order,
                        is_active,
                        created_at
                    FROM offers
                    ORDER BY
                        display_order ASC,
                        id DESC
                `);

            res.json(offers);

        } catch (err) {

            console.error(
                "GET OFFERS ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load offers."
            });

        }

    }
);

// =====================================================
// CREATE OFFER
// CLOUDINARY
// =====================================================

router.post(
    "/offers",
    offerUpload.single("image"),
    async (req, res) => {

        try {

            const {
                title,
                notification_message,
                display_order
            } = req.body;

            if (
                !title ||
                !String(title).trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Offer title is required."
                });

            }

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Offer image is required."
                });

            }

            // =========================================
            // UPLOAD IMAGE TO CLOUDINARY
            // =========================================

            const cloudinaryResult =
                await uploadOfferToCloudinary(
                    req.file.buffer
                );

            const imageUrl =
                cloudinaryResult.secure_url;

            await db.promise().query(`
                INSERT INTO offers
                (
                    title,
                    image_url,
                    display_order,
                    is_active
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    1
                )
            `, [

                String(title).trim(),

                imageUrl,

                Number(display_order) || 0

            ]);

            // =========================================
            // CREATE CUSTOMER NOTIFICATIONS
            // =========================================

            const [customers] =
                await db.promise().query(`
                    SELECT id
                    FROM customers
                `);

            if (customers.length > 0) {

                const notificationValues =
                    customers.map(customer => [

                        customer.id,

                        "offer",

                        String(title).trim(),

                        String(
                            notification_message || ""
                        ).trim(),

                        0

                    ]);

                await db.promise().query(`
                    INSERT INTO customer_notifications
                    (
                        customer_id,
                        type,
                        title,
                        message,
                        is_read
                    )
                    VALUES ?
                `, [
                    notificationValues
                ]);

            }

            res.json({

                success: true,

                message:
                    "Offer added successfully.",

                image_url:
                    imageUrl

            });

        } catch (err) {

            console.error(
                "CREATE OFFER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to create offer."
            });

        }

    }
);

// =====================================================
// UPDATE OFFER
// CLOUDINARY
// =====================================================

router.put(
    "/offers/:id",
    offerUpload.single("image"),
    async (req, res) => {

        let newCloudinaryUrl = null;

        try {

            const id =
                Number(req.params.id);

            const {
                title,
                display_order
            } = req.body;

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid offer ID."
                });

            }

            const [rows] =
                await db.promise().query(
                    "SELECT * FROM offers WHERE id=?",
                    [id]
                );

            if (
                rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Offer not found."
                });

            }

            const oldImageUrl =
                rows[0].image_url;

            const finalTitle =
                title !== undefined &&
                String(title).trim()
                    ? String(title).trim()
                    : rows[0].title;

            const finalDisplayOrder =
                display_order !== undefined
                    ? (
                        Number(display_order) || 0
                    )
                    : rows[0].display_order;

            let imageUrl =
                oldImageUrl;

            // =========================================
            // NEW IMAGE PROVIDED
            // =========================================

            if (req.file) {

                const cloudinaryResult =
                    await uploadOfferToCloudinary(
                        req.file.buffer
                    );

                newCloudinaryUrl =
                    cloudinaryResult.secure_url;

                imageUrl =
                    newCloudinaryUrl;

            }

            await db.promise().query(`
                UPDATE offers
                SET
                    title=?,
                    image_url=?,
                    display_order=?
                WHERE id=?
            `, [

                finalTitle,

                imageUrl,

                finalDisplayOrder,

                id

            ]);

            // =========================================
            // DELETE OLD CLOUDINARY IMAGE
            // ONLY AFTER DB UPDATE
            // =========================================

            if (
                req.file &&
                oldImageUrl &&
                oldImageUrl !== imageUrl
            ) {

                await deleteOfferImage(
                    oldImageUrl
                );

            }

            res.json({

                success: true,

                message:
                    "Offer updated successfully.",

                image_url:
                    imageUrl

            });

        } catch (err) {

            // =========================================
            // IF DB UPDATE FAILED AFTER NEW IMAGE
            // DELETE NEW CLOUDINARY IMAGE
            // =========================================

            if (
                newCloudinaryUrl
            ) {

                await deleteOfferImage(
                    newCloudinaryUrl
                );

            }

            console.error(
                "UPDATE OFFER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to update offer."
            });

        }

    }
);

// =====================================================
// TOGGLE OFFER
// =====================================================

router.put(
    "/offers/toggle/:id",
    async (req, res) => {

        try {

            const [result] =
                await db.promise().query(`
                    UPDATE offers
                    SET is_active =
                        CASE
                            WHEN is_active=1 THEN 0
                            ELSE 1
                        END
                    WHERE id=?
                `, [
                    req.params.id
                ]);

            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Offer not found."
                });

            }

            res.json({
                success: true,
                message:
                    "Offer status updated."
            });

        } catch (err) {

            console.error(
                "TOGGLE OFFER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to update offer."
            });

        }

    }
);

// =====================================================
// DELETE OFFER
// CLOUDINARY
// =====================================================

router.delete(
    "/offers/:id",
    async (req, res) => {

        try {

            const [rows] =
                await db.promise().query(
                    `
                        SELECT image_url
                        FROM offers
                        WHERE id=?
                    `,
                    [req.params.id]
                );

            if (
                rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Offer not found."
                });

            }

            const imageUrl =
                rows[0].image_url;

            // =========================================
            // DELETE DATABASE RECORD
            // =========================================

            await db.promise().query(
                "DELETE FROM offers WHERE id=?",
                [req.params.id]
            );

            // =========================================
            // DELETE CLOUDINARY IMAGE
            // =========================================

            await deleteOfferImage(
                imageUrl
            );

            res.json({

                success: true,

                message:
                    "Offer deleted successfully."

            });

        } catch (err) {

            console.error(
                "DELETE OFFER ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to delete offer."
            });

        }

    }
);

// =====================================================
// ACTIVE OFFERS
// CUSTOMER APP
// =====================================================

router.get(
    "/offers/active",
    async (req, res) => {

        try {

            const [offers] =
                await db.promise().query(`
                    SELECT
                        id,
                        title,
                        image_url,
                        display_order
                    FROM offers
                    WHERE is_active=1
                    ORDER BY
                        display_order ASC,
                        id DESC
                `);

            res.json({
                success: true,
                offers
            });

        } catch (err) {

            console.error(
                "ACTIVE OFFERS ERROR:",
                err
            );

            res.status(500).json({
                success: false,
                offers: [],
                message:
                    "Unable to load active offers."
            });

        }

    }
);

// =====================================================
// MULTER ERROR HANDLER
// =====================================================

router.use(
    (err, req, res, next) => {

        if (
            err instanceof multer.MulterError
        ) {

            return res.status(400).json({

                success: false,

                message:
                    err.message

            });

        }

        if (
            err &&
            err.message ===
            "Only image files are allowed."
        ) {

            return res.status(400).json({

                success: false,

                message:
                    err.message

            });

        }

        console.error(
            "ADMIN ROUTE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }
);

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;