const express = require("express");
const router = express.Router();
const db = require("../config/db");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendWhatsAppOTP } = require("../services/whatsappService");

const codRazorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const deliveryPasswordOtps = new Map();
const deliveryPasswordResetTokens = new Map();

const DELIVERY_GEOFENCE_RADIUS_METERS = Math.max(
    30,
    Math.min(500, Number(process.env.DELIVERY_GEOFENCE_RADIUS_METERS || 150))
);
const DELIVERY_MAX_GPS_ACCURACY_METERS = 100;
const DELIVERY_MAX_GPS_AGE_MS = 30 * 1000;

function requireDeliveryAuth(req, res, next) {
    const bearer = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    if (!bearer || !process.env.JWT_SECRET) {
        return res.status(401).json({ success: false, message: "Please sign in again to continue." });
    }
    try {
        const payload = jwt.verify(bearer[1], process.env.JWT_SECRET);
        const deliveryId = Number(payload?.sub);
        if (payload?.role !== "delivery_partner" || !Number.isInteger(deliveryId) || deliveryId <= 0) {
            return res.status(401).json({ success: false, message: "Your delivery session is invalid. Please sign in again." });
        }
        const requestedId = req.body?.deliveryId;
        if (requestedId != null && Number(requestedId) !== deliveryId) {
            return res.status(403).json({ success: false, message: "This action belongs to another rider." });
        }
        req.deliveryPartnerId = deliveryId;
        req.body = { ...(req.body || {}), deliveryId };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Your delivery session expired. Please sign in again." });
    }
}

function validateArrivalGps({ latitude, longitude, accuracy, timestamp }) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const gpsAccuracy = Number(accuracy);
    const gpsTimestamp = Number(timestamp);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { valid: false, message: "We could not read your GPS position. Refresh your location and try again." };
    }
    if (!Number.isFinite(gpsAccuracy) || gpsAccuracy <= 0 || gpsAccuracy > DELIVERY_MAX_GPS_ACCURACY_METERS) {
        return { valid: false, message: "Your GPS accuracy is too weak. Move to an open area and wait for a more accurate location." };
    }
    const age = Date.now() - gpsTimestamp;
    if (!Number.isFinite(gpsTimestamp) || age > DELIVERY_MAX_GPS_AGE_MS || age < -10000) {
        return { valid: false, message: "Your GPS location is out of date. Refresh your location and try again." };
    }
    return { valid: true, latitude: lat, longitude: lng };
}

router.get("/maps-config", (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, message: "Map service is not configured." });
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, apiKey });
});

function normalizeDeliveryPhone(phone) {
    let normalized = String(phone || "").replace(/\D/g, "");
    if (normalized.startsWith("91") && normalized.length === 12) {
        normalized = normalized.slice(2);
    }
    return normalized;
}

function readDeliveryPasswordRequest(req) {
    const mobile = normalizeDeliveryPhone(req.body?.mobile);
    return { mobile, valid: /^\d{10}$/.test(mobile) };
}

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

