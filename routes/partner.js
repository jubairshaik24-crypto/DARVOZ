console.log("✅ partner.js loaded");

const express = require("express");
const router = express.Router();

const db = require("../config/db");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");


// =====================================================
// TEST
// =====================================================

router.get("/test", (req, res) => {
    res.send("Partner Route Working");
});


// =====================================================
// CLOUDINARY + MULTER
// =====================================================

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {

        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG, WEBP and PDF files are allowed"
                )
            );
        }
    }
});


// =====================================================
// CLOUDINARY UPLOAD HELPER
// =====================================================

async function uploadToCloudinary(file, folder) {

    const base64 =
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const result =
        await cloudinary.uploader.upload(
            base64,
            {
                folder: folder,
                resource_type: "auto"
            }
        );

    return {
        url: result.secure_url,
        publicId: result.public_id
    };
}

async function uploadProductImageWithAI(file, folder) {

    const base64 =
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    // -------------------------------------------------
    // STEP 1: Upload original image
    // -------------------------------------------------

    const result =
        await cloudinary.uploader.upload(
            base64,
            {
                folder: folder,
                resource_type: "image"
            }
        );

    console.log(
        "✅ ORIGINAL IMAGE UPLOADED:",
        result.secure_url
    );

    // -------------------------------------------------
    // STEP 2: Create AI background-removal URL
    // -------------------------------------------------

    let enhancedUrl;

    try {

        enhancedUrl =
            cloudinary.url(
                result.public_id,
                {
                    secure: true,

                    transformation: [

                        {
                            effect:
                                "background_removal"
                        },

                        {
                            width: 1000,
                            height: 1000,
                            crop: "pad",
                            gravity: "center",
                            background: "white"
                        },

                        {
                            quality: "auto:good",
                            fetch_format: "auto"
                        }

                    ]
                }
            );

        console.log(
            "✅ AI IMAGE URL CREATED:",
            enhancedUrl
        );

    } catch (aiError) {

        console.error(
            "⚠️ AI URL CREATION ERROR:",
            aiError
        );

        // If AI URL cannot be created,
        // still return original image.
        enhancedUrl =
            result.secure_url;
    }

    return {

        // Use AI URL
        url:
            enhancedUrl,

        // Keep original public ID
        publicId:
            result.public_id,

        // Also keep original URL
        originalUrl:
            result.secure_url
    };
}
// =====================================================
// PARTNER DOCUMENT UPLOAD
// =====================================================

const uploadDocuments = upload.fields([

    {
        name: "storePhoto",
        maxCount: 1
    },

    {
        name: "logo",
        maxCount: 1
    },

    {
        name: "fssai",
        maxCount: 1
    },

    {
        name: "gst",
        maxCount: 1
    }

]);


// =====================================================
// UPLOAD PARTNER DOCUMENTS
// =====================================================

router.post(
    "/upload-documents",
    uploadDocuments,
    async (req, res) => {

        try {

            console.log("=================================");
            console.log("CLOUDINARY DOCUMENT UPLOAD");
            console.log("=================================");

            if (
                !req.files ||
                Object.keys(req.files).length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "No files uploaded"
                });
            }

            const response = {

                success: true,

                storePhoto: "",
                storePhoto_public_id: "",

                logo: "",
                logo_public_id: "",

                fssai: "",
                fssai_public_id: "",

                gst: "",
                gst_public_id: ""

            };


            // STORE PHOTO

            if (req.files.storePhoto) {

                const result =
                    await uploadToCloudinary(
                        req.files.storePhoto[0],
                        "darvoz/store-photos"
                    );

                response.storePhoto =
                    result.url;

                response.storePhoto_public_id =
                    result.publicId;
            }


            // LOGO

            if (req.files.logo) {

                const result =
                    await uploadToCloudinary(
                        req.files.logo[0],
                        "darvoz/logos"
                    );

                response.logo =
                    result.url;

                response.logo_public_id =
                    result.publicId;
            }


            // FSSAI

            if (req.files.fssai) {

                const result =
                    await uploadToCloudinary(
                        req.files.fssai[0],
                        "darvoz/documents/fssai"
                    );

                response.fssai =
                    result.url;

                response.fssai_public_id =
                    result.publicId;
            }


            // GST

            if (req.files.gst) {

                const result =
                    await uploadToCloudinary(
                        req.files.gst[0],
                        "darvoz/documents/gst"
                    );

                response.gst =
                    result.url;

                response.gst_public_id =
                    result.publicId;
            }


            console.log("✅ CLOUDINARY UPLOAD SUCCESS");

            return res.json(response);

        } catch (error) {

            console.error(
                "❌ CLOUDINARY DOCUMENT UPLOAD ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Cloudinary upload failed"
            });
        }
    }
);


// =====================================================
// PARTNER REGISTRATION
// =====================================================

router.post(
    "/register",
    async (req, res) => {

        console.log("=================================");
        console.log("PARTNER REGISTRATION");
        console.log("=================================");

        try {

            const {

                businessType,
                restaurant_name,
                owner_name,
                mobile,
                email,
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


            if (
                !email ||
                !password ||
                !mobile
            ) {

                return res.json({
                    success: false,
                    message:
                        "Email, mobile and password are required"
                });
            }


            db.query(
                "SELECT id FROM restaurants WHERE email=?",
                [email],
                async (err, exist) => {

                    if (err) {

                        console.log(err);

                        return res.json({
                            success: false,
                            message: "Database Error"
                        });
                    }


                    if (exist.length > 0) {

                        return res.json({
                            success: false,
                            message:
                                "Email already registered"
                        });
                    }


                    const hash =
                        await bcrypt.hash(
                            password,
                            10
                        );


                    const sql = `

                        INSERT INTO restaurants(

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

                        VALUES(
                            ?,?,?,?,?,?,?,?,?,?,
                            ?,?,
                            ?,?,
                            ?,?,
                            ?,?,
                            ?,?,
                            ?,?,?,?,?,?,?
                        )

                    `;


                    const values = [

                        businessType,
                        restaurant_name,
                        owner_name,
                        email,
                        mobile,
                        hash,
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


                    db.query(
                        sql,
                        values,
                        (insertErr, result) => {

                            if (insertErr) {

                                console.log(
                                    "REGISTRATION SQL ERROR:",
                                    insertErr
                                );

                                return res.json({
                                    success: false,
                                    message:
                                        "Registration Failed"
                                });
                            }


                            const partnerId =
                                "DAR" +
                                String(
                                    result.insertId
                                ).padStart(4, "0");


                            db.query(

                                `
                                UPDATE restaurants
                                SET restaurant_id=?
                                WHERE id=?
                                `,

                                [
                                    partnerId,
                                    result.insertId
                                ],

                                updateErr => {

                                    if (updateErr) {

                                        console.log(
                                            updateErr
                                        );

                                        return res.json({
                                            success: false,
                                            message:
                                                "Partner ID Error"
                                        });
                                    }


                                    return res.json({

                                        success: true,

                                        message:
                                            "Registration Successful",

                                        partnerId:
                                            partnerId

                                    });
                                }
                            );
                        }
                    );
                }
            );

        } catch (err) {

            console.log(err);

            return res.json({
                success: false,
                message: "Server Error"
            });
        }
    }
);


// =====================================================
// PARTNER LOGIN
// =====================================================

router.post(
    "/login",
    async (req, res) => {

        try {

            const {
                partnerId,
                password
            } = req.body;


            if (!partnerId || !password) {

                return res.json({
                    success: false,
                    message:
                        "Partner ID and Password are required."
                });
            }


            db.query(
                "SELECT * FROM restaurants WHERE restaurant_id=?",
                [partnerId],
                async (err, result) => {

                    if (err) {

                        console.log(err);

                        return res.json({
                            success: false,
                            message:
                                "Database Error"
                        });
                    }


                    if (result.length === 0) {

                        return res.json({
                            success: false,
                            message:
                                "Partner ID not found"
                        });
                    }


                    const partner =
                        result[0];


                    const match =
                        await bcrypt.compare(
                            password,
                            partner.password
                        );


                    if (!match) {

                        return res.json({
                            success: false,
                            message:
                                "Incorrect Password"
                        });
                    }


                    if (
                        partner.status !==
                        "Approved"
                    ) {

                        return res.json({
                            success: false,
                            message:
                                "Your account is still Pending Admin Approval."
                        });
                    }


                    return res.json({

                        success: true,

                        partner: {

                            id: partner.id,

                            partnerId:
                                partner.restaurant_id,

                            restaurant_name:
                                partner.restaurant_name,

                            owner_name:
                                partner.owner_name,

                            business_type:
                                partner.business_type,

                            email:
                                partner.email,

                            mobile:
                                partner.mobile,

                            image:
                                partner.image
                        }
                    });
                }
            );

        } catch (err) {

            console.log(err);

            return res.json({
                success: false,
                message: "Server Error"
            });
        }
    }
);


// =====================================================
// PARTNER DASHBOARD
// =====================================================

router.get(
    "/dashboard/:id",
    (req, res) => {

        const partnerId =
            req.params.id;


        const sql = `

            SELECT

            (
                SELECT COUNT(*)
                FROM orders
                WHERE partner_id=?
            ) AS todayOrders,

            (
                SELECT IFNULL(
                    SUM(grand_total),
                    0
                )
                FROM orders
                WHERE partner_id=?
                AND status='Completed'
            ) AS todayRevenue,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE partner_id=?
                AND status='Pending'
            ) AS pendingOrders,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE partner_id=?
                AND status='Completed'
            ) AS completedOrders

        `;


        db.query(
            sql,
            [
                partnerId,
                partnerId,
                partnerId,
                partnerId
            ],
            (err, result) => {

                if (err) {

                    console.log(err);

                    return res.json({
                        todayOrders: 0,
                        todayRevenue: 0,
                        pendingOrders: 0,
                        completedOrders: 0
                    });
                }


                res.json(result[0]);
            }
        );
    }
);


// =====================================================
// RECENT ORDERS
// =====================================================

router.get(
    "/orders/:id",
    (req, res) => {

        const partnerId =
            req.params.id;


        db.query(

            `
            SELECT
                id,
                customer_name,
                grand_total,
                status
            FROM orders
            WHERE partner_id=?
            ORDER BY id DESC
            LIMIT 10
            `,

            [partnerId],

            (err, result) => {

                if (err) {

                    console.log(err);

                    return res.json([]);
                }


                const orders =
                    result.map(order => ({

                        id: order.id,

                        order_id:
                            "ORD" +
                            String(
                                order.id
                            ).padStart(5, "0"),

                        customer_name:
                            order.customer_name,

                        total:
                            order.grand_total,

                        status:
                            order.status
                    }));


                res.json(orders);
            }
        );
    }
);

// =====================================================
// PARTNER WALLET BALANCE
// =====================================================

router.get("/wallet/:partnerId", async (req, res) => {

    try {

        const partnerId =
            Number(req.params.partnerId);

        if (!partnerId) {

            return res.status(400).json({

                success: false,
                message: "Invalid partner ID"

            });

        }

        const [wallets] =
            await db.promise().query(`

                SELECT balance

                FROM wallets

                WHERE user_type='partner'

                AND user_id=?

                LIMIT 1

            `, [partnerId]);


        return res.json({

            success: true,

            balance:
                wallets.length
                    ? Number(wallets[0].balance || 0)
                    : 0

        });

    }

    catch (err) {

        console.error(
            "PARTNER WALLET ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            balance: 0

        });

    }

});
// =====================================================
// UPDATE ORDER STATUS
// =====================================================

router.put(
    "/update-order/:id",
    (req, res) => {

        const orderId =
            req.params.id;

        const { status } =
            req.body;


        db.query(

            "UPDATE orders SET status=? WHERE id=?",

            [
                status,
                orderId
            ],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }


                res.json({
                    success: true,
                    message:
                        "Order Updated"
                });
            }
        );
    }
);


