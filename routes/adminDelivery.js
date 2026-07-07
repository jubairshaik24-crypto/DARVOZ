const express = require("express");
const router = express.Router();
const db = require("../config/db");


// =====================================
// Get All Delivery Partners
// =====================================

router.get("/delivery", (req, res) => {

    db.query(

        "SELECT * FROM delivery_partners ORDER BY id DESC",

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


// =====================================
// Approve Delivery Partner
// =====================================

router.put("/delivery/approve/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "UPDATE delivery_partners SET status='Approved' WHERE id=?",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json({
                success: true,
                message: "Delivery Partner Approved"
            });

        }

    );

});


// =====================================
// Reject Delivery Partner
// =====================================

router.put("/delivery/reject/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "UPDATE delivery_partners SET status='Rejected' WHERE id=?",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json({
                success: true,
                message: "Delivery Partner Rejected"
            });

        }

    );

});


// =====================================
// Delete Delivery Partner (Optional)
// =====================================

router.delete("/delivery/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "DELETE FROM delivery_partners WHERE id=?",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false
                });

            }

            res.json({
                success: true,
                message: "Delivery Partner Deleted"
            });

        }

    );

});

module.exports = router;