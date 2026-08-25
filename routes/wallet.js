const express = require("express");
const router = express.Router();
const db = require("../config/db");


// =====================================================
// WALLET DASHBOARD
// GET /wallet/:userType/:userId
//
// Example:
// /wallet/delivery/2
// /wallet/partner/5
// =====================================================

router.get("/:userType/:userId", async (req, res) => {

    try {

        const { userType, userId } = req.params;

        // ==========================================
        // VALIDATE USER TYPE
        // ==========================================

        if (
            userType !== "partner" &&
            userType !== "delivery"
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid user type"
            });

        }


        // ==========================================
        // GET WALLET
        // ==========================================

        const [wallet] = await db.promise().query(

            `SELECT
                id,
                user_type,
                user_id,
                balance
             FROM wallets
             WHERE user_type=?
             AND user_id=?`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // TODAY'S EARNINGS
        // ==========================================

        const [today] = await db.promise().query(

            `SELECT
                COUNT(*) AS transactions,
                IFNULL(SUM(amount),0) AS earnings
             FROM wallet_transactions
             WHERE user_type=?
             AND user_id=?
             AND DATE(created_at)=CURDATE()
             AND type='Credit'
AND transaction_type='Order Earnings'`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // WEEKLY EARNINGS
        // ==========================================

        const [week] = await db.promise().query(

            `SELECT
                IFNULL(SUM(amount),0) AS earnings
             FROM wallet_transactions
             WHERE user_type=?
             AND user_id=?
             AND YEARWEEK(created_at,1)
                 = YEARWEEK(CURDATE(),1)
             AND type='Credit'
AND transaction_type='Order Earnings'`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // MONTHLY EARNINGS
        // ==========================================

        const [month] = await db.promise().query(

            `SELECT
                IFNULL(SUM(amount),0) AS earnings
             FROM wallet_transactions
             WHERE user_type=?
             AND user_id=?
             AND MONTH(created_at)=MONTH(CURDATE())
             AND YEAR(created_at)=YEAR(CURDATE())
             AND type='Credit'
AND transaction_type='Order Earnings'`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // TOTAL EARNINGS
        // ==========================================

        const [total] = await db.promise().query(

            `SELECT
                IFNULL(SUM(amount),0) AS earnings
             FROM wallet_transactions
             WHERE user_type=?
             AND user_id=?
             AND type='Credit'
AND transaction_type='Order Earnings'`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // LAST 20 TRANSACTIONS
        // ==========================================

        const [transactions] = await db.promise().query(

            `SELECT
                id,
                order_id,
                amount,
                type,
                created_at
             FROM wallet_transactions
             WHERE user_type=?
             AND user_id=?
             ORDER BY id DESC
             LIMIT 20`,

            [
                userType,
                userId
            ]

        );


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            success: true,

            userType: userType,

            userId: userId,

            balance:
                wallet.length > 0
                    ? Number(wallet[0].balance)
                    : 0,

            today:
                Number(today[0].earnings || 0),

            week:
                Number(week[0].earnings || 0),

            month:
                Number(month[0].earnings || 0),

            total:
                Number(total[0].earnings || 0),

            transactions: transactions

        });

    }

    catch (err) {

        console.log(
            "WALLET ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});


// =====================================================
// WITHDRAWAL REQUEST
// POST /wallet/withdraw
//
// Body:
// {
//     "userType": "delivery",
//     "userId": 2,
//     "amount": 500
// }
// =====================================================

router.post("/withdraw", async (req, res) => {

    let connection;

    try {

        const {
            userType,
            userId,
            amount
        } = req.body;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (
            !userType ||
            !userId ||
            amount === undefined
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Missing required fields."

            });

        }


        // ==========================================
        // USER TYPE
        // ==========================================

        if (
            userType !== "partner" &&
            userType !== "delivery"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user type."

            });

        }


        // ==========================================
        // AMOUNT
        // ==========================================

        const withdrawAmount =
            Number(amount);


        if (
            !Number.isFinite(withdrawAmount) ||
            withdrawAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid withdrawal amount."

            });

        }


        // ==========================================
        // ROUND TO 2 DECIMALS
        // ==========================================

        const finalAmount =
            Math.round(
                withdrawAmount * 100
            ) / 100;


        // ==========================================
        // MINIMUM WITHDRAWAL
        // ==========================================

        if (finalAmount < 100) {

            return res.status(400).json({

                success: false,

                message:
                    "Minimum withdrawal amount is ₹100."

            });

        }


        // ==========================================
        // DATABASE CONNECTION
        // ==========================================

        connection =
            await db
                .promise()
                .getConnection();


        // ==========================================
        // START TRANSACTION
        // ==========================================

        await connection.beginTransaction();


        // ==========================================
        // LOCK WALLET
        // ==========================================

        const [walletRows] =
            await connection.query(

                `SELECT
                    id,
                    balance
                 FROM wallets
                 WHERE user_type=?
                 AND user_id=?
                 FOR UPDATE`,

                [
                    userType,
                    userId
                ]

            );


        // ==========================================
        // WALLET NOT FOUND
        // ==========================================

        if (walletRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Wallet not found."

            });

        }


        const wallet =
            walletRows[0];


        const balance =
            Number(wallet.balance || 0);


        // ==========================================
        // CHECK BALANCE
        // ==========================================

        if (finalAmount > balance) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Insufficient balance. Available balance is ₹${balance.toFixed(2)}.`

            });

        }


        // ==========================================
        // CHECK PENDING WITHDRAWAL
        // ==========================================

        const [pendingRows] =
            await connection.query(

                `SELECT
                    id,
                    amount
                 FROM withdrawal_requests
                 WHERE user_type=?
                 AND user_id=?
                 AND status='Pending'
                 LIMIT 1
                 FOR UPDATE`,

                [
                    userType,
                    userId
                ]

            );


        if (pendingRows.length > 0) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "You already have a pending withdrawal request."

            });

        }


        // ==========================================
        // CREATE WITHDRAWAL REQUEST
        // ==========================================

        const [withdrawalResult] =
            await connection.query(

                `INSERT INTO withdrawal_requests
                (
                    user_type,
                    user_id,
                    amount,
                    status,
                    requested_at
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    'Pending',
                    NOW()
                )`,

                [
                    userType,
                    userId,
                    finalAmount
                ]

            );


        const withdrawalId =
            withdrawalResult.insertId;


        // ==========================================
        // DEDUCT MONEY FROM WALLET
        // ==========================================

        await connection.query(

            `UPDATE wallets
             SET balance = balance - ?
             WHERE id=?`,

            [
                finalAmount,
                wallet.id
            ]

        );


        // ==========================================
// CREATE DEBIT TRANSACTION
// ==========================================

await connection.query(

    `INSERT INTO wallet_transactions
    (
        user_type,
        user_id,
        order_id,
        amount,
        type,
        transaction_type
    )
    VALUES
    (
        ?,
        ?,
        NULL,
        ?,
        'Debit',
        'Withdrawal'
    )`,

    [
        userType,
        userId,
        finalAmount
    ]

);

        // ==========================================
        // COMMIT
        // ==========================================

        await connection.commit();


        // ==========================================
        // SUCCESS
        // ==========================================

        res.json({

            success: true,

            message:
                "Withdrawal request submitted successfully.",

            withdrawalId:
                withdrawalId,

            amount:
                finalAmount,

            newBalance:
                Number(
                    (
                        balance -
                        finalAmount
                    ).toFixed(2)
                ),

            status:
                "Pending"

        });

    }

    catch (err) {

        // ==========================================
        // ROLLBACK
        // ==========================================

        if (connection) {

            try {

                await connection.rollback();

            }

            catch (rollbackError) {

                console.log(
                    "ROLLBACK ERROR:",
                    rollbackError
                );

            }

        }


        console.log(
            "WITHDRAW ERROR:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                "Unable to process withdrawal request."

        });

    }

    finally {

        // ==========================================
        // RELEASE CONNECTION
        // ==========================================

        if (connection) {

            connection.release();

        }

    }

});


// =====================================================
// MY WITHDRAWAL REQUESTS
//
// GET /wallet/withdrawals/delivery/2
//
// GET /wallet/withdrawals/partner/5
// =====================================================

router.get(
    "/withdrawals/:userType/:userId",
    async (req, res) => {

        try {

            const {
                userType,
                userId
            } = req.params;


            // ======================================
            // VALIDATE USER TYPE
            // ======================================

            if (
                userType !== "partner" &&
                userType !== "delivery"
            ) {

                return res.status(400).json({

                    success: false,

                    withdrawals: [],

                    message:
                        "Invalid user type."

                });

            }


            // ======================================
            // GET WITHDRAWALS
            // ======================================

            const [rows] =
                await db.promise().query(

                    `SELECT
                        id,
                        user_type,
                        user_id,
                        amount,
                        status,
                        requested_at,
                        processed_at
                     FROM withdrawal_requests
                     WHERE user_type=?
                     AND user_id=?
                     ORDER BY id DESC`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // GET CURRENT WALLET
            // ======================================

            const [wallet] =
                await db.promise().query(

                    `SELECT balance
                     FROM wallets
                     WHERE user_type=?
                     AND user_id=?`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // TOTAL EARNINGS
            // ======================================

            const [total] =
                await db.promise().query(

                    `SELECT
                        IFNULL(SUM(amount),0) AS earnings
                     FROM wallet_transactions
                     WHERE user_type=?
                     AND user_id=?
                     AND type='Credit'
