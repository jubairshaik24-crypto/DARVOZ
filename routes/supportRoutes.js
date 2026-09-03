const express = require("express");
const router = express.Router();
const db = require("../config/db");


// =====================================================
// CREATE SUPPORT CHAT
//
// POST /api/support/create
// =====================================================

router.post("/create", async (req, res) => {

    try {

        const {
            orderId,
            customerId,
            customerName,
            issue
        } = req.body;


        // -------------------------------------------------
        // CREATE UNIQUE CHAT ID
        // -------------------------------------------------

        const chatId =
            "SUP-" +
            Date.now()
                .toString(36)
                .toUpperCase() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();


        // -------------------------------------------------
        // CLEAN VALUES
        // -------------------------------------------------

        const cleanOrderId =
            orderId &&
            String(orderId).trim()
                ? Number(orderId)
                : null;


        const cleanCustomerId =
            customerId &&
            String(customerId).trim()
                ? Number(customerId)
                : null;


        const cleanCustomerName =
            customerName &&
            String(customerName).trim()
                ? String(customerName).trim()
                : "DARVOZ Customer";


        // -------------------------------------------------
        // FIRST MESSAGE
        // -------------------------------------------------

        const firstMessage =
            issue &&
            String(issue).trim()
                ? String(issue).trim()
                : cleanOrderId
                    ? `Customer requested DARVOZ Support for Order #${cleanOrderId}.`
                    : "Customer requested DARVOZ General Support.";


        // -------------------------------------------------
        // CREATE SUPPORT CHAT
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_chats
            (
                chat_id,
                order_id,
                customer_id,
                customer_name,
                status
            )
            VALUES (?, ?, ?, ?, 'waiting')
            `,
            [
                chatId,
                cleanOrderId,
                cleanCustomerId,
                cleanCustomerName
            ]
        );


        // -------------------------------------------------
        // ADD FIRST CUSTOMER MESSAGE
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_messages
            (
                chat_id,
                sender,
                message
            )
            VALUES (?, 'customer', ?)
            `,
            [
                chatId,
                firstMessage
            ]
        );


        // -------------------------------------------------
        // SUPPORT LINK
        // -------------------------------------------------

        const supportLink =
            `${req.protocol}://${req.get("host")}/support-chat.html?chatId=${chatId}`;


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                "Support request created successfully",

            chatId,

            supportLink

        });

    }
    catch (error) {

        console.error(
            "❌ Create support chat error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to create support request"

        });

    }

});


// =====================================================
// SUPPORT DASHBOARD - CHAT LIST
//
// GET /api/support/dashboard/chats
//
// IMPORTANT:
// This route MUST be before /:chatId
// =====================================================

router.get("/dashboard/chats", async (req, res) => {

    try {

        const [chats] =
            await db.promise().query(
                `
                SELECT
                    sc.chat_id,
                    sc.order_id,
                    sc.customer_id,
                    sc.customer_name,
                    sc.whatsapp_phone,
                    sc.status,
                    sc.support_joined_at,
                    sc.created_at,
                    sc.updated_at,

                    (
                        SELECT sm.message
                        FROM support_messages sm
                        WHERE sm.chat_id = sc.chat_id
                        ORDER BY sm.id DESC
                        LIMIT 1
                    ) AS last_message

                FROM support_chats sc

                WHERE sc.status IN ('waiting', 'active')

                ORDER BY
                    CASE
                        WHEN sc.status = 'waiting'
                        THEN 0
                        ELSE 1
                    END,

                    sc.updated_at DESC
                `
            );


        return res.json({

            success: true,

            chats

        });

    }
    catch (error) {

        console.error(
            "❌ Support dashboard chat list error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load support chats"

        });

    }

});

// =====================================================
// CUSTOMER SUPPORT HISTORY
//
// GET /api/support/customer-history
// =====================================================

router.get("/customer-history", async (req, res) => {

    try {

        const { customerId, orderId } = req.query;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID is required"
            });
        }

        let query = `
            SELECT
                sc.chat_id,
                sc.order_id,
                sc.customer_id,
                sc.customer_name,
                sc.status,
                sc.support_joined_at,
                sc.created_at,
                sc.updated_at
            FROM support_chats sc
            WHERE sc.customer_id = ?
        `;

        const params = [customerId];

        if (orderId) {

            query += `
                AND sc.order_id = ?
            `;

            params.push(orderId);

        } else {

            query += `
                AND sc.order_id IS NULL
            `;

        }

        query += `
            ORDER BY sc.created_at DESC
        `;

        const [chats] =
            await db.promise().query(
                query,
                params
            );

        return res.json({
            success: true,
            chats
        });

    } catch (error) {

        console.error(
            "❌ CUSTOMER SUPPORT HISTORY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load support history"
        });

    }

});

