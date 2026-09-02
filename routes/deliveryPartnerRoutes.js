const express = require("express");
const router = express.Router();
const db = require("../config/db");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =======================================
// GPS DISTANCE HELPER
// =======================================

function getDistanceInMeters(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const toRad = (value) => {
        return value * Math.PI / 180;
    };

    const dLat =
        toRad(lat2 - lat1);

    const dLon =
        toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *

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


// =======================================
// MULTER CONFIG
// =======================================

const uploadDir =
    path.join(
        __dirname,
        "../uploads/delivery"
    );

if (!fs.existsSync(uploadDir)) {

    fs.mkdirSync(
        uploadDir,
        {
            recursive: true
        }
    );

}


const storage =
    multer.diskStorage({

        destination: (req, file, cb) => {

            cb(
                null,
                uploadDir
            );

        },

        filename: (req, file, cb) => {

            cb(

                null,

                Date.now() +
                "-" +
                Math.round(
                    Math.random() * 1000000
                ) +
                path.extname(
                    file.originalname
                )

            );

        }

    });


const upload =
    multer({

        storage

    });


// =======================================
// DELIVERY PARTNER REGISTRATION
// =======================================

router.post(

    "/register",

    upload.fields([

        {
            name: "license",
            maxCount: 1
        },

        {
            name: "aadhaar",
            maxCount: 1
        },

        {
            name: "rc",
            maxCount: 1
        },

        {
            name: "photo",
            maxCount: 1
        }

    ]),

    (req, res) => {

        try {

            const {

                name,
                mobile,
                email,
                password,
                vehicle

            } = req.body;


            // ===================================
            // BASIC VALIDATION
            // ===================================

            if (
                !name ||
                !mobile ||
                !email ||
                !password ||
                !vehicle
            ) {

                return res.json({

                    success: false,

                    message:
                        "Please fill all fields."

                });

            }


            // ===================================
            // FILE VALIDATION
            // ===================================

            if (
                !req.files ||
                !req.files.license ||
                !req.files.aadhaar ||
                !req.files.rc ||
                !req.files.photo
            ) {

                return res.json({

                    success: false,

                    message:
                        "Please upload all required documents."

                });

            }


            if (
                !req.files.license[0] ||
                !req.files.aadhaar[0] ||
                !req.files.rc[0] ||
                !req.files.photo[0]
            ) {

                return res.json({

                    success: false,

                    message:
                        "Required documents are missing."

                });

            }


            // ===================================
            // CHECK MOBILE
            // ===================================

            db.query(

                `SELECT id
                 FROM delivery_partners
                 WHERE mobile=?`,

                [
                    mobile
                ],

                (err, result) => {

                    if (err) {

                        console.log(
                            "REGISTRATION CHECK ERROR:",
                            err
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Database Error"

                        });

                    }


                    if (
                        result.length > 0
                    ) {

                        return res.json({

                            success: false,

                            message:
                                "Mobile Number Already Registered"

                        });

                    }


                    // ===================================
                    // FILE NAMES
                    // ===================================

                    const license =
                        req.files
                            .license[0]
                            .filename;

                    const aadhaar =
                        req.files
                            .aadhaar[0]
                            .filename;

                    const rc =
                        req.files
                            .rc[0]
                            .filename;

                    const photo =
                        req.files
                            .photo[0]
                            .filename;


                    // ===================================
                    // INSERT PARTNER
                    // ===================================

                    db.query(

                        `INSERT INTO delivery_partners
                        (
                            name,
                            mobile,
                            email,
                            password,
                            vehicle,
                            license,
                            aadhaar,
                            rc,
                            photo,
                            status,
                            account_status,
                            online_status
                        )
                        VALUES
                        (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?
                        )`,

                        [

                            name,
                            mobile,
                            email,
                            password,
                            vehicle,

                            license,
                            aadhaar,
                            rc,
                            photo,

                            "Available",
                            "Pending",
                            "Offline"

                        ],

                        (err) => {

                            if (err) {

                                console.log(
                                    "REGISTRATION INSERT ERROR:",
                                    err
                                );

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Registration Failed"

                                });

                            }


                            return res.json({

                                success: true,

                                message:
                                    "Registration Submitted Successfully"

                            });

                        }

                    );

                }

            );

        }

        catch (err) {

            console.log(
                "REGISTRATION SERVER ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server Error"

            });

        }

    }

);


// =======================================
// DELIVERY PARTNER LOGIN
// =======================================

router.post(
    "/login",
    (req, res) => {

        const {

            mobile,
            password

        } = req.body;


        if (
            !mobile ||
            !password
        ) {

            return res.json({

                success: false,

                message:
                    "Mobile Number and Password are required."

            });

        }


        db.query(

            `SELECT *
             FROM delivery_partners
             WHERE mobile=?`,

            [
                mobile
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "LOGIN DATABASE ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Invalid Mobile Number"

                    });

                }


                const partner =
                    result[0];


                // ===================================
                // PASSWORD
                // ===================================

                if (
                    partner.password !==
                    password
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Incorrect Password"

                    });

                }


                // ===================================
                // ACCOUNT APPROVAL
                // ===================================

                if (
                    partner.account_status ===
                    "Pending"
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Your account is pending admin approval."

                    });

                }


                if (
                    partner.account_status ===
                    "Rejected"
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Your account has been rejected."

                    });

                }


                // ===================================
                // SUCCESS
                // ===================================

                return res.json({

                    success: true,

                    partner: {

                        id:
                            partner.id,

                        name:
                            partner.name,

                        mobile:
                            partner.mobile,

                        email:
                            partner.email,

                        vehicle:
                            partner.vehicle,

                        status:
                            partner.status,

                        online_status:
                            partner.online_status

                    }

                });

            }

        );

    }

);


