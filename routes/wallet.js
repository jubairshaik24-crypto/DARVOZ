const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ==========================================
   GET WALLET DETAILS
========================================== */

router.get("/:partnerId", (req, res) => {

    const partnerId = req.params.partnerId;

    db.query(

        "SELECT IFNULL(SUM(amount),0) AS balance FROM wallet_transactions WHERE partner_id=?",

        [partnerId],

        (err, balanceResult) => {

            if (err) {
                console.log(err);
                return res.json({});
            }

            const balance = balanceResult[0].balance || 0;

            db.query(

                `SELECT
                IFNULL(SUM(CASE WHEN DATE(created_at)=CURDATE() THEN amount END),0) AS today,
                IFNULL(SUM(CASE WHEN YEARWEEK(created_at,1)=YEARWEEK(CURDATE(),1) THEN amount END),0) AS week,
                IFNULL(SUM(CASE WHEN MONTH(created_at)=MONTH(CURDATE())
                AND YEAR(created_at)=YEAR(CURDATE()) THEN amount END),0) AS month,
                IFNULL(SUM(amount),0) AS total
                FROM wallet_transactions
                WHERE partner_id=?`,

                [partnerId],

                (err, result) => {

                    if (err) {
                        console.log(err);
                        return res.json({});
                    }

                    res.json({

                        balance: balance,
                        today: result[0].today,
                        week: result[0].week,
                        month: result[0].month,
                        total: result[0].total

                    });

                }

            );

        }

    );

});


/* ==========================================
   WALLET HISTORY
========================================== */

router.get("/history/:partnerId", (req, res) => {

    const partnerId = req.params.partnerId;

    db.query(

        `SELECT
            order_id,
            amount,
            created_at
        FROM wallet_transactions
        WHERE partner_id=?
        ORDER BY id DESC`,

        [partnerId],

        (err, result) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(result);

        }

    );

});


/* ==========================================
   WITHDRAW REQUEST
========================================== */

router.post("/withdraw", (req, res) => {

    const { partner_id, amount } = req.body;

    // For now just return success.
    // Later we'll add bank account verification.

    res.json({

        success: true,
        message: "Withdrawal request submitted."

    });

});

module.exports = router;