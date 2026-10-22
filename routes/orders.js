const express = require("express");
const router = express.Router();
const db = require("../config/db");
const admin = require("../config/firebaseAdmin");
async function sendCustomerNotification(customerId, title, body, data = {}) {
    try {
        const [rows] = await db.promise().query(
            `SELECT fcm_token
             FROM customers
             WHERE id=?`,
            [customerId]
        );

        if (!rows.length || !rows[0].fcm_token) {
            console.log(
                "FCM: Customer has no token:",
                customerId
            );
            return;
        }

        const token = rows[0].fcm_token;

        const message = {
            token,

            notification: {
                title,
                body
            },

            data: {
                customerId: String(customerId),
                ...Object.fromEntries(
                    Object.entries(data).map(
                        ([key, value]) => [key, String(value)]
                    )
                )
            }
        };

        const messageId =
            await admin.messaging().send(message);

        console.log(
            "📲 CUSTOMER FCM SENT:",
            messageId
        );

    } catch (error) {

        console.error(
            "❌ CUSTOMER FCM ERROR:",
            error
        );
    }
}
/*=========================================
            PLACE ORDER
=========================================*/

router.post("/place", async (req, res) => {

    const io = req.app.get("io");

    let connection;

    try {

        const {
            customer_id,
            partner_id,
            restaurant_name,
            customer_name,
            mobile,
            address,
            customer_lat,
            customer_lng,
            payment,
            payment_id,
            payment_order_id
        } = req.body;

        /*=========================================
            VALIDATE REQUIRED FIELDS
        =========================================*/

        if (
            !customer_id ||
            !partner_id ||
            !customer_name ||
            !mobile ||
            !address
        ) {

            return res.status(400).json({

                success: false,
                message: "Missing Required Fields"

            });

        }

        /*=========================================
            DATABASE CONNECTION
        =========================================*/

        connection =
            await db.promise().getConnection();
connection.query = new Proxy(connection.query, {
    apply(target, thisArg, args) {
        console.log("SQL BEING EXECUTED:", JSON.stringify(args[0]));
        return Reflect.apply(target, thisArg, args);
    }
});
        /*=========================================
            START TRANSACTION
        =========================================*/

        await connection.beginTransaction();

        /*=========================================
            GET CART PRODUCTS
        =========================================*/

const [cart] = await connection.query(
    `
    SELECT
        c.product_id,
        c.partner_id,
        c.quantity,
        m.product_name,
        m.price,
        m.offer_price
    FROM cart c
    INNER JOIN menu_items m
        ON m.id = c.product_id
       AND m.partner_id = c.partner_id
    WHERE c.customer_id = ?
      AND c.partner_id = ?

    UNION ALL

    SELECT
        c.product_id,
        c.partner_id,
        c.quantity,
        gp.product_name,
        CASE
            WHEN c.price IS NOT NULL THEN c.price
            ELSE COALESCE(gv.price, 0)
        END AS price,
        CASE
            WHEN c.price IS NOT NULL THEN 0
            ELSE COALESCE(gv.offer_price, 0)
        END AS offer_price
    FROM cart c
    INNER JOIN partner_grocery_products gp
        ON gp.id = c.product_id
       AND gp.partner_id = c.partner_id
    LEFT JOIN partner_grocery_variants gv
        ON gv.id = (
            SELECT v.id
            FROM partner_grocery_variants v
            WHERE v.partner_product_id = gp.id
              AND v.status = 'Available'
            ORDER BY v.id ASC
            LIMIT 1
        )
    WHERE c.customer_id = ?
      AND c.partner_id = ?
    `,
    [customer_id, partner_id, customer_id, partner_id]
);

console.log("Cart Data:", cart);
console.log("Cart Length:", cart.length);


        /*=========================================
            CHECK CART
        =========================================*/

        if (cart.length === 0) {

            await connection.rollback();

            return res.status(400).json({

                success: false,
                message: "Cart Empty"

            });

        }

        /*=========================================
            GET RESTAURANT COMMISSION
        =========================================*/

        const [partnerRows] =
            await connection.query(

                `SELECT
                    id,
                    restaurant_name,
                    commission_percent,
                    status

                 FROM restaurants

                 WHERE id=?`,

                [partner_id]

            );

        if (partnerRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,
                message: "Restaurant not found."

            });

        }

        const restaurant =
            partnerRows[0];

        /*=========================================
            CHECK RESTAURANT STATUS
        =========================================*/

        if (restaurant.status !== "Approved") {

            await connection.rollback();

            return res.status(400).json({

                success: false,
                message:
                    "This restaurant is not currently approved."

            });

        }

        /*=========================================
            COMMISSION
        =========================================*/

        const commission_percent =
            Number(
                restaurant.commission_percent || 0
            );

        if (
            !Number.isFinite(commission_percent) ||
            commission_percent < 0 ||
            commission_percent > 100
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,
                message:
                    "Invalid restaurant commission."

            });

        }

        console.log(
            "Restaurant Commission :",
            commission_percent + "%"
        );

        /*=========================================
            CALCULATE FOOD TOTAL
        =========================================*/

        let food_total = 0;

        for (const item of cart) {

            const price =
                Number(item.offer_price) > 0
                    ? Number(item.offer_price)
                    : Number(item.price);

            const quantity =
                Number(item.quantity);

            food_total +=
                price * quantity;

        }

        food_total =
            Number(food_total.toFixed(2));
 
