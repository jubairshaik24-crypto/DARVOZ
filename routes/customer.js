const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ==========================================
   CUSTOMER REGISTER
========================================== */

router.post("/register", (req, res) => {

    const {
        name,
        mobile,
        email,
        password
    } = req.body;

    // Check if mobile already exists
    db.query(

        "SELECT id FROM customers WHERE mobile=?",

        [mobile],

        (err, result) => {

            if (err) {
                console.log(err);
                return res.json({
                    success: false,
                    message: "Database Error"
                });
            }

            if (result.length > 0) {

                return res.json({
                    success: false,
                    message: "Mobile number already registered."
                });

            }

            // Insert customer
            db.query(

                `INSERT INTO customers
                (name,mobile,email,password,is_verified)
                VALUES (?,?,?,?,1)`,

                [
                    name,
                    mobile,
                    email,
                    password
                ],

                (err) => {

                    if (err) {
                        console.log(err);

                        return res.json({
                            success: false,
                            message: "Registration Failed"
                        });

                    }

                    res.json({
                        success: true,
                        message: "Registration Successful"
                    });

                }

            );

        }

    );

});


/* ==========================================
   CUSTOMER LOGIN
========================================== */

router.post("/login", (req, res) => {

    const { mobile, password } = req.body;

    db.query(

        `SELECT id,name,mobile,email
         FROM customers
         WHERE mobile=? AND password=?`,

        [mobile, password],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false,
                    message: "Database Error"
                });

            }

            if (result.length === 0) {

                return res.json({
                    success: false,
                    message: "Invalid Mobile Number or Password"
                });

            }

            res.json({
                success: true,
                customer: result[0]
            });

        }

    );

});

module.exports = router;