// =====================================================
// GET STORE PROFILE
// =====================================================

router.get(
    "/profile/:id",
    (req, res) => {

        db.query(

            "SELECT * FROM restaurants WHERE id=?",

            [req.params.id],

            (err, result) => {

                if (err) {

                    console.log(err);

                    return res.status(500).json({
                        success: false
                    });
                }


                if (result.length === 0) {

                    return res.status(404).json({
                        success: false,
                        message:
                            "Partner not found"
                    });
                }


                res.json(result[0]);
            }
        );
    }
);


// =====================================================
// UPDATE STORE PROFILE
// =====================================================

router.put(
    "/profile/:id",
    (req, res) => {

        const partnerId = req.params.id;

        const {
            restaurant_name,
            owner_name,
            mobile,
            email,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude,

            // IMAGE FIELDS
            logo,
            logo_public_id,

            storePhoto,
            storePhoto_public_id
        } = req.body;


        console.log("=================================");
        console.log("UPDATE PARTNER PROFILE");
        console.log("PARTNER ID:", partnerId);
        console.log("=================================");


        const sql = `

            UPDATE restaurants

            SET

                restaurant_name=?,
                owner_name=?,
                mobile=?,
                email=?,
                address=?,
                city=?,
                state=?,
                pincode=?,
                latitude=?,
                longitude=?,

                logo=?,
                logo_public_id=?,

                storePhoto=?,
                storePhoto_public_id=?

            WHERE id=?

        `;


        const values = [

            restaurant_name || "",
            owner_name || "",
            mobile || "",
            email || "",
            address || "",
            city || "",
            state || "",
            pincode || "",
            latitude || null,
            longitude || null,

            // LOGO
            logo || null,
            logo_public_id || null,

            // STORE PHOTO
            storePhoto || null,
            storePhoto_public_id || null,

            partnerId

        ];


        db.query(
            sql,
            values,
            (err, result) => {

                if (err) {

                    console.error(
                        "❌ PROFILE UPDATE SQL ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Profile update failed",

                        error:
                            err.message

                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Partner not found"

                    });

                }


                console.log(
                    "✅ PARTNER PROFILE UPDATED:",
                    partnerId
                );


                return res.json({

                    success: true,

                    message:
                        "Profile updated successfully"

                });

            }
        );

    }
);

// =====================================================
// UPDATE STORE IMAGES
//
// Editable:
// - logo
// - storePhoto
//
// NOT EDITABLE:
// - fssai
// - gst
// =====================================================

router.put(
    "/profile-images/:id",

    upload.fields([

        {
            name: "logo",
            maxCount: 1
        },

        {
            name: "storePhoto",
            maxCount: 1
        }

    ]),

    async (req, res) => {

        const partnerId =
            req.params.id;


        try {

            if (
                !req.files ||
                (
                    !req.files.logo &&
                    !req.files.storePhoto
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No image selected"

                });

            }


            const updates = [];
            const values = [];


            // =================================================
            // LOGO
            // =================================================

            if (
                req.files.logo &&
                req.files.logo.length > 0
            ) {

                console.log(
                    "📷 Uploading new partner logo..."
                );


                const result =
                    await uploadToCloudinary(

                        req.files.logo[0],

                        "darvoz/logos"

                    );


                updates.push(
                    "logo=?"
                );

                values.push(
                    result.url
                );


                updates.push(
                    "logo_public_id=?"
                );

                values.push(
                    result.publicId
                );


                console.log(
                    "✅ NEW LOGO:",
                    result.url
                );

            }


            // =================================================
            // STORE PHOTO
            // =================================================

            if (
                req.files.storePhoto &&
                req.files.storePhoto.length > 0
            ) {

                console.log(
                    "📷 Uploading new store photo..."
                );


                const result =
                    await uploadToCloudinary(

                        req.files.storePhoto[0],

                        "darvoz/store-photos"

                    );


                updates.push(
                    "storePhoto=?"
                );

                values.push(
                    result.url
                );


                updates.push(
                    "storePhoto_public_id=?"
                );

                values.push(
                    result.publicId
                );


                console.log(
                    "✅ NEW STORE PHOTO:",
                    result.url
                );

            }


            if (!updates.length) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Nothing to update"

                });

            }


            values.push(
                partnerId
            );


            const sql = `

                UPDATE restaurants

                SET
                    ${updates.join(",")}

                WHERE id=?

            `;


            db.query(
                sql,
                values,
                (err, result) => {

                    if (err) {

                        console.error(
                            "❌ IMAGE UPDATE ERROR:",
                            err
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to update images"

                        });

                    }


                    if (
                        result.affectedRows === 0
                    ) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "Partner not found"

                        });

                    }


                    return res.json({

                        success: true,

                        message:
                            "Images updated successfully"

                    });

                }
            );


        } catch (error) {

            console.error(
                "❌ PROFILE IMAGE ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Image upload failed"

            });

        }

    }

);

// =====================================================
// SOCKET.IO - SEND LIVE ORDER
// =====================================================

function sendNewOrder(
    io,
    partnerId,
    order
) {

    io
        .to(`partner_${partnerId}`)
        .emit(
            "newOrder",
            {

                orderId:
                    order.id,

                customer_name:
                    order.customer_name,

                total:
                    order.grand_total,

                status:
                    "Pending",

                time:
                    new Date()
            }
        );
}


// =====================================================
// =====================================================
// FOOD / RESTAURANT MENU SYSTEM
// =====================================================
// =====================================================


// =====================================================
// GET PARTNER FOOD MENU
// =====================================================

