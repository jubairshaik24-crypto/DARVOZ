const express = require("express");
const router = express.Router();
const db = require("../config/db");


// =====================================================
// GET SINGLE ORDER
// =====================================================

router.get("/order/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "SELECT * FROM orders WHERE id = ?",

        [id],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({

                    success: false

                });

            }

            if (result.length === 0) {

                return res.json({

                    success: false,
                    message: "Order Not Found"

                });

            }

            res.json(result[0]);

        }

    );

});

// =====================================================
// GET ALL ORDERS FOR PARTNER
// INCLUDING ORDERS REJECTED BY THIS PARTNER
// =====================================================

router.get("/:partner_id", (req, res) => {

    const partner_id = req.params.partner_id;

    db.query(

        `SELECT
            o.*,
            opr.response AS partner_response

         FROM orders o

         LEFT JOIN order_partner_responses opr
            ON opr.order_id = o.id
            AND opr.partner_id = ?

         WHERE
            o.partner_id = ?
            OR opr.partner_id = ?

         ORDER BY o.id DESC`,

        [
            partner_id,
            partner_id,
            partner_id
        ],

        (err, result) => {

            if (err) {

                console.log(
                    "GET PARTNER ORDERS ERROR:",
                    err
                );

                return res.status(500).json({

                    success: false,
                    message: "Database Error"

                });

            }

            res.json(result);

        }

    );

});


// =====================================================
// DARVOZ V1 - DISPATCH ORDER TO ONLINE RIDERS
// =====================================================

function dispatchOrderToRiders(io, orderId) {

    console.log("=================================");
    console.log("🚴 DARVOZ RIDER DISPATCH");
    console.log("Order ID:", orderId);
    console.log("=================================");

    if (!io) {
        console.log("❌ Socket.IO not available");
        return;
    }

    // -----------------------------------------
    // FIND APPROVED + ONLINE RIDERS
    // -----------------------------------------

    db.query(

        `SELECT id
         FROM delivery_partners
         WHERE online_status='Online'
         AND account_status='Approved'
         ORDER BY id ASC`,

        (err, riders) => {

            if (err) {

                console.log(
                    "❌ Rider Query Error:",
                    err
                );

                return;
            }

            if (riders.length === 0) {

                console.log(
                    "⚠️ No approved + online riders available"
                );

                return;
            }

            console.log(
                "Eligible Riders:",
                riders.map(rider => rider.id)
            );


            // -----------------------------------------
            // GET COMPLETE ORDER
            // -----------------------------------------

            db.query(

                `SELECT *
                 FROM orders
                 WHERE id=?`,

                [orderId],

                (err, orders) => {

                    if (err) {

                        console.log(
                            "❌ Order Query Error:",
                            err
                        );

                        return;
                    }

                    if (orders.length === 0) {

                        console.log(
                            "❌ Order not found"
                        );

                        return;
                    }

                    const order =
                        orders[0];


                    // -----------------------------------------
                    // SEND TO ALL ELIGIBLE RIDERS
                    // -----------------------------------------

                    riders.forEach(rider => {

                        console.log(
                            `📦 Sending order ${order.id} ` +
                            `to rider ${rider.id}`
                        );

                        io.to(
                            `delivery_${rider.id}`
                        ).emit(
                            "newDeliveryOrder",
                            order
                        );


                        // -----------------------------------------
                        // SAVE DISPATCH LOG
                        // -----------------------------------------

                        db.query(

                            `INSERT INTO order_dispatch_log
                            (
                                order_id,
                                delivery_partner_id,
                                status
                            )
                            VALUES (?, ?, 'Pending')`,

                            [
                                order.id,
                                rider.id
                            ],

                            logErr => {

                                if (logErr) {

                                    console.log(
                                        "❌ Dispatch Log Error:",
                                        logErr
                                    );

                                }

                            }

                        );

                    });


                    console.log(
                        `✅ Order ${order.id} dispatched to ` +
                        `${riders.length} rider(s)`
                    );

                }

            );

        }

    );

}
// =====================================================
// PARTNER ACCEPT ORDER
// =====================================================