// =======================================
// UPDATE ONLINE / OFFLINE STATUS
// SINGLE CORRECT ROUTE
// =======================================

router.put(
    "/status",
    (req, res) => {

        const {
            id,
            status
        } = req.body;


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !id ||
            !status
        ) {

            return res.json({

                success: false,

                message:
                    "Missing Required Fields"

            });

        }


        if (
            status !== "Online" &&
            status !== "Offline"
        ) {

            return res.json({

                success: false,

                message:
                    "Invalid Status"

            });

        }


        // ===================================
        // GET CURRENT RIDER DATA
        // ===================================

        db.query(

            `SELECT
                online_status,
                online_started_at,
                online_seconds_today,
                online_stats_date
             FROM delivery_partners
             WHERE id=?`,

            [
                id
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "STATUS SELECT ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Delivery Partner Not Found"

                    });

                }


                const partner =
                    result[0];


                const today =
                    new Date()
                        .toISOString()
                        .slice(0, 10);


                let onlineSeconds =
                    Number(
                        partner.online_seconds_today || 0
                    );


                // ===================================
                // NEW DAY RESET
                // ===================================

                if (
                    !partner.online_stats_date ||
                    String(
                        partner.online_stats_date
                    ).slice(0, 10) !== today
                ) {

                    onlineSeconds = 0;

                }


                // ===================================
                // GO ONLINE
                // ===================================

                if (
                    status === "Online"
                ) {

                    // Don't restart existing session
                    if (
                        partner.online_status ===
                        "Online"
                    ) {

                        return res.json({

                            success: true,

                            status:
                                "Online"

                        });

                    }


                    db.query(

                        `UPDATE delivery_partners
                         SET
                            online_status=?,
                            online_started_at=NOW(),
                            online_seconds_today=?,
                            online_stats_date=CURDATE()
                         WHERE id=?`,

                        [

                            "Online",
                            onlineSeconds,
                            id

                        ],

                        (updateErr) => {

                            if (updateErr) {

                                console.log(
                                    "GO ONLINE ERROR:",
                                    updateErr
                                );

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Database Error"

                                });

                            }


                            return res.json({

                                success: true,

                                status:
                                    "Online"

                            });

                        }

                    );

                    return;

                }


                // ===================================
                // GO OFFLINE
                // ===================================

                let finalSeconds =
                    onlineSeconds;


                if (
                    partner.online_status ===
                    "Online" &&
                    partner.online_started_at
                ) {

                    const started =
                        new Date(
                            partner.online_started_at
                        ).getTime();


                    const now =
                        Date.now();


                    const elapsed =
                        Math.max(

                            0,

                            Math.floor(
                                (
                                    now -
                                    started
                                ) / 1000
                            )

                        );


                    finalSeconds +=
                        elapsed;

                }


                db.query(

                    `UPDATE delivery_partners
                     SET
                        online_status=?,
                        online_started_at=NULL,
                        online_seconds_today=?,
                        online_stats_date=CURDATE()
                     WHERE id=?`,

                    [

                        "Offline",
                        finalSeconds,
                        id

                    ],

                    (updateErr) => {

                        if (updateErr) {

                            console.log(
                                "GO OFFLINE ERROR:",
                                updateErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Database Error"

                            });

                        }


                        return res.json({

                            success: true,

                            status:
                                "Offline",

                            onlineSeconds:
                                finalSeconds

                        });

                    }

                );

            }

        );

    }

);


// =======================================
// CALCULATE DISTANCE BETWEEN GPS POINTS
// =======================================