router.post("/password/send-otp", async (req, res) => {
    const request = readDeliveryPasswordRequest(req);
    if (!request.valid) {
        return res.status(400).json({ success: false, message: "Enter your registered 10-digit mobile number." });
    }

    try {
        const [partners] = await db.promise().query(
            "SELECT id, mobile FROM delivery_partners WHERE mobile=? LIMIT 1",
            [request.mobile]
        );
        const partner = partners[0];
        if (!partner || normalizeDeliveryPhone(partner.mobile) !== request.mobile) {
            return res.status(400).json({ success: false, message: "No delivery account matches that mobile number." });
        }

        const now = Date.now();
        const existing = deliveryPasswordOtps.get(request.mobile);
        if (existing && now - existing.sentAt < 60_000) {
            return res.status(429).json({ success: false, message: "Please wait one minute before requesting another OTP." });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        deliveryPasswordOtps.set(request.mobile, {
            partnerId: partner.id,
            mobile: request.mobile,
            otp,
            sentAt: now,
            expiresAt: now + 5 * 60_000,
            attempts: 0
        });

        const result = await sendWhatsAppOTP(request.mobile, otp);
        if (!result.success) {
            deliveryPasswordOtps.delete(request.mobile);
            console.error("Delivery password reset WhatsApp OTP delivery failed.");
            return res.status(502).json({ success: false, message: "Could not send the WhatsApp OTP. Please try again." });
        }
        return res.json({ success: true, message: "OTP sent to your registered WhatsApp number." });
    } catch (error) {
        console.error("DELIVERY PASSWORD OTP SEND ERROR:", error.message);
        return res.status(500).json({ success: false, message: "Unable to send the password reset OTP." });
    }
});

router.post("/password/verify-otp", (req, res) => {
    const request = readDeliveryPasswordRequest(req);
    const otp = String(req.body?.otp || "").trim();
    if (!request.valid || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: "Enter the six-digit OTP." });
    }

    const saved = deliveryPasswordOtps.get(request.mobile);
    if (!saved) {
        return res.status(400).json({ success: false, message: "Request a new OTP first." });
    }
    if (Date.now() > saved.expiresAt) {
        deliveryPasswordOtps.delete(request.mobile);
        return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
    }
    if (saved.otp !== otp) {
        saved.attempts += 1;
        if (saved.attempts >= 5) deliveryPasswordOtps.delete(request.mobile);
        return res.status(400).json({ success: false, message: saved.attempts >= 5 ? "Too many attempts. Request a new OTP." : "That OTP is incorrect." });
    }

    deliveryPasswordOtps.delete(request.mobile);
    const resetToken = crypto.randomBytes(32).toString("hex");
    deliveryPasswordResetTokens.set(resetToken, {
        partnerId: saved.partnerId,
        mobile: request.mobile,
        expiresAt: Date.now() + 5 * 60_000
    });
    return res.json({ success: true, resetToken, message: "Mobile verified. You can now set a new password." });
});

