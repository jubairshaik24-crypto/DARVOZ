const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all restaurants
router.get("/restaurants", (req, res) => {

    db.query(
        "SELECT * FROM restaurants ORDER BY id DESC",
        (err, result) => {

            if (err) return res.status(500).json(err);

            res.json(result);

        });

});

// Approve Restaurant
router.put("/approve/:id", (req, res) => {

    const id = req.params.id;

    const restaurantId = "RST" + (1000 + Number(id));
    const password = "DAR" + Math.floor(1000 + Math.random() * 9000);

    db.query(

        `UPDATE restaurants
         SET status='Approved',
             restaurant_id=?,
             login_password=?
         WHERE id=?`,

        [restaurantId, password, id],

        (err) => {

            if (err)
                return res.json({
                    success: false
                });

            res.json({
                success: true,
                restaurantId,
                password
            });

        });

});

module.exports = router;