// =====================================================
// GET SUPPORT CHAT
//
// GET /api/support/:chatId
//
// Returns chat + complete message history
// =====================================================

router.get("/:chatId", async (req, res) => {

    try {

        const chatId =
            req.params.chatId;

console.log("🔥 GET SUPPORT CHAT HIT:", chatId);
        // -------------------------------------------------
        // GET CHAT
        // -------------------------------------------------

        const [chatRows] =
            await db.promise().query(
                `
                SELECT
                    id,
                    chat_id,
                    order_id,
                    customer_id,
                    customer_name,
                    whatsapp_phone,
                    status,
                    support_joined_at,
                    created_at,
                    updated_at

                FROM support_chats

                WHERE chat_id = ?

                LIMIT 1
                `,
                [chatId]
            );


        if (!chatRows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Support chat not found"

            });

        }


        const chat =
            chatRows[0];


        // -------------------------------------------------
        // GET MESSAGES
        // -------------------------------------------------

        const [messages] =
            await db.promise().query(
                `
                SELECT
                    id,
                    chat_id,
                    sender,
                    message,
                    created_at

                FROM support_messages

                WHERE chat_id = ?

                ORDER BY id ASC
                `,
                [chatId]
            );


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.json({

            success: true,

            chat: {

                ...chat,

                messages

            }

        });

    }
    catch (error) {

        console.error(
            "❌ Get support chat error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to load support chat"

        });

    }

});


// =====================================================
// SUPPORT AGENT JOIN CHAT
//
// POST /api/support/:chatId/join
// =====================================================