router.post("/password/reset", async (req, res) => {
    const request = readDeliveryPasswordRequest(req);
    const resetToken = String(req.body?.resetToken || "");
    const password = String(req.body?.password || "");
    const tokenData = deliveryPasswordResetTokens.get(resetToken);

    if (!request.valid || !tokenData || tokenData.mobile !== request.mobile || Date.now() > tokenData.expiresAt) {
        if (resetToken) deliveryPasswordResetTokens.delete(resetToken);
        return res.status(400).json({ success: false, message: "Verify your mobile number again before changing the password." });
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.promise().query(
            "UPDATE delivery_partners SET password=? WHERE id=? AND mobile=?",
            [hash, tokenData.partnerId, request.mobile]
        );
        if (result.affectedRows !== 1) {
            deliveryPasswordResetTokens.delete(resetToken);
            return res.status(400).json({ success: false, message: "Delivery account not found. Verify your mobile again." });
        }
        deliveryPasswordResetTokens.delete(resetToken);
        return res.json({ success: true, message: "Password changed successfully." });
    } catch (error) {
        console.error("DELIVERY PASSWORD RESET ERROR:", error.message);
        return res.status(500).json({ success: false, message: "Unable to change the password right now." });
    }
});

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

                const storedPassword = String(partner.password || "");
                const isBcryptPassword = /^\$2[aby]\$/.test(storedPassword);
                const passwordMatches = isBcryptPassword
                    ? bcrypt.compareSync(password, storedPassword)
                    : storedPassword === password;

                if (!passwordMatches) {

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

                if (!process.env.JWT_SECRET) {
                    return res.status(503).json({ success: false, message: "Secure delivery sign-in is not configured. Contact support." });
                }
                const token = jwt.sign({ sub: String(partner.id), role: "delivery_partner" }, process.env.JWT_SECRET, { expiresIn: "7d" });

                return res.json({

                    success: true,

                    token,

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

                r.longitude AS restaurant_lng,

                c.method AS cod_collected_method,

                c.collected_at AS cod_collected_at,

                c.amount AS cod_collected_amount

             FROM orders o

             LEFT JOIN restaurants r
                ON r.id = o.partner_id

             LEFT JOIN delivery_cod_collections c
                ON c.order_id = o.id AND c.status='collected'

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
                            `You are ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`} from the restaurant. Please move closer to within ${allowedDistance} m to mark arrival.`,

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
            longitude,
            customerLatitude,
            customerLongitude
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

            async (err, result) => {

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

                const validCoordinatePair = (lat, lng) =>
                    lat !== null && lat !== undefined && lat !== "" &&
                    lng !== null && lng !== undefined && lng !== "" &&
                    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
                    Number(lat) >= -90 && Number(lat) <= 90 &&
                    Number(lng) >= -180 && Number(lng) <= 180;

                let customerLat = order.customer_lat;
                let customerLng = order.customer_lng;

                if (!validCoordinatePair(customerLat, customerLng) && validCoordinatePair(customerLatitude, customerLongitude)) {
                    customerLat = Number(customerLatitude);
                    customerLng = Number(customerLongitude);
                    await db.promise().query(
                        `UPDATE orders SET customer_lat=?, customer_lng=? WHERE id=? AND delivery_partner_id=?`,
                        [customerLat, customerLng, orderId, deliveryId]
                    );
                }

                if (!validCoordinatePair(customerLat, customerLng)) {
                    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
                    const rawCustomerAddress = String(order.address || order.customer_address || order.delivery_address || order.full_address || "").trim();
                    const customerAddress = /\b(India|भारत)\b/i.test(rawCustomerAddress)
                        ? rawCustomerAddress
                        : `${rawCustomerAddress}, India`;
                    if (!mapsApiKey || !rawCustomerAddress) {
                        return res.json({ success: false, message: "Customer address or map service is not available." });
                    }
                    try {
                        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(customerAddress)}&key=${encodeURIComponent(mapsApiKey)}`;
                        const geocodeResponse = await fetch(geocodeUrl);
                        const geocodeData = await geocodeResponse.json();
                        const point = geocodeData.status === "OK" ? geocodeData.results?.[0]?.geometry?.location : null;
                        if (!geocodeResponse.ok || !point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
                            console.error("CUSTOMER ADDRESS GEOCODE FAILED:", geocodeData.status, customerAddress);
                            return res.json({ success: false, message: "Could not locate the customer address on the map." });
                        }
                        customerLat = Number(point.lat);
                        customerLng = Number(point.lng);
                        await db.promise().query(
                            `UPDATE orders SET customer_lat=?, customer_lng=? WHERE id=? AND delivery_partner_id=?`,
                            [customerLat, customerLng, orderId, deliveryId]
                        );
                    } catch (geocodeError) {
                        console.error("CUSTOMER ADDRESS GEOCODE ERROR:", geocodeError);
                        return res.json({ success: false, message: "Unable to locate the customer address right now." });
                    }
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
                            `You are ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`} from the customer. Move closer to mark arrival.`,

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
// CREATE THE ORDER-SPECIFIC RAZORPAY UPI QR
// =======================================
router.post("/create-cod-payment/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    const deliveryId = Number(req.body?.deliveryId);
    let connection;
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(deliveryId) || deliveryId <= 0) {
        return res.status(400).json({ success: false, message: "A valid order and rider are required." });
    }
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            `SELECT * FROM orders WHERE id=? AND delivery_partner_id=? FOR UPDATE`,
            [orderId, deliveryId]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "This order is not assigned to this rider." });
        }
        const order = rows[0];
        if (String(order.payment || "").trim().toUpperCase() !== "COD" || String(order.delivery_status || "").trim().toLowerCase().replace(/[\s_-]+/g, "") !== "reachedcustomer") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "COD UPI payment is available after reaching the customer." });
        }
        const amount = Number(order.grand_total || 0);
        if (!Number.isFinite(amount) || amount <= 0 || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            await connection.rollback();
            return res.status(503).json({ success: false, message: "Razorpay is not configured for delivery collection." });
        }
        const [existing] = await connection.query(
            `SELECT id, status, method, amount, razorpay_order_id FROM delivery_cod_collections WHERE order_id=? FOR UPDATE`,
            [orderId]
        );
        if (existing.some(row => row.status === "collected")) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Payment is already recorded for this order." });
        }
        const expectedPaise = Math.round(amount * 100);
        const activeCollection = existing.find(row => row.status === "pending" && row.method === "razorpay_upi" && Number(row.amount) === amount);
        if (activeCollection?.razorpay_order_id) {
            if (String(activeCollection.razorpay_order_id).startsWith("qr_")) {
                const activeQr = await codRazorpay.qrCode.fetch(activeCollection.razorpay_order_id);
                if (activeQr.status === "active" && activeQr.image_url) {
                    await connection.commit();
                    return res.json({ success: true, qr_code: { id: activeQr.id, image_url: activeQr.image_url, payment_amount: activeQr.payment_amount, close_by: activeQr.close_by }, amount });
                }
            } else if (String(activeCollection.razorpay_order_id).startsWith("plink_")) {
                const activeLink = await codRazorpay.paymentLink.fetch(activeCollection.razorpay_order_id);
                if (activeLink.status === "paid" && Number(activeLink.amount_paid) === expectedPaise) {
                    const linkPayments = Array.isArray(activeLink.payments) ? activeLink.payments : [];
                    const paid = linkPayments.find(payment => payment.status === "captured" && Number(payment.amount) === expectedPaise);
                    if (paid?.payment_id) {
                        await connection.query(
                            `UPDATE delivery_cod_collections SET status='collected', razorpay_payment_id=?, collected_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'`,
                            [paid.payment_id, activeCollection.id]
                        );
                        await connection.commit();
                        return res.json({ success: true, paid: true, method: "razorpay_upi", amount });
                    }
                }
                if (["created", "issued"].includes(String(activeLink.status)) && activeLink.short_url) {
                    const imageUrl = await QRCode.toDataURL(activeLink.short_url, { width: 240, margin: 2 });
                    await connection.commit();
                    return res.json({ success: true, qr_code: { id: activeLink.id, image_url: imageUrl, payment_amount: expectedPaise, close_by: activeLink.expire_by }, payment_url: activeLink.short_url, amount });
                }
            }
        }

        let qrCode;
        let paymentUrl = null;
        try {
            qrCode = await codRazorpay.qrCode.create({
                type: "upi_qr",
                name: `DARVOZ Order #${orderId}`,
                usage: "single_use",
                fixed_amount: true,
                payment_amount: expectedPaise,
                description: `COD payment for DARVOZ order #${orderId}`,
                close_by: Math.floor(Date.now() / 1000) + (2 * 60 * 60),
                notes: { order_id: String(orderId), delivery_partner_id: String(deliveryId), payment_type: "COD_UPI_QR" }
            });
        } catch (qrError) {
            const qrDescription = String(qrError?.error?.description || qrError?.message || "");
            if (!/requested url was not found|not enabled|on.?demand|feature/i.test(qrDescription)) throw qrError;

            // Some Razorpay accounts do not have the QR Codes API activated.
            // Fall back to a single-use UPI Payment Link and render its URL as a
            // local QR image. Payment is still verified against Razorpay below.
            const link = await codRazorpay.paymentLink.create({
                amount: expectedPaise,
                currency: "INR",
                accept_partial: false,
                reference_id: `COD-${orderId}-${Date.now()}`,
                description: `COD payment for DARVOZ order #${orderId}`,
                upi_link: true,
                notify: { sms: false, email: false },
                reminder_enable: false,
                expire_by: Math.floor(Date.now() / 1000) + (2 * 60 * 60),
                notes: { order_id: String(orderId), delivery_partner_id: String(deliveryId), payment_type: "COD_UPI_LINK" }
            });
            if (!link.id || !link.short_url) throw new Error("Razorpay did not return a usable UPI payment link.");
            paymentUrl = link.short_url;
            qrCode = {
                id: link.id,
                image_url: await QRCode.toDataURL(link.short_url, { width: 240, margin: 2 }),
                payment_amount: expectedPaise,
                close_by: link.expire_by
            };
        }
        await connection.query(
            `INSERT INTO delivery_cod_collections
                (order_id, delivery_partner_id, amount, method, status, razorpay_order_id, razorpay_payment_id)
             VALUES (?, ?, ?, 'razorpay_upi', 'pending', ?, NULL)
             ON DUPLICATE KEY UPDATE delivery_partner_id=VALUES(delivery_partner_id), amount=VALUES(amount),
                method='razorpay_upi', status='pending', razorpay_order_id=VALUES(razorpay_order_id), razorpay_payment_id=NULL`,
            [orderId, deliveryId, amount, qrCode.id]
        );
        await connection.commit();
        return res.json({
            success: true,
            qr_code: { id: qrCode.id, image_url: qrCode.image_url, payment_amount: qrCode.payment_amount, close_by: qrCode.close_by },
            payment_url: paymentUrl,
            amount
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        // Razorpay's SDK error shape varies by API response/version. Preserve the
        // provider's useful diagnostic instead of hiding it behind a generic QR error.
        const providerError = error?.error || error?.response?.body?.error || {};
        const description = String(
            providerError.description ||
            error?.description ||
            error?.message ||
            (typeof error === "string" ? error : "")
        ).trim();
        const code = String(providerError.code || providerError.type || error?.code || "").trim();
        console.error("CREATE COD RAZORPAY QR ERROR:", { code, description });

        let message = description || "Razorpay did not return an error description. Check the server log for CREATE COD RAZORPAY QR ERROR.";
        if (/qr.?code|feature|not enabled|on.?demand|not available for this account|requested url was not found/i.test(description)) {
            message = "Razorpay QR API is unavailable for these account keys. Ask Razorpay Support to activate UPI QR Codes for this account, then retry; cash collection is available meanwhile.";
        } else if (/authentication|invalid.*key|unauthorized|credential/i.test(`${code} ${description}`)) {
            message = "Razorpay rejected the API credentials. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.";
        } else if (!message) {
            message = "Could not create the Razorpay payment QR. Please try again or collect cash.";
        }
        return res.status(503).json({ success: false, message });
    } finally {
        if (connection) connection.release();
    }
});