router.put("/accept/:id", (req, res) => {

    const orderId = req.params.id;
    const { partnerId } = req.body;

    if (!partnerId) {

        return res.status(400).json({
            success: false,
            message: "Partner ID required."
        });

    }

    // =================================================
    // CHECK WHETHER PARTNER ALREADY REJECTED
    // =================================================

    db.query(

        `SELECT id
         FROM order_partner_responses
         WHERE order_id=?
         AND partner_id=?
         AND response='Rejected'`,

        [
            orderId,
            partnerId
        ],

        (err, rejected) => {

            if (err) {

                console.log(
                    "PARTNER REJECTION CHECK ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            if (rejected.length > 0) {

                return res.json({
                    success: false,
                    message:
                        "You already rejected this order and cannot accept it."
                });

            }


            // =================================================
            // GET ORDER
            // =================================================

            db.query(

                `SELECT *
                 FROM orders
                 WHERE id=?`,

                [
                    orderId
                ],

                (err, orders) => {

                    if (err) {

                        console.log(
                            "GET ORDER ERROR:",
                            err
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Database Error"
                        });

                    }

                    if (orders.length === 0) {

                        return res.json({
                            success: false,
                            message: "Order not found."
                        });

                    }

                    const order =
                        orders[0];


                    // =================================================
                    // ANOTHER PARTNER ALREADY ACCEPTED
                    // =================================================

                    if (
                        order.partner_id &&
                        Number(order.partner_id) !==
                        Number(partnerId)
                    ) {

                        return res.json({
                            success: false,
                            message:
                                "This order has already been accepted by another partner."
                        });

                    }


                    // =================================================
                    // ACCEPT ORDER
                    // =================================================

                    db.query(

                        `UPDATE orders

                         SET
                            partner_id=?,
                            status='Accepted',
                            rider_response_deadline=
                                DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                            dispatch_time=NOW(),
                            delivery_status='Waiting'

                         WHERE id=?

                         AND (
                            partner_id IS NULL
                            OR partner_id=?
                         )`,

                        [
                            partnerId,
                            orderId,
                            partnerId
                        ],

                        (updateErr, result) => {

                            if (updateErr) {

                                console.log(
                                    "ACCEPT ORDER ERROR:",
                                    updateErr
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        "Unable to accept order."
                                });

                            }


                            if (
                                result.affectedRows === 0
                            ) {

                                return res.json({
                                    success: false,
                                    message:
                                        "Order was already accepted."
                                });

                            }


                            // =================================================
                            // SAVE PARTNER RESPONSE
                            // =================================================

                            db.query(

                                `INSERT INTO order_partner_responses
                                (
                                    order_id,
                                    partner_id,
                                    response
                                )

                                VALUES (?, ?, 'Accepted')

                                ON DUPLICATE KEY UPDATE
                                response='Accepted'`,

                                [
                                    orderId,
                                    partnerId
                                ],

                                (responseErr) => {

                                    if (responseErr) {

                                        console.log(
                                            "Response save error:",
                                            responseErr
                                        );

                                    }

                                }

                            );


                            // =================================================
                            // DISPATCH TO RIDERS
                            // =================================================

                            const io =
                                req.app.get("io");

                            dispatchOrderToRiders(
                                io,
                                orderId
                            );


                            // =================================================
                            // CUSTOMER UPDATE
                            // =================================================

                            if (
                                io &&
                                order.customer_id
                            ) {

                                io.to(
                                    `customer_${order.customer_id}`
                                ).emit(
                                    "orderStatusUpdated",
                                    {
                                        orderId:
                                            orderId,

                                        status:
                                            "Accepted"
                                    }
                                );

                            }


                            // =================================================
                            // ONLY ONE RESPONSE
                            // =================================================

                            return res.json({

                                success: true,

                                message:
                                    "Order accepted successfully.",

                                orderId:
                                    orderId,

                                partnerId:
                                    partnerId,

                                status:
                                    "Accepted"

                            });

                        }

                    );

                }

            );

        }

    );

});

// =====================================================
// PARTNER REJECT ORDER
// =====================================================

