const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const router = express.Router();

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return R * c;
}

function addDistance(restaurant, latitude, longitude) {
    const customerLat = Number(latitude);
    const customerLng = Number(longitude);
    const restaurantLat = Number(restaurant.latitude);
    const restaurantLng = Number(restaurant.longitude);

    if (
        Number.isFinite(customerLat) &&
        Number.isFinite(customerLng) &&
        Number.isFinite(restaurantLat) &&
        Number.isFinite(restaurantLng)
    ) {
        const distance = getDistance(
            customerLat,
            customerLng,
            restaurantLat,
            restaurantLng
        );

        restaurant.distance = `${distance.toFixed(1)} km`;

        restaurant.delivery_time =
            `${Math.round(distance * 4 + 10)}-${Math.round(distance * 4 + 15)} min`;
    } else {
        restaurant.distance = "";
        restaurant.delivery_time = "25-35 min";
    }

    return restaurant;
}

// ======================================
// RESTAURANT REGISTRATION
// ======================================

router.post("/register", async (req, res) => {
    try {
        const {
            businessType,
            restaurant_name,
            owner_name,
            email,
            mobile,
            password,

            address,
            city,
            state,
            pincode,
            latitude,
            longitude,

            logo,
            logo_public_id,

            storePhoto,
            storePhoto_public_id,

            fssai,
            fssai_public_id,

            gst,
            gst_public_id,

            account_holder,
            bank_name,
            account_number,
            ifsc,
            upi
        } = req.body;

        if (!email || !mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "Email, mobile and password are required"
            });
        }

        db.query(
            "SELECT id FROM restaurants WHERE email = ?",
            [email],
            async (checkErr, existing) => {
                if (checkErr) {
                    console.error("EMAIL CHECK ERROR:", checkErr);

                    return res.status(500).json({
                        success: false,
                        message: "Database error"
                    });
                }

                if (existing.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: "Email already registered"
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                const sql = `
                    INSERT INTO restaurants (
                        business_type,
                        restaurant_name,
                        owner_name,
                        email,
                        mobile,
                        password,
                        address,
                        city,
                        state,
                        pincode,
                        latitude,
                        longitude,
                        logo,
                        logo_public_id,
                        storePhoto,
                        storePhoto_public_id,
                        fssai,
                        fssai_public_id,
                        gst,
                        gst_public_id,
                        account_holder,
                        bank_name,
                        account_number,
                        ifsc,
                        upi,
                        status
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?
                    )
                `;

                const values = [
                    businessType,
                    restaurant_name,
                    owner_name,
                    email,
                    mobile,
                    hashedPassword,

                    address,
                    city,
                    state,
                    pincode,
                    latitude,
                    longitude,

                    logo,
                    logo_public_id,

                    storePhoto,
                    storePhoto_public_id,

                    fssai,
                    fssai_public_id,

                    gst,
                    gst_public_id,

                    account_holder,
                    bank_name,
                    account_number,
                    ifsc,
                    upi,

                    "Pending"
                ];

                db.query(sql, values, (insertErr, result) => {
                    if (insertErr) {
                        console.error(
                            "RESTAURANT REGISTRATION ERROR:",
                            insertErr
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Registration failed"
                        });
                    }

                    const partnerId =
                        "DAR" +
                        String(result.insertId).padStart(4, "0");

                    db.query(
                        "UPDATE restaurants SET restaurant_id = ? WHERE id = ?",
                        [partnerId, result.insertId],
                        updateErr => {
                            if (updateErr) {
                                console.error(
                                    "PARTNER ID UPDATE ERROR:",
                                    updateErr
                                );

                                return res.status(500).json({
                                    success: false,
                                    message: "Partner ID creation failed"
                                });
                            }

                            return res.status(201).json({
                                success: true,
                                partnerId
                            });
                        }
                    );
                });
            }
        );
    } catch (error) {
        console.error("REGISTRATION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

// ======================================
// CUSTOMER - GET PARTNER GROCERY PRODUCTS
// GET /restaurants/grocery/:partnerId
// ======================================

router.get("/grocery/:partnerId", (req, res) => {
    const partnerId = Number(req.params.partnerId);

    if (!Number.isInteger(partnerId) || partnerId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid partner ID",
            categories: [],
            products: []
        });
    }

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

            gdp.product_type,
            gdp.product_image AS default_image

        FROM partner_grocery_products AS pgp

        LEFT JOIN grocery_categories AS gc
            ON gc.id = pgp.category_id

        LEFT JOIN grocery_default_products AS gdp
            ON gdp.id = pgp.default_product_id

        WHERE pgp.partner_id = ?
          AND pgp.status = 'Available'

        ORDER BY
            pgp.featured DESC,
            pgp.id DESC
    `;

    db.query(productSql, [partnerId], (productErr, products) => {
        if (productErr) {
            console.error(
                "CUSTOMER GROCERY PRODUCT ERROR:",
                productErr
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load grocery products",
                categories: [],
                products: []
            });
        }

        if (products.length === 0) {
            return res.json({
                success: true,
                partner_id: partnerId,
                categories: [],
                products: []
            });
        }

        const productIds = products.map(product => product.id);
        const placeholders = productIds.map(() => "?").join(", ");

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

            ORDER BY
                partner_product_id ASC,
                id ASC
        `;

        db.query(variantSql, productIds, (variantErr, variants) => {
            if (variantErr) {
                console.error(
                    "CUSTOMER GROCERY VARIANT ERROR:",
                    variantErr
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to load grocery variants",
                    categories: [],
                    products: []
                });
            }

            const variantMap = {};

            variants.forEach(variant => {
                const productKey = String(
                    variant.partner_product_id
                );

                if (!variantMap[productKey]) {
                    variantMap[productKey] = [];
                }

                const mrp = Number(variant.price) || 0;

                const rawOfferPrice =
                    variant.offer_price !== null &&
                    variant.offer_price !== undefined &&
                    variant.offer_price !== ""
                        ? Number(variant.offer_price)
                        : null;

                const offerPrice =
                    rawOfferPrice !== null &&
                    Number.isFinite(rawOfferPrice) &&
                    rawOfferPrice > 0
                        ? rawOfferPrice
                        : null;

                const sellingPrice =
                    offerPrice !== null
                        ? offerPrice
                        : mrp;

                variantMap[productKey].push({
                    id: variant.id,

                    partner_product_id:
                        variant.partner_product_id,

                    weight: variant.size,
                    size: variant.size,

                    // Customer selling price:
                    // offer_price when present, otherwise normal price.
                    price: sellingPrice,
                    selling_price: sellingPrice,

                    // Original price / MRP remains available.
                    mrp: mrp,
                    offer_price: offerPrice,

                    stock: Number(variant.stock) || 0,
                    status: variant.status
                });
            });

            const finalProducts = products.map(product => {
                const productVariants =
                    variantMap[String(product.id)] || [];

                const sellingPrices = productVariants
                    .map(variant => Number(variant.selling_price))
                    .filter(price => price > 0);

                const mrpPrices = productVariants
                    .map(variant => Number(variant.mrp))
                    .filter(price => price > 0);

                const lowestSellingPrice =
                    sellingPrices.length > 0
                        ? Math.min(...sellingPrices)
                        : 0;

                const lowestMrp =
                    mrpPrices.length > 0
                        ? Math.min(...mrpPrices)
                        : 0;

                return {
                    id: product.id,
                    partner_id: product.partner_id,
                    default_product_id: product.default_product_id,

                    product_name: product.product_name,

                    category_id: product.category_id,
                    category_name:
                        product.category_name || "Other",

                    image:
                        product.image ||
                        product.default_image ||
                        "/images/other.jpg",

                    product_type: product.product_type,
                    status: product.status,
                    featured: product.featured,
                    created_at: product.created_at,

                    price: lowestSellingPrice,
                    selling_price: lowestSellingPrice,
                    mrp: lowestMrp,

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
                            name: product.category_name
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

// ======================================
// RESTAURANT LOGIN
// ======================================

router.post("/login", (req, res) => {
    const { restaurantId, password } = req.body;

    if (!restaurantId || !password) {
        return res.status(400).json({
            success: false,
            message: "Partner ID and password are required"
        });
    }

    const sql = `
        SELECT *
        FROM restaurants
        WHERE restaurant_id = ?
          AND status = 'Approved'
        LIMIT 1
    `;

    db.query(sql, [restaurantId], async (err, result) => {
        if (err) {
            console.error("RESTAURANT LOGIN ERROR:", err);

            return res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }

        if (result.length === 0) {
            return res.json({
                success: false,
                message:
                    "Your account is pending admin approval or Partner ID is invalid."
            });
        }

        try {
            const partner = result[0];

            const match = await bcrypt.compare(
                password,
                partner.password
            );

            if (!match) {
                return res.json({
                    success: false,
                    message: "Wrong Password"
                });
            }

            return res.json({
                success: true,
                restaurant: {
                    id: partner.id,
                    restaurant_name:
                        partner.restaurant_name,
                    owner_name: partner.owner_name,
                    business_type: partner.business_type
                }
            });
        } catch (compareErr) {
            console.error(
                "PASSWORD COMPARISON ERROR:",
                compareErr
            );

            return res.status(500).json({
                success: false,
                message: "Server Error"
            });
        }
    });
});

// ======================================
// GET ALL APPROVED RESTAURANTS
// ======================================

router.post("/all/list", (req, res) => {
    const {
        latitude,
        longitude
    } = req.body || {};

    const sql = `
        SELECT
            id,
            restaurant_id,
            restaurant_name,
            business_type,
            address,
            city,
            state,
            banner,
            logo,
            rating,
            latitude,
            longitude

        FROM restaurants

        WHERE status = 'Approved'

        ORDER BY id DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error(
                "APPROVED RESTAURANTS ERROR:",
                err
            );

            return res.status(500).json([]);
        }

        const restaurants = result.map(restaurant =>
            addDistance(
                restaurant,
                latitude,
                longitude
            )
        );

        return res.json(restaurants);
    });
});

// ======================================
// GET RESTAURANT DETAILS
// POST /restaurants/:id
// ======================================

router.post("/:id", (req, res) => {
    const id = Number(req.params.id);

    const {
        latitude,
        longitude
    } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid restaurant ID"
        });
    }

    db.query(
        "SELECT * FROM restaurants WHERE id = ? LIMIT 1",
        [id],
        (err, result) => {
            if (err) {
                console.error(
                    "RESTAURANT DETAILS ERROR:",
                    err
                );

                return res.status(500).json({});
            }

            if (result.length === 0) {
                return res.status(404).json({});
            }

            const restaurant = addDistance(
                result[0],
                latitude,
                longitude
            );

            return res.json(restaurant);
        }
    );
});

module.exports = router;