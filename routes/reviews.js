const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/", async (req, res) => {

    const {
        restaurant_id,
        customer_id,
        order_id,
        rating,
        review
    } = req.body;

    await db.query(

        `INSERT INTO restaurant_reviews
        (restaurant_id,customer_id,order_id,rating,review)
        VALUES(?,?,?,?,?)`,

        [
            restaurant_id,
            customer_id,
            order_id,
            rating,
            review
        ]

    );

    res.json({
        success: true
    });

});

module.exports = router;