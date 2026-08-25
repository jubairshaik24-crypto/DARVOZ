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

    // Remove old default address
    db.query(
        "UPDATE customer_addresses SET is_default=0 WHERE customer_id=?",
        [customer_id],
        (updateError) => {

            if (updateError) {
                console.log(
                    "REMOVE OLD DEFAULT ERROR:",
                    updateError
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to save address"
                });
            }

            // Add new address as default
            db.query(
                `
                INSERT INTO customer_addresses
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `,
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
                        console.log(
                            "ADD ADDRESS ERROR:",
                            err
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Unable to save address"
                        });
                    }

                    return res.json({
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
router.get("/default/:customerId", (req, res) => {

    const sql = `
        SELECT *
        FROM customer_addresses
        WHERE customer_id = ?
        AND is_default = 1
        LIMIT 1
    `;

    db.query(
        sql,
        [req.params.customerId],
        (err, result) => {

            if (err) {
                console.log(
                    "GET DEFAULT ADDRESS ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to get default address"
                });
            }

            if (!result || result.length === 0) {
                return res.json(null);
            }

            return res.json(result[0]);
        }
    );
});


// ======================================
// GET CUSTOMER ADDRESSES
// ======================================
router.get("/:customerId", (req, res) => {

    const sql = `
        SELECT *
        FROM customer_addresses
        WHERE customer_id = ?
        ORDER BY is_default DESC, id DESC
    `;

    db.query(
        sql,
        [req.params.customerId],
        (err, result) => {

            if (err) {
                console.log(
                    "GET ADDRESSES ERROR:",
                    err
                );

                return res.status(500).json([]);
            }

            return res.json(result);
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
        (resetError) => {

            if (resetError) {
                console.log(
                    "RESET DEFAULT ADDRESS ERROR:",
                    resetError
                );

                return res.status(500).json({
                    success: false
                });
            }

            db.query(
                `
                UPDATE customer_addresses
                SET is_default = 1
                WHERE id = ?
                AND customer_id = ?
                `,
                [addressId, customerId],
                (err, result) => {

                    if (err) {
                        console.log(
                            "SET DEFAULT ADDRESS ERROR:",
                            err
                        );

                        return res.status(500).json({
                            success: false
                        });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Address not found"
                        });
                    }

                    return res.json({
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

    const sql = `
        UPDATE customer_addresses
        SET
            title = ?,
            house = ?,
            street = ?,
            area = ?,
            city = ?,
            state = ?,
            pincode = ?,
            latitude = ?,
            longitude = ?
        WHERE id = ?
    `;

    db.query(
        sql,
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
                console.log(
                    "UPDATE ADDRESS ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }

            return res.json({
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
                console.log(
                    "DELETE ADDRESS ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }

            return res.json({
                success: true
            });
        }
    );
});


module.exports = router;