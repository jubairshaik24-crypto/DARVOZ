const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/register", (req, res) => {

   const {

businessType,
restaurant_name,
owner_name,
email,
mobile,
password,
address

}=req.body;

    const sql = `
INSERT INTO restaurants
(business_type, restaurant_name, owner_name, email, mobile, password, address)
VALUES (?,?,?,?,?,?,?)
`;
db.query(
    sql,
    [
        businessType,
        restaurant_name,
        owner_name,
        email,
        mobile,
        password,
        address
    ],
    (err, result) => {

        if (err) {
            console.log(err);

            return res.json({
                success: false,
                message: "Registration Failed"
            });
        }

        // Generate Partner ID
        const partnerId = "DAR" + String(result.insertId).padStart(4, "0");

        db.query(

            "UPDATE restaurants SET restaurant_id=? WHERE id=?",

            [partnerId, result.insertId],

            (updateErr) => {

                if(updateErr){

                    console.log(updateErr);

                    return res.json({
                        success:false,
                        message:"Partner ID Generation Failed"
                    });

                }

                res.json({

                    success:true,

                    message:"Registration Successful",

                    partnerId:partnerId

                });

            }

        );

    }
);

});
// ======================================
// Get Restaurant Details
// ======================================

router.get("/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "SELECT * FROM restaurants WHERE id=?",

        [id],

        (err, result) => {

            if (err) {

                console.log(err);
                return res.status(500).json({});

            }

            if (result.length === 0) {

                return res.status(404).json({});

            }

            res.json(result[0]);

        }

    );

});
// ======================================
// Get Restaurant Products
// ======================================

router.get("/:id/products", (req, res) => {

    const id = req.params.id;

    db.query(

        "SELECT * FROM products WHERE partner_id=?",

        [id],

        (err, result) => {

            if (err) {

                console.log(err);
                return res.status(500).json([]);

            }

            res.json(result);

        }

    );

});
const bcrypt = require("bcryptjs");

// ======================================
// Restaurant Login
// ======================================

router.post("/login", async (req, res) => {

    const { restaurantId, password } = req.body;

    db.query(

        "SELECT * FROM restaurants WHERE restaurant_id=?",

        [restaurantId],

        async (err, result) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false,
                    message: "Server Error"
                });

            }

            if (result.length == 0) {

                return res.json({
                    success: false,
                    message: "Partner not found"
                });

            }

            const partner = result[0];

            const match = await bcrypt.compare(password, partner.password);

            if (!match) {

                return res.json({
                    success: false,
                    message: "Wrong Password"
                });

            }

            res.json({

                success: true,

                restaurant: {

                    id: partner.id,
                    restaurant_name: partner.restaurant_name,
                    owner_name: partner.owner_name,
                    business_type: partner.business_type

                }

            });

        }

    );

});

// ======================================
// Get All Restaurants
// ======================================

router.get("/all/list", (req, res) => {

    db.query(

        `SELECT
            id,
            restaurant_name,
            business_type,
            address
         FROM restaurants
         ORDER BY id DESC`,

        (err, result) => {

            if(err){

                console.log(err);

                return res.json([]);

            }

            res.json(result);

        }

    );

});
module.exports = router;