function calculateDistanceKm(
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
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *

        Math.cos(
            lat2 * Math.PI / 180
        ) *

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

// =======================================
// UPDATE LIVE LOCATION
// =======================================

router.put(
    "/location",
    (req, res) => {

        const {
            deliveryId,
            latitude,
            longitude
        } = req.body;


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !deliveryId ||
            latitude == null ||
            longitude == null
        ) {

            return res.json({

                success: false,

                message:
                    "Missing Location"

            });

        }


        // ===================================
        // GET CURRENT LOCATION
        // ===================================

        db.query(

            `SELECT
                online_status,
                latitude,
                longitude,
                distance_today_km
             FROM delivery_partners
             WHERE id=?`,

            [
                deliveryId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "LOCATION SELECT ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Delivery Partner Not Found"

                    });

                }


                const partner =
                    result[0];


                // ===================================
                // CURRENT DISTANCE
                // ===================================

                let distance =
                    Number(
                        partner.distance_today_km || 0
                    );


                // ===================================
                // CALCULATE DISTANCE ONLY ONLINE
                // ===================================

                if (

                    partner.online_status ===
                    "Online"

                    &&

                    partner.latitude != null

                    &&

                    partner.longitude != null

                ) {

                    const previousLat =
                        Number(
                            partner.latitude
                        );

                    const previousLng =
                        Number(
                            partner.longitude
                        );

                    const currentLat =
                        Number(
                            latitude
                        );

                    const currentLng =
                        Number(
                            longitude
                        );


                    const movedKm =
                        calculateDistanceKm(

                            previousLat,
                            previousLng,

                            currentLat,
                            currentLng

                        );


                    // ===================================
                    // IGNORE GPS NOISE / HUGE JUMPS
                    // ===================================

                    if (

                        movedKm > 0

                        &&

                        movedKm < 2

                    ) {

                        distance +=
                            movedKm;

                    }

                }


                // ===================================
                // SAVE LOCATION
                // ===================================

                db.query(

                    `UPDATE delivery_partners
                     SET
                        latitude=?,
                        longitude=?,
                        distance_today_km=?
                     WHERE id=?`,

                    [

                        latitude,
                        longitude,
                        distance,
                        deliveryId

                    ],

                    (updateErr) => {

                        if (updateErr) {

                            console.log(
                                "LOCATION UPDATE ERROR:",
                                updateErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Database Error"

                            });

                        }


                        return res.json({

                            success: true,

                            distance:
                                Number(
                                    distance.toFixed(2)
                                )

                        });

                    }

                );

            }

        );

    }

);


// =======================================
// GET DELIVERY PARTNER PROFILE
// =======================================

router.get(
    "/profile/:id",
    (req, res) => {

        db.query(

            `SELECT
                id,
                name,
                mobile,
                email,
                vehicle,
                status,
                account_status,
                online_status,
                latitude,
                longitude,
                online_started_at,
                online_seconds_today,
                online_stats_date,
                distance_today_km,
                created_at
             FROM delivery_partners
             WHERE id=?`,

            [
                req.params.id
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "PROFILE ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Delivery Partner Not Found"

                    });

                }


                const partner =
                    result[0];


                // ===================================
                // STORED ONLINE TIME
                // ===================================

                let onlineSeconds =
                    Number(
                        partner.online_seconds_today || 0
                    );


                // ===================================
                // LIVE ONLINE TIME
                // ===================================

                if (

                    partner.online_status ===
                    "Online"

                    &&

                    partner.online_started_at

                ) {

                    const started =
                        new Date(
                            partner.online_started_at
                        ).getTime();


                    const now =
                        Date.now();


                    const currentSession =
                        Math.max(

                            0,

                            Math.floor(

                                (
                                    now -
                                    started
                                ) / 1000

                            )

                        );


                    onlineSeconds +=
                        currentSession;

                }


                // ===================================
                // RESPONSE
                // ===================================

                return res.json({

                    success: true,

                    partner: {

                        ...partner,

                        onlineTimeSeconds:
                            onlineSeconds,

                        distance:
                            Number(
                                partner.distance_today_km || 0
                            ).toFixed(2)

                    }

                });

            }

        );

    }

);


// =======================================
// DELIVERY DASHBOARD
// IMPORTANT:
// WALLET BALANCE IS SOURCE OF TRUTH
// =======================================

router.get(
    "/dashboard/:id",
    (req, res) => {

        const deliveryId =
            req.params.id;


        // ===================================
        // GET TODAY'S DELIVERIES
        // ===================================

        db.query(

            `SELECT
                COUNT(*) AS todayDeliveries
             FROM orders
             WHERE
                delivery_partner_id=?
                AND status='Delivered'`,

            [
                deliveryId
            ],

            (err, orderResult) => {

                if (err) {

                    console.log(
                        "DASHBOARD ORDER ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                // ===================================
                // GET WALLET BALANCE
                // ===================================

                db.query(

                    `SELECT
                        balance
                     FROM wallets
                     WHERE
                        user_type='delivery'
                        AND user_id=?
                     LIMIT 1`,

                    [
                        deliveryId
                    ],

                    (walletErr, walletResult) => {

                        if (walletErr) {

                            console.log(
                                "DASHBOARD WALLET ERROR:",
                                walletErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Wallet Database Error"

                            });

                        }


                        // ===================================
                        // WALLET BALANCE
                        // ===================================

                        const walletBalance =

                            walletResult.length > 0

                                ?

                                Number(
                                    walletResult[0]
                                        .balance || 0
                                )

                                :

                                0;


                        // ===================================
                        // RESPONSE
                        // ===================================

                        return res.json({

                            success: true,

                            todayDeliveries:

                                Number(
                                    orderResult[0]
                                        .todayDeliveries || 0
                                ),

                            // IMPORTANT
                            // Dashboard earnings comes
                            // directly from wallet SQL

                            todayEarnings:
                                walletBalance,

                            walletBalance:
                                walletBalance

                        });

                    }

                );

            }

        );

    }

);


// =======================================
// GET CURRENT DELIVERY ORDER
// =======================================

router.get(
    "/current/:id",
    (req, res) => {

        const deliveryId =
            req.params.id;


        console.log(
            "================================"
        );

        console.log(
            "🔎 CURRENT ORDER CHECK - RIDER:",
            deliveryId
        );

        console.log(
            "================================"
        );


        db.query(

            `SELECT

                o.*,

                r.restaurant_name AS restaurant_name,

                r.address AS restaurant_address,

                r.mobile AS restaurant_mobile,

                r.latitude AS restaurant_lat,

                r.longitude AS restaurant_lng

             FROM orders o

             LEFT JOIN restaurants r
                ON r.id = o.partner_id

             WHERE
                o.delivery_partner_id=?

             AND
                o.status IN
                (
                    'Delivery Assigned',
                    'Picked Up',
                    'Out For Delivery'
                )

             ORDER BY
                o.id DESC

             LIMIT 1`,

            [
                deliveryId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "❌ CURRENT ORDER DB ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    console.log(
                        "ℹ️ NO CURRENT ORDER"
                    );

                    return res.json({

                        success: false,

                        message:
                            "No Active Delivery"

                    });

                }


                const order =
                    result[0];


                console.log(
                    "================================"
                );

                console.log(
                    "✅ CURRENT ORDER FOUND"
                );

                console.log(
                    "Order ID:",
                    order.id
                );

                console.log(
                    "Delivery Partner ID:",
                    order.delivery_partner_id
                );

                console.log(
                    "Order Status:",
                    order.status
                );

                console.log(
                    "Delivery Status:",
                    order.delivery_status
                );

                console.log(
                    "Restaurant:",
                    order.restaurant_name
                );

                console.log(
                    "Restaurant GPS:",
                    order.restaurant_lat,
                    order.restaurant_lng
                );

                console.log(
                    "Customer GPS:",
                    order.customer_lat,
                    order.customer_lng
                );

                console.log(
                    "================================"
                );


                return res.json({

                    success: true,

                    order:
                        order

                });

            }

        );

    }

);


