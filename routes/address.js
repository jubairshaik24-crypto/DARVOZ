const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ======================================
// ADD NEW ADDRESS
// ======================================

router.post("/add", (req, res) => {

    const {
        customer_id,
        title,
        house,
        street,
        area,
        city,
        state,
        pincode,
        latitude,
        longitude
    } = req.body;

    // Remove old default if this is first/default address
    db.query(
        "UPDATE customer_addresses SET is_default=0 WHERE customer_id=?",
        [customer_id],
        () => {

            db.query(

                `INSERT INTO customer_addresses
                (
                    customer_id,
                    title,
                    house,
                    street,
                    area,
                    city,
                    state,
                    pincode,
                    latitude,
                    longitude,
                    is_default
                )
                VALUES(?,?,?,?,?,?,?,?,?,?,1)`,

                [
                    customer_id,
                    title,
                    house,
                    street,
                    area,
                    city,
                    state,
                    pincode,
                    latitude,
                    longitude
                ],

                (err, result) => {

                    if (err) {
                        console.log(err);

                        return res.json({
                            success: false,
                            message: "Unable to save address"
                        });
                    }

                    res.json({
                        success: true,
                        message: "Address Saved",
                        addressId: result.insertId
                    });

                }

            );

        }

    );

});
// ======================================
// GET DEFAULT ADDRESS
// ======================================

router.get("/default/:customerId",(req,res)=>{

db.query(

`SELECT *
FROM customer_addresses
WHERE customer_id=?
AND is_default=1
LIMIT 1`,

[req.params.customerId],

(err,result)=>{

if(err){

console.log(err);

return res.json(null);

}

if(result.length===0){

return res.json(null);

}

res.json(result[0]);

}

);

});
// ======================================
// GET CUSTOMER ADDRESSES
// ======================================

router.get("/:customerId", (req, res) => {

    db.query(

        `SELECT *
         FROM customer_addresses
         WHERE customer_id=?
         ORDER BY is_default DESC,id DESC`,

        [req.params.customerId],

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
// SET DEFAULT ADDRESS
// ======================================

router.put("/default/:id", (req, res) => {

    const addressId = req.params.id;
    const customerId = req.body.customer_id;

    db.query(
        "UPDATE customer_addresses SET is_default=0 WHERE customer_id=?",
        [customerId],
        () => {

            db.query(
                "UPDATE customer_addresses SET is_default=1 WHERE id=?",
                [addressId],
                (err) => {

                    if (err) {

                        console.log(err);

                        return res.json({
                            success: false
                        });

                    }

                    res.json({
                        success: true
                    });

                }

            );

        }

    );

});

// ======================================
// UPDATE ADDRESS
// ======================================

router.put("/update/:id", (req, res) => {

    const {
        title,
        house,
        street,
        area,
        city,
        state,
        pincode,
        latitude,
        longitude
    } = req.body;

    db.query(

        `UPDATE customer_addresses
         SET
         title=?,
         house=?,
         street=?,
         area=?,
         city=?,
         state=?,
         pincode=?,
         latitude=?,
         longitude=?
         WHERE id=?`,

        [
            title,
            house,
            street,
            area,
            city,
            state,
            pincode,
            latitude,
            longitude,
            req.params.id
        ],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});

// ======================================
// DELETE ADDRESS
// ======================================

router.delete("/:id", (req, res) => {

    db.query(

        "DELETE FROM customer_addresses WHERE id=?",

        [req.params.id],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});

module.exports = router;