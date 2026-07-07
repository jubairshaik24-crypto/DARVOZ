console.log("ADMIN ROUTES LOADED");
const express = require("express");
const router = express.Router();
const db = require("../config/db");



// ======================================
// Dashboard Statistics
// ======================================

router.get("/dashboard", async (req, res) => {

    try {

        const stats = {};

        db.query(
            "SELECT COUNT(*) AS total FROM orders",
            (err, orders) => {

                if (err) return res.status(500).json(err);

                stats.orders = orders[0].total;

                db.query(
                    "SELECT COUNT(*) AS total FROM restaurants",
                    (err, partners) => {

                        if (err) return res.status(500).json(err);

                        stats.partners = partners[0].total;

                        db.query(
                            "SELECT COUNT(*) AS total FROM customers",
                            (err, customers) => {

                                if (err) return res.status(500).json(err);

                                stats.customers = customers[0].total;

                                db.query(
                                    "SELECT COUNT(*) AS total FROM delivery_partners",
                                    (err, delivery) => {

                                        if (err) return res.status(500).json(err);

                                        stats.delivery = delivery[0].total;

                                        res.json(stats);

                                    }
                                );
                            }
                        );
                    }
                );
            }
        );

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });

    }

});


// ======================================
// Approve Partner
// ======================================

router.put("/approve-partner/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "UPDATE restaurants SET status='Approved' WHERE id=?",

        [id],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({ success: false });

            }

            res.json({ success: true });

        }

    );

});

// ======================================
// Reject Partner
// ======================================

router.delete("/reject-partner/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "DELETE FROM restaurants WHERE id=?",

        [id],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({ success: false });

            }

            res.json({ success: true });

        }

    );

});
// ======================================
// Get Pending Food Partners
// ======================================


router.get("/partners/:type",(req,res)=>{

    console.log("Partners Route Hit");
    console.log("Category:", req.params.type);

    const type = req.params.type;

    db.query(

        "SELECT * FROM restaurants WHERE business_type=? AND status='Pending'",

        [type],

        (err,result)=>{

            if(err){

                console.log(err);
                return res.json([]);

            }

            console.log(result);

            res.json(result);

        }

    );

});
// ======================================
// Get All Orders
// ======================================

router.get("/orders", (req, res) => {

    db.query(

        `SELECT
        id,
        customer_name,
        restaurant_name,
        grand_total,
        status

        FROM orders

        ORDER BY id DESC`,

        (err, result) => {

            if (err) {

                console.log(err);

                return res.json([]);

            }

            res.json(result);

        }

    );

});
// ======================================
// Get All Customers
// ======================================

router.get("/customers", (req, res) => {

    db.query(

        "SELECT id, name, mobile, email FROM customers ORDER BY id DESC",

        (err, result) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(result);

        }

    );

});


// ======================================
// Wallet Summary
// ======================================

router.get("/wallet", (req, res) => {

    db.query(

        "SELECT COUNT(*) AS partners FROM restaurants WHERE status='Approved'",

        (err, result) => {

            if (err) {
                console.log(err);
                return res.json({});
            }

            res.json({

                partners: result[0].partners,
                totalSettlement: 0,
                pendingSettlement: 0

            });

        }

    );

});
// Pending Delivery Partners
router.get("/delivery-partners",(req,res)=>{

db.query(

"SELECT * FROM delivery_partners WHERE status='Pending'",

(err,result)=>{

if(err){
console.log(err);
return res.json([]);
}

res.json(result);

});

});

// Approve Delivery Partner
router.put("/delivery/approve/:id",(req,res)=>{

db.query(

"UPDATE delivery_partners SET status='Approved' WHERE id=?",

[req.params.id],

(err)=>{

if(err) return res.json({success:false});

res.json({success:true});

});

});

// Reject Delivery Partner
router.delete("/delivery/reject/:id",(req,res)=>{

db.query(

"DELETE FROM delivery_partners WHERE id=?",

[req.params.id],

(err)=>{

if(err) return res.json({success:false});

res.json({success:true});

});

});
module.exports = router;