// =======================================
// ACCEPT DELIVERY
// DARVOZ V1 - FIRST RIDER WINS
// =======================================

router.put(
    "/accept/:orderId",
    (req, res) => {

        const orderId =
            req.params.orderId;

        const {
            deliveryId
        } = req.body;


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !orderId ||
            !deliveryId
        ) {

            return res.json({

                success: false,

                message:
                    "Missing Order ID or Delivery ID"

            });

        }


        // ===================================
        // ATOMIC ACCEPT
        //
        // FIRST RIDER WINS
        // ===================================

        db.query(

            `UPDATE orders o

             JOIN delivery_partners d
             ON d.id=?

             SET

                o.delivery_partner_id=?,

                o.status='Delivery Assigned'

             WHERE

                o.id=?

                AND o.delivery_partner_id IS NULL

                AND o.status='Accepted'

                AND d.account_status='Approved'

                AND d.online_status='Online'`,

            [

                deliveryId,
                deliveryId,
                orderId

            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "ACCEPT ORDER ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                // ===================================
                // RIDER WON
                // ===================================

                if (
                    result.affectedRows === 1
                ) {

                    console.log(
                        "================================="
                    );

                    console.log(
                        "✅ ORDER ACCEPTED BY RIDER"
                    );

                    console.log(
                        "Order ID:",
                        orderId
                    );

                    console.log(
                        "Delivery ID:",
                        deliveryId
                    );

                    console.log(
                        "================================="
                    );


                    // ===================================
                    // UPDATE DISPATCH LOG
                    // ===================================

                    db.query(

                        `UPDATE order_dispatch_log

                         SET

                            status='Accepted',

                            accepted_at=NOW()

                         WHERE

                            order_id=?

                            AND delivery_partner_id=?

                            AND status='Pending'`,

                        [

                            orderId,
                            deliveryId

                        ],

                        (logErr) => {

                            if (logErr) {

                                console.log(
                                    "Dispatch Log Error:",
                                    logErr
                                );

                            }

                        }

                    );


                    // ===================================
                    // GET UPDATED ORDER
                    // ===================================

                    db.query(

                        `SELECT *
                         FROM orders
                         WHERE id=?`,

                        [
                            orderId
                        ],

                        (e, rows) => {

                            if (e) {

                                console.log(e);

                                return res.json({

                                    success: true,

                                    message:
                                        "Delivery Accepted",

                                    orderId:
                                        orderId,

                                    deliveryId:
                                        deliveryId

                                });

                            }


                            if (
                                rows.length === 0
                            ) {

                                return res.json({

                                    success: true,

                                    message:
                                        "Delivery Accepted",

                                    orderId:
                                        orderId,

                                    deliveryId:
                                        deliveryId

                                });

                            }


                            const order =
                                rows[0];


                            // ===================================
                            // SOCKET.IO
                            // ===================================

                            const io =
                                req.app.get("io");


                            if (io) {

                                // CUSTOMER
                                io.to(
                                    `customer_${order.customer_id}`
                                ).emit(

                                    "orderStatusUpdated",

                                    {

                                        orderId:
                                            orderId,

                                        status:
                                            "Delivery Assigned"

                                    }

                                );


                                // RESTAURANT
                                io.to(
                                    `partner_${order.partner_id}`
                                ).emit(

                                    "deliveryAssigned",

                                    {

                                        orderId:
                                            orderId,

                                        deliveryId:
                                            deliveryId

                                    }

                                );

                            }


                            // ===================================
                            // RESPONSE
                            // ===================================

                            return res.json({

                                success: true,

                                message:
                                    "Delivery Accepted",

                                orderId:
                                    orderId,

                                deliveryId:
                                    deliveryId

                            });

                        }

                    );

                    return;

                }


                // ===================================
                // SECOND RIDER
                // ===================================

                console.log(

                    `Rider ${deliveryId} tried to accept ` +
                    `Order ${orderId}, but it was already assigned.`

                );


                return res.json({

                    success: false,

                    message:
                        "Order already accepted by another rider."

                });

            }

        );

    }

);

