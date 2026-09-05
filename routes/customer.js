const express = require("express");
const router = express.Router();
const db = require("../config/db");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");

// ==========================================
// GENERATE REFERRAL CODE
// ==========================================

function generateReferralCode() {
    return crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();
}

// ==========================================
// GENERATE UNIQUE REFERRAL CODE
// ==========================================

function createUniqueReferralCode(callback) {

    const code = generateReferralCode();

    db.query(
        `SELECT id
         FROM customers
         WHERE referral_code=?
         LIMIT 1`,
        [code],
        (err, result) => {

            if (err) {

                console.log(
                    "REFERRAL CODE CHECK ERROR:",
                    err
                );

                return callback(err);
            }

            if (result.length > 0) {

                return createUniqueReferralCode(
                    callback
                );
            }

            callback(
                null,
                code
            );
        }
    );
}

// ==========================================
// CLEAN MOBILE NUMBER
// ==========================================

function cleanMobileNumber(mobile) {

    let cleanMobile =
        String(mobile || "")
            .replace(/\D/g, "");

    if (
        cleanMobile.startsWith("91") &&
        cleanMobile.length === 12
    ) {

        cleanMobile =
            cleanMobile.substring(2);
    }

    return cleanMobile;
}

// ==========================================
// CUSTOMER REGISTER
// ==========================================