router.get(
    "/menu/:id",
    (req, res) => {

        const partnerId =
            req.params.id;


        db.query(

            `
            SELECT
                id,
                product_name,
                business_type,
                type,
                category,
                price,
                offer_price,
                image,
                featured,
                status
            FROM menu_items
            WHERE partner_id=?
            ORDER BY id DESC
            `,

            [partnerId],

            (err, products) => {

                if (err) {

                    console.log(
                        "MENU ERROR:",
                        err
                    );

                    return res.json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }


                if (!products.length) {

                    return res.json({
                        success: true,
                        products: []
                    });
                }


                const productIds =
                    products.map(
                        product =>
                            product.id
                    );


                const placeholders =
                    productIds
                        .map(() => "?")
                        .join(",");


                db.query(

                    `
                    SELECT
                        id,
                        menu_item_id,
                        size,
                        price,
                        stock
                    FROM menu_item_variants
                    WHERE menu_item_id
                    IN (${placeholders})
                    ORDER BY menu_item_id, id
                    `,

                    productIds,

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(
                                "VARIANT ERROR:",
                                variantErr
                            );

                            return res.json({
                                success: false,
                                message:
                                    "Unable to load product variants"
                            });
                        }


                        products.forEach(
                            product => {

                                product.variants =
                                    variants.filter(
                                        variant =>
                                            Number(
                                                variant.menu_item_id
                                            ) ===
                                            Number(
                                                product.id
                                            )
                                    );
                            }
                        );


                        res.json({
                            success: true,
                            products:
                                products
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// GET FOOD MENU BY BUSINESS TYPE
// =====================================================

router.get(
    "/menu/:partnerId/:business",
    (req, res) => {

        const partnerId =
            req.params.partnerId;

        const business =
            req.params.business;


        db.query(

            `
            SELECT *
            FROM menu_items
            WHERE partner_id=?
            AND LOWER(TRIM(business_type))
                =
                LOWER(TRIM(?))
            ORDER BY id DESC
            `,

            [
                partnerId,
                business
            ],

            (err, products) => {

                if (err) {

                    console.log(
                        "MENU ERROR:",
                        err
                    );

                    return res.json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }


                if (!products.length) {

                    return res.json({
                        success: true,
                        products: []
                    });
                }


                const productIds =
                    products.map(
                        product =>
                            product.id
                    );


                const placeholders =
                    productIds
                        .map(() => "?")
                        .join(",");


                db.query(

                    `
                    SELECT
                        id,
                        menu_item_id,
                        size,
                        price,
                        stock
                    FROM menu_item_variants
                    WHERE menu_item_id
                    IN (${placeholders})
                    ORDER BY menu_item_id, id
                    `,

                    productIds,

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(
                                "VARIANT ERROR:",
                                variantErr
                            );

                            return res.json({
                                success: false,
                                message:
                                    "Unable to load product variants"
                            });
                        }


                        products.forEach(
                            product => {

                                product.variants =
                                    variants.filter(
                                        variant =>
                                            Number(
                                                variant.menu_item_id
                                            ) ===
                                            Number(
                                                product.id
                                            )
                                    );
                            }
                        );


                        res.json({
                            success: true,
                            products:
                                products
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// ADD FOOD / RESTAURANT PRODUCT
// =====================================================

router.post(
    "/add-product",
    (req, res) => {

        const {

            partner_id,
            business_type,
            product_name,
            type,
            category,
            price,
            offer_price,
            featured,
            image

        } = req.body;


        db.query(

            `
            INSERT INTO menu_items
            (
                partner_id,
                business_type,
                product_name,
                type,
                category,
                price,
                offer_price,
                featured,
                image
            )
            VALUES(?,?,?,?,?,?,?,?,?)
            `,

            [

                partner_id,
                business_type,
                product_name,
                type,
                category,
                price,
                offer_price || null,
                featured || 0,
                image || null

            ],

            (err, result) => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message:
                            "Unable to add product."
                    });
                }


                res.json({

                    success: true,

                    id:
                        result.insertId,

                    message:
                        "Product added successfully"
                });
            }
        );
    }
);


// =====================================================
// FOOD PRODUCT STATUS
// =====================================================

router.put(
    "/product-status/:id",
    (req, res) => {

        db.query(

            `
            UPDATE menu_items
            SET status=?
            WHERE id=?
            `,

            [
                req.body.status,
                req.params.id
            ],

            err => {

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


// =====================================================
// PRODUCT IMAGE UPLOAD
// =====================================================

const productUpload = multer({

    storage:
        multer.memoryStorage(),

    limits: {
        fileSize:
            5 * 1024 * 1024
    },

    fileFilter:
        function (req, file, cb) {

            const allowed = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (
                allowed.includes(
                    file.mimetype
                )
            ) {

                cb(null, true);

            } else {

                cb(
                    new Error(
                        "Only JPG, PNG and WEBP images are allowed"
                    )
                );
            }
        }
});

router.post(
    "/upload-product-image",
    productUpload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No image selected"
                });
            }


            console.log(
                "📷 IMAGE RECEIVED:",
                req.file.originalname
            );


            const result =
                await uploadProductImageWithAI(
                    req.file,
                    "darvoz/products"
                );


            console.log(
                "✅ PRODUCT IMAGE READY:",
                result.url
            );


            return res.json({

                success: true,

                imageUrl:
                    result.url,

                originalImageUrl:
                    result.originalUrl,

                publicId:
                    result.publicId
            });


        } catch (error) {

            console.error(
                "❌ PRODUCT IMAGE UPLOAD ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Image upload failed"
            });
        }
    }
);

// =====================================================
// GET SINGLE FOOD PRODUCT
// =====================================================

router.get(
    "/product/:id",
    (req, res) => {

        const productId =
            req.params.id;

        db.query(

            `
            SELECT
                id,
                partner_id,
                business_type,
                product_name,
                type,
                category,
                description,
                price,
                offer_price,
                featured,
                image,
                status
            FROM menu_items
            WHERE id=?
            `,

            [productId],

            (err, result) => {

                if (err) {

                    console.log(
                        "GET PRODUCT ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to load product"
                    });
                }

                if (!result.length) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Product not found"
                    });
                }

                return res.json(
                    result[0]
                );
            }
        );
    }
);

// =====================================================
// UPDATE FOOD PRODUCT
// =====================================================

router.put(
    "/product/:id",
    (req, res) => {

        const {
            product_name,
            type,
            category,
            price,
            offer_price,
            featured,
            image
        } = req.body;

        const productId = req.params.id;

        console.log("=================================");
        console.log("UPDATE FOOD PRODUCT");
        console.log("PRODUCT ID:", productId);
        console.log("PRODUCT DATA:", {
            product_name,
            type,
            category,
            price,
            offer_price,
            featured,
            image
        });
        console.log("=================================");

        const sql = `
            UPDATE menu_items
            SET
                product_name=?,
                type=?,
                category=?,
                price=?,
                offer_price=?,
                featured=?,
                image=?
            WHERE id=?
        `;

        const values = [

            product_name || "",

            type || "Veg",

            category || "Other",

            Number(price) || 0,

            (
                offer_price !== undefined &&
                offer_price !== null &&
                offer_price !== ""
            )
                ? Number(offer_price)
                : null,

            featured ? 1 : 0,

            image || null,

            Number(productId)

        ];

        console.log("SQL VALUES:", values);

        db.query(
            sql,
            values,
            (err, result) => {

                if (err) {

                    console.error(
                        "❌ PRODUCT UPDATE SQL ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Update failed",
                        error: err.message
                    });
                }

                if (result.affectedRows === 0) {

                    return res.status(404).json({
                        success: false,
                        message: "Product not found"
                    });
                }

                console.log(
                    "✅ PRODUCT UPDATED:",
                    productId
                );

                return res.json({
                    success: true,
                    message:
                        "Product updated successfully"
                });

            }
        );
    }
);

// =====================================================
// DELETE FOOD PRODUCT
// =====================================================

router.delete(
    "/product/:id",
    (req, res) => {

        db.query(

            "DELETE FROM menu_items WHERE id=?",

            [req.params.id],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message:
                            "Delete failed"
                    });
                }


                res.json({
                    success: true
                });
            }
        );
    }
);


// =====================================================
// BUSINESS TYPES
// =====================================================

