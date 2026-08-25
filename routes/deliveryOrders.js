const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ==========================================
   AVAILABLE ORDERS
========================================== */

router.get("/available", (req, res) => {

    db.query(

        "SELECT * FROM orders WHERE status='Accepted' AND delivery_partner_id IS NULL",

        (err, result) => {

            if (err) {
                console.log(err);
                return res.status(500).json([]);
            }

            res.json(result);

        }

    );

});


/* ==========================================
   ACCEPT ORDER
========================================== */

router.put("/accept/:id", (req, res) => {

    const orderId = req.params.id;
    const { partner_id } = req.body;

    db.query(

        `UPDATE orders
         SET
            delivery_partner_id=?,
            status='Delivery Assigned'
         WHERE
            id=?
            AND delivery_partner_id IS NULL
            AND status='Accepted'`,

        [
            partner_id,
            orderId
        ],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success:false,
                    message:"Database Error"
                });

            }

            if (result.affectedRows === 0) {

                return res.json({
                    success:false,
                    message:"Order already accepted."
                });

            }

            // ================================
            // SOCKET
            // ================================

            const io = req.app.get("io");

            // Get customer
            db.query(

                `SELECT customer_id
                 FROM orders
                 WHERE id=?`,

                [orderId],

                (e, rows) => {

                    if (!e && rows.length > 0) {

                        io.to(
                            `customer_${rows[0].customer_id}`
                        ).emit(

                            "orderStatusUpdated",

                            {
                                orderId,
                                status:"Delivery Assigned"
                            }

                        );

                    }

                }

            );


            res.json({

                success:true,

                message:"Order Accepted"

            });

        }

    );

});

/* ==========================================
   MY ORDERS
========================================== */

router.get("/my-orders/:id", (req,res)=>{

    const partnerId=req.params.id;

    db.query(

        "SELECT * FROM orders WHERE delivery_partner_id=? ORDER BY id DESC",

        [partnerId],

        (err,result)=>{

            if(err){

                console.log(err);

                return res.json([]);

            }

            res.json(result);

        }

    );

});


/* ==========================================
   PICKED UP
========================================== */

router.put("/pickup/:id", (req, res) => {

    const orderId = req.params.id;
    const { deliveryId } = req.body;

    db.query(

        `UPDATE orders
         SET status='Picked Up'
         WHERE id=?
         AND delivery_partner_id=?
         AND status='Delivery Assigned'`,

        [
            orderId,
            deliveryId
        ],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success:false
                });

            }

            if (result.affectedRows === 0) {

                return res.json({

                    success:false,

                    message:
                        "Order cannot be picked up."

                });

            }


            // ================================
            // SOCKET UPDATE
            // ================================

            const io = req.app.get("io");


            db.query(

                `SELECT customer_id
                 FROM orders
                 WHERE id=?`,

                [orderId],

                (e, rows) => {

                    if (!e && rows.length > 0) {

                        io.to(
                            `customer_${rows[0].customer_id}`
                        ).emit(

                            "orderStatusUpdated",

                            {
                                orderId,
                                status:"Picked Up"
                            }

                        );

                    }

                }

            );


            res.json({

                success:true,

                message:"Order Picked Up"

            });

        }

    );

});

/* ==========================================
   OUT FOR DELIVERY
========================================== */

router.put("/outfordelivery/:id", (req, res) => {

    const orderId = req.params.id;
    const { deliveryId } = req.body;

    db.query(

        `UPDATE orders
         SET status='Out For Delivery'
         WHERE id=?
         AND delivery_partner_id=?
         AND status='Picked Up'`,

        [
            orderId,
            deliveryId
        ],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success:false
                });

            }

            if (result.affectedRows === 0) {

                return res.json({

                    success:false,

                    message:
                        "Order cannot be moved to delivery."

                });

            }


            // ================================
            // SEND STATUS TO CUSTOMER
            // ================================

            const io = req.app.get("io");


            db.query(

                `SELECT customer_id
                 FROM orders
                 WHERE id=?`,

                [orderId],

                (e, rows) => {

                    if (!e && rows.length > 0) {

                        io.to(
                            `customer_${rows[0].customer_id}`
                        ).emit(

                            "orderStatusUpdated",

                            {
                                orderId,
                                status:
                                    "Out For Delivery"
                            }

                        );

                    }

                }

            );


            res.json({

                success:true,

                message:"Out For Delivery"

            });

        }

    );

});


/* ==========================================
   DELIVERED
========================================== */
// ==========================================
// DELIVERED + DELIVERY WALLET CREDIT
// DARVOZ V1
// ==========================================