/*=========================================
    DELIVERY FEE + GST
=========================================*/

const deliveryDistance = Number(req.body.delivery_distance_km);

const DELIVERY_RULES = [
    { min: 0, max: 2.0, customer: 25, rider: 25, admin: 0 },
    { min: 2.1, max: 2.2, customer: 30, rider: 25, admin: 5 },
    { min: 2.3, max: 2.4, customer: 32, rider: 27, admin: 5 },
    { min: 2.5, max: 2.6, customer: 34, rider: 29, admin: 5 },
    { min: 2.7, max: 2.8, customer: 36, rider: 31, admin: 5 },
    { min: 2.9, max: 3.0, customer: 38, rider: 33, admin: 5 },
    { min: 3.1, max: 3.2, customer: 40, rider: 35, admin: 5 },
    { min: 3.3, max: 3.4, customer: 42, rider: 37, admin: 5 },
    { min: 3.5, max: 3.6, customer: 44, rider: 39, admin: 5 },
    { min: 3.7, max: 3.8, customer: 46, rider: 41, admin: 5 },
    { min: 3.9, max: 4.0, customer: 48, rider: 43, admin: 5 },
    { min: 4.1, max: 4.2, customer: 50, rider: 45, admin: 5 },
    { min: 4.3, max: 4.4, customer: 51, rider: 46, admin: 5 },
    { min: 4.5, max: 4.6, customer: 52, rider: 47, admin: 5 },
    { min: 4.7, max: 4.8, customer: 53, rider: 48, admin: 5 },
    { min: 4.9, max: 5.0, customer: 54, rider: 49, admin: 5 },
    { min: 5.1, max: 5.2, customer: 55, rider: 50, admin: 5 },
    { min: 5.3, max: 5.4, customer: 56, rider: 51, admin: 5 },
    { min: 5.5, max: 5.6, customer: 57, rider: 52, admin: 5 },
    { min: 5.7, max: 5.8, customer: 58, rider: 58, admin: 0 },
    { min: 5.9, max: 6.0, customer: 59, rider: 59, admin: 0 },
    { min: 6.1, max: 6.5, customer: 59, rider: 59, admin: 0 },
    { min: 6.6, max: 7.0, customer: 60, rider: 60, admin: 0 }
];

if (!Number.isFinite(deliveryDistance) || deliveryDistance < 0) {
    await connection.rollback();
    return res.status(400).json({
        success: false,
        message: "Invalid delivery distance."
    });
}

const distanceKm = Math.round(deliveryDistance * 10) / 10;

if (distanceKm > 7) {
    await connection.rollback();
    return res.status(400).json({
        success: false,
        message: "Delivery is unavailable beyond 7 km."
    });
}

const deliveryRule = DELIVERY_RULES.find(
    rule => distanceKm >= rule.min && distanceKm <= rule.max
);

if (!deliveryRule) {
    await connection.rollback();
    return res.status(400).json({
        success: false,
        message: "Delivery is unavailable for this distance."
    });
}

/* Free delivery above ₹399, matching checkout */
const delivery_fee =
    food_total > 399 ? 0 : deliveryRule.customer;
const delivery_rider_earning = Number((deliveryRule.rider + (distanceKm > 6 ? 10 : 0)).toFixed(2));
const admin_delivery_fee = food_total > 399 ? 0 : deliveryRule.admin;
const delivery_subsidy = Number(Math.max(0, delivery_rider_earning + admin_delivery_fee - delivery_fee).toFixed(2));

