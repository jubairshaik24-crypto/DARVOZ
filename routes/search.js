const express = require("express");
const router = express.Router();
const db = require("../config/db");

/*
=================================================
DARVOZ GLOBAL SEARCH
FOOD + GROCERY
=================================================
*/

// Convert callback-style db.query() into a Promise
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows);
        });
    });
}


router.get("/", async (req, res) => {

    const q = String(req.query.q || "").trim();

    /*
    =================================================
    EMPTY SEARCH
    =================================================
    */

    if (!q) {
        return res.json({
            success: true,
            query: "",
            restaurants: [],
            groceries: []
        });
    }


    try {

        const search = `%${q}%`;


        /*
        =================================================
        FOOD SEARCH
        =================================================
        */

        const foodRows = await query(
            `
            SELECT
                id AS product_id,
                partner_id,
                product_name,
                type,
                category,
                price,
                offer_price,
                image,
                status

            FROM menu_items

            WHERE product_name LIKE ?

            ORDER BY product_name ASC

            LIMIT 100
            `,
            [search]
        );


        /*
        =================================================
        GROUP FOOD BY RESTAURANT
        =================================================
        */

        const restaurantsMap = new Map();


        for (const item of foodRows) {

            /*
            ---------------------------------------------
            FIND RESTAURANT
            ---------------------------------------------
            */

            const restaurantRows = await query(
                `
                SELECT
                    id,
                    restaurant_name,
                    city,
                    rating,
                    delivery_time,
                    logo

                FROM restaurants

                WHERE id = ?

                LIMIT 1
                `,
                [item.partner_id]
            );


            /*
            ---------------------------------------------
            IGNORE OLD / DELETED RESTAURANTS
            ---------------------------------------------
            */

            if (
                !restaurantRows ||
                restaurantRows.length === 0
            ) {
                continue;
            }


            const restaurant = restaurantRows[0];

            const restaurantId = restaurant.id;


            /*
            ---------------------------------------------
            CREATE RESTAURANT GROUP
            ---------------------------------------------
            */

            if (!restaurantsMap.has(restaurantId)) {

                restaurantsMap.set(
                    restaurantId,
                    {
                        restaurant_id: restaurantId,

                        restaurant_name:
                            restaurant.restaurant_name ||
                            "Restaurant",

                        restaurant_image: "",

                        logo:
                            restaurant.logo || "",

                        city:
                            restaurant.city || "",

                        rating:
                            restaurant.rating ?? null,

                        delivery_time:
                            restaurant.delivery_time ?? null,

                        is_open: 1,

                        business_type: "Food",

                        items: []
                    }
                );

            }


            /*
            ---------------------------------------------
            ADD MATCHING FOOD ITEM
            ---------------------------------------------
            */

            restaurantsMap
                .get(restaurantId)
                .items
                .push({

                    product_id:
                        item.product_id,

                    partner_id:
                        item.partner_id,

                    product_name:
                        item.product_name,

                    type:
                        item.type,

                    category:
                        item.category,

                    price:
                        item.price,

                    offer_price:
                        item.offer_price,

                    image:
                        item.image,

                    status:
                        item.status

                });

        }


        const restaurants =
            Array.from(
                restaurantsMap.values()
            );


        /*
        =================================================
        GROCERY SEARCH
        =================================================
        */

        const groceryRows = await query(
            `
            SELECT

                gp.id AS product_id,

                gp.partner_id,

                gp.default_product_id,

                gp.product_name,

                gp.category_id,

                gp.image AS product_image,

                gv.id AS variant_id,

                gv.size,

                gv.price,

                gv.offer_price,

                gv.stock,

                gv.status AS variant_status

            FROM partner_grocery_products gp

            INNER JOIN partner_grocery_variants gv

                ON gv.partner_product_id = gp.id

            WHERE gp.product_name LIKE ?

            ORDER BY
                gp.product_name ASC,
                gv.price ASC

            LIMIT 100
            `,
            [search]
        );


        /*
        =================================================
        RESPONSE
        =================================================
        */

        return res.json({

            success: true,

            query: q,

            restaurants:
                restaurants,

            groceries:
                groceryRows

        });

    }
    catch (error) {

        console.error(
            "DARVOZ GLOBAL SEARCH ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Search failed",

            error: error.message

        });

    }

});


module.exports = router;