// =======================================
// RIDER REACHED RESTAURANT
// GPS VERIFIED
// =======================================

router.put(
    "/reached-restaurant/:orderId",
    (req, res) => {

        const orderId =
            req.params.orderId;

        const {
            deliveryId,
            latitude,
            longitude
        } = req.body;


        console.log(
            "================================="
        );

        console.log(
            "🏪 RIDER REACHED RESTAURANT"
        );

        console.log(
            "Order ID:",
            orderId
        );

        console.log(
            "Delivery ID:",
            deliveryId
        );

        console.log(
            "Rider GPS:",
            latitude,
            longitude
        );

        console.log(
            "================================="
        );


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !orderId ||
            !deliveryId ||
            latitude == null ||
            longitude == null
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID, Delivery ID and GPS location are required."

            });

        }


        // ===================================
        // VERIFY RIDER OWNS ORDER
        // ===================================

        db.query(

            `SELECT

                o.*,

                r.latitude AS restaurant_lat,

                r.longitude AS restaurant_lng

             FROM orders o

             LEFT JOIN restaurants r
                ON r.id = o.partner_id

             WHERE
                o.id=?

             AND
                o.delivery_partner_id=?`,

            [
                orderId,
                deliveryId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "❌ REACHED RESTAURANT DB ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "This order is not assigned to this delivery partner."

                    });

                }


                const order =
                    result[0];


                // ===================================
                // CHECK ORDER STATUS
                // ===================================

                if (
                    order.status !==
                    "Delivery Assigned"
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Order is not ready for restaurant arrival."

                    });

                }


                // ===================================
                // CHECK RESTAURANT GPS
                // ===================================

                if (
                    order.restaurant_lat == null ||
                    order.restaurant_lng == null
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Restaurant GPS location is not available."

                    });

                }


                // ===================================
                // CALCULATE DISTANCE
                // ===================================

                const distance =
                    getDistanceInMeters(

                        Number(latitude),

                        Number(longitude),

                        Number(order.restaurant_lat),

                        Number(order.restaurant_lng)

                    );


                console.log(

                    "🏪 DISTANCE FROM RESTAURANT:",

                    Math.round(distance),

                    "meters"

                );


                // ===================================
                // GEOFENCE
                // ===================================

                const allowedDistance =
                    150;


                if (
                    distance >
                    allowedDistance
                ) {

                    return res.json({

                        success: false,

                        message:
                            `You are ${Math.round(distance)} meters away from the restaurant. Please move closer.`,

                        distance:
                            Math.round(distance)

                    });

                }


                // ===================================
                // UPDATE DELIVERY STATUS
                // ===================================

                db.query(

                    `UPDATE orders

                     SET
                        delivery_status='Reached Restaurant'

                     WHERE
                        id=?

                     AND
                        delivery_partner_id=?`,

                    [
                        orderId,
                        deliveryId
                    ],

                    (updateErr) => {

                        if (updateErr) {

                            console.log(
                                "❌ REACHED RESTAURANT UPDATE ERROR:",
                                updateErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Failed to update delivery status"

                            });

                        }


                        // ===================================
                        // SOCKET.IO
                        // ===================================

                        const io =
                            req.app.get("io");


                        if (io) {

                            // CUSTOMER
                            io.to(
                                `customer_${order.customer_id}`
                            ).emit(

                                "orderStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Restaurant"

                                }

                            );


                            // RESTAURANT
                            io.to(
                                `partner_${order.partner_id}`
                            ).emit(

                                "orderStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Restaurant"

                                }

                            );


                            // RIDER
                            io.to(
                                `delivery_${deliveryId}`
                            ).emit(

                                "deliveryStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Restaurant"

                                }

                            );

                        }


                        console.log(
                            "================================="
                        );

                        console.log(
                            "✅ RESTAURANT REACHED"
                        );

                        console.log(
                            "Order:",
                            orderId
                        );

                        console.log(
                            "Rider:",
                            deliveryId
                        );

                        console.log(
                            "Distance:",
                            Math.round(distance),
                            "meters"
                        );

                        console.log(
                            "================================="
                        );


                        return res.json({

                            success: true,

                            message:
                                "Restaurant reached successfully.",

                            orderId:
                                orderId,

                            deliveryId:
                                deliveryId,

                            distance:
                                Math.round(distance),

                            delivery_status:
                                "Reached Restaurant"

                        });

                    }

                );

            }

        );

    }

);


// =======================================
// RIDER REACHED CUSTOMER
// GPS VERIFIED
// =======================================

