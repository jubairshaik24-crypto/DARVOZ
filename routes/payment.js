console.log("🔥 PAYMENT ROUTE LOADED");
const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/*====================================
CREATE RAZORPAY ORDER
====================================*/

router.post("/create-order", async (req, res) => {

    try {

        const { amount } = req.body;

        const options = {

            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: "DARVOZ_" + Date.now()

        };

        const order = await razorpay.orders.create(options);

        res.json({

            success: true,
            order

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: "Unable to create order"

        });

    }

});

/*====================================
VERIFY PAYMENT
====================================*/

router.post("/verify", (req, res) => {

    try {

        const {

            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature

        } = req.body;

        const body =
            razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body)
            .digest("hex");

        if (expectedSignature === razorpay_signature) {

            return res.json({

                success: true,
                paymentId: razorpay_payment_id

            });

        }

        return res.status(400).json({

            success: false,
            message: "Payment Verification Failed"

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false

        });

    }

});


/*====================================
REFUND PAYMENT
====================================*/

router.post("/refund", async (req, res) => {

    try {

        const {
            payment_id,
            amount
        } = req.body;

        if (!payment_id) {

            return res.status(400).json({

                success: false,
                message: "Payment ID is required"

            });

        }

        const refundData = {};

        // ------------------------------------
        // FULL REFUND
        // ------------------------------------

        if (amount) {

            refundData.amount =
                Math.round(Number(amount) * 100);

        }

        refundData.speed = "optimum";


        const refund =
            await razorpay.payments.refund(
                payment_id,
                refundData
            );


        console.log(
            "💰 RAZORPAY REFUND:",
            refund
        );


        res.json({

            success: true,

            refundId:
                refund.id,

            paymentId:
                payment_id,

            status:
                refund.status

        });


    } catch (err) {

        console.log(
            "❌ REFUND ERROR:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err?.error?.description ||
                "Unable to process refund"

        });

    }

});

module.exports = router;