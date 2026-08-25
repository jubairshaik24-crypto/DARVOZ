console.log("✅ search.js loaded");
const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", async (req, res) => {

    try {

        const keyword = "%" + (req.query.q || "") + "%";

        const [rows] = await db.query(

            `SELECT DISTINCT
                r.id,
                r.restaurant_name,
                r.city,
                r.rating,
                r.delivery_time,
                r.logo
            FROM restaurants r
            LEFT JOIN menu_items m
            ON r.id = m.partner_id
            WHERE r.restaurant_name LIKE ?
            OR m.product_name LIKE ?
            ORDER BY r.rating DESC`,

            [keyword, keyword]

        );

        res.json(rows);

    } catch (err) {

        console.log(err);
        res.status(500).json([]);

    }

});

module.exports = router;