AND transaction_type='Order Earnings'`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // TODAY
            // ======================================

            const [today] =
                await db.promise().query(

                    `SELECT
                        IFNULL(SUM(amount),0) AS earnings
                     FROM wallet_transactions
                     WHERE user_type=?
                     AND user_id=?
                     AND DATE(created_at)=CURDATE()
                     AND type='Credit'
AND transaction_type='Order Earnings'`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // WEEK
            // ======================================

            const [week] =
                await db.promise().query(

                    `SELECT
                        IFNULL(SUM(amount),0) AS earnings
                     FROM wallet_transactions
                     WHERE user_type=?
                     AND user_id=?
                     AND YEARWEEK(created_at,1)
                         = YEARWEEK(CURDATE(),1)
                     AND type='Credit'
AND transaction_type='Order Earnings'`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // MONTH
            // ======================================

            const [month] =
                await db.promise().query(

                    `SELECT
                        IFNULL(SUM(amount),0) AS earnings
                     FROM wallet_transactions
                     WHERE user_type=?
                     AND user_id=?
                     AND MONTH(created_at)=MONTH(CURDATE())
                     AND YEAR(created_at)=YEAR(CURDATE())
                     AND type='Credit'
AND transaction_type='Order Earnings'`,

                    [
                        userType,
                        userId
                    ]

                );


            // ======================================
            // RESPONSE
            // ======================================

            res.json({

                success: true,

                userType: userType,

                userId: userId,

                balance:
                    wallet.length > 0
                        ? Number(wallet[0].balance)
                        : 0,

                today:
                    Number(today[0].earnings || 0),

                week:
                    Number(week[0].earnings || 0),

                month:
                    Number(month[0].earnings || 0),

                total:
                    Number(total[0].earnings || 0),

                withdrawals: rows

            });

        }

        catch (err) {

            console.log(
                "WITHDRAWALS ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                withdrawals: [],

                message:
                    "Server Error"

            });

        }

    }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;