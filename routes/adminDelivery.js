const express = require("express");
const router = express.Router();
const db = require("../config/db");


// =====================================
// Get All Delivery Partners
// =====================================

router.get("/delivery", (req, res) => {

    db.query(

        "SELECT * FROM delivery_partners ORDER BY id DESC",

        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json(result);

        }

    );

});


// =====================================
// Approve Delivery Partner
// =====================================



      router.put("/delivery/approve/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        `UPDATE delivery_partners
         SET
            status='Approved',
            account_status='Approved'
         WHERE id=?`,

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Database Error"
                });

            }

            res.json({
                success: true,
                message: "Delivery Partner Approved"
            });

        }

    );

});


// =====================================
// Reject Delivery Partner
// =====================================

router.put("/delivery/reject/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        `UPDATE delivery_partners
         SET
            status='Rejected',
            account_status='Rejected'
         WHERE id=?`,

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});


// =====================================
// Delete Delivery Partner (Optional)
// =====================================

router.delete("/delivery/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        "DELETE FROM delivery_partners WHERE id=?",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false
                });

            }

            res.json({
                success: true,
                message: "Delivery Partner Deleted"
            });

        }

    );

});
router.get("/delivery/pending",(req,res)=>{

db.query(

`SELECT *

FROM delivery_partners

WHERE account_status='Pending'`,

(err,result)=>{

if(err){

return res.status(500).json([]);

}

res.json(result);

}

);

});


router.put("/delivery/toggle/:id", (req, res) => {

    const id = req.params.id;

    db.query(

        `UPDATE delivery_partners
         SET
            status =
                CASE
                    WHEN status='Approved' THEN 'Blocked'
                    ELSE 'Approved'
                END,

            account_status =
                CASE
                    WHEN account_status='Approved' THEN 'Blocked'
                    ELSE 'Approved'
                END

         WHERE id=?`,

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});

// =====================================
// GET PENDING WITHDRAWAL REQUESTS
// =====================================

router.get("/withdrawals/pending", async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT
                id,
                user_type,
                user_id,
                amount,
                status,
                requested_at,
                processed_at
             FROM withdrawal_requests
             WHERE status='Pending'
             ORDER BY id DESC`

        );

        res.json({

            success: true,
            withdrawals: rows

        });

    }

    catch (err) {

        console.log("GET WITHDRAWALS ERROR:", err);

        res.status(500).json({

            success: false,
            withdrawals: []

        });

    }

});


// =====================================
// APPROVE WITHDRAWAL
// =====================================

router.put("/withdrawal/approve/:id", async (req, res) => {

    const withdrawalId = req.params.id;

    const connection =
        await db.promise().getConnection();

    try {

        await connection.beginTransaction();

        // =================================
        // GET PENDING REQUEST
        // =================================

        const [requests] =
            await connection.query(

                `SELECT
                    id,
                    user_type,
                    user_id,
                    amount,
                    status

                 FROM withdrawal_requests

                 WHERE id=?
                 AND status='Pending'

                 FOR UPDATE`,

                [withdrawalId]

            );

        if (requests.length === 0) {

            await connection.rollback();

            return res.json({

                success: false,

                message:
                    "Withdrawal request not found or already processed."

            });

        }

        const request = requests[0];

        // =================================
        // GET WALLET
        // =================================

        const [wallets] =
            await connection.query(

                `SELECT
                    id,
                    balance

                 FROM wallets

                 WHERE user_type=?
                 AND user_id=?

                 FOR UPDATE`,

                [
                    request.user_type,
                    request.user_id
                ]

            );

        if (wallets.length === 0) {

            await connection.rollback();

            return res.json({

                success: false,

                message: "Wallet not found."

            });

        }

        const balance =
            Number(wallets[0].balance);

        const amount =
            Number(request.amount);

        // =================================
        // CHECK BALANCE
        // =================================

        if (balance < amount) {

            await connection.rollback();

            return res.json({

                success: false,

                message:
                    "Insufficient wallet balance."

            });

        }

        // =================================
        // DEDUCT WALLET
        // =================================

        await connection.query(

            `UPDATE wallets

             SET balance = balance - ?

             WHERE id=?`,

            [
                amount,
                wallets[0].id
            ]

        );

        // =================================
        // CREATE DEBIT TRANSACTION
        // =================================

        await connection.query(

            `INSERT INTO wallet_transactions
            (
                user_type,
                user_id,
                order_id,
                amount,
                type
            )

            VALUES(?,?,?,?,?)`,

            [
                request.user_type,
                request.user_id,
                null,
                amount,
                "Debit"
            ]

        );

        // =================================
        // MARK WITHDRAWAL APPROVED
        // =================================

        await connection.query(

            `UPDATE withdrawal_requests

             SET
                status='Approved',
                processed_at=NOW()

             WHERE id=?`,

            [withdrawalId]

        );

        // =================================
        // COMMIT
        // =================================

        await connection.commit();

        res.json({

            success: true,

            message:
                "Withdrawal approved successfully."

        });

    }

    catch (err) {

        await connection.rollback();

        console.log(
            "APPROVE WITHDRAWAL ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

    finally {

        connection.release();

    }

});


// =====================================
// REJECT WITHDRAWAL
// =====================================

router.put("/withdrawal/reject/:id", async (req, res) => {

    try {

        const withdrawalId =
            req.params.id;

        const [result] =
            await db.promise().query(

                `UPDATE withdrawal_requests

                 SET
                    status='Rejected',
                    processed_at=NOW()

                 WHERE id=?
                 AND status='Pending'`,

                [withdrawalId]

            );

        if (result.affectedRows === 0) {

            return res.json({

                success: false,

                message:
                    "Withdrawal request not found or already processed."

            });

        }

        res.json({

            success: true,

            message:
                "Withdrawal rejected."

        });

    }

    catch (err) {

        console.log(
            "REJECT WITHDRAWAL ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});
module.exports = router;