router.get(
    "/business-types/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;


        db.query(

            `
            SELECT business_type
            FROM restaurants
            WHERE id=?
            `,

            [partnerId],

            (err, result) => {

                if (err) {

                    return res.json({
                        success: false
                    });
                }


                if (!result.length) {

                    return res.json({
                        success: false
                    });
                }


                const businessTypes =
                    String(
                        result[0]
                            .business_type || ""
                    )
                    .split(",")
                    .map(
                        type =>
                            type.trim()
                    )
                    .filter(Boolean);


                if (!businessTypes.length) {

                    return res.json({
                        success: true,
                        businessTypes: []
                    });
                }


                const response = [];

                let completed = 0;


                businessTypes.forEach(
                    type => {

                        // Grocery is handled by the
                        // new Grocery tables.

                        const normalized =
                            type.toLowerCase();


                        if (
                            normalized === "grocery" ||
                            normalized === "groceries"
                        ) {

                            db.query(

                                `
                                SELECT
                                    COUNT(*) AS total,
                                    SUM(
                                        CASE
                                            WHEN status='Available'
                                            THEN 1
                                            ELSE 0
                                        END
                                    ) AS available
                                FROM partner_grocery_products
                                WHERE partner_id=?
                                `,

                                [partnerId],

                                (e, row) => {

                                    completed++;


                                    response.push({

                                        name: type,

                                        total:
                                            row &&
                                            row[0]
                                                ? row[0].total
                                                : 0,

                                        available:
                                            row &&
                                            row[0]
                                                ? (
                                                    row[0]
                                                        .available || 0
                                                )
                                                : 0
                                    });


                                    if (
                                        completed ===
                                        businessTypes.length
                                    ) {

                                        return res.json({

                                            success: true,

                                            businessTypes:
                                                response
                                        });
                                    }
                                }
                            );


                            return;
                        }


                        // FOOD / RESTAURANT

                        db.query(

                            `
                            SELECT
                                COUNT(*) total,

                                SUM(
                                    CASE
                                        WHEN status='Available'
                                        THEN 1
                                        ELSE 0
                                    END
                                ) available

                            FROM menu_items

                            WHERE partner_id=?
                            AND business_type=?
                            `,

                            [
                                partnerId,
                                type
                            ],

                            (e, row) => {

                                completed++;


                                response.push({

                                    name:
                                        type,

                                    total:
                                        row &&
                                        row[0]
                                            ? row[0].total
                                            : 0,

                                    available:
                                        row &&
                                        row[0]
                                            ? (
                                                row[0]
                                                    .available || 0
                                            )
                                            : 0
                                });


                                if (
                                    completed ===
                                    businessTypes.length
                                ) {

                                    res.json({

                                        success:
                                            true,

                                        businessTypes:
                                            response
                                    });
                                }
                            }
                        );
                    }
                );
            }
        );
    }
);


// =====================================================
// MENU COUNT
// =====================================================

router.get(
    "/menu-count/:partnerId/:business",
    (req, res) => {

        const business =
            String(
                req.params.business || ""
            ).trim().toLowerCase();


        if (
            business === "grocery" ||
            business === "groceries"
        ) {

            db.query(

                `
                SELECT COUNT(*) AS total
                FROM partner_grocery_products
                WHERE partner_id=?
                `,

                [req.params.partnerId],

                (err, row) => {

                    if (err) {

                        console.log(err);

                        return res.json({
                            success: false
                        });
                    }


                    return res.json({

                        success: true,

                        total:
                            row[0].total
                    });
                }
            );

            return;
        }


        db.query(

            `
            SELECT COUNT(*) AS total
            FROM menu_items
            WHERE partner_id=?
            AND business_type=?
            `,

            [
                req.params.partnerId,
                req.params.business
            ],

            (err, row) => {

                if (err) {

                    return res.json({
                        success: false
                    });
                }


                res.json({

                    success: true,

                    total:
                        row[0].total
                });
            }
        );
    }
);


// =====================================================
// STORE STATUS
// =====================================================

router.put(
    "/store-status",
    (req, res) => {

        const {
            partnerId,
            online_status
        } = req.body;


        db.query(

            `
            UPDATE restaurants
            SET online_status=?
            WHERE id=?
            `,

            [
                online_status,
                partnerId
            ],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }


                res.json({
                    success: true,
                    message:
                        "Store status updated"
                });
            }
        );
    }
);


router.get(
    "/store-status/:id",
    (req, res) => {

        db.query(

            `
            SELECT online_status
            FROM restaurants
            WHERE id=?
            `,

            [req.params.id],

            (err, result) => {

                if (
                    err ||
                    result.length === 0
                ) {

                    return res.json({
                        success: false
                    });
                }


                res.json({

                    success: true,

                    online_status:
                        result[0]
                            .online_status
                });
            }
        );
    }
);


// =====================================================
// =====================================================
// NEW GROCERY SYSTEM
// =====================================================
// =====================================================


// =====================================================
// GET DEFAULT GROCERY CATEGORIES
// =====================================================

router.get(
    "/grocery/categories",
    (req, res) => {

        db.query(

            `
            SELECT
                id,
                category_name,
                image,
                status,
                sort_order
            FROM grocery_categories
            WHERE status='Active'
            ORDER BY sort_order ASC, id ASC
            `,

            (err, categories) => {

                if (err) {

                    console.log(
                        "GROCERY CATEGORY ERROR:",
                        err
                    );

                    return res.json({
                        success: false,
                        message:
                            "Unable to load Grocery categories"
                    });
                }


                res.json({

                    success: true,

                    categories:
                        categories
                });
            }
        );
    }
);


// =====================================================
// GET DEFAULT GROCERY PRODUCTS
// =====================================================

router.get(
    "/grocery/default-products",
    (req, res) => {

        db.query(

            `
            SELECT
                p.id,
                p.category_id,
                c.category_name,
                p.product_name,
                p.product_image,
                p.product_type,
                p.status

            FROM grocery_default_products p

            LEFT JOIN grocery_categories c
                ON c.id = p.category_id

            WHERE p.status='Active'

            ORDER BY
                c.sort_order ASC,
                p.id ASC
            `,

            (err, products) => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message:
                            "Unable to load default Grocery products"
                    });
                }


                res.json({

                    success: true,

                    products:
                        products
                });
            }
        );
    }
);


// =====================================================
// GET DEFAULT GROCERY PRODUCT VARIANTS
// =====================================================

