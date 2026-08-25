const express = require("express");
const router = express.Router();

const db = require("../config/db");

const {
    sendWhatsAppOTP
} = require("../services/whatsappService");

const otpStore = new Map();


// ==============================
// NORMALIZE PHONE
// ==============================

function normalizePhone(phone) {

    let mobile = String(phone || "")
        .replace(/\D/g, "");

    // 918333995837 -> 8333995837
    if (
        mobile.startsWith("91") &&
        mobile.length === 12
    ) {
        mobile = mobile.substring(2);
    }

    return mobile;
}


// ==============================
// SEND OTP
// ==============================

router.post("/send-otp", async (req, res) => {

    try {

        const phone = normalizePhone(req.body.phone);

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }


        // Generate 6 digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();


        console.log("SEND OTP PHONE:", phone);
        console.log("GENERATED OTP:", otp);


        // Store OTP for 5 minutes
        otpStore.set(phone, {
            otp: otp,
            expiresAt: Date.now() + 5 * 60 * 1000
        });


        console.log(
            "OTP STORED FOR:",
            phone
        );

        console.log(
            "OTP STORE KEYS:",
            [...otpStore.keys()]
        );


        // Send WhatsApp OTP
        const result = await sendWhatsAppOTP(
            phone,
            otp
        );


        if (!result.success) {

            otpStore.delete(phone);

            return res.status(500).json({
                success: false,
                message:
                    "Failed to send WhatsApp OTP",
                error:
                    result.error
            });
        }


        return res.json({
            success: true,
            message:
                "OTP sent successfully to WhatsApp"
        });

    } catch (error) {

        console.error(
            "SEND OTP ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to send OTP"
        });
    }
});


// ==============================
// VERIFY OTP
// ==============================

router.post("/verify-otp", async (req, res) => {

    try {

        const phone = normalizePhone(
            req.body.phone
        );

        const otp = String(
            req.body.otp || ""
        ).trim();


        console.log(
            "VERIFY OTP PHONE:",
            phone
        );

        console.log(
            "VERIFY OTP:",
            otp
        );

        console.log(
            "AVAILABLE OTP KEYS:",
            [...otpStore.keys()]
        );


        // Validate
        if (!phone || !otp) {

            return res.status(400).json({
                success: false,
                message:
                    "Phone number and OTP are required"
            });
        }


        // Find OTP
        const savedOTP =
            otpStore.get(phone);


        if (!savedOTP) {

            return res.status(400).json({
                success: false,
                message:
                    "OTP not found. Please request a new OTP."
            });
        }


        // Check expiry
        if (
            Date.now() >
            savedOTP.expiresAt
        ) {

            otpStore.delete(phone);

            return res.status(400).json({
                success: false,
                message:
                    "OTP expired. Please request a new OTP."
            });
        }


        // Check OTP
        if (
            savedOTP.otp !== otp
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid OTP"
            });
        }


        // OTP verified
        otpStore.delete(phone);


        console.log(
            "OTP VERIFIED SUCCESSFULLY:",
            phone
        );


        return res.json({
            success: true,
            message:
                "Phone number verified successfully",
            mobile: phone
        });

    } catch (error) {

        console.error(
            "VERIFY OTP ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "OTP verification failed"
        });
    }
});


// ==============================
// CHECK CUSTOMER
// ==============================

router.post("/check-customer", (req, res) => {

    try {

        const mobile = normalizePhone(
            req.body.phone
        );


        console.log(
            "CHECKING CUSTOMER:",
            mobile
        );


        if (!mobile) {

            return res.status(400).json({
                success: false,
                message:
                    "Phone number is required"
            });
        }


        const sql = `
            SELECT *
            FROM customers
            WHERE mobile = ?
            LIMIT 1
        `;


        db.query(
            sql,
            [mobile],
            (error, results) => {

                if (error) {

                    console.error(
                        "CHECK CUSTOMER MYSQL ERROR:",
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to check customer",
                        error:
                            error.message
                    });
                }


                console.log(
                    "CUSTOMER QUERY RESULT:",
                    results
                );


                // Existing customer
                if (
                    results &&
                    results.length > 0
                ) {

                    const customer =
                        results[0];


                    console.log(
                        "CUSTOMER FOUND:",
                        customer
                    );


                    return res.json({
                        success: true,
                        exists: true,
                        customer: customer
                    });
                }


                // New customer
                console.log(
                    "CUSTOMER NOT FOUND:",
                    mobile
                );


                return res.json({
                    success: true,
                    exists: false,
                    customer: null
                });
            }
        );

    } catch (error) {

        console.error(
            "CHECK CUSTOMER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to check customer",
            error:
                error.message
        });
    }
});


module.exports = router;