router.put(
    "/reached-customer/:orderId",
    (req, res) => {

        const orderId =
            req.params.orderId;

        const {
            deliveryId,
            latitude,
            longitude
        } = req.body;


        console.log(
            "================================="
        );

        console.log(
            "🏠 RIDER REACHED CUSTOMER"
        );

        console.log(
            "Order ID:",
            orderId
        );

        console.log(
            "Delivery ID:",
            deliveryId
        );

        console.log(
            "Rider GPS:",
            latitude,
            longitude
        );

        console.log(
            "================================="
        );


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !orderId ||
            !deliveryId ||
            latitude == null ||
            longitude == null
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID, Delivery ID and GPS location are required."

            });

        }


        // ===================================
        // FIND ORDER
        // ===================================

        db.query(

            `SELECT *

             FROM orders

             WHERE
                id=?

             AND
                delivery_partner_id=?`,

            [
                orderId,
                deliveryId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "❌ REACHED CUSTOMER DB ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                if (
                    result.length === 0
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "This order is not assigned to this delivery partner."

                    });

                }


                const order =
                    result[0];


                // ===================================
                // CHECK PICKUP STATUS
                // ===================================

                const deliveryStatus =
                    String(
                        order.delivery_status || ""
                    )
                    .trim()
                    .toLowerCase();


                if (
                    deliveryStatus !==
                        "picked up" &&

                    deliveryStatus !==
                        "out for delivery"
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Order has not been picked up yet."

                    });

                }


                // ===================================
                // CUSTOMER GPS
                // ===================================

                const customerLat =
                    order.customer_lat;

                const customerLng =
                    order.customer_lng;


                if (
                    customerLat == null ||
                    customerLng == null
                ) {

                    return res.json({

                        success: false,

                        message:
                            "Customer GPS location is not available."

                    });

                }


                // ===================================
                // CALCULATE DISTANCE
                // ===================================

                const distance =
                    getDistanceInMeters(

                        Number(latitude),

                        Number(longitude),

                        Number(customerLat),

                        Number(customerLng)

                    );


                console.log(

                    "🏠 DISTANCE FROM CUSTOMER:",

                    Math.round(distance),

                    "meters"

                );


                // ===================================
                // GEOFENCE
                // ===================================

                const allowedDistance =
                    150;


                if (
                    distance >
                    allowedDistance
                ) {

                    return res.json({

                        success: false,

                        message:
                            `You are ${Math.round(distance)} meters away from the customer. Please move closer.`,

                        distance:
                            Math.round(distance)

                    });

                }


                // ===================================
                // UPDATE STATUS
                // ===================================

                db.query(

                    `UPDATE orders

                     SET
                        delivery_status='Reached Customer'

                     WHERE
                        id=?

                     AND
                        delivery_partner_id=?`,

                    [
                        orderId,
                        deliveryId
                    ],

                    (updateErr) => {

                        if (updateErr) {

                            console.log(
                                "❌ REACHED CUSTOMER UPDATE ERROR:",
                                updateErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Failed to update customer status"

                            });

                        }


                        // ===================================
                        // SOCKET.IO
                        // ===================================

                        const io =
                            req.app.get("io");


                        if (io) {

                            // CUSTOMER
                            io.to(
                                `customer_${order.customer_id}`
                            ).emit(

                                "orderStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Customer"

                                }

                            );


                            // PARTNER
                            io.to(
                                `partner_${order.partner_id}`
                            ).emit(

                                "orderStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Customer"

                                }

                            );


                            // RIDER
                            io.to(
                                `delivery_${deliveryId}`
                            ).emit(

                                "deliveryStatusUpdated",

                                {

                                    orderId:
                                        orderId,

                                    status:
                                        "Reached Customer"

                                }

                            );

                        }


                        console.log(
                            "================================="
                        );

                        console.log(
                            "✅ CUSTOMER REACHED"
                        );

                        console.log(
                            "Order:",
                            orderId
                        );

                        console.log(
                            "Rider:",
                            deliveryId
                        );

                        console.log(
                            "Distance:",
                            Math.round(distance),
                            "meters"
                        );

                        console.log(
                            "================================="
                        );


                        return res.json({

                            success: true,

                            message:
                                "Customer reached successfully.",

                            orderId:
                                orderId,

                            deliveryId:
                                deliveryId,

                            distance:
                                Math.round(distance),

                            delivery_status:
                                "Reached Customer"

                        });

                    }

                );

            }

        );

    }

);


// =======================================
// REJECT DELIVERY
// =======================================

router.put(
    "/reject/:orderId",
    (req, res) => {

        const orderId =
            req.params.orderId;

        const {
            deliveryId
        } = req.body;


        if (
            !orderId ||
            !deliveryId
        ) {

            return res.json({

                success: false,

                message:
                    "Order ID and Delivery ID are required."

            });

        }


        db.query(

            `UPDATE order_dispatch_log

             SET
                status='Rejected'

             WHERE
                order_id=?

             AND
                delivery_partner_id=?`,

            [
                orderId,
                deliveryId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "REJECT DELIVERY ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                return res.json({

                    success: true,

                    message:
                        "Rejected",

                    affectedRows:
                        result.affectedRows

                });

            }

        );

    }

);


// ======================================================
// DELIVERY HISTORY
// GET /deliveryPartner/history/:id
// ======================================================

