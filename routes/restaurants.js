const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ==========================================
// GET NEARBY RESTAURANTS
// POST /restaurants/nearby
// ==========================================

router.post("/nearby", (req, res) => {

    const {
        latitude,
        longitude,
        radius,
        category
    } = req.body;

    console.log("=================================");
    console.log("NEARBY RESTAURANT REQUEST");
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);
    console.log("Radius:", radius);
    console.log("Category:", category);
    console.log("=================================");

    if (
        latitude === undefined ||
        longitude === undefined ||
        latitude === null ||
        longitude === null
    ) {
        return res.status(400).json({
            success: false,
            message: "Latitude and longitude are required.",
            restaurants: []
        });
    }

    let sql = `
        SELECT
            id,
            restaurant_id,
            restaurant_name,
            business_type,
            logo,
            city,
            state,
            latitude,
            longitude,
            rating,
            opening_time,
            closing_time,
            online_status,

            (
                6371 *
                acos(
                    cos(radians(?))
                    *
                    cos(radians(latitude))
                    *
                    cos(
                        radians(longitude) -
                        radians(?)
                    )
                    +
                    sin(radians(?))
                    *
                    sin(radians(latitude))
                )
            ) AS distance

        FROM restaurants
    `;

    const params = [
        latitude,
        longitude,
        latitude
    ];

    // ==========================================
    // CATEGORY FILTER
    // ==========================================

    if (category) {

        sql += `
            WHERE LOWER(business_type)
            LIKE CONCAT('%', LOWER(?), '%')
        `;

        params.push(category);
    }

    // ==========================================
    // DISTANCE FILTER
    // ==========================================

    sql += `
        HAVING distance <= ?
        ORDER BY distance ASC
    `;

    params.push(radius || 10);

    db.query(sql, params, (err, result) => {

        if (err) {

            console.log("NEARBY RESTAURANT SQL ERROR:", err);

            return res.status(500).json({
                success: false,
                message: "Unable to load restaurants.",
                restaurants: []
            });
        }

        console.log(
            "RESTAURANTS FOUND:",
            result.length
        );

        const restaurants = result.map(r => {

            const now = new Date();

            const current =
                now.getHours() * 60 +
                now.getMinutes();

            const open =
                parseTime(r.opening_time);

            const close =
                parseTime(r.closing_time);

            let isOpen = false;

            if (r.online_status === "Open") {

                if (
                    open === null ||
                    close === null
                ) {
                    isOpen = true;
                } else {
                    isOpen =
                        current >= open &&
                        current <= close;
                }
            }

            const deliveryTime =
                Math.round(
                    15 + Number(r.distance) * 3
                );

            let offer = "";

            if (Number(r.rating) >= 4.7) {
                offer = "50% OFF";
            }
            else if (Number(r.rating) >= 4.5) {
                offer = "FREE Delivery";
            }
            else {
                offer = "20% OFF";
            }

            return {
                ...r,

                distance:
                    Number(r.distance),

                isOpen,

                deliveryTime,

                offer
            };

        });

        res.json(restaurants);

    });

});


// ==========================================
// GET RESTAURANT DETAILS
// POST /restaurants/:id
// ==========================================

router.post("/:id", (req, res) => {

    const id = req.params.id;

    const {
        latitude,
        longitude
    } = req.body;

    console.log("=================================");
    console.log("RESTAURANT DETAILS REQUEST");
    console.log("RESTAURANT ID:", id);
    console.log("=================================");

    db.query(
        "SELECT * FROM restaurants WHERE id=?",
        [id],
        (err, result) => {

            if (err) {

                console.log(
                    "RESTAURANT DETAILS SQL ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Database error"
                });
            }

            if (result.length === 0) {

                console.log(
                    "RESTAURANT NOT FOUND:",
                    id
                );

                return res.status(404).json({
                    success: false,
                    message: "Restaurant not found"
                });
            }

            const restaurant = result[0];

            console.log(
                "RESTAURANT FOUND:",
                restaurant.id,
                restaurant.restaurant_name,
                restaurant.restaurant_id
            );

            // ==========================================
            // DISTANCE
            // ==========================================

            if (
                latitude !== undefined &&
                longitude !== undefined &&
                restaurant.latitude &&
                restaurant.longitude
            ) {

                const distance = getDistance(

                    parseFloat(latitude),
                    parseFloat(longitude),

                    parseFloat(restaurant.latitude),
                    parseFloat(restaurant.longitude)

                );

                restaurant.distance =
                    distance.toFixed(1) + " km";

                restaurant.delivery_time =
                    `${Math.round(distance * 4 + 10)}-${Math.round(distance * 4 + 15)} min`;

            }
            else {

                restaurant.distance = "";

                restaurant.delivery_time =
                    "25-35 min";
            }

            res.json(restaurant);

        }
    );

});


// ==========================================
// GET RESTAURANT PRODUCTS
// GET /restaurants/:id/products
// ==========================================

