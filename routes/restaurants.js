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

    // ==========================================
    // RESTAURANTS QUERY
    // ==========================================

    let sql = `
        SELECT
            r.id,
            r.restaurant_id,
            r.restaurant_name,
            r.business_type,
            r.logo,
            r.city,
            r.state,
            r.latitude,
            r.longitude,
            r.rating,
            r.online_status,

            (
                6371 *
                acos(
                    LEAST(
                        1,
                        GREATEST(
                            -1,
                            cos(radians(?))
                            *
                            cos(radians(r.latitude))
                            *
                            cos(
                                radians(r.longitude) -
                                radians(?)
                            )
                            +
                            sin(radians(?))
                            *
                            sin(radians(r.latitude))
                        )
                    )
                )
            ) AS distance

        FROM restaurants r
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
            WHERE LOWER(r.business_type)
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

            console.log(
                "NEARBY RESTAURANT SQL ERROR:",
                err
            );

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

        // ==========================================
        // IF NO RESTAURANTS
        // ==========================================

        if (!result.length) {

            return res.json([]);

        }

        // ==========================================
        // GET CURRENT DAY
        // ==========================================

        const now = new Date();

        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

        const currentDay =
            dayNames[now.getDay()];

        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();

        console.log(
            "CURRENT DAY:",
            currentDay
        );

        console.log(
            "CURRENT TIME:",
            now.toTimeString()
        );

        // ==========================================
        // GET BUSINESS HOURS FOR ALL RESTAURANTS
        // ==========================================

        const restaurantIds =
            result.map(r => r.id);

        const placeholders =
            restaurantIds
                .map(() => "?")
                .join(",");

        const hoursSql = `

            SELECT
                partner_id,
                day_of_week,
                is_closed,
                opening_time,
                closing_time

            FROM partner_business_hours

            WHERE partner_id IN (${placeholders})

        `;

        db.query(
            hoursSql,
            restaurantIds,
            (hoursErr, hoursResult) => {

                if (hoursErr) {

                    console.log(
                        "BUSINESS HOURS SQL ERROR:",
                        hoursErr
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to load business hours.",
                        restaurants: []
                    });
                }

                // ==========================================
                // CREATE HOURS MAP
                // ==========================================

                const hoursMap = {};

                hoursResult.forEach(row => {

                    const key =
                        `${row.partner_id}_${row.day_of_week}`;

                    hoursMap[key] = row;

                });

                // ==========================================
                // CALCULATE OPEN / CLOSED
                // + NEXT OPENING
                // ==========================================

                const restaurants =
                    result.map(r => {

                        const key =
                            `${r.id}_${currentDay}`;

                        const todayHours =
                            hoursMap[key];

                        let isOpen = false;

                        let openingTime = null;

                        let closingTime = null;

                        let nextOpeningText = "";

                        // ==========================================
                        // FIND NEXT OPENING
                        // ==========================================

                        function findNextOpening() {

                            const dayOrder = [
                                "Sunday",
                                "Monday",
                                "Tuesday",
                                "Wednesday",
                                "Thursday",
                                "Friday",
                                "Saturday"
                            ];

                            const currentIndex =
                                dayOrder.indexOf(currentDay);

                            // --------------------------------------
                            // CHECK TODAY FIRST
                            // --------------------------------------

                            if (
                                todayHours &&
                                Number(todayHours.is_closed) !== 1
                            ) {

                                const todayOpening =
                                    parseTime(
                                        todayHours.opening_time
                                    );

                                const todayClosing =
                                    parseTime(
                                        todayHours.closing_time
                                    );

                                if (
                                    todayOpening !== null &&
                                    todayClosing !== null
                                ) {

                                    // Restaurant has not opened yet
                                    // today.

                                    if (
                                        currentMinutes <
                                        todayOpening
                                    ) {

                                        return {
                                            day: "today",
                                            time:
                                                todayHours.opening_time
                                        };

                                    }

                                }

                            }

                            // --------------------------------------
                            // CHECK NEXT 7 DAYS
                            // --------------------------------------

                            for (
                                let i = 1;
                                i <= 7;
                                i++
                            ) {

                                const nextIndex =
                                    (currentIndex + i) % 7;

                                const nextDay =
                                    dayOrder[nextIndex];

                                const nextKey =
                                    `${r.id}_${nextDay}`;

                                const nextHours =
                                    hoursMap[nextKey];

                                if (
                                    nextHours &&
                                    Number(
                                        nextHours.is_closed
                                    ) !== 1
                                ) {

                                    const nextOpening =
                                        parseTime(
                                            nextHours.opening_time
                                        );

                                    const nextClosing =
                                        parseTime(
                                            nextHours.closing_time
                                        );

                                    if (
                                        nextOpening !== null &&
                                        nextClosing !== null
                                    ) {

                                        return {
                                            day: nextDay,
                                            time:
                                                nextHours.opening_time
                                        };

                                    }

                                }

                            }

                            // --------------------------------------
                            // ALL DAYS CLOSED
                            // --------------------------------------

                            return null;

                        }

                        // ==========================================
                        // NO HOURS CONFIGURED
                        // ==========================================

                        if (!todayHours) {

                            isOpen = false;

                        }

                        // ==========================================
                        // PARTNER MARKED CLOSED
                        // ==========================================

                        else if (
                            Number(
                                todayHours.is_closed
                            ) === 1
                        ) {

                            isOpen = false;

                        }

                        // ==========================================
                        // HOURS EXIST
                        // ==========================================

                        else {

                            openingTime =
                                parseTime(
                                    todayHours.opening_time
                                );

                            closingTime =
                                parseTime(
                                    todayHours.closing_time
                                );

                            // --------------------------------------
                            // MISSING TIME = CLOSED
                            // --------------------------------------

                            if (
                                openingTime === null ||
                                closingTime === null
                            ) {

                                isOpen = false;

                            }

                            // --------------------------------------
                            // SAME DAY
                            // Example:
                            // 09:00 -> 22:00
                            // --------------------------------------

                            else if (
                                openingTime <= closingTime
                            ) {

                                isOpen =
                                    currentMinutes >=
                                    openingTime &&
                                    currentMinutes <=
                                    closingTime;

                            }

                            // --------------------------------------
                            // OVERNIGHT
                            // Example:
                            // 22:00 -> 02:00
                            // --------------------------------------

                            else {

                                isOpen =
                                    currentMinutes >=
                                    openingTime ||
                                    currentMinutes <=
                                    closingTime;

                            }

                        }

                        // ==========================================
                        // CREATE NEXT OPENING TEXT
                        // ==========================================

                        if (!isOpen) {

                            const nextOpening =
                                findNextOpening();

                            if (nextOpening) {

                                // ----------------------------------
                                // OPENS LATER TODAY
                                // ----------------------------------

                                if (
                                    nextOpening.day === "today"
                                ) {

                                    nextOpeningText =
                                        `Opens at ${formatTime(
                                            nextOpening.time
                                        )}`;

                                }

                                // ----------------------------------
                                // OPENS ANOTHER DAY
                                // ----------------------------------

                                else {

                                    nextOpeningText =
                                        `Opens ${nextOpening.day} at ${formatTime(
                                            nextOpening.time
                                        )}`;

                                }

                            }

                            // --------------------------------------
                            // ALL DAYS CLOSED
                            // --------------------------------------

                            else {

                                nextOpeningText = "";

                            }

                        }

                        // ==========================================
                        // DELIVERY TIME
                        // ==========================================

                        const deliveryTime =
                            Math.round(
                                15 +
                                Number(r.distance) * 3
                            );

                        // ==========================================
                        // OFFER
                        // ==========================================

                        let offer = "";

                        if (
                            Number(r.rating) >= 4.7
                        ) {

                            offer = "50% OFF";

                        }

                        else if (
                            Number(r.rating) >= 4.5
                        ) {

                            offer = "FREE Delivery";

                        }

                        else {

                            offer = "20% OFF";

                        }

                        // ==========================================
                        // FINAL RESPONSE
                        // ==========================================

                        return {

                            ...r,

                            distance:
                                Number(r.distance),

                            isOpen,

                            currentDay,

                            openingTime:
                                todayHours
                                    ? todayHours.opening_time
                                    : null,

                            closingTime:
                                todayHours
                                    ? todayHours.closing_time
                                    : null,

                            isClosedToday:
                                todayHours
                                    ? Number(
                                        todayHours.is_closed
                                      ) === 1
                                    : true,

                            nextOpeningText,

                            deliveryTime,

                            offer

                        };

                    });

                // ==========================================
                // LOG STATUS
                // ==========================================

                restaurants.forEach(r => {

                    console.log(
                        r.restaurant_name,
                        "|",
                        currentDay,
                        "|",
                        r.openingTime,
                        "-",
                        r.closingTime,
                        "| OPEN:",
                        r.isOpen,
                        "| NEXT:",
                        r.nextOpeningText
                    );

                });

                // ==========================================
                // SEND RESPONSE
                // ==========================================

                return res.json(restaurants);

            }
        );

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
    } = req.body || {};

    console.log("=================================");
    console.log("RESTAURANT DETAILS REQUEST");
    console.log("RESTAURANT ID:", id);
    console.log("LATITUDE:", latitude);
    console.log("LONGITUDE:", longitude);
    console.log("=================================");

    const sql = `
        SELECT *
        FROM restaurants
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [id], (err, result) => {

        if (err) {

            console.error(
                "RESTAURANT DETAILS SQL ERROR:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Database error"
            });

        }

        if (!result || result.length === 0) {

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

        addDistance(
            restaurant,
            latitude,
            longitude
        );

        // ==========================================
        // RESPONSE
        // ==========================================

        return res.json(restaurant);

    });

});