/* GST calculation: 5% */
const gst_fee = Number((food_total * 0.05).toFixed(2));

/* Keep existing DB column name for compatibility */
const platform_fee = gst_fee;

/* Grand total before coupons and coins */
const grand_total = Number(
    (food_total + delivery_fee + gst_fee).toFixed(2)
);
        

/*=========================================
            CALCULATE COMMISSION PREVIEW
=========================================*/

        const commissionAmount =
            Number(
                (
                    food_total *
                    commission_percent /
                    100
                ).toFixed(2)
            );

        const partnerAmount =
            Number(
                (
                    food_total -
                    commissionAmount
                ).toFixed(2)
            );

        console.log(
            "=================================="
        );

        console.log(
            "Food Total        :",
            food_total
        );

        console.log(
            "Commission %      :",
            commission_percent
        );

        console.log(
            "DARVOZ Commission :",
            commissionAmount
        );

        console.log(
            "Partner Amount    :",
            partnerAmount
        );

        console.log(
            "Delivery Fee      :",
            delivery_fee
        );

        console.log(
            "Platform Fee      :",
            platform_fee
        );

        console.log(
            "Grand Total       :",
            grand_total
        );

        console.log(
            "=================================="
        );

        /*=========================================
            GENERATE DELIVERY OTP
        =========================================*/

        const delivery_otp =
            Math.floor(
                1000 +
                Math.random() * 9000
            ).toString();

        console.log(
            "DELIVERY OTP FOR ORDER:",
            delivery_otp
        );

        /*=========================================
            CREATE ORDER
        =========================================*/

       const [result] =
    await connection.query(

        `INSERT INTO orders(

            customer_id,
            partner_id,
            restaurant_name,
            customer_name,
            mobile,
            address,

            customer_lat,
            customer_lng,

            payment,
            payment_id,
            payment_order_id,

            food_total,
            delivery_fee,
            delivery_rider_earning,
            admin_delivery_fee,
            delivery_subsidy,
            platform_fee,
            commission_percent,
            grand_total,

            status,
            delivery_otp

        )

        VALUES(
            ?,?,?,?,?,?,
            ?,?,
            ?,?,?,
            ?,?,?,?,?,?,?,?,
            ?,?
        )`,

        [

            customer_id,
            partner_id,

            restaurant_name ||
                restaurant.restaurant_name,

            customer_name,
            mobile,
            address,

            customer_lat || null,
            customer_lng || null,

            payment || null,
            payment_id || null,
            payment_order_id || null,

            food_total,
            delivery_fee,
            delivery_rider_earning,
            admin_delivery_fee,
            delivery_subsidy,
            platform_fee,
            commission_percent,
            grand_total,

            "Pending",
            delivery_otp

        ]

    );

        const orderId =
            result.insertId;

        /*=========================================
            SAVE ORDER ITEMS
        =========================================*/

        for (const item of cart) {

            const price =
                Number(item.offer_price) > 0
                    ? Number(item.offer_price)
                    : Number(item.price);

            await connection.query(

                `INSERT INTO order_items(

                    order_id,
                    product_name,
                    price,
                    qty

                )

                VALUES(?,?,?,?)`,

                [

                    orderId,
                    item.product_name,
                    price,
                    item.quantity

                ]

            );

        }

        /*=========================================
            CLEAR CUSTOMER CART
        =========================================*/

        await connection.query(

            `DELETE FROM cart
             WHERE customer_id=?`,

            [customer_id]

        );

        /*=========================================
            COMMIT TRANSACTION
        =========================================*/

        await connection.commit();

        await sendCustomerNotification(
    customer_id,
    "🎉 Order Placed",
    `Your order #${orderId} has been placed successfully.`,
    {
        type: "order_placed",
        orderId: orderId
    }
);

// ==========================================
// SEND NEW ORDER TO PARTNER IN REAL TIME
// ==========================================

const socketIO = req.app.get("io");

console.log("");
console.log("==============================================");
console.log("📡 DARVOZ NEW ORDER REAL-TIME DISPATCH");
console.log("==============================================");
console.log("🛒 Order ID       :", orderId);
console.log("🏪 partner_id     :", partner_id);
console.log("🏪 partner_id type:", typeof partner_id);

