const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post("/create-order", async (req, res) => {

    try {

        const { amount } = req.body;

        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: "DARVOZ_" + Date.now()
        };

        const order = await razorpay.orders.create(options);

        res.json(order);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false
        });

    }

});

module.exports = router;