router.put("/delivered/:id", async (req, res) => {

    const orderId = req.params.id;

    const connection = await db.promise().getConnection();

    try {

        await connection.beginTransaction();

        // ======================================
        // GET ORDER
        // ======================================

        const [orders] = await connection.query(

            `SELECT
                delivery_partner_id,
                customer_id,
                delivery_fee,
                status
             FROM orders
             WHERE id=?
             FOR UPDATE`,

            [orderId]

        );

        if (orders.length === 0) {

            await connection.rollback();

            return res.json({

                success: false,
                message: "Order not found."

            });

        }

        const order = orders[0];

        const deliveryId =
            order.delivery_partner_id;

        const amount =
            Number(order.delivery_fee || 0);

        if (!deliveryId) {

            await connection.rollback();

            return res.json({

                success: false,
                message: "No delivery partner assigned."

            });

        }

        // ======================================
        // PREVENT DOUBLE EARNING
        // ======================================

        if (order.status === "Delivered") {

            await connection.rollback();

            return res.json({

                success: false,
                message: "Order already delivered."

            });

        }

        // ======================================
        // UPDATE ORDER
        // ======================================

        await connection.query(

            `UPDATE orders
             SET status='Delivered'
             WHERE id=?`,

            [orderId]

        );

        // ======================================
        // CREATE DELIVERY WALLET IF NOT EXISTS
        // ======================================

        await connection.query(

            `INSERT INTO wallets
            (
                user_type,
                user_id,
                balance
            )
            VALUES
            (
                'delivery',
                ?,
                0
            )
            ON DUPLICATE KEY UPDATE
            user_id=user_id`,

            [deliveryId]

        );

        // ======================================
        // ADD MONEY TO DELIVERY WALLET
        // ======================================

        await connection.query(

            `UPDATE wallets

             SET balance = balance + ?

             WHERE
                user_type='delivery'
                AND user_id=?`,

            [
                amount,
                deliveryId
            ]

        );

        // ======================================
        // SAVE TRANSACTION
        // ======================================

        await connection.query(

            `INSERT INTO wallet_transactions
            (
                user_type,
                user_id,
                order_id,
                amount,
                type
            )
            VALUES
            (
                'delivery',
                ?,
                ?,
                ?,
                'Credit'
            )`,

            [
                deliveryId,
                orderId,
                amount
            ]

        );

        // ======================================
        // COMMIT
        // ======================================

        await connection.commit();

        // ======================================
        // SOCKET UPDATE
        // ======================================

        const io = req.app.get("io");

        io.to(
            `delivery_${deliveryId}`
        ).emit(
            "orderStatusUpdated",
            {
                orderId,
                status: "Delivered"
            }
        );

        res.json({

            success: true,

            message:
                "Order Delivered and wallet credited.",

            amount

        });

    }

    catch (err) {

        await connection.rollback();

        console.log(
            "DELIVERY WALLET ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to complete delivery."

        });

    }

    finally {

        connection.release();

    }

});

/* ==========================================
   LIVE RIDER LOCATION
========================================== */

router.put("/location", (req, res) => {

    const {
        deliveryId,
        latitude,
        longitude
    } = req.body;


    if (
        !deliveryId ||
        latitude == null ||
        longitude == null
    ) {

        return res.status(400).json({

            success:false,

            message:"Missing Location"

        });

    }


    // ======================================
    // SAVE RIDER LOCATION
    // ======================================

    db.query(

        `UPDATE delivery_partners

         SET
            latitude=?,
            longitude=?

         WHERE id=?`,

        [
            latitude,
            longitude,
            deliveryId
        ],

        (err) => {

            if (err) {

                console.log(
                    "LOCATION ERROR:",
                    err
                );

                return res.status(500).json({

                    success:false

                });

            }


            // ==================================
            // FIND RIDER'S ACTIVE ORDER
            // ==================================

            db.query(

                `SELECT
                    id,
                    customer_id,
                    status

                 FROM orders

                 WHERE
                    delivery_partner_id=?

                 AND status IN (
                    
                    'Picked Up',
                    'Out For Delivery'
                 )

                 ORDER BY id DESC

                 LIMIT 1`,

                [
                    deliveryId
                ],

                (orderErr, orders) => {

                    if (orderErr) {

                        console.log(
                            orderErr
                        );

                        return res.json({

                            success:true

                        });

                    }


                    if (
                        orders.length === 0
                    ) {

                        return res.json({

                            success:true

                        });

                    }


                    const order =
                        orders[0];


                    // ==============================
                    // SEND LIVE LOCATION
                    // ==============================

                    const io =
                        req.app.get("io");


                    if (io) {

                        io.to(

                            `customer_${order.customer_id}`

                        ).emit(

                            "deliveryLocationUpdated",

                            {

                                orderId:
                                    order.id,

                                deliveryId:
                                    deliveryId,

                                latitude:
                                    Number(latitude),

                                longitude:
                                    Number(longitude)

                            }

                        );

                    }


                    res.json({

                        success:true

                    });

                }

            );

        }

    );

});

module.exports = router;