if (!socketIO) {

    console.error("❌ SOCKET.IO INSTANCE NOT FOUND");

} else {

    const numericPartnerId = Number(partner_id);

    const room = `partner_${numericPartnerId}`;

    console.log("🏠 Target Room    :", room);

    const roomMembers =
        socketIO.sockets.adapter.rooms.get(room);

    console.log(
        "👥 Room Members   :",
        roomMembers
            ? Array.from(roomMembers)
            : []
    );

    if (
        !roomMembers ||
        roomMembers.size === 0
    ) {

        console.warn(
            "⚠️ NO PARTNER SOCKET IS CURRENTLY IN THIS ROOM!"
        );

        console.warn(
            "⚠️ The order will still be saved in MySQL."
        );

    } else {

       
const orderPayload = {
    id: orderId,
    customer_name: customer_name || "",
    mobile: mobile || "",
    food_total: food_total,
    delivery_fee: delivery_fee,
    platform_fee: platform_fee,
    grand_total: grand_total,
    commission_percent: commission_percent,
    payment: payment || "",

    // 🔊 Product names and quantities for Telugu voice
    items: cart.map(item => ({
        product_name: item.product_name,
        quantity: Number(item.quantity)
    })),

    status: "Pending"
};

        console.log(
            "📤 EMITTING EVENT: newOrder"
        );

        console.log(
            "📦 Payload:",
            orderPayload
        );

        socketIO
            .to(room)
            .emit(
                "newOrder",
                orderPayload
            );

        console.log(
            "✅ NEW ORDER SENT TO:",
            room
        );

    }

}

console.log("==============================================");
console.log("");

        

        /*=========================================
            SUCCESS
        =========================================*/

        return res.json({

            success: true,

            message:
                "Order Placed Successfully",

            orderId

        });

    }

    catch (err) {

        console.error(
            "PLACE ORDER ERROR:",
            err
        );

        if (connection) {

            try {

                await connection.rollback();

            }
            catch (rollbackError) {

                console.error(
                    "ROLLBACK ERROR:",
                    rollbackError
                );

            }

        }

        return res.status(500).json({

            success: false,

            message: "Order Failed"

        });

    }

    finally {

        if (connection) {

            connection.release();

        }

    }

});


/*=========================================
            TRACK ORDER
=========================================*/

router.get(
    "/track/:id",
    async (req, res) => {

        try {

            const [rows] =
                await db.promise().query(

                    `SELECT

                        o.id,
                        o.status,

                        o.delivery_status,
                        o.delivery_partner_id,
                        o.delivery_otp,

                        o.customer_id,
                        o.partner_id,

                        o.customer_name,
                        o.mobile,
                        o.address,

                        o.payment,

                        o.food_total,
                        o.delivery_fee,
                        o.platform_fee,
                        o.commission_percent,
                        o.grand_total,

                        o.restaurant_name,

                        o.customer_lat,
                        o.customer_lng,

                        r.latitude AS restaurant_lat,
                        r.longitude AS restaurant_lng,

                        d.id AS rider_id,
                        d.name AS rider_name,
                        d.mobile AS rider_mobile,

                        d.latitude,
                        d.longitude

                    FROM orders o

                    LEFT JOIN restaurants r
                    ON o.partner_id = r.id

                    LEFT JOIN delivery_partners d
                    ON o.delivery_partner_id = d.id

                    WHERE o.id=?`,

                    [req.params.id]

                );

            /*=========================================
                ORDER NOT FOUND
            =========================================*/

            if (rows.length === 0) {

                return res.status(404).json({

                    success: false,
                    message: "Order Not Found"

                });

            }

            /*=========================================
                SEND ORDER
            =========================================*/

            return res.json({

                success: true,

                order: rows[0]

            });

        }

        catch (err) {

            console.error(
                "TRACK ORDER ERROR:",
                err
            );

            return res.status(500).json({

                success: false,
                message: "Server Error"

            });

        }

    }
);


/*=========================================
        CUSTOMER ORDER HISTORY
=========================================*/

router.get(
    "/customer/:customerId",
    async (req, res) => {

        try {

            const [rows] =
                await db.promise().query(

                    `SELECT

                        id,
                        restaurant_name,
                        grand_total,
                        status,
                        payment,
                        food_total,
                        delivery_fee,
                        platform_fee,
                        commission_percent

                    FROM orders

                    WHERE customer_id=?

                    ORDER BY id DESC`,

                    [req.params.customerId]

                );

            return res.json({

                success: true,
                orders: rows

            });

        }

        catch (err) {

            console.error(
                "CUSTOMER ORDERS ERROR:",
                err
            );

            return res.status(500).json({

                success: false,
                orders: []

            });

        }

    }
);


