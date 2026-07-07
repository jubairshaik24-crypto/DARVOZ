const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ==========================================
   AVAILABLE ORDERS
========================================== */

router.get("/available", (req, res) => {

    db.query(

        "SELECT * FROM orders WHERE status='Ready' AND delivery_partner_id IS NULL",

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
            status='Accepted by Delivery',
            delivery_partner_id=?
        WHERE
            id=?
            AND delivery_partner_id IS NULL
            AND status='Ready'`,

        [partner_id, orderId],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.json({
                    success:false,
                    message:"Database Error"
                });

            }

            if(result.affectedRows===0){

                return res.json({
                    success:false,
                    message:"Order already accepted."
                });

            }

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

router.put("/pickup/:id",(req,res)=>{

    const id=req.params.id;

    db.query(

        "UPDATE orders SET status='Picked Up' WHERE id=?",

        [id],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({success:false});

            }

            res.json({success:true});

        }

    );

});


/* ==========================================
   OUT FOR DELIVERY
========================================== */

router.put("/outfordelivery/:id",(req,res)=>{

    const id=req.params.id;

    db.query(

        "UPDATE orders SET status='Out For Delivery' WHERE id=?",

        [id],

        (err)=>{

            if(err){

                console.log(err);

                return res.json({success:false});

            }

            res.json({success:true});

        }

    );

});


/* ==========================================
   DELIVERED
========================================== */
router.put("/delivered/:id", (req, res) => {

    const orderId = req.params.id;

    db.query(

        "SELECT delivery_partner_id, delivery_fee FROM orders WHERE id=?",

        [orderId],

        (err, result) => {

            if (err || result.length === 0) {

                return res.json({
                    success: false
                });

            }

            const partnerId = result[0].delivery_partner_id;
            const amount = result[0].delivery_fee;

            db.query(

                "UPDATE orders SET status='Delivered' WHERE id=?",

                [orderId],

                (err) => {

                    if (err) {

                        return res.json({
                            success: false
                        });

                    }

                    db.query(

                        `INSERT INTO wallet_transactions
                        (partner_id,order_id,amount)
                        VALUES (?,?,?)`,

                        [partnerId, orderId, amount],

                        (err) => {

                            if (err) {

                                console.log(err);

                            }

                            res.json({

                                success: true,
                                message: "Order Delivered"

                            });

                        }

                    );

                }

            );

        }

    );

});

module.exports = router;