router.post(
    "/register",
    (req, res) => {

        const {
            name,
            mobile,
            email,
            gender,
            referralCode
        } = req.body;

        // ==========================================
        // BASIC VALIDATION
        // ==========================================

        if (
            !name ||
            !mobile ||
            !email ||
            !gender
        ) {

            return res.json({
                success: false,
                message:
                    "Please complete all required fields."
            });
        }

        const cleanName =
            String(name).trim();

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();

        const cleanMobile =
            cleanMobileNumber(mobile);

        const cleanGender =
            String(gender).trim();

        const cleanReferralCode =
            referralCode
                ? String(referralCode)
                    .trim()
                    .toUpperCase()
                : "";

        // ==========================================
        // VALIDATE NAME
        // ==========================================

        if (cleanName.length < 2) {

            return res.json({
                success: false,
                message:
                    "Please enter a valid name."
            });
        }

        // ==========================================
        // VALIDATE MOBILE
        // ==========================================

        if (
            !/^[0-9]{10}$/.test(
                cleanMobile
            )
        ) {

            return res.json({
                success: false,
                message:
                    "Please enter a valid mobile number."
            });
        }

        // ==========================================
        // VALIDATE EMAIL
        // ==========================================

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(cleanEmail)
        ) {

            return res.json({
                success: false,
                message:
                    "Please enter a valid email address."
            });
        }

        // ==========================================
        // VALIDATE GENDER
        // ==========================================

        const allowedGenders = [
            "Male",
            "Female",
            "Other"
        ];

        if (
            !allowedGenders.includes(
                cleanGender
            )
        ) {

            return res.json({
                success: false,
                message:
                    "Please select a valid gender."
            });
        }

        // ==========================================
        // CHECK MOBILE
        // ==========================================

        db.query(

            `SELECT id
             FROM customers
             WHERE mobile=?
             LIMIT 1`,

            [cleanMobile],

            (err, result) => {

                if (err) {

                    console.log(
                        "REGISTER MOBILE CHECK ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }

                // ==========================================
                // MOBILE ALREADY EXISTS
                // ==========================================

                if (result.length > 0) {

                    return res.json({
                        success: false,
                        message:
                            "Mobile number already registered."
                    });
                }

                // ==========================================
                // FIND REFERRER
                // ==========================================

                const findReferrer =
                    (callback) => {

                        // No referral
                        if (!cleanReferralCode) {

                            return callback(
                                null,
                                null
                            );
                        }

                        db.query(

                            `SELECT id
                             FROM customers
                             WHERE referral_code=?
                             LIMIT 1`,

                            [cleanReferralCode],

                            (err, result) => {

                                if (err) {

                                    console.log(
                                        "REFERRER CHECK ERROR:",
                                        err
                                    );

                                    return callback(
                                        err
                                    );
                                }

                                // Invalid referral
                                // Registration continues
                                if (
                                    result.length === 0
                                ) {

                                    return callback(
                                        null,
                                        null
                                    );
                                }

                                callback(
                                    null,
                                    result[0].id
                                );
                            }
                        );
                    };

                // ==========================================
                // FIND REFERRER
                // ==========================================

                findReferrer(

                    (
                        referrerError,
                        referrerId
                    ) => {

                        if (referrerError) {

                            return res.status(500).json({
                                success: false,
                                message:
                                    "Referral verification failed."
                            });
                        }

                        // ==========================================
                        // GENERATE NEW REFERRAL CODE
                        // ==========================================

                        createUniqueReferralCode(

                            (
                                codeError,
                                newReferralCode
                            ) => {

                                if (codeError) {

                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            "Unable to generate referral code."
                                    });
                                }

                                // ==========================================
                                // INSERT CUSTOMER
                                // NEW CUSTOMER = 500 COINS
                                // ==========================================

                                db.query(

                                    `INSERT INTO customers
                                    (
                                        name,
                                        mobile,
                                        email,
                                        gender,
                                        password,
                                        is_verified,
                                        coins,
                                        referral_code,
                                        referred_by
                                    )
                                    VALUES
                                    (
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        NULL,
                                        1,
                                        500,
                                        ?,
                                        ?
                                    )`,

                                    [
                                        cleanName,
                                        cleanMobile,
                                        cleanEmail,
                                        cleanGender,
                                        newReferralCode,
                                        referrerId || null
                                    ],

                                    (
                                        err,
                                        insertResult
                                    ) => {

                                        if (err) {

                                            console.log(
                                                "CUSTOMER INSERT ERROR:",
                                                err
                                            );

                                            return res.status(500).json({
                                                success: false,
                                                message:
                                                    "Registration Failed"
                                            });
                                        }

                                        const newCustomerId =
                                            insertResult.insertId;

                                        // ==========================================
                                        // NO REFERRAL
                                        // ==========================================

                                        if (!referrerId) {

                                            return res.json({

                                                success: true,

                                                message:
                                                    "Registration Successful",

                                                customer: {

                                                    id:
                                                        newCustomerId,

                                                    name:
                                                        cleanName,

                                                    mobile:
                                                        cleanMobile,

                                                    email:
                                                        cleanEmail,

                                                    gender:
                                                        cleanGender,

                                                    coins:
                                                        500,

                                                    referralCode:
                                                        newReferralCode
                                                },

                                                referral: {

                                                    applied:
                                                        false
                                                }
                                            });
                                        }

                                        // ==========================================
                                        // VALID REFERRAL
                                        // REFERRER +1000
                                        // NEW CUSTOMER 500
                                        // ==========================================

                                        db.query(

                                            `UPDATE customers
                                             SET coins = coins + 1000
                                             WHERE id=?`,

                                            [referrerId],

                                            (err) => {

                                                if (err) {

                                                    console.log(
                                                        "REFERRER COIN UPDATE ERROR:",
                                                        err
                                                    );

                                                    // Registration succeeded.
                                                    // Customer already has 500 coins.

                                                    return res.json({

                                                        success: true,

                                                        message:
                                                            "Registration Successful",

                                                        customer: {

                                                            id:
                                                                newCustomerId,

                                                            name:
                                                                cleanName,

                                                            mobile:
                                                                cleanMobile,

                                                            email:
                                                                cleanEmail,

                                                            gender:
                                                                cleanGender,

                                                            coins:
                                                                500,

                                                            referralCode:
                                                                newReferralCode
                                                        },

                                                        referral: {

                                                            applied:
                                                                false
                                                        }
                                                    });
                                                }

                                                // ==========================================
                                                // RECORD REFERRAL HISTORY
                                                // ==========================================

                                                db.query(

                                                    `INSERT INTO referral_rewards
                                                    (
                                                        referrer_id,
                                                        referred_customer_id,
                                                        referrer_coins,
                                                        referred_coins
                                                    )
                                                    VALUES
                                                    (
                                                        ?,
                                                        ?,
                                                        1000,
                                                        500
                                                    )`,

                                                    [
                                                        referrerId,
                                                        newCustomerId
                                                    ],

                                                    (rewardErr) => {

                                                        if (rewardErr) {

                                                            console.log(
                                                                "REFERRAL HISTORY ERROR:",
                                                                rewardErr
                                                            );

                                                            // Referrer already received
                                                            // 1000 coins.
                                                            // Do not give another reward.

                                                            return res.json({

                                                                success: true,

                                                                message:
                                                                    "Registration Successful",

                                                                customer: {

                                                                    id:
                                                                        newCustomerId,

                                                                    name:
                                                                        cleanName,

                                                                    mobile:
                                                                        cleanMobile,

                                                                    email:
                                                                        cleanEmail,

                                                                    gender:
                                                                        cleanGender,

                                                                    coins:
                                                                        500,

                                                                    referralCode:
                                                                        newReferralCode
                                                                },

                                                                referral: {

                                                                    applied:
                                                                        true,

                                                                    referrerReward:
                                                                        1000,

                                                                    customerReward:
                                                                        500,

                                                                    historyRecorded:
                                                                        false
                                                                }
                                                            });
                                                        }

                                                        // ==========================================
                                                        // SEND REFERRER NOTIFICATION
                                                        // ==========================================

                                                        db.query(

                                                            `INSERT INTO customer_notifications
                                                            (
                                                                customer_id,
                                                                type,
                                                                title,
                                                                message,
                                                                is_read
                                                            )
                                                            VALUES
                                                            (
                                                                ?,
                                                                ?,
                                                                ?,
                                                                ?,
                                                                0
                                                            )`,

                                                            [
                                                                referrerId,

                                                                "referral",

                                                                "🎉 Referral Reward Earned!",

                                                                "Your friend joined DARVOZ using your referral code. You earned 1000 DARVOZ Coins!"
                                                            ],

                                                            (
                                                                referrerNotificationErr
                                                            ) => {

                                                                if (
                                                                    referrerNotificationErr
                                                                ) {

                                                                    console.log(
                                                                        "REFERRER NOTIFICATION ERROR:",
                                                                        referrerNotificationErr
                                                                    );
                                                                }

                                                                // ==========================================
                                                                // SEND NEW CUSTOMER NOTIFICATION
                                                                // ==========================================

                                                                db.query(

                                                                    `INSERT INTO customer_notifications
                                                                    (
                                                                        customer_id,
                                                                        type,
                                                                        title,
                                                                        message,
                                                                        is_read
                                                                    )
                                                                    VALUES
                                                                    (
                                                                        ?,
                                                                        ?,
                                                                        ?,
                                                                        ?,
                                                                        0
                                                                    )`,

                                                                    [
                                                                        newCustomerId,

                                                                        "referral",

                                                                        "🎁 Welcome Referral Bonus!",

                                                                        "Welcome to DARVOZ! You received 500 DARVOZ Coins for joining with a referral."
                                                                    ],

                                                                    (
                                                                        customerNotificationErr
                                                                    ) => {

                                                                        if (
                                                                            customerNotificationErr
                                                                        ) {

                                                                            console.log(
                                                                                "NEW CUSTOMER NOTIFICATION ERROR:",
                                                                                customerNotificationErr
                                                                            );
                                                                        }

                                                                        // ==========================================
                                                                        // COMPLETE SUCCESS
                                                                        // ==========================================

                                                                        return res.json({

                                                                            success: true,

                                                                            message:
                                                                                "Registration Successful",

                                                                            customer: {

                                                                                id:
                                                                                    newCustomerId,

                                                                                name:
                                                                                    cleanName,

                                                                                mobile:
                                                                                    cleanMobile,

                                                                                email:
                                                                                    cleanEmail,

                                                                                gender:
                                                                                    cleanGender,

                                                                                coins:
                                                                                    500,

                                                                                referralCode:
                                                                                    newReferralCode
                                                                            },

                                                                            referral: {

                                                                                applied:
                                                                                    true,

                                                                                referrerReward:
                                                                                    1000,

                                                                                customerReward:
                                                                                    500,

                                                                                historyRecorded:
                                                                                    true
                                                                            }
                                                                        });
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
                            }
                        );
                    }
                );
            }
        );
    }
);

// ==========================================
// CUSTOMER LOGIN / CHECK MOBILE
// ==========================================

router.post(
    "/login",
    (req, res) => {

        const {
            mobile
        } = req.body;

        if (!mobile) {

            return res.status(400).json({
                success: false,
                message:
                    "Mobile number is required"
            });
        }

        const cleanMobile =
            cleanMobileNumber(mobile);

        if (
            !/^[0-9]{10}$/.test(
                cleanMobile
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid mobile number"
            });
        }

        db.query(

            `SELECT
                id,
                name,
                mobile,
                email,
                gender,
                coins,
                referral_code,
                referred_by
             FROM customers
             WHERE mobile=?
             LIMIT 1`,

            [cleanMobile],

            (err, result) => {

                if (err) {

                    console.log(
                        "CUSTOMER LOGIN ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }

                // ==========================================
                // EXISTING CUSTOMER
                // ==========================================

                if (result.length > 0) {

                    return res.json({
                        success: true,
                        exists: true,
                        customer:
                            result[0]
                    });
                }

                // ==========================================
                // NEW CUSTOMER
                // ==========================================

                return res.json({
                    success: true,
                    exists: false,
                    customer: null,
                    mobile:
                        cleanMobile
                });
            }
        );
    }
);

// ==========================================
// UPDATE LOCATION
// ==========================================

router.post(
    "/update-location",
    (req, res) => {

        const {
            customerId,
            latitude,
            longitude,
            city,
            state
        } = req.body;

        db.query(

            `UPDATE customers
             SET
                latitude=?,
                longitude=?,
                city=COALESCE(?, city),
                state=COALESCE(?, state)
             WHERE id=?`,

            [
                latitude,
                longitude,
                city || null,
                state || null,
                customerId
            ],

            (err) => {

                if (err) {

                    console.log(
                        "UPDATE LOCATION ERROR:",
                        err
                    );

                    return res.json({
                        success: false,
                        message:
                            "Location update failed"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Location updated successfully"
                });
            }
        );
    }
);

// ==========================================
// CUSTOMER PROFILE
// ==========================================

router.get(
    "/profile/:id",
    (req, res) => {

        db.query(

            `SELECT
                id,
                name,
                mobile,
                email,
                gender,
                house,
                street,
                area,
                city,
                state,
                pincode,
                latitude,
                longitude,
                profile_image,
                coins,
                referral_code,
                referred_by
             FROM customers
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

                    return res.json({
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
                            "Customer not found"
                    });
                }

                res.json({
                    success: true,
                    customer:
                        result[0]
                });
            }
        );
    }
);

// ==========================================
// MULTER PROFILE IMAGE
// ==========================================

const storage =
    multer.diskStorage({

        destination:
            (req, file, cb) => {

                cb(
                    null,
                    "uploads/"
                );
            },

        filename:
            (req, file, cb) => {

                cb(
                    null,
                    Date.now() +
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

// ==========================================
// UPDATE PROFILE
// ==========================================

router.post(
    "/update-profile",
    upload.single("profileImage"),
    (req, res) => {

        const {
            customerId,
            name,
            email,
            house,
            street,
            area,
            city,
            state,
            pincode
        } = req.body;

        let image = "";

        if (req.file) {

            image =
                req.file.filename;
        }

        const sql = `

            UPDATE customers

            SET
                name = ?,
                email = ?,
                house = ?,
                street = ?,
                area = ?,
                city = ?,
                state = ?,
                pincode = ?,

                profile_image = IF(
                    ? = '',
                    profile_image,
                    ?
                )

            WHERE id = ?

        `;

        db.query(

            sql,

            [
                name,
                email,
                house,
                street,
                area,
                city,
                state,
                pincode,
                image,
                image,
                customerId
            ],

            (err) => {

                if (err) {

                    console.log(
                        "UPDATE PROFILE ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Profile update failed"
                    });
                }

                return res.json({
                    success: true,
                    message:
                        "Profile Updated Successfully"
                });
            }
        );
    }
);

// ==========================================
// FAVORITE PRODUCT
// ==========================================

router.post(
    "/favorite",
    (req, res) => {

        const {
            customerId,
            productId
        } = req.body;

        if (
            !customerId ||
            !productId
        ) {

            return res.json({
                success: false,
                message:
                    "Customer ID and Product ID required"
            });
        }

        db.query(

            `SELECT id
             FROM customer_favorites
             WHERE customer_id=?
             AND product_id=?`,

            [
                customerId,
                productId
            ],

            (err, result) => {

                if (err) {

                    console.error(err);

                    return res.json({
                        success: false,
                        message:
                            "Database error"
                    });
                }

                // ==========================================
                // ALREADY FAVORITE → REMOVE
                // ==========================================

                if (
                    result.length > 0
                ) {

                    db.query(

                        `DELETE FROM customer_favorites
                         WHERE customer_id=?
                         AND product_id=?`,

                        [
                            customerId,
                            productId
                        ],

                        (err) => {

                            if (err) {

                                return res.json({
                                    success: false,
                                    message:
                                        "Unable to remove favorite"
                                });
                            }

                            res.json({
                                success: true,
                                favorite:
                                    false
                            });
                        }
                    );
                }

                // ==========================================
                // NOT FAVORITE → ADD
                // ==========================================

                else {

                    db.query(

                        `INSERT INTO customer_favorites
                         (
                            customer_id,
                            product_id
                         )
                         VALUES (?,?)`,

                        [
                            customerId,
                            productId
                        ],

                        (err) => {

                            if (err) {

                                console.error(err);

                                return res.json({
                                    success: false,
                                    message:
                                        "Unable to save favorite"
                                });
                            }

                            res.json({
                                success: true,
                                favorite:
                                    true
                            });
                        }
                    );
                }
            }
        );
    }
);

// ==========================================
// CHECK CUSTOMER PHONE
// ==========================================

router.post(
    "/check-phone",
    (req, res) => {

        const {
            mobile
        } = req.body;

        if (!mobile) {

            return res.status(400).json({
                success: false,
                message:
                    "Mobile number is required"
            });
        }

        const cleanMobile =
            cleanMobileNumber(
                mobile
            );

        console.log(
            "CHECKING CUSTOMER MOBILE:",
            cleanMobile
        );

        db.query(

            `SELECT
                id,
                name,
                mobile,
                email,
                gender,
                coins,
                referral_code,
                referred_by
             FROM customers
             WHERE mobile=?
             LIMIT 1`,

            [
                cleanMobile
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "CHECK PHONE ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }

                // ==========================================
                // EXISTING CUSTOMER
                // ==========================================

                if (
                    result.length > 0
                ) {

                    return res.json({
                        success: true,
                        exists: true,
                        customer:
                            result[0]
                    });
                }

                // ==========================================
                // NEW CUSTOMER
                // ==========================================

                return res.json({
                    success: true,
                    exists: false,
                    customer: null
                });
            }
        );
    }
);

// ==========================================
// REFERRAL HISTORY
// ==========================================

router.get(
    "/referral-history/:customerId",
    (req, res) => {

        const customerId =
            req.params.customerId;

        if (!customerId) {

            return res.status(400).json({
                success: false,
                message:
                    "Customer ID is required"
            });
        }

        const sql = `

            SELECT

                rr.referrer_id,

                rr.referred_customer_id,

                rr.referrer_coins,

                rr.referred_coins,

                c.name AS referred_name,

                c.mobile AS referred_mobile,

                c.email AS referred_email

            FROM referral_rewards rr

            INNER JOIN customers c
                ON c.id =
                   rr.referred_customer_id

            WHERE rr.referrer_id = ?

            ORDER BY
                rr.referred_customer_id DESC

        `;

        db.query(

            sql,

            [
                customerId
            ],

            (err, result) => {

                if (err) {

                    console.log(
                        "REFERRAL HISTORY ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to load referral history"
                    });
                }

                return res.json({
                    success: true,
                    referrals:
                        result
                });
            }
        );
    }
);

// ==========================================
// CUSTOMER NOTIFICATIONS
// ==========================================

router.get(
    "/notifications",
    (req, res) => {

        const customerId =
            req.query.customerId ||
            req.headers["x-customer-id"];

        if (!customerId) {

            return res.status(400).json({
                success: false,
                message:
                    "Customer ID is required"
            });
        }

        const sql = `

            SELECT
                id,
                type,
                title,
                message,
                is_read,
                created_at

            FROM customer_notifications

            WHERE customer_id = ?

            ORDER BY
                created_at DESC

        `;

        db.query(

            sql,

            [
                customerId
            ],

            (error, results) => {

                if (error) {

                    console.error(
                        "CUSTOMER NOTIFICATIONS ERROR:",
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Database Error"
                    });
                }

                return res.json({

                    success: true,

                    notifications:
                        results || []
                });
            }
        );
    }
);
// ==========================================
// SAVE FCM TOKEN
// ==========================================

router.post(
    "/fcm-token",
    (req, res) => {

        const {
            customerId,
            fcmToken
        } = req.body;

        if (!customerId || !fcmToken) {

            return res.status(400).json({
                success: false,
                message: "Customer ID and FCM token are required"
            });
        }

        const sql = `
            UPDATE customers
            SET fcm_token = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                fcmToken,
                customerId
            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "FCM TOKEN SAVE ERROR:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Unable to save FCM token"
                    });
                }

                if (result.affectedRows === 0) {

                    return res.status(404).json({
                        success: false,
                        message: "Customer not found"
                    });
                }

                console.log(
                    "✅ FCM TOKEN SAVED FOR CUSTOMER:",
                    customerId
                );

                return res.json({
                    success: true,
                    message: "FCM token saved successfully"
                });
            }
        );
    }
);
// ==========================================
// EXPORT
// ==========================================

module.exports = router;