// Re-render the payload decoded from Razorpay's QR as a plain, unbranded QR.
// The payload is unchanged, so Razorpay still associates scans with the original QR entity.
router.post("/render-cod-qr/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    const deliveryId = Number(req.body?.deliveryId);
    const payload = String(req.body?.payload || "").trim();
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(deliveryId) || deliveryId <= 0 || payload.length > 2048) {
        return res.status(400).json({ success: false, message: "A valid order, rider and UPI QR payload are required." });
    }
    let upiUrl;
    try {
        upiUrl = new URL(payload);
    } catch {
        return res.status(400).json({ success: false, message: "The Razorpay QR did not contain a valid UPI payment payload." });
    }
    const payeeVpa = String(upiUrl.searchParams.get("pa") || "").trim().toLowerCase();
    const expectedVpa = String(process.env.RAZORPAY_UPI_VPA || "darvoz2325166.rxp@rxairtel").trim().toLowerCase();
    const payloadAmount = Number(upiUrl.searchParams.get("am"));
    if (upiUrl.protocol.toLowerCase() !== "upi:" || upiUrl.hostname.toLowerCase() !== "pay" || payeeVpa !== expectedVpa || !Number.isFinite(payloadAmount) || upiUrl.searchParams.get("cu")?.toUpperCase() !== "INR") {
        return res.status(400).json({ success: false, message: "The QR payload does not match the DARVOZ Razorpay UPI account." });
    }
    try {
        const [rows] = await db.promise().query(
            `SELECT o.grand_total, o.payment, o.delivery_status, c.amount, c.status, c.method, c.razorpay_order_id
             FROM orders o JOIN delivery_cod_collections c ON c.order_id=o.id
             WHERE o.id=? AND o.delivery_partner_id=? AND c.delivery_partner_id=? LIMIT 1`,
            [orderId, deliveryId, deliveryId]
        );
        if (!rows.length || String(rows[0].payment || "").trim().toUpperCase() !== "COD" ||
            String(rows[0].delivery_status || "").trim().toLowerCase().replace(/[\s_-]+/g, "") !== "reachedcustomer" ||
            rows[0].status !== "pending" || rows[0].method !== "razorpay_upi" || !String(rows[0].razorpay_order_id || "").startsWith("qr_")) {
            return res.status(409).json({ success: false, message: "There is no active Razorpay QR for this order." });
        }
        const expectedAmount = Number(rows[0].amount || rows[0].grand_total || 0);
        if (Math.round(payloadAmount * 100) !== Math.round(expectedAmount * 100)) {
            return res.status(400).json({ success: false, message: "The UPI QR amount does not match this order." });
        }
        const imageUrl = await QRCode.toDataURL(payload, { width: 480, margin: 4, errorCorrectionLevel: "M" });
        return res.json({ success: true, image_url: imageUrl });
    } catch (error) {
        console.error("RENDER CLEAN COD QR ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not prepare the plain UPI QR image." });
    }
});