/*=========================================
            ORDER ITEMS
=========================================*/

router.get(
    "/items/:orderId",
    async (req, res) => {

        try {

            const [rows] =
                await db.promise().query(

                    `SELECT

                        product_name,
                        price,
                        qty

                    FROM order_items

                    WHERE order_id=?`,

                    [req.params.orderId]

                );

            return res.json({

                success: true,
                items: rows

            });

        }

        catch (err) {

            console.error(
                "ORDER ITEMS ERROR:",
                err
            );

            return res.status(500).json({

                success: false,
                items: []

            });

        }

    }
);


/*=========================================
        CUSTOMER CANCEL ORDER
=========================================*/

router.put(
    "/cancel/:id",
    async (req, res) => {

        const orderId =
            req.params.id;

        const {
            customerId
        } = req.body;

        if (
            !orderId ||
            !customerId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID and Customer ID are required."

            });

        }

        try {

            /*=========================================
                GET ORDER
            =========================================*/

            const [rows] =
                await db.promise().query(

                    `SELECT

                        id,
                        customer_id,
                        status,
                        delivery_status,
                        partner_id,
                        delivery_partner_id,
                        payment_id,
                        payment_order_id

                    FROM orders

                    WHERE id=?`,

                    [orderId]

                );

            /*=========================================
                ORDER NOT FOUND
            =========================================*/

            if (rows.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found."

                });

            }

            const order =
                rows[0];

            /*=========================================
                SECURITY CHECK
            =========================================*/

            if (
                Number(order.customer_id) !==
                Number(customerId)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You cannot cancel this order."

                });

            }

            /*=========================================
                ALREADY CANCELLED
            =========================================*/

            if (
                order.status ===
                "Cancelled"
            ) {

                return res.json({

                    success: false,

                    message:
                        "Order is already cancelled."

                });

            }

            /*=========================================
                DON'T CANCEL COMPLETED ORDERS
            =========================================*/

            if (
                order.status ===
                    "Completed" ||

                order.status ===
                    "Delivered" ||

                order.status ===
                    "Picked Up" ||

                order.delivery_status ===
                    "Picked Up"
            ) {

                return res.json({

                    success: false,

                    message:
                        "This order can no longer be cancelled."

                });

            }

            /*=========================================
                CANCEL ORDER
            =========================================*/

            const [result] =
                await db.promise().query(

                    `UPDATE orders

                     SET

                        status='Cancelled',

                        cancellation_reason=?

                     WHERE id=?

                     AND customer_id=?

                     AND status NOT IN
                     (
                        'Delivered',
                        'Completed',
                        'Picked Up',
                        'Cancelled'
                     )`,

                    [

                        "Customer cancelled after timeout",

                        orderId,

                        customerId

                    ]

                );

            if (
                result.affectedRows === 0
            ) {

                return res.json({

                    success: false,

                    message:
                        "Order could not be cancelled."

                });

            }

            /*=========================================
                SOCKET.IO
            =========================================*/

            const io =
                req.app.get("io");

            if (io) {

                /* CUSTOMER */

                io.to(
                    `customer_${customerId}`
                ).emit(
                    "orderCancelled",
                    {

                        orderId: orderId,

                        status:
                            "Cancelled"

                    }
                );

                /* PARTNER */

                if (
                    order.partner_id
                ) {

                    io.to(
                        `partner_${order.partner_id}`
                    ).emit(
                        "orderCancelled",
                        {

                            orderId: orderId,

                            status:
                                "Cancelled"

                        }
                    );

                }

                /* DELIVERY PARTNER */

                if (
                    order.delivery_partner_id
                ) {

                    io.to(
                        `delivery_${order.delivery_partner_id}`
                    ).emit(
                        "orderCancelled",
                        {

                            orderId: orderId,

                            status:
                                "Cancelled"

                        }
                    );

                }

            }

            console.log(
                "ORDER CANCELLED:",
                orderId
            );

            /*=========================================
                REFUND
            =========================================*/

            // Payment refund is NOT processed here yet.
            // Razorpay refund can be connected later.

            return res.json({

                success: true,

                message:
                    "Order cancelled successfully.",

                orderId: orderId,

                refundRequired:
                    !!order.payment_id

            });

        }

        catch (err) {

            console.error(
                "CANCEL ORDER ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to cancel order."

            });

        }

    }
);