// ==========================================
// GET PARTNER BUSINESS HOURS
// GET /restaurants/:id/business-hours
// ==========================================

router.get("/:id/business-hours", (req, res) => {

    const partnerId = req.params.id;

    const sql = `
        SELECT
            id,
            partner_id,
            day_of_week,
            is_closed,
            opening_time,
            closing_time
        FROM partner_business_hours
        WHERE partner_id = ?
        ORDER BY FIELD(
            day_of_week,
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        )
    `;

    db.query(sql, [partnerId], (err, rows) => {

        if (err) {

            console.error(
                "BUSINESS HOURS ERROR:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load business hours",
                hours: []
            });

        }

        res.json({
            success: true,
            hours: rows
        });

    });

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

                console.log(
                    "PRODUCT SQL ERROR:",
                    err
                );

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
// FORMAT TIME
// ==========================================

function formatTime(time) {

    if (!time) {
        return "";
    }

    const parts =
        String(time).split(":");

    if (parts.length < 2) {
        return String(time);
    }

    let hour =
        parseInt(parts[0], 10);

    const minute =
        String(parts[1]).padStart(2, "0");

    const suffix =
        hour >= 12 ? "PM" : "AM";

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${suffix}`;

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


// ==========================================
// ADD DISTANCE
// ==========================================

function addDistance(
    restaurant,
    latitude,
    longitude
) {

    const customerLat =
        Number(latitude);

    const customerLng =
        Number(longitude);

    const restaurantLat =
        Number(restaurant.latitude);

    const restaurantLng =
        Number(restaurant.longitude);

    if (
        Number.isFinite(customerLat) &&
        Number.isFinite(customerLng) &&
        Number.isFinite(restaurantLat) &&
        Number.isFinite(restaurantLng)
    ) {

        const distance =
            getDistance(
                customerLat,
                customerLng,
                restaurantLat,
                restaurantLng
            );

        restaurant.distance =
            `${distance.toFixed(1)} km`;

        restaurant.delivery_time =
            `${Math.round(
                distance * 4 + 10
            )}-${Math.round(
                distance * 4 + 15
            )} min`;

    }

    else {

        restaurant.distance = "";

        restaurant.delivery_time =
            "25-35 min";

    }

    return restaurant;

}


// ==========================================
// GET GROCERY PRODUCTS
// GET /restaurants/grocery/:partnerId
// ==========================================

router.get(
    "/grocery/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;

        console.log(
            "NEW GROCERY ROUTE RUNNING:",
            partnerId
        );

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

            ORDER BY
                pgp.featured DESC,
                pgp.id DESC
        `;

        db.query(
            productSql,
            [partnerId],
            (productErr, products) => {

                if (productErr) {

                    console.error(productErr);

                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to load grocery products",
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

                // ==========================================
                // GET PRODUCT VARIANTS
                // ==========================================

                const productIds =
                    products.map(
                        product => product.id
                    );

                const placeholders =
                    productIds
                        .map(() => "?")
                        .join(",");

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

                    WHERE partner_product_id
                    IN (${placeholders})

                      AND status = 'Available'

                    ORDER BY
                        partner_product_id,
                        id
                `;

                db.query(
                    variantSql,
                    productIds,
                    (variantErr, variants) => {

                        if (variantErr) {

                            console.error(
                                variantErr
                            );

                            return res.status(500).json({
                                success: false,
                                message:
                                    "Failed to load grocery variants",
                                categories: [],
                                products: []
                            });

                        }

                        // ==========================================
                        // CREATE VARIANT MAP
                        // ==========================================

                        const variantMap = {};

                        variants.forEach(
                            variant => {

                                const key =
                                    String(
                                        variant.partner_product_id
                                    );

                                if (!variantMap[key]) {

                                    variantMap[key] = [];

                                }

                                const mrp =
                                    Number(
                                        variant.price
                                    ) || 0;

                                const offerPrice =
                                    variant.offer_price !== null &&
                                    variant.offer_price !== undefined &&
                                    Number(
                                        variant.offer_price
                                    ) > 0

                                        ? Number(
                                            variant.offer_price
                                        )

                                        : null;

                                variantMap[key].push({

                                    id:
                                        variant.id,

                                    weight:
                                        variant.size,

                                    size:
                                        variant.size,

                                    // Selling price
                                    price:
                                        offerPrice || mrp,

                                    selling_price:
                                        offerPrice || mrp,

                                    // Original price
                                    mrp:
                                        mrp,

                                    offer_price:
                                        offerPrice,

                                    stock:
                                        Number(
                                            variant.stock
                                        ) || 0,

                                    status:
                                        variant.status

                                });

                            }
                        );

                        // ==========================================
                        // FINAL PRODUCTS
                        // ==========================================

                        const finalProducts =
                            products.map(
                                product => {

                                    const productVariants =
                                        variantMap[
                                            String(product.id)
                                        ] || [];

                                    const prices =
                                        productVariants
                                            .map(
                                                item =>
                                                    item.price
                                            )
                                            .filter(
                                                price =>
                                                    price > 0
                                            );

                                    const mrps =
                                        productVariants
                                            .map(
                                                item =>
                                                    item.mrp
                                            )
                                            .filter(
                                                price =>
                                                    price > 0
                                            );

                                    return {

                                        ...product,

                                        category_name:
                                            product.category_name ||
                                            "Other",

                                        image:
                                            product.image ||
                                            product.default_image ||
                                            "/images/other.jpg",

                                        price:
                                            prices.length > 0
                                                ? Math.min(
                                                    ...prices
                                                )
                                                : 0,

                                        selling_price:
                                            prices.length > 0
                                                ? Math.min(
                                                    ...prices
                                                )
                                                : 0,

                                        mrp:
                                            mrps.length > 0
                                                ? Math.min(
                                                    ...mrps
                                                )
                                                : 0,

                                        variants:
                                            productVariants

                                    };

                                }
                            );

                        // ==========================================
                        // CATEGORY MAP
                        // ==========================================

                        const categoryMap =
                            new Map();

                        finalProducts.forEach(
                            product => {

                                if (
                                    product.category_id !== null &&
                                    product.category_id !== undefined
                                ) {

                                    categoryMap.set(
                                        String(
                                            product.category_id
                                        ),
                                        {

                                            id:
                                                product.category_id,

                                            name:
                                                product.category_name ||
                                                "Other",

                                            category_image:
                                                product.category_image ||
                                                null

                                        }
                                    );

                                }

                            }
                        );

                        // ==========================================
                        // SEND GROCERY RESPONSE
                        // ==========================================

                        return res.json({

                            success: true,

                            partner_id:
                                partnerId,

                            categories:
                                Array.from(
                                    categoryMap.values()
                                ),

                            products:
                                finalProducts

                        });

                    }
                );

            }
        );

    }
);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;