// Verify a single-use COD QR with Razorpay before marking the collection paid.
router.post("/verify-cod-qr/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    const deliveryId = Number(req.body?.deliveryId);
    let connection;
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(deliveryId) || deliveryId <= 0) {
        return res.status(400).json({ success: false, message: "A valid order and rider are required." });
    }
    try {
        connection = await db.promise().getConnection();
        const [rows] = await connection.query(
            `SELECT o.payment, o.delivery_status, o.grand_total,
                    c.id AS collection_id, c.amount AS collection_amount,
                    c.status AS collection_status, c.method, c.razorpay_order_id AS qr_code_id
             FROM orders o
             JOIN delivery_cod_collections c ON c.order_id=o.id
             WHERE o.id=? AND o.delivery_partner_id=? AND c.delivery_partner_id=? LIMIT 1`,
            [orderId, deliveryId, deliveryId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: "No Razorpay QR payment was found for this order." });
        const row = rows[0];
        if (String(row.payment || "").trim().toUpperCase() !== "COD" || String(row.delivery_status || "").trim().toLowerCase().replace(/[\s_-]+/g, "") !== "reachedcustomer") {
            return res.status(409).json({ success: false, message: "Customer arrival must be verified before checking payment." });
        }
        if (row.collection_status === "collected") return res.json({ success: true, paid: true, method: row.method });
        if (row.method !== "razorpay_upi" || !/^(qr_|plink_)/.test(String(row.qr_code_id || ""))) {
            return res.status(409).json({ success: false, message: "There is no active Razorpay payment request for this order." });
        }

        const expectedPaise = Math.round(Number(row.collection_amount || row.grand_total || 0) * 100);
        let paidPayment;
        if (String(row.qr_code_id).startsWith("qr_")) {
            const payments = await codRazorpay.qrCode.fetchAllPayments(row.qr_code_id, { count: 100 });
            paidPayment = (payments.items || []).find(payment =>
                payment.status === "captured" && payment.captured === true && Number(payment.amount) === expectedPaise
            );
        } else {
            const paymentLink = await codRazorpay.paymentLink.fetch(row.qr_code_id);
            const linkPayments = Array.isArray(paymentLink.payments) ? paymentLink.payments : [];
            const linkPayment = linkPayments.find(payment => payment.status === "captured" && Number(payment.amount) === expectedPaise);
            if (paymentLink.status === "paid" && Number(paymentLink.amount_paid) === expectedPaise && linkPayment?.payment_id) {
                const fetchedPayment = await codRazorpay.payments.fetch(linkPayment.payment_id);
                if (fetchedPayment.status === "captured" && fetchedPayment.captured === true && Number(fetchedPayment.amount) === expectedPaise) {
                    paidPayment = fetchedPayment;
                }
            }
        }
        if (!paidPayment) return res.json({ success: true, paid: false, message: "Payment has not been received yet." });

        await connection.beginTransaction();
        const [locked] = await connection.query(
            `SELECT id, status, razorpay_order_id FROM delivery_cod_collections
             WHERE id=? AND order_id=? AND delivery_partner_id=? FOR UPDATE`,
            [row.collection_id, orderId, deliveryId]
        );
        if (!locked.length || locked[0].razorpay_order_id !== row.qr_code_id) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "The payment QR changed. Refresh and check the active QR." });
        }
        if (locked[0].status !== "collected") {
            await connection.query(
                `UPDATE delivery_cod_collections SET status='collected', razorpay_payment_id=?, collected_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'`,
                [paidPayment.id, row.collection_id]
            );
        }
        await connection.commit();
        return res.json({ success: true, paid: true, method: "razorpay_upi", amount: expectedPaise / 100 });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("VERIFY COD QR ERROR:", error);
        return res.status(503).json({ success: false, message: "Could not verify the Razorpay QR payment right now." });
    } finally {
        if (connection) connection.release();
    }
});

