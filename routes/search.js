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

// Treat popular customer spellings as equivalent when searching dishes.
function getSpellingVariants(value) {
    const text = String(value || "");
    if (!/biryani|biriyani|briyani/i.test(text)) {
        return [text];
    }

    const canonical = text.replace(/biriyani|briyani/ig, "biryani");
    return [...new Set([
        text,
        canonical,
        canonical.replace(/biryani/ig, "biriyani"),
        canonical.replace(/biryani/ig, "briyani")
    ])];
}

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function getTrigramPatterns(value) {
    const grams = new Set();
    for (const token of normalizeSearchText(value).split(/\s+/).filter(Boolean)) {
        if (token.length < 4) continue;
        for (let index = 0; index <= token.length - 3; index += 1) {
            grams.add(token.slice(index, index + 3));
        }
    }
    return [...grams].slice(0, 24).map((gram) => `%${gram}%`);
}

function editDistance(left, right) {
    const a = normalizeSearchText(left).replace(/\s+/g, "");
    const b = normalizeSearchText(right).replace(/\s+/g, "");
    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
            }
        }
    }
    return matrix[a.length][b.length];
}

function getFuzzyMatchScore(queryText, productName) {
    const queryTokens = normalizeSearchText(queryText).split(/\s+/).filter(Boolean);
    const productTokens = normalizeSearchText(productName).split(/\s+/).filter(Boolean);
    let totalScore = 0;

    for (const queryToken of queryTokens) {
        let bestDistance = Infinity;
        for (const productToken of productTokens) {
            const allowedDistance = queryToken.length >= 8 ? 2 : 1;
            if (Math.abs(queryToken.length - productToken.length) > allowedDistance) continue;
            bestDistance = Math.min(bestDistance, editDistance(queryToken, productToken));
        }
        if (!Number.isFinite(bestDistance) || bestDistance > (queryToken.length >= 8 ? 2 : 1)) {
            return null;
        }
        totalScore += bestDistance;
    }

    return totalScore;
}