router.get(
    "/grocery/default-product/:id",
    (req, res) => {

        const productId =
            req.params.id;


        db.query(

            `
            SELECT
                p.id,
                p.category_id,
                p.product_name,
                p.product_image,
                p.product_type,
                c.category_name

            FROM grocery_default_products p

            LEFT JOIN grocery_categories c
                ON c.id=p.category_id

            WHERE p.id=?
            `,

            [productId],

            (productErr, products) => {

                if (productErr) {

                    console.log(productErr);

                    return res.json({
                        success: false
                    });
                }


                if (!products.length) {

                    return res.json({
                        success: false,
                        message:
                            "Default Grocery product not found"
                    });
                }


                db.query(

                    `
                    SELECT
                        id,
                        product_id,
                        size,
                        default_price,
                        default_stock

                    FROM grocery_default_variants

                    WHERE product_id=?

                    ORDER BY id
                    `,

                    [productId],

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(variantErr);

                            return res.json({
                                success: false
                            });
                        }


                        res.json({

                            success: true,

                            product:
                                products[0],

                            variants:
                                variants
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// CHECK PARTNER GROCERY MENU
// =====================================================

router.get(
    "/grocery/check/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;


        db.query(

            `
            SELECT COUNT(*) AS total
            FROM partner_grocery_products
            WHERE partner_id=?
            `,

            [partnerId],

            (err, result) => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false
                    });
                }


                res.json({

                    success: true,

                    exists:
                        Number(
                            result[0].total
                        ) > 0,

                    total:
                        result[0].total
                });
            }
        );
    }
);


// =====================================================
// PREPARE GROCERY MENU FOR PARTNER
//
// Copies:
//
// grocery_default_products
//          ↓
// partner_grocery_products
//
// grocery_default_variants
//          ↓
// partner_grocery_variants
// =====================================================

router.post(
    "/prepare-grocery-menu/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;


        console.log("=================================");
        console.log("PREPARING NEW GROCERY MENU");
        console.log("PARTNER ID:", partnerId);
        console.log("=================================");


        // -------------------------------------------------
        // STEP 1
        // CHECK EXISTING PARTNER PRODUCTS
        // -------------------------------------------------

        db.query(

            `
            SELECT id
            FROM partner_grocery_products
            WHERE partner_id=?
            LIMIT 1
            `,

            [partnerId],

            (checkErr, existing) => {

                if (checkErr) {

                    console.log(
                        "GROCERY CHECK ERROR:",
                        checkErr
                    );

                    return res.json({

                        success: false,

                        message:
                            "Unable to check Grocery menu"
                    });
                }


                if (existing.length > 0) {

                    return res.json({

                        success: true,

                        created: false,

                        message:
                            "Grocery menu already exists"
                    });
                }


                // -------------------------------------------------
                // STEP 2
                // GET DEFAULT PRODUCTS
                // -------------------------------------------------

                db.query(

                    `
                    SELECT
                        id,
                        category_id,
                        product_name,
                        product_image,
                        product_type

                    FROM grocery_default_products

                    WHERE status='Active'

                    ORDER BY id
                    `,

                    (productErr, defaultProducts) => {

                        if (productErr) {

                            console.log(
                                "DEFAULT PRODUCT ERROR:",
                                productErr
                            );

                            return res.json({

                                success: false,

                                message:
                                    "Unable to load default Grocery products"
                            });
                        }


                        if (
                            !defaultProducts.length
                        ) {

                            return res.json({

                                success: false,

                                message:
                                    "No default Grocery products found"
                            });
                        }


                        // -------------------------------------------------
                        // STEP 3
                        // INSERT PARTNER PRODUCTS
                        // -------------------------------------------------

                        let completed = 0;

                        let failed = false;

                        const mappings = [];


                        defaultProducts.forEach(
                            product => {

                                db.query(

                                    `
                                    INSERT INTO partner_grocery_products
                                    (
                                        partner_id,
                                        default_product_id,
                                        product_name,
                                        category_id,
                                        image,
                                        status,
                                        featured
                                    )

                                    VALUES
                                    (?, ?, ?, ?, ?, ?, ?)
                                    `,

                                    [

                                        partnerId,

                                        product.id,

                                        product.product_name,

                                        product.category_id,

                                        product.product_image || null,

                                        "Available",

                                        0
                                    ],

                                    (insertErr, result) => {

                                        completed++;


                                        if (insertErr) {

                                            console.log(
                                                "❌ GROCERY PRODUCT INSERT ERROR:",
                                                insertErr
                                            );

                                            failed = true;

                                        } else {

                                            mappings.push({

                                                defaultProductId:
                                                    product.id,

                                                partnerProductId:
                                                    result.insertId
                                            });


                                            console.log(
                                                "✅ Grocery product created:",
                                                product.product_name,
                                                "=>",
                                                result.insertId
                                            );
                                        }


                                        if (
                                            completed ===
                                            defaultProducts.length
                                        ) {

                                            if (failed) {

                                                return res.json({

                                                    success: false,

                                                    message:
                                                        "Some Grocery products could not be created"
                                                });
                                            }


                                            copyNewGroceryVariants(
                                                mappings,
                                                res
                                            );
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);


// =====================================================
// COPY DEFAULT VARIANTS → PARTNER VARIANTS
// =====================================================

function copyNewGroceryVariants(
    mappings,
    res
) {

    console.log("=================================");
    console.log("COPYING NEW GROCERY VARIANTS");
    console.log("=================================");


    if (
        !mappings ||
        mappings.length === 0
    ) {

        return res.json({

            success: true,

            created: true,

            message:
                "Grocery products created. No variants found."
        });
    }


    let completedProducts = 0;

    let copiedVariants = 0;

    let failed = false;


    mappings.forEach(
        mapping => {

            db.query(

                `
                SELECT
                    size,
                    default_price,
                    default_stock

                FROM grocery_default_variants

                WHERE product_id=?

                ORDER BY id
                `,

                [
                    mapping.defaultProductId
                ],

                (variantErr, variants) => {

                    if (variantErr) {

                        console.log(
                            "❌ DEFAULT VARIANT ERROR:",
                            variantErr
                        );

                        failed = true;

                        completedProducts++;

                        checkComplete();

                        return;
                    }


                    if (
                        !variants ||
                        variants.length === 0
                    ) {

                        completedProducts++;

                        checkComplete();

                        return;
                    }


                    let completedVariants = 0;


                    variants.forEach(
                        variant => {

                            db.query(

                                `
                                INSERT INTO partner_grocery_variants
                                (
                                    partner_product_id,
                                    size,
                                    price,
                                    offer_price,
                                    stock,
                                    status
                                )

                                VALUES
                                (?, ?, ?, ?, ?, ?)
                                `,

                                [

                                    mapping.partnerProductId,

                                    variant.size,

                                    Number(
                                        variant.default_price || 0
                                    ),

                                    null,

                                    Number(
                                        variant.default_stock || 0
                                    ),

                                    "Available"
                                ],

                                insertErr => {

                                    if (insertErr) {

                                        console.log(
                                            "❌ PARTNER VARIANT INSERT ERROR:",
                                            insertErr
                                        );

                                        failed = true;

                                    } else {

                                        copiedVariants++;
                                    }


                                    completedVariants++;


                                    if (
                                        completedVariants ===
                                        variants.length
                                    ) {

                                        completedProducts++;

                                        checkComplete();
                                    }
                                }
                            );
                        }
                    );
                }
            );
        }
    );


    function checkComplete() {

        if (
            completedProducts !==
            mappings.length
        ) {

            return;
        }


        console.log(
            "GROCERY COPY FINISHED"
        );

        console.log(
            "VARIANTS COPIED:",
            copiedVariants
        );


        if (failed) {

            return res.json({

                success: false,

                created: true,

                message:
                    "Products created but some variants failed",

                copied:
                    copiedVariants
            });
        }


        return res.json({

            success: true,

            created: true,

            message:
                "Grocery products and variants created successfully",

            copied:
                copiedVariants
        });
    }
}


// =====================================================
// GET PARTNER GROCERY MENU
// =====================================================

router.get(
    "/grocery/menu/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;


        db.query(

            `SELECT
    p.id,
    p.partner_id,
    p.default_product_id,
    p.product_name,
    p.category_id,
    c.category_name,
    c.image AS category_image,
    p.image,
    p.status,
    p.featured,
    p.created_at
FROM partner_grocery_products p
LEFT JOIN grocery_categories c
    ON c.id=p.category_id

            WHERE p.partner_id=?

            ORDER BY
                c.sort_order ASC,
                p.id ASC
            `,

            [partnerId],

            (productErr, products) => {

                if (productErr) {

                    console.log(
                        "PARTNER GROCERY MENU ERROR:",
                        productErr
                    );

                    return res.json({

                        success: false,

                        message:
                            "Unable to load Grocery menu"
                    });
                }


                if (!products.length) {

                    return res.json({

                        success: true,

                        products: []
                    });
                }


                const productIds =
                    products.map(
                        product =>
                            product.id
                    );


                const placeholders =
                    productIds
                        .map(() => "?")
                        .join(",");


                db.query(

                    `
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

                    ORDER BY
                        partner_product_id,
                        id
                    `,

                    productIds,

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(
                                "GROCERY VARIANT ERROR:",
                                variantErr
                            );

                            return res.json({

                                success: false,

                                message:
                                    "Unable to load Grocery variants"
                            });
                        }


                        products.forEach(
                            product => {

                                product.variants =
                                    variants.filter(
                                        variant =>
                                            Number(
                                                variant.partner_product_id
                                            ) ===
                                            Number(
                                                product.id
                                            )
                                    );
                            }
                        );


                        res.json({

                            success: true,

                            products:
                                products
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// GET GROCERY PRODUCTS BY CATEGORY
// =====================================================

router.get(
    "/grocery/category/:partnerId/:categoryId",
    (req, res) => {

        const {
            partnerId,
            categoryId
        } = req.params;


        db.query(

            `
            SELECT

                p.id,
                p.partner_id,
                p.default_product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.image,
                p.status,
                p.featured

            FROM partner_grocery_products p

            LEFT JOIN grocery_categories c
                ON c.id=p.category_id

            WHERE p.partner_id=?
            AND p.category_id=?

            ORDER BY p.id ASC
            `,

            [
                partnerId,
                categoryId
            ],

            (productErr, products) => {

                if (productErr) {

                    console.log(productErr);

                    return res.json({
                        success: false
                    });
                }


                if (!products.length) {

                    return res.json({

                        success: true,

                        products: []
                    });
                }


                const ids =
                    products.map(
                        p => p.id
                    );


                const placeholders =
                    ids
                        .map(() => "?")
                        .join(",");


                db.query(

                    `
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

                    ORDER BY id
                    `,

                    ids,

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(variantErr);

                            return res.json({
                                success: false
                            });
                        }


                        products.forEach(
                            product => {

                                product.variants =
                                    variants.filter(
                                        variant =>
                                            Number(
                                                variant.partner_product_id
                                            ) ===
                                            Number(
                                                product.id
                                            )
                                    );
                            }
                        );


                        res.json({

                            success: true,

                            products:
                                products
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// GET SINGLE PARTNER GROCERY PRODUCT
// =====================================================

router.get(
    "/grocery/product/:id",
    (req, res) => {

        const productId =
            req.params.id;


        db.query(

            `
            SELECT

                p.id,
                p.partner_id,
                p.default_product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.image,
                p.status,
                p.featured

            FROM partner_grocery_products p

            LEFT JOIN grocery_categories c
                ON c.id=p.category_id

            WHERE p.id=?
            `,

            [productId],

            (productErr, products) => {

                if (productErr) {

                    console.log(productErr);

                    return res.json({
                        success: false
                    });
                }


                if (!products.length) {

                    return res.json({

                        success: false,

                        message:
                            "Grocery product not found"
                    });
                }


                db.query(

                    `
                    SELECT

                        id,
                        partner_product_id,
                        size,
                        price,
                        offer_price,
                        stock,
                        status

                    FROM partner_grocery_variants

                    WHERE partner_product_id=?

                    ORDER BY id
                    `,

                    [productId],

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(variantErr);

                            return res.json({
                                success: false
                            });
                        }


                        res.json({

                            success: true,

                            product:
                                products[0],

                            variants:
                                variants
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// UPDATE GROCERY PRODUCT
// =====================================================

router.put(
    "/grocery/product/:id",
    (req, res) => {

        const {
            product_name,
            category_id,
            image,
            featured
        } = req.body;


        db.query(

            `
            UPDATE partner_grocery_products

            SET
                product_name=?,
                category_id=?,
                image=?,
                featured=?

            WHERE id=?
            `,

            [

                product_name,
                category_id,
                image || null,
                featured || 0,
                req.params.id

            ],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({

                        success: false,

                        message:
                            "Grocery product update failed"
                    });
                }


                res.json({

                    success: true,

                    message:
                        "Grocery product updated successfully"
                });
            }
        );
    }
);


// =====================================================
// GROCERY PRODUCT STATUS
// =====================================================

router.put(
    "/grocery/product-status/:id",
    (req, res) => {

        db.query(

            `
            UPDATE partner_grocery_products

            SET status=?

            WHERE id=?
            `,

            [
                req.body.status,
                req.params.id
            ],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false
                    });
                }


                res.json({

                    success: true,

                    message:
                        "Grocery product status updated"
                });
            }
        );
    }
);


// =====================================================
// GROCERY FEATURED STATUS
// =====================================================

router.put(
    "/grocery/product-featured/:id",
    (req, res) => {

        db.query(

            `
            UPDATE partner_grocery_products

            SET featured=?

            WHERE id=?
            `,

            [
                req.body.featured ? 1 : 0,
                req.params.id
            ],

            err => {

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


// =====================================================
// GET GROCERY VARIANTS
// =====================================================

router.get(
    "/grocery/product/:id/variants",
    (req, res) => {

        db.query(

            `
            SELECT

                id,
                partner_product_id,
                size,
                price,
                offer_price,
                stock,
                status

            FROM partner_grocery_variants

            WHERE partner_product_id=?

            ORDER BY id
            `,

            [req.params.id],

            (err, variants) => {

                if (err) {

                    console.log(err);

                    return res.json({

                        success: false,

                        message:
                            "Unable to load Grocery variants"
                    });
                }


                res.json({

                    success: true,

                    variants:
                        variants
                });
            }
        );
    }
);


// =====================================================
// SAVE / REPLACE GROCERY VARIANTS
// =====================================================

router.put(
    "/grocery/product/:id/variants",
    (req, res) => {

        const partnerProductId =
            req.params.id;

        const variants =
            req.body.variants;


        if (!Array.isArray(variants)) {

            return res.json({

                success: false,

                message:
                    "Invalid variants"
            });
        }


        db.query(

            `
            DELETE FROM partner_grocery_variants
            WHERE partner_product_id=?
            `,

            [partnerProductId],

            deleteErr => {

                if (deleteErr) {

                    console.log(deleteErr);

                    return res.json({

                        success: false,

                        message:
                            "Unable to remove old variants"
                    });
                }


                if (!variants.length) {

                    return res.json({

                        success: true,

                        message:
                            "Variants removed"
                    });
                }


                let completed = 0;

                let failed = false;


                variants.forEach(
                    variant => {

                        db.query(

                            `
                            INSERT INTO partner_grocery_variants
                            (
                                partner_product_id,
                                size,
                                price,
                                offer_price,
                                stock,
                                status
                            )

                            VALUES
                            (?, ?, ?, ?, ?, ?)
                            `,

                            [

                                partnerProductId,

                                variant.size,

                                Number(
                                    variant.price || 0
                                ),

                                variant.offer_price !==
                                undefined &&
                                variant.offer_price !==
                                null &&
                                variant.offer_price !== ""
                                    ? Number(
                                        variant.offer_price
                                    )
                                    : null,

                                Number(
                                    variant.stock || 0
                                ),

                                variant.status ||
                                "Available"

                            ],

                            err => {

                                completed++;


                                if (err) {

                                    console.log(
                                        "GROCERY VARIANT SAVE ERROR:",
                                        err
                                    );

                                    failed = true;
                                }


                                if (
                                    completed ===
                                    variants.length
                                ) {

                                    if (failed) {

                                        return res.json({

                                            success: false,

                                            message:
                                                "Some Grocery variants failed"
                                        });
                                    }


                                    res.json({

                                        success: true,

                                        message:
                                            "Grocery variants updated successfully"
                                    });
                                }
                            }
                        );
                    }
                );
            }
        );
    }
);


// =====================================================
// UPDATE SINGLE GROCERY VARIANT
// =====================================================

router.put(
    "/grocery/variant/:id",
    (req, res) => {

        const {
            size,
            price,
            offer_price,
            stock,
            status
        } = req.body;


        db.query(

            `
            UPDATE partner_grocery_variants

            SET
                size=?,
                price=?,
                offer_price=?,
                stock=?,
                status=?

            WHERE id=?
            `,

            [

                size,

                Number(price || 0),

                offer_price !== undefined &&
                offer_price !== null &&
                offer_price !== ""
                    ? Number(offer_price)
                    : null,

                Number(stock || 0),

                status ||
                "Available",

                req.params.id
            ],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({

                        success: false,

                        message:
                            "Variant update failed"
                    });
                }


                res.json({

                    success: true,

                    message:
                        "Grocery variant updated successfully"
                });
            }
        );
    }
);


// =====================================================
// GROCERY VARIANT STATUS
// =====================================================

router.put(
    "/grocery/variant-status/:id",
    (req, res) => {

        db.query(

            `
            UPDATE partner_grocery_variants

            SET status=?

            WHERE id=?
            `,

            [
                req.body.status,
                req.params.id
            ],

            err => {

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


// =====================================================
// DELETE SINGLE GROCERY VARIANT
// =====================================================

router.delete(
    "/grocery/variant/:id",
    (req, res) => {

        db.query(

            `
            DELETE FROM partner_grocery_variants
            WHERE id=?
            `,

            [req.params.id],

            err => {

                if (err) {

                    console.log(err);

                    return res.json({

                        success: false,

                        message:
                            "Unable to delete variant"
                    });
                }


                res.json({
                    success: true
                });
            }
        );
    }
);


// =====================================================
// DELETE PARTNER GROCERY PRODUCT
// =====================================================

router.delete(
    "/grocery/product/:id",
    (req, res) => {

        const productId =
            req.params.id;


        // Delete variants first because
        // partner_grocery_variants references
        // partner_grocery_products.

        db.query(

            `
            DELETE FROM partner_grocery_variants
            WHERE partner_product_id=?
            `,

            [productId],

            deleteVariantErr => {

                if (deleteVariantErr) {

                    console.log(
                        deleteVariantErr
                    );

                    return res.json({

                        success: false,

                        message:
                            "Unable to delete Grocery variants"
                    });
                }


                db.query(

                    `
                    DELETE FROM partner_grocery_products
                    WHERE id=?
                    `,

                    [productId],

                    deleteProductErr => {

                        if (deleteProductErr) {

                            console.log(
                                deleteProductErr
                            );

                            return res.json({

                                success: false,

                                message:
                                    "Unable to delete Grocery product"
                            });
                        }


                        res.json({

                            success: true,

                            message:
                                "Grocery product deleted successfully"
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// SYNC DEFAULT GROCERY VARIANTS
//
// IMPORTANT:
// This updates ONLY
//
// partner_grocery_variants
//
// It does NOT touch menu_items.
// =====================================================

router.post(
    "/sync-grocery-variants/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;


        console.log("=================================");
        console.log("SYNC NEW GROCERY VARIANTS");
        console.log("PARTNER:", partnerId);
        console.log("=================================");


        db.query(

            `
            SELECT
                id,
                default_product_id,
                product_name

            FROM partner_grocery_products

            WHERE partner_id=?

            ORDER BY id
            `,

            [partnerId],

            (productErr, partnerProducts) => {

                if (productErr) {

                    console.log(productErr);

                    return res.json({

                        success: false,

                        message:
                            "Unable to load partner Grocery products"
                    });
                }


                if (!partnerProducts.length) {

                    return res.json({

                        success: false,

                        message:
                            "No Grocery products found for this partner"
                    });
                }


                let completed = 0;

                let copied = 0;

                let failed = false;


                partnerProducts.forEach(
                    partnerProduct => {

                        const defaultProductId =
                            partnerProduct
                                .default_product_id;


                        db.query(

                            `
                            SELECT
                                size,
                                default_price,
                                default_stock

                            FROM grocery_default_variants

                            WHERE product_id=?

                            ORDER BY id
                            `,

                            [defaultProductId],

                            (variantErr, variants) => {

                                if (variantErr) {

                                    console.log(
                                        variantErr
                                    );

                                    failed = true;

                                    completed++;

                                    checkFinished();

                                    return;
                                }


                                if (
                                    !variants.length
                                ) {

                                    completed++;

                                    checkFinished();

                                    return;
                                }


                                // Delete current partner variants

                                db.query(

                                    `
                                    DELETE FROM partner_grocery_variants

                                    WHERE partner_product_id=?
                                    `,

                                    [
                                        partnerProduct.id
                                    ],

                                    deleteErr => {

                                        if (deleteErr) {

                                            console.log(
                                                deleteErr
                                            );

                                            failed = true;

                                            completed++;

                                            checkFinished();

                                            return;
                                        }


                                        let inserted =
                                            0;


                                        variants.forEach(
                                            variant => {

                                                db.query(

                                                    `
                                                    INSERT INTO partner_grocery_variants
                                                    (
                                                        partner_product_id,
                                                        size,
                                                        price,
                                                        offer_price,
                                                        stock,
                                                        status
                                                    )

                                                    VALUES
                                                    (?, ?, ?, ?, ?, ?)
                                                    `,

                                                    [

                                                        partnerProduct.id,

                                                        variant.size,

                                                        Number(
                                                            variant.default_price || 0
                                                        ),

                                                        null,

                                                        Number(
                                                            variant.default_stock || 0
                                                        ),

                                                        "Available"
                                                    ],

                                                    insertErr => {

                                                        if (insertErr) {

                                                            console.log(
                                                                "SYNC VARIANT ERROR:",
                                                                insertErr
                                                            );

                                                            failed = true;

                                                        } else {

                                                            copied++;
                                                        }


                                                        inserted++;


                                                        if (
                                                            inserted ===
                                                            variants.length
                                                        ) {

                                                            completed++;

                                                            checkFinished();
                                                        }
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );


                function checkFinished() {

                    if (
                        completed !==
                        partnerProducts.length
                    ) {

                        return;
                    }


                    console.log(
                        "GROCERY VARIANT SYNC FINISHED"
                    );

                    console.log(
                        "COPIED:",
                        copied
                    );


                    if (failed) {

                        return res.json({

                            success: false,

                            message:
                                "Some Grocery variants could not be synced",

                            copied:
                                copied
                        });
                    }


                    return res.json({

                        success: true,

                        message:
                            "All Grocery variants synced successfully",

                        copied:
                            copied
                    });
                }
            }
        );
    }
);


// =====================================================
// UPLOAD GROCERY PRODUCT IMAGE
// =====================================================

router.post(
    "/upload-grocery-image",
    productUpload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.json({

                    success: false,

                    message:
                        "No image selected"
                });
            }


            const result =
    await uploadProductImageWithAI(
        req.file,
        "darvoz/grocery-products"
    );


            console.log(
                "✅ Grocery image uploaded:",
                result.url
            );


            res.json({

                success: true,

                imageUrl:
                    result.url,

                publicId:
                    result.publicId
            });

        } catch (error) {

            console.log(
                "❌ Grocery image upload error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Grocery image upload failed"
            });
        }
    }
);
// =====================================================
// NEW GROCERY API FOR partner-category-menu.html
// =====================================================


// =====================================================
// GET PARTNER GROCERY PRODUCTS
// =====================================================

router.get(
    "/grocery-products/:partnerId",
    (req, res) => {

        const partnerId =
            req.params.partnerId;

        db.query(

            `
            SELECT

                p.id,
                p.partner_id,
                p.default_product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.image,
                p.status,
                p.featured,
                p.created_at

            FROM partner_grocery_products p

            LEFT JOIN grocery_categories c
                ON c.id = p.category_id

            WHERE p.partner_id=?

            ORDER BY
                c.sort_order ASC,
                p.id DESC
            `,

            [partnerId],

            (productErr, products) => {

                if (productErr) {

                    console.log(
                        "GROCERY PRODUCTS ERROR:",
                        productErr
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to load Grocery products"
                    });
                }


                if (!products.length) {

                    return res.json({

                        success: true,

                        products: []
                    });
                }


                const productIds =
                    products.map(
                        product =>
                            product.id
                    );


                const placeholders =
                    productIds
                        .map(() => "?")
                        .join(",");


                db.query(

                    `
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

                    ORDER BY
                        partner_product_id,
                        id
                    `,

                    productIds,

                    (variantErr, variants) => {

                        if (variantErr) {

                            console.log(
                                "GROCERY VARIANT ERROR:",
                                variantErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Unable to load Grocery variants"
                            });
                        }


                        products.forEach(
                            product => {

                                product.variants =
                                    variants.filter(
                                        variant =>
                                            Number(
                                                variant.partner_product_id
                                            ) ===
                                            Number(
                                                product.id
                                            )
                                    );

                                // HTML uses "type"
                                product.type =
                                    "Veg";

                            }
                        );


                        return res.json({

                            success: true,

                            products:
                                products
                        });

                    }
                );

            }
        );
    }
);


// =====================================================
// GET GROCERY CATEGORIES
// =====================================================


// =====================================================
// GET DEFAULT GROCERY PRODUCTS
// =====================================================

router.get(
    "/grocery-default-products",
    (req, res) => {

        db.query(

            `
            SELECT

                p.id,
                p.category_id,
                c.category_name,
                p.product_name,
                p.product_image,
                p.product_type,
                p.status

            FROM grocery_default_products p

            LEFT JOIN grocery_categories c
                ON c.id = p.category_id

            WHERE p.status='Active'

            ORDER BY
                c.sort_order ASC,
                p.id ASC
            `,

            (err, products) => {

                if (err) {

                    console.log(
                        "DEFAULT GROCERY PRODUCT ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to load default Grocery products"
                    });
                }


                res.json({

                    success: true,

                    products:
                        products
                });

            }
        );
    }
);


// =====================================================
// ADD GROCERY PRODUCT
// POST /partner/grocery-products
// =====================================================

router.post(
    "/grocery-products",
    (req, res) => {

        const {
            partner_id,
            product_name,
            category_id,
            image,
            status,
            featured
        } = req.body;


        console.log("=================================");
        console.log("ADD GROCERY PRODUCT");
        console.log("BODY:", req.body);
        console.log("=================================");


        if (
            !partner_id ||
            !product_name ||
            !category_id
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Partner, product name and category are required"
            });

        }


        // =================================================
        // INSERT NEW PARTNER GROCERY PRODUCT
        // NO default_product_id
        // =================================================

        const sql = `
            INSERT INTO partner_grocery_products
            (
                partner_id,
                product_name,
                category_id,
                image,
                status,
                featured
            )
            VALUES
            (?, ?, ?, ?, ?, ?)
        `;


        const values = [

            partner_id,

            product_name,

            category_id,

            image || null,

            status || "Available",

            featured ? 1 : 0

        ];


        db.query(
            sql,
            values,
            (insertErr, result) => {

                if (insertErr) {

                    console.error(
                        "❌ GROCERY PRODUCT INSERT ERROR:",
                        insertErr
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to add Grocery product",
                        error:
                            insertErr.sqlMessage
                    });

                }


                console.log(
                    "✅ Grocery product added:",
                    result.insertId
                );


                return res.json({

                    success: true,

                    id:
                        result.insertId,

                    partnerProductId:
                        result.insertId,

                    message:
                        "Grocery product added successfully"

                });

            }
        );

    }
);


// =====================================================
// UPDATE GROCERY PRODUCT
// =====================================================

router.put(
    "/grocery-products/:id",
    (req, res) => {

        const {

            product_name,
            category_id,
            image,
            status,
            featured

        } = req.body;


        db.query(

            `
            UPDATE partner_grocery_products

            SET

                product_name=?,
                category_id=?,
                image=?,
                status=?,
                featured=?

            WHERE id=?
            `,

            [

                product_name,

                category_id,

                image || null,

                status ||
                    "Available",

                featured
                    ? 1
                    : 0,

                req.params.id

            ],

            err => {

                if (err) {

                    console.log(
                        "GROCERY UPDATE ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Grocery product update failed"
                    });
                }


                res.json({

                    success: true,

                    message:
                        "Grocery product updated successfully"
                });

            }
        );
    }
);


// =====================================================
// DELETE GROCERY PRODUCT
// =====================================================

router.delete(
    "/grocery-products/:id",
    (req, res) => {

        const productId =
            req.params.id;


        // Delete variants first

        db.query(

            `
            DELETE FROM partner_grocery_variants

            WHERE partner_product_id=?
            `,

            [productId],

            variantErr => {

                if (variantErr) {

                    console.log(
                        "DELETE GROCERY VARIANTS ERROR:",
                        variantErr
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to delete Grocery variants"
                    });
                }


                // Delete product

                db.query(

                    `
                    DELETE FROM partner_grocery_products

                    WHERE id=?
                    `,

                    [productId],

                    productErr => {

                        if (productErr) {

                            console.log(
                                "DELETE GROCERY PRODUCT ERROR:",
                                productErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Unable to delete Grocery product"
                            });
                        }


                        res.json({

                            success: true,

                            message:
                                "Grocery product deleted successfully"
                        });

                    }
                );

            }
        );
    }
);


// =====================================================
// GET GROCERY VARIANTS
// =====================================================

router.get(
    "/grocery-products/:id/variants",
    (req, res) => {

        db.query(

            `
            SELECT

                id,
                partner_product_id,
                size,
                price,
                offer_price,
                stock,
                status

            FROM partner_grocery_variants

            WHERE partner_product_id=?

            ORDER BY id
            `,

            [req.params.id],

            (err, variants) => {

                if (err) {

                    console.log(
                        "GET GROCERY VARIANTS ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to load Grocery variants"
                    });
                }


                res.json({

                    success: true,

                    variants:
                        variants
                });

            }
        );
    }
);


// =====================================================
// SAVE / REPLACE GROCERY VARIANTS
// =====================================================

// =====================================================
// SAVE GROCERY PRODUCT VARIANTS
// PUT /partner/grocery-products/:id/variants
// =====================================================

router.put(
    "/grocery-products/:id/variants",
    (req, res) => {

        const partnerProductId =
            Number(req.params.id);

        const variants =
            Array.isArray(req.body.variants)
                ? req.body.variants
                : [];


        console.log("=================================");
        console.log("SAVE GROCERY VARIANTS");
        console.log("PARTNER PRODUCT ID:", partnerProductId);
        console.log("VARIANTS:", variants);
        console.log("=================================");


        if (
            !Number.isInteger(partnerProductId) ||
            partnerProductId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid Grocery product ID"
            });

        }


        // =================================================
        // DELETE OLD VARIANTS
        // =================================================

        db.query(
            `
            DELETE FROM partner_grocery_variants
            WHERE partner_product_id = ?
            `,
            [partnerProductId],

            deleteErr => {

                if (deleteErr) {

                    console.error(
                        "❌ DELETE VARIANTS ERROR:",
                        deleteErr
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to remove old Grocery variants"
                    });

                }


                // =================================================
                // NO VARIANTS
                // =================================================

                if (!variants.length) {

                    return res.json({
                        success: true,
                        message:
                            "Grocery product saved without variants"
                    });

                }


                // =================================================
                // INSERT NEW VARIANTS
                // =================================================

                let completed = 0;
                let failed = false;


                variants.forEach(variant => {

                    const size =
                        String(
                            variant.size || ""
                        ).trim();


                    const price =
                        Number(
                            variant.price
                        ) || 0;


                    const offerPrice =
                        variant.offer_price !== null &&
                        variant.offer_price !== undefined &&
                        variant.offer_price !== "" &&
                        Number(variant.offer_price) > 0

                            ? Number(
                                variant.offer_price
                            )

                            : null;


                    const stock =
                        Number(
                            variant.stock
                        ) || 0;


                    const status =
                        stock > 0
                            ? "Available"
                            : "Out of Stock";


                    if (
                        !size ||
                        price <= 0
                    ) {

                        completed++;

                        return checkFinished();

                    }


                    db.query(
                        `
                        INSERT INTO partner_grocery_variants
                        (
                            partner_product_id,
                            size,
                            price,
                            offer_price,
                            stock,
                            status
                        )
                        VALUES
                        (?, ?, ?, ?, ?, ?)
                        `,

                        [
                            partnerProductId,
                            size,
                            price,
                            offerPrice,
                            stock,
                            status
                        ],

                        insertErr => {

                            completed++;


                            if (insertErr) {

                                console.error(
                                    "❌ INSERT VARIANT ERROR:",
                                    insertErr
                                );

                                failed = true;

                            } else {

                                console.log(
                                    "✅ VARIANT SAVED:",
                                    partnerProductId,
                                    size,
                                    price,
                                    offerPrice,
                                    stock
                                );

                            }


                            checkFinished();

                        }
                    );


                });


                function checkFinished() {

                    if (
                        completed !==
                        variants.length
                    ) {
                        return;
                    }


                    if (failed) {

                        return res.status(500).json({
                            success: false,
                            message:
                                "Some Grocery variants could not be saved"
                        });

                    }


                    return res.json({

                        success: true,

                        message:
                            "Grocery variants saved successfully"

                    });

                }

            }
        );

    }
);


// =====================================================
// GROCERY CATEGORIES
// =====================================================

// GET GROCERY CATEGORIES FOR PARTNER
router.get(
    "/grocery-categories/:partnerId",
    (req, res) => {

        db.query(
            `
            SELECT
                id,
                category_name,
                image,
                status,
                sort_order
            FROM grocery_categories
            ORDER BY sort_order ASC, id ASC
            `,
            (err, categories) => {

                if (err) {

                    console.error(
                        "GET GROCERY CATEGORIES ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        categories: []
                    });
                }

                const finalCategories =
                    categories.map(category => ({

                        id: category.id,

                        name:
                            category.category_name,

                        category_name:
                            category.category_name,

                        image:
                            category.image,

                        category_image:
                            category.image,

                        status:
                            category.status,

                        sort_order:
                            category.sort_order

                    }));

                console.log(
                    "GROCERY CATEGORIES SENT:",
                    finalCategories
                );

                return res.json({

                    success: true,

                    categories:
                        finalCategories

                });

            }
        );
    }
);


// =====================================================
// ADD GROCERY CATEGORY
// =====================================================

router.post(
    "/grocery-categories/:partnerId",
    (req, res) => {

        const partnerId =
            Number(req.params.partnerId);

        const {
            category_name,
            category_image
        } = req.body;

        console.log(
            "ADD GROCERY CATEGORY:",
            req.body
        );

        if (
            !Number.isInteger(partnerId) ||
            partnerId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid partner ID"
            });
        }

        if (
            !category_name ||
            !String(category_name).trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Category name is required"
            });
        }

        const image =
            category_image || null;

        db.query(
            `
            INSERT INTO grocery_categories
            (
                partner_id,
                category_name,
                image,
                status,
                sort_order
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                partnerId,
                String(category_name).trim(),
                image,
                "Active",
                0
            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "ADD GROCERY CATEGORY ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to add grocery category"
                    });
                }

                return res.json({
                    success: true,
                    message:
                        "Grocery category added successfully",

                    category: {
                        id: result.insertId,
                        category_name:
                            String(category_name).trim(),
                        category_image:
                            image
                    }
                });
            }
        );
    }
);


// =====================================================
// UPDATE GROCERY CATEGORY
// =====================================================

router.put(
    "/grocery-categories/:id",
    (req, res) => {

        const categoryId =
            Number(req.params.id);

        const {
            category_name,
            category_image,
            status,
            sort_order
        } = req.body;

        console.log(
            "UPDATE GROCERY CATEGORY:",
            categoryId,
            req.body
        );

        console.log(
            "FINAL IMAGE SAVING:",
            category_image
        );

        if (
            !category_name ||
            !String(category_name).trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        db.query(
            `
            UPDATE grocery_categories
            SET
                category_name = ?,
                image = ?,
                status = ?,
                sort_order = ?
            WHERE id = ?
            `,
            [
                String(category_name).trim(),
                category_image || null,
                status || "Active",
                Number(sort_order) || 0,
                categoryId
            ],
            (err, result) => {

                if (err) {
                    console.error(
                        "UPDATE GROCERY CATEGORY ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to update grocery category"
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Grocery category not found"
                    });
                }

                return res.json({
                    success: true,
                    message:
                        "Grocery category updated successfully"
                });
            }
        );
    }
);

// =====================================================
// BUSINESS HOURS - GET
// =====================================================

router.get("/business-hours/:id", (req, res) => {

    const partnerId = req.params.id;

    db.query(
        `
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
        `,
        [partnerId],

        (err, result) => {

            if (err) {

                console.error(
                    "GET BUSINESS HOURS ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to load business hours"
                });

            }

            res.json({
                success: true,
                hours: result
            });

        }
    );

});


// =====================================================
// BUSINESS HOURS - SAVE / UPDATE
// =====================================================

router.put("/business-hours/:id", (req, res) => {

    const partnerId = req.params.id;

    const hours = req.body.hours;


    if (!Array.isArray(hours)) {

        return res.status(400).json({
            success: false,
            message: "Invalid business hours data"
        });

    }


    const allowedDays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];


    const connection = db;


    let completed = 0;


    if (hours.length !== 7) {

        return res.status(400).json({
            success: false,
            message: "All 7 days are required"
        });

    }


    for (const day of hours) {

        if (!allowedDays.includes(day.day_of_week)) {

            return res.status(400).json({
                success: false,
                message:
                    `Invalid day: ${day.day_of_week}`
            });

        }

    }


    function saveNext(index) {

        if (index >= hours.length) {

            return res.json({
                success: true,
                message: "Business hours saved successfully"
            });

        }


        const day = hours[index];


        const isClosed =
            Number(day.is_closed) === 1 ? 1 : 0;


        const openingTime =
            isClosed
                ? null
                : day.opening_time || null;


        const closingTime =
            isClosed
                ? null
                : day.closing_time || null;


        connection.query(

            `
            INSERT INTO partner_business_hours
            (
                partner_id,
                day_of_week,
                is_closed,
                opening_time,
                closing_time
            )
            VALUES (?, ?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE

                is_closed = VALUES(is_closed),

                opening_time =
                    VALUES(opening_time),

                closing_time =
                    VALUES(closing_time)
            `,

            [
                partnerId,
                day.day_of_week,
                isClosed,
                openingTime,
                closingTime
            ],

            (err) => {

                if (err) {

                    console.error(
                        "SAVE BUSINESS HOURS ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to save business hours"
                    });

                }


                saveNext(index + 1);

            }

        );

    }


    saveNext(0);

});
// =====================================================
// EXPORT
// =====================================================

module.exports = router;