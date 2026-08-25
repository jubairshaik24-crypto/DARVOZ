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
                console.log("LOGIN ERROR:", err);
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

router.post("/update-location", (req, res) => {

    const {
        customerId,
        latitude,
        longitude,
        city,
        state
    } = req.body;


    db.query(

        `UPDATE customers
         SET
            latitude=?,
            longitude=?,
            city=COALESCE(?, city),
            state=COALESCE(?, state)
         WHERE id=?`,

        [
            latitude,
            longitude,
            city || null,
            state || null,
            customerId
        ],

        (err) => {

            if(err){

                console.log(
                    "UPDATE LOCATION ERROR:",
                    err
                );

                return res.json({

                    success:false,

                    message:"Location update failed"

                });

            }


            res.json({

                success:true,

                message:"Location updated successfully"

            });

        }

    );

});

router.get("/profile/:id", (req, res) => {

    db.query(

        `SELECT
            id,
            name,
            mobile,
            email,
            house,
            street,
            area,
            city,
            state,
            pincode,
            latitude,
            longitude,
            profile_image
         FROM customers
         WHERE id=?`,

        [req.params.id],

        (err, result) => {

            if(err){

                console.log(
                    "PROFILE ERROR:",
                    err
                );

                return res.json({
                    success:false,
                    message:"Database Error"
                });

            }


            if(result.length === 0){

                return res.json({
                    success:false,
                    message:"Customer not found"
                });

            }


            res.json({

                success:true,

                customer:result[0]

            });

        }

    );

});

const multer = require("multer");
const path = require("path");

// Upload Folder
const storage = multer.diskStorage({

destination:(req,file,cb)=>{

cb(null,"uploads/");

},

filename:(req,file,cb)=>{

cb(

null,

Date.now()+path.extname(file.originalname)

);

}

});

const upload=multer({storage});

// ===============================
// UPDATE PROFILE
// ===============================
router.post(
    "/update-profile",
    upload.single("profileImage"),
    (req, res) => {

        const {
            customerId,
            name,
            email,
            house,
            street,
            area,
            city,
            state,
            pincode
        } = req.body;

        let image = "";

        if (req.file) {
            image = req.file.filename;
        }

        const sql = `
            UPDATE customers
            SET
                name = ?,
                email = ?,
                house = ?,
                street = ?,
                area = ?,
                city = ?,
                state = ?,
                pincode = ?,
                profile_image = IF(
                    ? = '',
                    profile_image,
                    ?
                )
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                name,
                email,
                house,
                street,
                area,
                city,
                state,
                pincode,
                image,
                image,
                customerId
            ],
            (err) => {

                if (err) {
                    console.log(
                        "UPDATE PROFILE ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Profile update failed"
                    });
                }

                return res.json({
                    success: true,
                    message: "Profile Updated Successfully"
                });
            }
        );
    }
);
 
router.post("/favorite", (req, res) => {

    const { customerId, productId } = req.body;

    if (!customerId || !productId) {
        return res.json({
            success: false,
            message: "Customer ID and Product ID required"
        });
    }

    db.query(
        `SELECT id
         FROM customer_favorites
         WHERE customer_id=? AND product_id=?`,
        [customerId, productId],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.json({
                    success: false,
                    message: "Database error"
                });
            }

            // Already favorite → remove
            if (result.length > 0) {

                db.query(
                    `DELETE FROM customer_favorites
                     WHERE customer_id=? AND product_id=?`,
                    [customerId, productId],
                    (err) => {

                        if (err) {
                            return res.json({
                                success: false,
                                message: "Unable to remove favorite"
                            });
                        }

                        res.json({
                            success: true,
                            favorite: false
                        });

                    }
                );

            }

            // Not favorite → add
            else {

                db.query(
                    `INSERT INTO customer_favorites
                     (customer_id, product_id)
                     VALUES (?,?)`,
                    [customerId, productId],
                    (err) => {

                        if (err) {
                            console.error(err);

                            return res.json({
                                success: false,
                                message: "Unable to save favorite"
                            });
                        }

                        res.json({
                            success: true,
                            favorite: true
                        });

                    }
                );

            }

        }
    );

});
// ==========================================
// CHECK CUSTOMER PHONE
// ==========================================
router.post("/check-phone", (req, res) => {

    const { mobile } = req.body;

    if (!mobile) {
        return res.status(400).json({
            success: false,
            message: "Mobile number is required"
        });
    }

    // Remove +91 if present
    let cleanMobile = String(mobile)
        .replace(/\D/g, "");

    if (
        cleanMobile.startsWith("91") &&
        cleanMobile.length === 12
    ) {
        cleanMobile = cleanMobile.substring(2);
    }

    console.log(
        "CHECKING CUSTOMER MOBILE:",
        cleanMobile
    );

    db.query(
        `SELECT id, name, mobile, email
         FROM customers
         WHERE mobile=?
         LIMIT 1`,
        [cleanMobile],
        (err, result) => {

            if (err) {
                console.log(
                    "CHECK PHONE ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });
            }

            // Existing customer
            if (result.length > 0) {

                return res.json({
                    success: true,
                    exists: true,
                    customer: result[0]
                });
            }

            // New customer
            return res.json({
                success: true,
                exists: false,
                customer: null
            });
        }
    );
});


module.exports = router;