function rankFuzzyRows(rows, queryText, nameField) {
    return rows
        .map((row) => ({ row, score: getFuzzyMatchScore(queryText, row[nameField]) }))
        .filter((entry) => entry.score !== null)
        .sort((a, b) => a.score - b.score)
        .slice(0, 100)
        .map((entry) => entry.row);
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
            restaurantMatches: [],
            foodProducts: [],
            groceries: []
        });
    }


    try {

        const search = `%${q}%`;
        const queryPatterns = getSpellingVariants(q).map((value) => `%${value}%`);
        const searchTokens = q.split(/\s+/).filter(Boolean);
        const tokenSearches = searchTokens.flatMap((token) =>
            getSpellingVariants(token).map((value) => `%${value}%`)
        );
        const foodTokenConditions = searchTokens
            .map((token) => `(${getSpellingVariants(token).map(() => "product_name LIKE ?").join(" OR ")})`)
            .join(" AND ");
        const groceryTokenConditions = searchTokens
            .map((token) => `(${getSpellingVariants(token).map(() => "gp.product_name LIKE ?").join(" OR ")})`)
            .join(" AND ");
        const foodSearchConditions = queryPatterns.map(() => "product_name LIKE ?").join(" OR ");
        const grocerySearchConditions = queryPatterns.map(() => "gp.product_name LIKE ?").join(" OR ");


        /*
        =================================================
        FOOD SEARCH
        =================================================
        */

        let foodRows = await query(
            `
            SELECT
                id AS product_id,
                partner_id,
                business_type,
                product_name,
                type,
                category,
                price,
                offer_price,
                image,
                status

            FROM menu_items

            WHERE (${foodSearchConditions})
               OR (${foodTokenConditions})

            ORDER BY
                CASE
                    WHEN product_name LIKE ? THEN 0
                    ELSE 1
                END,
                product_name ASC

            LIMIT 100
            `,
            [...queryPatterns, ...tokenSearches, search]
        );

        const foodFuzzyPatterns = getTrigramPatterns(q);
        if (foodFuzzyPatterns.length) {
            const candidateRows = await query(
                `SELECT id AS product_id, partner_id, business_type, product_name, type, category, price, offer_price, image, status
                 FROM menu_items
                 WHERE ${foodFuzzyPatterns.map(() => "product_name LIKE ?").join(" OR ")}
                 LIMIT 500`,
                foodFuzzyPatterns
            );
            const knownProductIds = new Set(foodRows.map((item) => String(item.product_id)));
            const fuzzyRows = rankFuzzyRows(candidateRows, q, "product_name")
                .filter((item) => !knownProductIds.has(String(item.product_id)));
            foodRows = [...foodRows, ...fuzzyRows];
        }


        /*
        =================================================
        GROUP FOOD BY RESTAURANT
        =================================================
        */

        const restaurantsMap = new Map();
        const foodProducts = [];


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

            foodProducts.push({
                ...item,
                restaurant: {
                    restaurant_id: restaurantId,
                    restaurant_name: restaurant.restaurant_name || "Restaurant",
                    logo: restaurant.logo || "",
                    city: restaurant.city || "",
                    rating: restaurant.rating ?? null,
                    delivery_time: restaurant.delivery_time ?? null
                }
            });


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

                    business_type:
                        item.business_type,

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

        let restaurantMatches = await query(
            `SELECT id AS restaurant_id, restaurant_name, city, rating, delivery_time, logo
             FROM restaurants
             WHERE (${queryPatterns.map(() => "restaurant_name LIKE ?").join(" OR ")})
             ORDER BY CASE WHEN restaurant_name LIKE ? THEN 0 ELSE 1 END, restaurant_name ASC
             LIMIT 30`,
            [...queryPatterns, search]
        );

        const restaurantFuzzyPatterns = getTrigramPatterns(q);
        if (restaurantFuzzyPatterns.length) {
            const candidateRows = await query(
                `SELECT id AS restaurant_id, restaurant_name, city, rating, delivery_time, logo
                 FROM restaurants
                 WHERE ${restaurantFuzzyPatterns.map(() => "restaurant_name LIKE ?").join(" OR ")}
                 LIMIT 300`,
                restaurantFuzzyPatterns
            );
            const knownRestaurantIds = new Set(restaurantMatches.map((item) => String(item.restaurant_id)));
            const fuzzyRows = rankFuzzyRows(candidateRows, q, "restaurant_name")
                .filter((item) => !knownRestaurantIds.has(String(item.restaurant_id)));
            restaurantMatches = [...restaurantMatches, ...fuzzyRows].slice(0, 30);
        }


        /*
        =================================================
        GROCERY SEARCH
        =================================================
        */

        let groceryRows = await query(
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

                gv.status AS variant_status,
                r.business_type

            FROM partner_grocery_products gp

            INNER JOIN partner_grocery_variants gv

                ON gv.partner_product_id = gp.id

            LEFT JOIN restaurants r
                ON r.id = gp.partner_id

            WHERE (${grocerySearchConditions})
               OR (${groceryTokenConditions})

            ORDER BY
                CASE
                    WHEN gp.product_name LIKE ? THEN 0
                    ELSE 1
                END,
                gp.product_name ASC,
                gv.price ASC

            LIMIT 100
            `,
            [...queryPatterns, ...tokenSearches, search]
        );

        const groceryFuzzyPatterns = getTrigramPatterns(q);
        if (groceryFuzzyPatterns.length) {
            const candidateRows = await query(
                `SELECT gp.id AS product_id, gp.partner_id, gp.default_product_id, gp.product_name,
                        gp.category_id, gp.image AS product_image, gv.id AS variant_id, gv.size,
                        gv.price, gv.offer_price, gv.stock, gv.status AS variant_status, r.business_type
                 FROM partner_grocery_products gp
                 INNER JOIN partner_grocery_variants gv ON gv.partner_product_id = gp.id
                 LEFT JOIN restaurants r ON r.id = gp.partner_id
                 WHERE ${groceryFuzzyPatterns.map(() => "gp.product_name LIKE ?").join(" OR ")}
                 LIMIT 500`,
                groceryFuzzyPatterns
            );
            const knownVariants = new Set(groceryRows.map((item) => String(item.variant_id)));
            const fuzzyRows = rankFuzzyRows(candidateRows, q, "product_name")
                .filter((item) => !knownVariants.has(String(item.variant_id)));
            groceryRows = [...groceryRows, ...fuzzyRows];
        }


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

            restaurantMatches:
                restaurantMatches,

            foodProducts:
                foodProducts,

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