router.get("/history/:id", async (req, res) => {

  try {

    const deliveryId = Number(req.params.id);

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {

      return res.status(400).json({
        success: false,
        message: "Invalid delivery partner ID."
      });

    }


    const [orders] = await db.promise().query(

      `SELECT
          id,
          customer_name,
          mobile,
          address,
          payment,
          food_total,
          delivery_fee,
          platform_fee,
          grand_total,
          status,
          partner_id,
          restaurant_name,
          delivery_partner_id,
          customer_id,
          customer_lat,
          customer_lng,
          dispatch_attempt,
          dispatch_time,
          delivery_status,
          delivery_otp,
          payment_id,
          payment_order_id,
          partner_response_deadline,
          rider_response_deadline,
          refund_status,
          cancellation_reason,
          partner_wallet_credited,
          admin_commission_credited,
          delivery_wallet_credited,
          commission_percent
       FROM orders
       WHERE delivery_partner_id = ?
       ORDER BY
         CASE
           WHEN dispatch_time IS NULL THEN 1
           ELSE 0
         END,
         dispatch_time DESC,
         id DESC`,

      [deliveryId]

    );


    console.log(
      "📦 DELIVERY HISTORY:",
      deliveryId,
      orders.length,
      "orders"
    );


    return res.json({

      success: true,

      orders: orders

    });

  }

  catch (error) {

    console.error(
      "❌ DELIVERY HISTORY ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      message: "Failed to load delivery history."

    });

  }

});


// =======================================
// LOGOUT
// =======================================

router.put(
    "/logout/:id",
    (req, res) => {

        db.query(

            `UPDATE delivery_partners

             SET
                online_status='Offline',
                online_started_at=NULL

             WHERE
                id=?`,

            [
                req.params.id
            ],

            (err) => {

                if (err) {

                    console.log(
                        "LOGOUT ERROR:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Database Error"

                    });

                }


                return res.json({

                    success: true

                });

            }

        );

    }

);

// =======================================
// VERIFY DELIVERY OTP
// COMPLETE DELIVERY + CREDIT RIDER WALLET
// =======================================