router.put("/reject/:id", (req, res) => {

    const orderId = req.params.id;
    const { partnerId } = req.body;

    if (!partnerId) {

        return res.status(400).json({
            success: false,
            message: "Partner ID required."
        });

    }

    db.query(
        `SELECT *
         FROM orders
         WHERE id=?`,
        [orderId],

        (err, orders) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (orders.length === 0) {

                return res.json({
                    success: false,
                    message: "Order not found."
                });

            }

            const order = orders[0];

            // Partner cannot reject after accepting
            if (
                order.partner_id &&
                Number(order.partner_id) ===
                Number(partnerId)
            ) {

                return res.json({
                    success: false,
                    message:
                        "You already accepted this order."
                });

            }

            // Save permanent rejection
            db.query(
                `INSERT INTO order_partner_responses
                (
                    order_id,
                    partner_id,
                    response
                )
                VALUES (?, ?, 'Rejected')
                ON DUPLICATE KEY UPDATE
                response='Rejected'`,

                [
                    orderId,
                    partnerId
                ],

                (insertErr) => {

                    if (insertErr) {

                        console.log(
                            "Rejection save error:",
                            insertErr
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to save rejection."
                        });

                    }

                    // Notify ADMIN
                    const io =
                        req.app.get("io");

                    if (io) {

                        io.to("admin").emit(
                            "partnerRejectedOrder",
                            {
                                orderId,
                                partnerId,
                                message:
                                    "Partner rejected an order."
                            }
                        );

                    }

                    res.json({
                        success: true,
                        message:
                            "Order rejected successfully."
                    });

                }
            );

        }
    );

});

// =====================================================
// UPDATE ORDER STATUS
// =====================================================

router.put("/status/:id", (req, res) => {

    const id = req.params.id;

    const { status } = req.body;



    db.query(

        `UPDATE orders
         SET status=?
         WHERE id=?`,

        [status, id],

        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({

                    success: false,
                    message: "Database Error"

                });

            }


            const io = req.app.get("io");


            // =================================================
            // CUSTOMER + PARTNER LIVE STATUS UPDATE
            // =================================================

            db.query(

                `SELECT
                    customer_id,
                    partner_id
                 FROM orders
                 WHERE id=?`,

                [id],

                (err, rows) => {

                    if (err || rows.length === 0) {

                        return;

                    }


                    const order = rows[0];


                    // CUSTOMER

                    io.to(

                        `customer_${order.customer_id}`

                    ).emit(

                        "orderStatusUpdated",

                        {

                            orderId: id,
                            status: status

                        }

                    );


                    // RESTAURANT / PARTNER

                    io.to(

                        `partner_${order.partner_id}`

                    ).emit(

                        "orderStatusUpdated",

                        {

                            orderId: id,
                            status: status

                        }

                    );

                }

            );


            // =================================================
            // DARVOZ V1 DELIVERY DISPATCH
            // =================================================

            if (status === "Accepted") {


                console.log(
                    "================================="
                );

                console.log(
                    "DARVOZ DELIVERY DISPATCH"
                );

                console.log(
                    "Order ID:",
                    id
                );

                console.log(
                    "================================="
                );


                // =================================================
                // FIND APPROVED + ONLINE RIDERS
                // =================================================

                db.query(

                    `SELECT
                        id
                     FROM delivery_partners
                     WHERE
                        online_status='Online'
                        AND account_status='Approved'
                     ORDER BY id ASC`,

                    (err, riders) => {

                        if (err) {

                            console.log(
                                "Rider Query Error:",
                                err
                            );

                            return;

                        }


                        // =================================================
                        // NO RIDERS
                        // =================================================

                        if (riders.length === 0) {

                            console.log(
                                "No Approved + Online Riders"
                            );

                            return;

                        }


                        console.log(
                            "Eligible Riders:",
                            riders.map(rider => rider.id)
                        );


                        // =================================================
                        // GET COMPLETE ORDER
                        // =================================================

                        db.query(

                            `SELECT *
                             FROM orders
                             WHERE id=?`,

                            [id],

                            (err, orders) => {

                                if (err) {

                                    console.log(
                                        "Order Query Error:",
                                        err
                                    );

                                    return;

                                }


                                if (orders.length === 0) {

                                    console.log(
                                        "Order Not Found"
                                    );

                                    return;

                                }


                                const order = orders[0];


                                // =================================================
                                // SEND ORDER TO ALL ELIGIBLE RIDERS
                                // =================================================

                                riders.forEach(

                                    (rider) => {


                                        console.log(

                                            `Sending Order ${order.id} `
                                            + `to Rider ${rider.id}`

                                        );


                                        io.to(

                                            `delivery_${rider.id}`

                                        ).emit(

                                            "newDeliveryOrder",

                                            order

                                        );

                                    }

                                );


                                console.log(

                                    `Order ${order.id} sent to `
                                    + `${riders.length} rider(s).`

                                );


                                // =================================================
                                // SAVE DISPATCH LOG
                                // =================================================

                                riders.forEach(

                                    (rider) => {

                                        db.query(

                                            `INSERT INTO order_dispatch_log
                                            (
                                                order_id,
                                                delivery_partner_id,
                                                status
                                            )
                                            VALUES(?,?,?)`,

                                            [

                                                order.id,

                                                rider.id,

                                                "Pending"

                                            ],

                                            (err) => {

                                                if (err) {

                                                    console.log(

                                                        "Dispatch Log Error:",

                                                        err

                                                    );

                                                }

                                            }

                                        );

                                    }

                                );

                            }

                        );

                    }

                );

            }


            // =================================================
            // RESPONSE
            // =================================================

            res.json({

                success: true,

                message:
                    "Order Status Updated Successfully"

            });

        }

    );

});