router.post("/:chatId/join", async (req, res) => {

    try {

        const { chatId } =
            req.params;


        if (!chatId) {

            return res.status(400).json({

                success: false,

                message:
                    "Chat ID is required"

            });

        }


        // -------------------------------------------------
        // JOIN ONLY WAITING CHAT
        // -------------------------------------------------

        const [result] =
            await db.promise().query(
                `
                UPDATE support_chats

                SET
                    status = 'active',

                    support_joined_at =
                        COALESCE(
                            support_joined_at,
                            NOW()
                        ),

                    updated_at = NOW()

                WHERE chat_id = ?

                AND status = 'waiting'
                `,
                [chatId]
            );


        // -------------------------------------------------
        // CHAT WAS NOT WAITING
        // -------------------------------------------------

        if (result.affectedRows === 0) {

            const [existing] =
                await db.promise().query(
                    `
                    SELECT
                        chat_id,
                        status

                    FROM support_chats

                    WHERE chat_id = ?

                    LIMIT 1
                    `,
                    [chatId]
                );


            if (
                !existing ||
                existing.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Support chat not found"

                });

            }


            // -------------------------------------------------
            // ALREADY ACTIVE
            // -------------------------------------------------

            if (
                existing[0].status === "active"
            ) {

                return res.json({

                    success: true,

                    message:
                        "Support chat is already active",

                    chatId,

                    status: "active"

                });

            }


            // -------------------------------------------------
            // CLOSED
            // -------------------------------------------------

            if (
                existing[0].status === "closed"
            ) {

                return res.status(400).json({

                    success: false,

                    closed: true,

                    message:
                        "This support conversation has already ended"

                });

            }


            return res.status(400).json({

                success: false,

                message:
                    "Support chat cannot be joined"

            });

        }


        // -------------------------------------------------
        // ADD SUPPORT JOIN MESSAGE
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_messages
            (
                chat_id,
                sender,
                message
            )
            VALUES
            (
                ?,
                'support',
                ?
            )
            `,
            [
                chatId,

                "DARVOZ Support has joined the conversation."
            ]
        );


        // -------------------------------------------------
        // UPDATE ACTIVITY
        // -------------------------------------------------

        await db.promise().query(
            `
            UPDATE support_chats
            SET updated_at = NOW()
            WHERE chat_id = ?
            `,
            [chatId]
        );


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.json({

            success: true,

            message:
                "Support chat joined successfully",

            chatId,

            status: "active"

        });

    }
    catch (error) {

        console.error(
            "❌ Support join chat error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to join support chat"

        });

    }

});


// =====================================================
// SUPPORT AGENT SEND MESSAGE
//
// POST /api/support/:chatId/message
// =====================================================

router.post("/:chatId/message", async (req, res) => {

    try {

        const { chatId } =
            req.params;


        const message =
            String(
                req.body.message || ""
            ).trim();


        // -------------------------------------------------
        // VALIDATE MESSAGE
        // -------------------------------------------------

        if (!message) {

            return res.status(400).json({

                success: false,

                message:
                    "Message is required"

            });

        }


        // -------------------------------------------------
        // FIND SUPPORT CHAT
        // -------------------------------------------------

        const [chatRows] =
            await db.promise().query(
                `
                SELECT
                    chat_id,
                    order_id,
                    customer_id,
                    customer_name,
                    whatsapp_phone,
                    status

                FROM support_chats

                WHERE chat_id = ?

                LIMIT 1
                `,
                [chatId]
            );


        if (
            !chatRows ||
            chatRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Support chat not found"

            });

        }


        const chat =
            chatRows[0];


        // -------------------------------------------------
        // CHAT MUST BE ACTIVE
        // -------------------------------------------------

        if (
            chat.status !== "active"
        ) {

            return res.status(400).json({

                success: false,

                closed:
                    chat.status === "closed",

                message:
                    chat.status === "closed"
                        ? "This support conversation has ended"
                        : "Join the support chat before replying"

            });

        }


        // -------------------------------------------------
        // SAVE SUPPORT MESSAGE
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_messages
            (
                chat_id,
                sender,
                message
            )
            VALUES
            (
                ?,
                'support',
                ?
            )
            `,
            [
                chatId,
                message
            ]
        );


        // -------------------------------------------------
        // UPDATE CHAT ACTIVITY
        // -------------------------------------------------

        await db.promise().query(
            `
            UPDATE support_chats
            SET updated_at = NOW()
            WHERE chat_id = ?
            `,
            [chatId]
        );


        // -------------------------------------------------
        // SEND TO WHATSAPP
        // -------------------------------------------------

        let whatsappResult = null;


        if (chat.whatsapp_phone) {

            const {
                sendWhatsAppMessage
            } =
                require(
                    "../services/whatsappService"
                );


            whatsappResult =
                await sendWhatsAppMessage(
                    chat.whatsapp_phone,
                    message
                );


            if (
                !whatsappResult.success
            ) {

                console.error(
                    "❌ SUPPORT WHATSAPP SEND FAILED:",
                    whatsappResult.error
                );


                // IMPORTANT:
                // Message remains saved in MySQL.

                return res.status(502).json({

                    success: false,

                    message:
                        "Message saved, but WhatsApp delivery failed",

                    whatsappError:
                        whatsappResult.error

                });

            }

        }


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.json({

            success: true,

            message:
                "Support message sent successfully",

            chatId,

            whatsapp:
                !!chat.whatsapp_phone

        });

    }
    catch (error) {

        console.error(
            "❌ Support send message error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to send support message",

            error:
                error.message

        });

    }

});


// =====================================================
// CUSTOMER GET SUPPORT CHAT MESSAGES
//
// GET /api/support/:chatId/messages
// =====================================================

router.get("/:chatId/messages", async (req, res) => {

    try {

        const chatId =
            req.params.chatId;


        // -------------------------------------------------
        // GET CHAT STATUS
        // -------------------------------------------------

        const [chatRows] =
            await db.promise().query(
                `
                SELECT
                    status

                FROM support_chats

                WHERE chat_id = ?

                LIMIT 1
                `,
                [chatId]
            );


        if (!chatRows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Support chat not found"

            });

        }


        // -------------------------------------------------
        // GET MESSAGES
        // -------------------------------------------------

        const [messages] =
            await db.promise().query(
                `
                SELECT
                    id,
                    chat_id,
                    sender,
                    message,
                    created_at

                FROM support_messages

                WHERE chat_id = ?

                ORDER BY id ASC
                `,
                [chatId]
            );


        return res.json({

            success: true,

            status:
                chatRows[0].status,

            messages

        });

    }
    catch (error) {

        console.error(
            "❌ Get support messages error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to load messages"

        });

    }

});


// =====================================================
// CUSTOMER SEND MESSAGE
//
// POST /api/support/:chatId/customer-message
// =====================================================