router.put(
    "/verify-otp/:orderId",
    async (req, res) => {

        const orderId =
            req.params.orderId;

        const {
            deliveryId,
            otp
        } = req.body;


        console.log(
            "================================="
        );

        console.log(
            "🔐 VERIFY DELIVERY OTP"
        );

        console.log(
            "Order ID:",
            orderId
        );

        console.log(
            "Delivery ID:",
            deliveryId
        );

        console.log(
            "================================="
        );


        // ===================================
        // VALIDATION
        // ===================================

        if (
            !orderId ||
            !deliveryId ||
            !otp
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID, Delivery ID and OTP are required."

            });

        }


        let connection;


        try {

            // ===================================
            // GET DB CONNECTION
            // ===================================

            connection =
                await db.promise()
                    .getConnection();


            await connection.beginTransaction();


            // ===================================
            // GET ORDER + LOCK ROW
            // ===================================

            const [orders] =
                await connection.query(

                    `SELECT *
                     FROM orders
                     WHERE
                        id=?
                        AND delivery_partner_id=?
                     FOR UPDATE`,

                    [
                        orderId,
                        deliveryId
                    ]

                );


            // ===================================
            // ORDER NOT FOUND
            // ===================================

            if (
                orders.length === 0
            ) {

                await connection.rollback();

                return res.status(403).json({

                    success: false,

                    message:
                        "This order is not assigned to this delivery partner."

                });

            }


            const order =
                orders[0];


            // ===================================
            // ALREADY DELIVERED
            // IMPORTANT:
            // PREVENT DOUBLE WALLET CREDIT
            // ===================================

            if (

                String(order.status)
                    .trim()
                    .toLowerCase()
                    === "delivered"

            ) {

                await connection.rollback();

                return res.json({

                    success: false,

                    message:
                        "This order has already been delivered."

                });

            }


            // ===================================
            // CHECK DELIVERY STATUS
            // ===================================

            const currentDeliveryStatus =

                String(
                    order.delivery_status || ""
                )
                .trim()
                .toLowerCase()
                .replace(
                    /[\s_-]+/g,
                    ""
                );


            if (
                currentDeliveryStatus !==
                "reachedcustomer"
            ) {

                await connection.rollback();

                return res.json({

                    success: false,

                    message:
                        "You have not reached the customer yet."

                });

            }


            // ===================================
            // CHECK OTP
            // ===================================

            if (

                String(
                    order.delivery_otp
                ) !==

                String(
                    otp
                )

            ) {

                await connection.rollback();

                return res.json({

                    success: false,

                    message:
                        "Invalid delivery OTP."

                });

            }


            // ===================================
            // ACTUAL DELIVERY FEE
            //
            // IMPORTANT:
            // This comes from orders.delivery_fee
            // NOT hardcoded ₹1
            // ===================================

            const earning =
                Number(
                    order.delivery_fee || 0
                );


            console.log(
                "💰 ACTUAL DELIVERY FEE:",
                earning
            );


            // ===================================
            // COMPLETE ORDER
            // ===================================

            const [deliveryUpdate] =
                await connection.query(

                    `UPDATE orders

                     SET
                        delivery_status='Delivered',
                        status='Delivered'

                     WHERE
                        id=?
                        AND delivery_partner_id=?`,

                    [
                        orderId,
                        deliveryId
                    ]

                );


            if (
                deliveryUpdate.affectedRows !== 1
            ) {

                throw new Error(
                    "Failed to mark order as delivered."
                );

            }


            // ===================================
            // GET RIDER WALLET + LOCK
            // ===================================

            const [walletRows] =
                await connection.query(

                    `SELECT
                        id,
                        balance

                     FROM wallets

                     WHERE
                        user_type='delivery'
                        AND user_id=?

                     FOR UPDATE`,

                    [
                        deliveryId
                    ]

                );


            let walletId;

            let newBalance;


            // ===================================
            // CREATE WALLET
            // ===================================

            if (
                walletRows.length === 0
            ) {

                const [walletResult] =
                    await connection.query(

                        `INSERT INTO wallets
                        (
                            user_type,
                            user_id,
                            balance
                        )

                        VALUES
                        (
                            'delivery',
                            ?,
                            ?
                        )`,

                        [
                            deliveryId,
                            earning
                        ]

                    );


                walletId =
                    walletResult.insertId;


                newBalance =
                    earning;


                console.log(
                    "💰 NEW RIDER WALLET CREATED"
                );

            }


            // ===================================
            // EXISTING WALLET
            // ===================================

            else {

                walletId =
                    walletRows[0].id;


                const oldBalance =
                    Number(
                        walletRows[0].balance || 0
                    );


                newBalance =
                    oldBalance +
                    earning;


                // ===================================
                // CREDIT ACTUAL DELIVERY FEE
                // ===================================

                await connection.query(

                    `UPDATE wallets

                     SET
                        balance = balance + ?

                     WHERE
                        id=?`,

                    [
                        earning,
                        walletId
                    ]

                );


                console.log(
                    "💰 RIDER WALLET UPDATED"
                );

                console.log(
                    "Old Balance:",
                    oldBalance
                );

                console.log(
                    "Added:",
                    earning
                );

                console.log(
                    "New Balance:",
                    newBalance
                );

            }


            // ===================================
            // WALLET TRANSACTION
            // ===================================

            await connection.query(

                `INSERT INTO wallet_transactions
                (
                    user_type,
                    user_id,
                    order_id,
                    amount,
                    type
                )

                VALUES
                (
                    'delivery',
                    ?,
                    ?,
                    ?,
                    'Credit'
                )`,

                [
                    deliveryId,
                    orderId,
                    earning
                ]

            );


            // ===================================
            // COMMIT
            // ===================================

            await connection.commit();


            // ===================================
            // SOCKET.IO
            // ===================================

            const io =
                req.app.get("io");


            if (io) {


                // ===================================
                // CUSTOMER
                // ===================================

                io.to(
                    `customer_${order.customer_id}`
                ).emit(

                    "orderStatusUpdated",

                    {

                        orderId:
                            orderId,

                        status:
                            "Delivered"

                    }

                );


                // ===================================
                // RESTAURANT
                // ===================================

                io.to(
                    `partner_${order.partner_id}`
                ).emit(

                    "orderStatusUpdated",

                    {

                        orderId:
                            orderId,

                        status:
                            "Delivered"

                    }

                );


                // ===================================
                // RIDER
                // ===================================

                io.to(
                    `delivery_${deliveryId}`
                ).emit(

                    "deliveryStatusUpdated",

                    {

                        orderId:
                            orderId,

                        status:
                            "Delivered"

                    }

                );


                // ===================================
                // WALLET UPDATE
                // ===================================

                io.to(
                    `delivery_${deliveryId}`
                ).emit(

                    "walletUpdated",

                    {

                        orderId:
                            orderId,

                        amount:
                            earning,

                        walletBalance:
                            newBalance

                    }

                );

            }


            // ===================================
            // SUCCESS LOG
            // ===================================

            console.log(
                "================================="
            );

            console.log(
                "✅ DELIVERY COMPLETED"
            );

            console.log(
                "Order:",
                orderId
            );

            console.log(
                "Rider:",
                deliveryId
            );

            console.log(
                "💰 Delivery Fee:",
                earning
            );

            console.log(
                "💰 New Wallet Balance:",
                newBalance
            );

            console.log(
                "================================="
            );


            // ===================================
            // RESPONSE
            // ===================================

            return res.json({

                success: true,

                message:
                    "Delivery completed successfully.",

                orderId:
                    orderId,

                deliveryId:
                    deliveryId,

                delivery_status:
                    "Delivered",

                earning:
                    earning,

                walletBalance:
                    newBalance

            });

        }


        catch (err) {

            console.log(
                "❌ VERIFY OTP / WALLET ERROR:",
                err
            );


            // ===================================
            // ROLLBACK
            // ===================================

            if (connection) {

                try {

                    await connection.rollback();

                }

                catch (rollbackError) {

                    console.log(
                        "Rollback Error:",
                        rollbackError
                    );

                }

            }


            return res.status(500).json({

                success: false,

                message:
                    "Failed to complete delivery."

            });

        }


        finally {

            // ===================================
            // RELEASE CONNECTION
            // ===================================

            if (connection) {

                connection.release();

            }

        }

    }

);


// =======================================
// EXPORT ROUTER
// =======================================

module.exports = router;