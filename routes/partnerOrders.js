const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ===============================
// Get All Orders for Partner
// ===============================

router.get("/:partner_id", (req, res) => {

    const partner_id = req.params.partner_id;

    db.query(

        `SELECT * FROM orders
         WHERE partner_id = ?
         ORDER BY id DESC`,

        [partner_id],

        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json(result);

        }

    );

});


// ===============================
// Update Order Status
// ===============================

router.put("/status/:id", (req, res) => {

    const id = req.params.id;
    const { status } = req.body;

    db.query(

        `UPDATE orders
         SET status = ?
         WHERE id = ?`,

        [status, id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json({

                success: true,
                message: "Order Status Updated Successfully"

            });

        }

    );

});


// ===============================
// Get Single Order
// ===============================

router.get("/order/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "SELECT * FROM orders WHERE id = ?",

        [id],

        (err, result) => {

            if (err) {

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


// ===============================
// Delete Order (Optional)
// ===============================

router.delete("/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "DELETE FROM orders WHERE id=?",

        [id],

        (err) => {

            if (err) {

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

module.exports = router;