router.post("/:chatId/customer-message", async (req, res) => {

    try {

        const chatId =
            req.params.chatId;


        const { message } =
            req.body;


        // -------------------------------------------------
        // VALIDATE MESSAGE
        // -------------------------------------------------

        if (
            !message ||
            !String(message).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Message is required"

            });

        }


        const cleanMessage =
            String(message).trim();


        // -------------------------------------------------
        // CHECK CHAT
        // -------------------------------------------------

        const [chatRows] =
            await db.promise().query(
                `
                SELECT
                    id,
                    status

                FROM support_chats

                WHERE chat_id = ?

                LIMIT 1
                `,
                [chatId]
            );


        // -------------------------------------------------
        // CHAT NOT FOUND
        // -------------------------------------------------

        if (!chatRows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Support chat not found"

            });

        }


        const chat =
            chatRows[0];


        // -------------------------------------------------
        // CLOSED CHAT
        // -------------------------------------------------

        if (
            chat.status === "closed"
        ) {

            return res.status(400).json({

                success: false,

                closed: true,

                message:
                    "This support conversation has ended"

            });

        }


        // -------------------------------------------------
        // CUSTOMER MUST WAIT FOR SUPPORT
        // -------------------------------------------------

        if (
            chat.status !== "active"
        ) {

            return res.status(400).json({

                success: false,

                waiting: true,

                message:
                    "Please wait for DARVOZ Support to join"

            });

        }


        // -------------------------------------------------
        // INSERT CUSTOMER MESSAGE
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_messages
            (
                chat_id,
                sender,
                message
            )
            VALUES
            (
                ?,
                'customer',
                ?
            )
            `,
            [
                chatId,
                cleanMessage
            ]
        );


        // -------------------------------------------------
        // UPDATE CHAT ACTIVITY
        // -------------------------------------------------

        await db.promise().query(
            `
            UPDATE support_chats
            SET updated_at = NOW()
            WHERE chat_id = ?
            `,
            [chatId]
        );


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.json({

            success: true,

            message:
                "Message sent successfully"

        });

    }
    catch (error) {

        console.error(
            "❌ Customer message error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to send message"

        });

    }

});


// =====================================================
// SUPPORT AGENT CLOSE / COMPLETE CHAT
//
// POST /api/support/:chatId/close
// =====================================================

router.post("/:chatId/close", async (req, res) => {

    try {

        const { chatId } =
            req.params;


        if (!chatId) {

            return res.status(400).json({

                success: false,

                message:
                    "Chat ID is required"

            });

        }


        // -------------------------------------------------
        // FIND CHAT
        // -------------------------------------------------

        const [chatRows] =
            await db.promise().query(
                `
                SELECT
                    chat_id,
                    status,
                    whatsapp_phone

                FROM support_chats

                WHERE chat_id = ?

                LIMIT 1
                `,
                [chatId]
            );


        if (!chatRows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "Support chat not found"

            });

        }


        const chat =
            chatRows[0];


        // -------------------------------------------------
        // ALREADY CLOSED
        // -------------------------------------------------

        if (
            chat.status === "closed"
        ) {

            return res.json({

                success: true,

                message:
                    "Support chat is already closed",

                chatId,

                status: "closed"

            });

        }


        // -------------------------------------------------
        // ONLY ACTIVE CHAT CAN BE CLOSED
        // -------------------------------------------------

        if (
            chat.status !== "active"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Only an active chat can be closed"

            });

        }


        // -------------------------------------------------
        // CLOSE CHAT
        // -------------------------------------------------

        const [result] =
            await db.promise().query(
                `
                UPDATE support_chats

                SET
                    status = 'closed',
                    updated_at = NOW()

                WHERE chat_id = ?

                AND status = 'active'
                `,
                [chatId]
            );


        if (
            result.affectedRows === 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Support chat could not be closed"

            });

        }


        // -------------------------------------------------
        // ADD END MESSAGE
        // -------------------------------------------------

        await db.promise().query(
            `
            INSERT INTO support_messages
            (
                chat_id,
                sender,
                message
            )
            VALUES
            (
                ?,
                'support',
                ?
            )
            `,
            [
                chatId,

                "DARVOZ Support has ended this conversation."
            ]
        );


        // -------------------------------------------------
        // UPDATE ACTIVITY AGAIN
        // -------------------------------------------------

        await db.promise().query(
            `
            UPDATE support_chats

            SET updated_at = NOW()

            WHERE chat_id = ?
            `,
            [chatId]
        );


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.json({

            success: true,

            message:
                "Support chat closed successfully",

            chatId,

            status: "closed"

        });

    }
    catch (error) {

        console.error(
            "❌ Support close chat error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to close support chat"

        });

    }

});


module.exports = router;