// =======================================
// RECORD COD COLLECTION AT CUSTOMER
// A COD order may be settled with cash or Razorpay UPI.
// UPI is verified against Razorpay before it is recorded.
// =======================================
router.post("/collect-cod/:orderId", async (req, res) => {
    const orderId = Number(req.params.orderId);
    const deliveryId = Number(req.body?.deliveryId);
    const method = String(req.body?.method || "").toLowerCase();
    let connection;

    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(deliveryId) || deliveryId <= 0 || !["cash", "razorpay_upi"].includes(method)) {
        return res.status(400).json({ success: false, message: "A valid order, rider, and COD payment method are required." });
    }

    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            `SELECT * FROM orders WHERE id=? AND delivery_partner_id=? FOR UPDATE`,
            [orderId, deliveryId]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "This order is not assigned to this rider." });
        }
        const order = rows[0];
        if (String(order.payment || "").trim().toUpperCase() !== "COD") {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "This order is not Cash on Delivery." });
        }
        if (String(order.delivery_status || "").trim().toLowerCase().replace(/[\s_-]+/g, "") !== "reachedcustomer") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Reach the customer location before collecting payment." });
        }

        const amount = Number(order.grand_total || 0);
        let razorpayOrderId = null;
        let razorpayPaymentId = null;
        if (method === "razorpay_upi") {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !process.env.RAZORPAY_KEY_SECRET) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: "Razorpay payment verification details are missing." });
            }
            const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
            const supplied = Buffer.from(String(razorpay_signature));
            const expectedBuffer = Buffer.from(expected);
            if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: "Razorpay payment signature is invalid." });
            }
            const payment = await codRazorpay.payments.fetch(razorpay_payment_id);
            const expectedPaise = Math.round(amount * 100);
            if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== expectedPaise || payment.status !== "captured") {
                await connection.rollback();
                return res.status(400).json({ success: false, message: "Razorpay has not confirmed the full order payment." });
            }
            razorpayOrderId = razorpay_order_id;
            razorpayPaymentId = razorpay_payment_id;
        }

        const [existing] = await connection.query(
            `SELECT id, delivery_partner_id, method, amount, status, razorpay_order_id
             FROM delivery_cod_collections WHERE order_id=? FOR UPDATE`,
            [orderId]
        );
        if (existing.some(row => row.status === "collected")) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Payment has already been recorded for this order." });
        }
        if (method === "cash") {
            const pendingQr = existing.find(row => row.status === "pending" && /^(qr_|plink_)/.test(String(row.razorpay_order_id || "")));
            if (pendingQr) {
                const expectedPaise = Math.round(amount * 100);
                let alreadyPaid;
                if (String(pendingQr.razorpay_order_id).startsWith("qr_")) {
                    const qrPayments = await codRazorpay.qrCode.fetchAllPayments(pendingQr.razorpay_order_id, { count: 100 });
                    alreadyPaid = (qrPayments.items || []).find(payment =>
                        payment.status === "captured" && payment.captured === true && Number(payment.amount) === expectedPaise
                    );
                } else {
                    const paymentLink = await codRazorpay.paymentLink.fetch(pendingQr.razorpay_order_id);
                    const linkPayments = Array.isArray(paymentLink.payments) ? paymentLink.payments : [];
                    const linkPayment = linkPayments.find(payment => payment.status === "captured" && Number(payment.amount) === expectedPaise);
                    if (paymentLink.status === "paid" && Number(paymentLink.amount_paid) === expectedPaise && linkPayment?.payment_id) {
                        const fetchedPayment = await codRazorpay.payments.fetch(linkPayment.payment_id);
                        if (fetchedPayment.status === "captured" && fetchedPayment.captured === true && Number(fetchedPayment.amount) === expectedPaise) alreadyPaid = fetchedPayment;
                    }
                }
                if (alreadyPaid) {
                    await connection.query(
                        `UPDATE delivery_cod_collections
                         SET method='razorpay_upi', status='collected', razorpay_payment_id=?, collected_at=CURRENT_TIMESTAMP
                         WHERE id=? AND status='pending'`,
                        [alreadyPaid.id, pendingQr.id]
                    );
                    await connection.commit();
                    return res.json({ success: true, message: "Razorpay QR payment was already received.", amount, method: "razorpay_upi" });
                }
                try {
                    if (String(pendingQr.razorpay_order_id).startsWith("qr_")) {
                        const qrStatus = await codRazorpay.qrCode.fetch(pendingQr.razorpay_order_id);
                        if (qrStatus.status === "active") await codRazorpay.qrCode.close(pendingQr.razorpay_order_id);
                    } else {
                        const linkStatus = await codRazorpay.paymentLink.fetch(pendingQr.razorpay_order_id);
                        if (["created", "issued"].includes(String(linkStatus.status))) {
                            await codRazorpay.paymentLink.cancel(pendingQr.razorpay_order_id);
                        }
                    }
                } catch (qrCloseError) {
                    await connection.rollback();
                    console.error("CLOSE COD QR BEFORE CASH ERROR:", qrCloseError);
                    return res.status(503).json({ success: false, message: "Could not safely close the Razorpay QR. Check payment status before collecting cash." });
                }
            }
        }
        if (method === "razorpay_upi") {
            const pending = existing.find(row => row.status === "pending");
            if (!pending || Number(pending.delivery_partner_id) !== deliveryId || pending.razorpay_order_id !== razorpayOrderId || Number(pending.amount) !== amount) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: "This UPI payment was not started for this order. Create a fresh payment request." });
            }
            await connection.query(
                `UPDATE delivery_cod_collections
                 SET status='collected', razorpay_payment_id=?, collected_at=CURRENT_TIMESTAMP
                 WHERE id=? AND status='pending'`,
                [razorpayPaymentId, pending.id]
            );
        } else if (existing.length) {
            await connection.query(
                `UPDATE delivery_cod_collections
                 SET delivery_partner_id=?, amount=?, method='cash', status='collected',
                     razorpay_order_id=NULL, razorpay_payment_id=NULL, collected_at=CURRENT_TIMESTAMP
                 WHERE id=? AND status='pending'`,
                [deliveryId, amount, existing[0].id]
            );
        } else {
            await connection.query(
                `INSERT INTO delivery_cod_collections
                    (order_id, delivery_partner_id, amount, method, status, razorpay_order_id, razorpay_payment_id)
                 VALUES (?, ?, ?, 'cash', 'collected', NULL, NULL)`,
                [orderId, deliveryId, amount]
            );
        }
        await connection.commit();
        return res.json({ success: true, message: "COD payment recorded. Verify the customer OTP to complete delivery.", amount, method });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("COD COLLECTION ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not record payment. Check the COD collection database setup." });
    } finally {
        if (connection) connection.release();
    }
});

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

            if (String(order.payment || "").trim().toUpperCase() === "COD") {
                const [collections] = await connection.query(
                    `SELECT id FROM delivery_cod_collections
                     WHERE order_id=? AND delivery_partner_id=? AND status='collected' LIMIT 1`,
                    [orderId, deliveryId]
                );
                if (!collections.length) {
                    await connection.rollback();
                    return res.status(409).json({
                        success: false,
                        message: "Record the COD payment before completing this delivery."
                    });
                }
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
                    order.delivery_rider_earning == null
                        ? order.delivery_fee || 0
                        : order.delivery_rider_earning || 0
                );
            const adminDeliveryShare = Number(order.admin_delivery_fee || 0);


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

            if (adminDeliveryShare > 0) {
                await connection.query(`
                    INSERT INTO wallets (user_type, user_id, balance)
                    VALUES ('admin', 1, 0)
                    ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)
                `);
                await connection.query(`
                    UPDATE wallets SET balance=balance+?
                    WHERE user_type='admin' AND user_id=1
                `, [adminDeliveryShare]);
                await connection.query(`
                    INSERT INTO wallet_transactions
                        (user_type, user_id, order_id, amount, type, transaction_type)
                    VALUES ('admin', 1, ?, ?, 'Credit', 'Delivery Fee Share')
                `, [orderId, adminDeliveryShare]);
            }

            await connection.query(`
                UPDATE orders
                SET delivery_wallet_credited=1,
                    admin_delivery_wallet_credited=?
                WHERE id=?
            `, [adminDeliveryShare > 0 ? 1 : 0, orderId]);


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