// =====================================================
// DELETE ORDER
// =====================================================

router.delete("/:id", (req, res) => {

    const id = req.params.id;


    db.query(

        "DELETE FROM orders WHERE id=?",

        [id],

        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({

                    success: false

                });

            }


            res.json({

                success: true,

                message: "Order Deleted"

            });

        }

    );

});

// =====================================================
// CONFIRM PICKUP BY PARTNER
// CREDIT PARTNER WALLET + ADMIN COMMISSION
// =====================================================

router.put(
    "/confirm-pickup/:id",
    async (req, res) => {

        const orderId =
            req.params.id;

        const {
            partnerId
        } = req.body;


        // ===============================================
        // VALIDATION
        // ===============================================

        if (
            !orderId ||
            !partnerId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Missing Order ID or Partner ID"

            });

        }


        let connection;


        try {

            // ===========================================
            // GET DATABASE CONNECTION
            // ===========================================

            connection =
                await db.promise()
                    .getConnection();


            // ===========================================
            // START TRANSACTION
            // ===========================================

            await connection.beginTransaction();


            // ===========================================
            // GET + LOCK ORDER
            // ===========================================

            const [orders] =
                await connection.query(

                    `SELECT
                        id,
                        partner_id,
                        delivery_partner_id,
                        status,
                        delivery_status,
                        customer_id,
                        food_total,
                        delivery_fee,
                        platform_fee,
                        grand_total,
                        commission_percent,
                        partner_wallet_credited,
                        admin_commission_credited

                     FROM orders

                     WHERE id=?

                     FOR UPDATE`,

                    [
                        orderId
                    ]

                );


            // ===========================================
            // ORDER NOT FOUND
            // ===========================================

            if (
                orders.length === 0
            ) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found"

                });

            }


            const order =
                orders[0];


            // ===========================================
            // VERIFY PARTNER
            // ===========================================

            if (
                Number(order.partner_id) !==
                Number(partnerId)
            ) {

                await connection.rollback();

                return res.status(403).json({

                    success: false,

                    message:
                        "This order does not belong to this partner."

                });

            }


            // ===========================================
            // VERIFY RIDER ASSIGNED
            // ===========================================

            if (
                !order.delivery_partner_id
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "No delivery partner assigned."

                });

            }


            // ===========================================
            // RIDER MUST REACH RESTAURANT
            // ===========================================

            const deliveryStatus =

                String(
                    order.delivery_status || ""
                )
                .trim()
                .toLowerCase()
                .replace(
                    /[\s_-]+/g,
                    ""
                );


            if (
                deliveryStatus !==
                "reachedrestaurant"
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "Rider has not reached the restaurant yet."

                });

            }


            // ===========================================
            // PREVENT DOUBLE PICKUP / DOUBLE CREDIT
            // ===========================================

            if (
                Number(
                    order.partner_wallet_credited
                ) === 1 ||

                Number(
                    order.admin_commission_credited
                ) === 1
            ) {

                await connection.rollback();

                return res.json({

                    success: false,

                    message:
                        "This order has already been processed for wallet credit."

                });

            }


            // ===========================================
            // CALCULATE MONEY
            // ===========================================

            const foodTotal =
                Number(
                    order.food_total || 0
                );


            const commissionPercent =
                Number(
                    order.commission_percent || 0
                );


            // Admin commission
            const adminCommission =
                Number(

                    (
                        foodTotal *
                        commissionPercent
                    ) / 100

                );


            // Partner receives food amount
            // after DARVOZ commission
            const partnerEarning =
                Number(
                    foodTotal -
                    adminCommission
                );


            console.log(
                "================================="
            );

            console.log(
                "💰 PICKUP WALLET CALCULATION"
            );

            console.log(
                "Order:",
                orderId
            );

            console.log(
                "Food Total:",
                foodTotal
            );

            console.log(
                "Commission %:",
                commissionPercent
            );

            console.log(
                "Admin Commission:",
                adminCommission
            );

            console.log(
                "Partner Earning:",
                partnerEarning
            );

            console.log(
                "================================="
            );


            // ===========================================
            // UPDATE ORDER STATUS FIRST
            // ===========================================

            const [updateResult] =
                await connection.query(

                    `UPDATE orders

                     SET
                        delivery_status='Picked Up',
                        status='Picked Up'

                     WHERE
                        id=?
                        AND partner_id=?
                        AND delivery_partner_id=?`,

                    [

                        orderId,
                        partnerId,
                        order.delivery_partner_id

                    ]

                );


            if (
                updateResult.affectedRows !== 1
            ) {

                throw new Error(
                    "Unable to confirm pickup."
                );

            }


            // ===========================================
            // GET PARTNER WALLET + LOCK
            // ===========================================

            const [partnerWalletRows] =
                await connection.query(

                    `SELECT
                        id,
                        balance

                     FROM wallets

                     WHERE
                        user_type='partner'
                        AND user_id=?

                     FOR UPDATE`,

                    [
                        partnerId
                    ]

                );


            let partnerWalletId;

            let partnerNewBalance;


            // ===========================================
            // CREATE PARTNER WALLET
            // ===========================================

            if (
                partnerWalletRows.length === 0
            ) {

                const [walletResult] =
                    await connection.query(

                        `INSERT INTO wallets
                        (
                            user_type,
                            user_id,
                            balance
                        )

                        VALUES
                        (
                            'partner',
                            ?,
                            ?
                        )`,

                        [

                            partnerId,
                            partnerEarning

                        ]

                    );


                partnerWalletId =
                    walletResult.insertId;


                partnerNewBalance =
                    partnerEarning;

            }


            // ===========================================
            // UPDATE PARTNER WALLET
            // ===========================================

            else {

                partnerWalletId =
                    partnerWalletRows[0].id;


                const oldBalance =
                    Number(
                        partnerWalletRows[0]
                            .balance || 0
                    );


                partnerNewBalance =
                    oldBalance +
                    partnerEarning;


                await connection.query(

                    `UPDATE wallets

                     SET
                        balance=balance + ?

                     WHERE id=?`,

                    [

                        partnerEarning,
                        partnerWalletId

                    ]

                );

            }


            // ===========================================
            // PARTNER WALLET TRANSACTION
            // ===========================================

            await connection.query(

                `INSERT INTO wallet_transactions
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
                    'Order Earning'
                )`,

                [

                    partnerId,
                    orderId,
                    partnerEarning

                ]

            );


            // ===========================================
            // GET ADMIN WALLET + LOCK
            //
            // DARVOZ ADMIN USER ID = 1
            // ===========================================

            const adminUserId =
                1;


            const [adminWalletRows] =
                await connection.query(

                    `SELECT
                        id,
                        balance

                     FROM wallets

                     WHERE
                        user_type='admin'
                        AND user_id=?

                     FOR UPDATE`,

                    [
                        adminUserId
                    ]

                );


            let adminWalletId;

            let adminNewBalance;


            // ===========================================
            // CREATE ADMIN WALLET
            // ===========================================

            if (
                adminWalletRows.length === 0
            ) {

                const [adminWalletResult] =
                    await connection.query(

                        `INSERT INTO wallets
                        (
                            user_type,
                            user_id,
                            balance
                        )

                        VALUES
                        (
                            'admin',
                            ?,
                            ?
                        )`,

                        [

                            adminUserId,
                            adminCommission

                        ]

                    );


                adminWalletId =
                    adminWalletResult.insertId;


                adminNewBalance =
                    adminCommission;

            }


            // ===========================================
            // UPDATE ADMIN WALLET
            // ===========================================

            else {

                adminWalletId =
                    adminWalletRows[0].id;


                const oldAdminBalance =
                    Number(
                        adminWalletRows[0]
                            .balance || 0
                    );


                adminNewBalance =
                    oldAdminBalance +
                    adminCommission;


                await connection.query(

                    `UPDATE wallets

                     SET
                        balance=balance + ?

                     WHERE id=?`,

                    [

                        adminCommission,
                        adminWalletId

                    ]

                );

            }


            // ===========================================
            // ADMIN WALLET TRANSACTION
            // ===========================================

            await connection.query(

                `INSERT INTO wallet_transactions
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
                    ?,
                    ?,
                    ?,
                    'Credit',
                    'Restaurant Commission'
                )`,

                [

                    adminUserId,
                    orderId,
                    adminCommission

                ]

            );


            // ===========================================
            // MARK WALLET CREDIT FLAGS
            // ===========================================

            await connection.query(

                `UPDATE orders

                 SET
                    partner_wallet_credited=1,
                    admin_commission_credited=1

                 WHERE id=?`,

                [
                    orderId
                ]

            );


            // ===========================================
            // COMMIT EVERYTHING
            // ===========================================

            await connection.commit();


            // ===========================================
            // SOCKET.IO
            // ===========================================

            const io =
                req.app.get("io");


            if (io) {


                // RIDER
                io.to(
                    `delivery_${order.delivery_partner_id}`
                ).emit(

                    "deliveryStatusUpdated",

                    {

                        orderId:
                            orderId,

                        status:
                            "Picked Up"

                    }

                );


                // PARTNER
                io.to(
                    `partner_${partnerId}`
                ).emit(

                    "orderStatusUpdated",

                    {

                        orderId:
                            orderId,

                        status:
                            "Picked Up"

                    }

                );


                // CUSTOMER
                if (
                    order.customer_id
                ) {

                    io.to(
                        `customer_${order.customer_id}`
                    ).emit(

                        "orderStatusUpdated",

                        {

                            orderId:
                                orderId,

                            status:
                                "Picked Up"

                        }

                    );

                }


                // PARTNER WALLET LIVE UPDATE
                io.to(
                    `partner_${partnerId}`
                ).emit(

                    "walletUpdated",

                    {

                        orderId:
                            orderId,

                        amount:
                            partnerEarning,

                        walletBalance:
                            partnerNewBalance

                    }

                );

            }


            // ===========================================
            // SUCCESS RESPONSE
            // ===========================================

            return res.json({

                success: true,

                message:
                    "Pickup confirmed and wallets credited successfully.",

                orderId:
                    orderId,

                deliveryId:
                    order.delivery_partner_id,

                delivery_status:
                    "Picked Up",

                partnerEarning:
                    partnerEarning,

                partnerWalletBalance:
                    partnerNewBalance,

                adminCommission:
                    adminCommission,

                adminWalletBalance:
                    adminNewBalance

            });

        }


        // ===============================================
        // ERROR
        // ===============================================

        catch (err) {

            console.log(
                "❌ PICKUP WALLET ERROR:",
                err
            );


            if (connection) {

                try {

                    await connection.rollback();

                }

                catch (rollbackError) {

                    console.log(
                        "ROLLBACK ERROR:",
                        rollbackError
                    );

                }

            }


            return res.status(500).json({

                success: false,

                message:
                    "Failed to confirm pickup and credit wallets."

            });

        }


        // ===============================================
        // RELEASE CONNECTION
        // ===============================================

        finally {

            if (connection) {

                connection.release();

            }

        }

    }

);


module.exports = router;