/*=========================================
        PARTNER GET ORDERS
=========================================*/

router.get(
    "/partner/orders/:partnerId",
    async (req, res) => {

        try {

            const partnerId =
                req.params.partnerId;

            const [orders] =
                await db.promise().query(

                    `SELECT

                        id,

                        CONCAT(
                            'ORD-',
                            LPAD(id, 6, '0')
                        ) AS order_id,

                        customer_name,

                        mobile,

                        address,

                        food_total,

                        delivery_fee,

                        platform_fee,

                        grand_total AS total,

                        payment,

                        status,

                        created_at

                    FROM orders

                    WHERE partner_id=?

                    ORDER BY id DESC`,

                    [partnerId]

                );

            return res.json(
                orders
            );

        }

        catch (err) {

            console.error(
                "PARTNER GET ORDERS ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load orders"

            });

        }

    }
);

/*=========================================
       PARTNER UPDATE ORDER STATUS
=========================================*/

router.put(
    "/partner/update-order/:id",
    async (req, res) => {

        try {

            const orderId =
                req.params.id;

            const {
                status,
                partnerId
            } = req.body;


            /*=========================================
                VALIDATE
            =========================================*/

            if (
                !partnerId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Partner ID is required"

                });

            }


            const allowedStatus = [

                "Accepted",
                "Rejected",
                "Preparing",
                "Ready"

            ];


            if (
                !allowedStatus.includes(status)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid order status"

                });

            }


            /*=========================================
                GET ORDER + SECURITY CHECK
            =========================================*/

            const [orders] =
                await db.promise().query(

                    `SELECT
                        id,
                        customer_id,
                        partner_id,
                        status
                     FROM orders
                     WHERE id=?`,

                    [
                        orderId
                    ]

                );


            if (
                orders.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found"

                });

            }


            const order =
                orders[0];


            /*=========================================
                CHECK ORDER BELONGS TO PARTNER
            =========================================*/

            if (
                Number(order.partner_id) !==
                Number(partnerId)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You cannot update this order"

                });

            }


            /*=========================================
                DON'T UPDATE CANCELLED ORDER
            =========================================*/

            if (
                order.status === "Cancelled"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Cancelled order cannot be updated"

                });

            }


            /*=========================================
                UPDATE ORDER
            =========================================*/

            const [result] =
                await db.promise().query(

                    `UPDATE orders

                     SET status=?

                     WHERE id=?
                     AND partner_id=?`,

                    [

                        status,

                        orderId,

                        partnerId

                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Unable to update order"

                });

            }

           


// ==========================================
// CUSTOMER FCM NOTIFICATION
// ==========================================

let notificationTitle = "📦 Order Update";

let notificationBody =
    `Your order #${orderId} is now ${status}.`;


if (status === "Accepted") {

    notificationTitle = "✅ Order Accepted";

    notificationBody =
        `Restaurant accepted your order #${orderId}.`;

}


if (status === "Preparing") {

    notificationTitle = "👨‍🍳 Order Preparing";

    notificationBody =
        `Your order #${orderId} is being prepared.`;

}


if (status === "Ready") {

    notificationTitle = "🍽️ Order Ready";

    notificationBody =
        `Your order #${orderId} is ready.`;

}


if (status === "Rejected") {

    notificationTitle = "❌ Order Rejected";

    notificationBody =
        `Unfortunately, your order #${orderId} was rejected.`;

}


await sendCustomerNotification(
    order.customer_id,
    notificationTitle,
    notificationBody,
    {
        type: "order_status",
        orderId: orderId,
        status: status
    }
);




            /*=========================================
                SOCKET EVENTS
            =========================================*/

            const io =
                req.app.get("io");


            if (io) {


                /* CUSTOMER ONLY */

                io.to(
                    `customer_${order.customer_id}`
                ).emit(
                    "orderStatusUpdated",
                    {

                        orderId,

                        status

                    }
                );


                /* CORRECT PARTNER ONLY */

                io.to(
                    `partner_${partnerId}`
                ).emit(
                    "orderStatusUpdated",
                    {

                        orderId,

                        status

                    }
                );

            }


            return res.json({

                success: true,

                message:
                    "Order status updated successfully",

                orderId,

                status

            });

        }

        catch (err) {

            console.error(
                "UPDATE ORDER STATUS ERROR:",
                err
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to update order"

            });

        }

    }
);
/*=========================================
            EXPORT ROUTER
=========================================*/

module.exports = router;