router.get("/:id/products", (req, res) => {

    const id = req.params.id;

    console.log("=================================");
    console.log("PRODUCT REQUEST");
    console.log("RESTAURANT ID:", id);
    console.log("=================================");

    db.query(
        "SELECT * FROM products WHERE partner_id=?",
        [id],
        (err, result) => {

            if (err) {
                console.log("PRODUCT SQL ERROR:", err);
                return res.status(500).json([]);
            }

            console.log(
                "PRODUCTS FOR RESTAURANT",
                id,
                ":",
                result.length
            );

            console.log(
                result.map(p => ({
                    id: p.id,
                    partner_id: p.partner_id,
                    name: p.product_name
                }))
            );

            res.json(result);
        }
    );
});


// ==========================================
// TIME PARSER
// ==========================================

function parseTime(time) {

    if (!time) {
        return null;
    }

    const arr =
        String(time).split(":");

    if (
        arr.length < 2 ||
        isNaN(arr[0]) ||
        isNaN(arr[1])
    ) {
        return null;
    }

    return (
        parseInt(arr[0], 10) * 60 +
        parseInt(arr[1], 10)
    );
}


// ==========================================
// DISTANCE CALCULATION
// ==========================================

function getDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;

    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(
            lat1 * Math.PI / 180
        )

        *

        Math.cos(
            lat2 * Math.PI / 180
        )

        *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

router.get("/grocery/:partnerId", (req, res) => {
    const partnerId = req.params.partnerId;

    console.log("NEW GROCERY ROUTE RUNNING:", partnerId);

    const productSql = `
        SELECT
            pgp.id,
            pgp.partner_id,
            pgp.default_product_id,
            pgp.product_name,
            pgp.category_id,
            pgp.image,
            pgp.status,
            pgp.featured,
            pgp.created_at,
            gc.category_name,
gc.image AS category_image,
gdp.product_type,
gdp.product_image AS default_image

        FROM partner_grocery_products pgp

        LEFT JOIN grocery_categories gc
            ON gc.id = pgp.category_id

        LEFT JOIN grocery_default_products gdp
            ON gdp.id = pgp.default_product_id

        WHERE pgp.partner_id = ?
          AND pgp.status = 'Available'

        ORDER BY pgp.featured DESC, pgp.id DESC
    `;

    db.query(productSql, [partnerId], (productErr, products) => {
        if (productErr) {
            console.error(productErr);

            return res.status(500).json({
                success: false,
                message: "Failed to load grocery products",
                categories: [],
                products: []
            });
        }

        if (!products.length) {
            return res.json({
                success: true,
                partner_id: partnerId,
                categories: [],
                products: []
            });
        }

        const productIds = products.map(product => product.id);
        const placeholders = productIds.map(() => "?").join(",");

        const variantSql = `
            SELECT
                id,
                partner_product_id,
                size,
                price,
                offer_price,
                stock,
                status

            FROM partner_grocery_variants

            WHERE partner_product_id IN (${placeholders})
              AND status = 'Available'

            ORDER BY partner_product_id, id
        `;

        db.query(variantSql, productIds, (variantErr, variants) => {
            if (variantErr) {
                console.error(variantErr);

                return res.status(500).json({
                    success: false,
                    message: "Failed to load grocery variants",
                    categories: [],
                    products: []
                });
            }

            const variantMap = {};

            variants.forEach(variant => {
                const key = String(variant.partner_product_id);

                if (!variantMap[key]) {
                    variantMap[key] = [];
                }

                const mrp = Number(variant.price) || 0;

                const offerPrice =
                    variant.offer_price !== null &&
                    variant.offer_price !== undefined &&
                    Number(variant.offer_price) > 0
                        ? Number(variant.offer_price)
                        : null;

                variantMap[key].push({
                    id: variant.id,
                    weight: variant.size,
                    size: variant.size,

                    // Selling price uses offer price if entered.
                    price: offerPrice || mrp,
                    selling_price: offerPrice || mrp,

                    // Original price remains available.
                    mrp: mrp,
                    offer_price: offerPrice,

                    stock: Number(variant.stock) || 0,
                    status: variant.status
                });
            });

            const finalProducts = products.map(product => {
                const productVariants =
                    variantMap[String(product.id)] || [];

                const prices = productVariants
                    .map(item => item.price)
                    .filter(price => price > 0);

                const mrps = productVariants
                    .map(item => item.mrp)
                    .filter(price => price > 0);

                return {
                    ...product,

                    category_name:
                        product.category_name || "Other",

                    image:
                        product.image ||
                        product.default_image ||
                        "/images/other.jpg",

                    price:
                        prices.length > 0
                            ? Math.min(...prices)
                            : 0,

                    selling_price:
                        prices.length > 0
                            ? Math.min(...prices)
                            : 0,

                    mrp:
                        mrps.length > 0
                            ? Math.min(...mrps)
                            : 0,

                    variants: productVariants
                };
            });

            const categoryMap = new Map();

finalProducts.forEach(product => {

    if (
        product.category_id !== null &&
        product.category_id !== undefined
    ) {

        categoryMap.set(
            String(product.category_id),
            {
                id: product.category_id,

                name:
                    product.category_name || "Other",

                category_image:
                    product.category_image || null
            }
        );

    }

});

            return res.json({
                success: true,
                partner_id: partnerId,
                categories: Array.from(categoryMap.values()),
                products: finalProducts
            });
        });
    });
});
module.exports = router;