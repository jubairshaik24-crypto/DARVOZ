const express = require("express");
const router = express.Router();

const SupportChat = require("../models/SupportChat");


/* ==========================================
   CREATE SUPPORT CHAT
========================================== */

router.post("/create", async (req, res) => {

    try {

        const {
            orderId,
            customerId,
            customerName,
            issue
        } = req.body;


        if (!orderId) {

            return res.status(400).json({
                success: false,
                message: "Order ID is required"
            });

        }


        /* Unique Chat ID */

        const chatId =
            "SUP-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();


        const supportChat =
            await SupportChat.create({

                chatId,

                orderId,

                customerId:
                    customerId || "",

                customerName:
                    customerName ||
                    "DARVOZ Customer",

                status: "waiting",

                messages: [

                    {
                        sender: "customer",

                        message:
                            issue ||
                            "Customer requested DARVOZ Support."
                    }

                ]

            });


        const supportLink =
    `${req.protocol}://${req.get("host")}/support-chat.html?chatId=${supportChat.chatId}`;

res.status(201).json({

    success: true,

    message:
        "Support request created successfully",

    chatId:
        supportChat.chatId,

    supportLink:
        supportLink

});


    } catch (error) {

        console.error(
            "Create support chat error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to create support request"

        });

    }

});

/* ==========================================
   GET SUPPORT CHAT
========================================== */

router.get("/:chatId", async (req, res) => {

    try {

        const supportChat =
            await SupportChat.findOne({
                chatId: req.params.chatId
            });

        if (!supportChat) {

            return res.status(404).json({
                success: false,
                message: "Support chat not found"
            });

        }

        res.json({
            success: true,
            chat: supportChat
        });

    } catch (error) {

        console.error(
            "Get support chat error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load support chat"
        });

    }

});


/* ==========================================
   SEND SUPPORT MESSAGE
========================================== */

router.post("/:chatId/message", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message || !message.trim()) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }


        const supportChat =
            await SupportChat.findOne({
                chatId: req.params.chatId
            });


        if (!supportChat) {

            return res.status(404).json({
                success: false,
                message: "Support chat not found"
            });

        }


        supportChat.messages.push({

            sender: "support",

            message: message.trim(),

            createdAt: new Date()

        });


        /* Mark support as active */

        supportChat.status = "active";

        if (!supportChat.supportJoinedAt) {

            supportChat.supportJoinedAt =
                new Date();

        }


        await supportChat.save();


        res.json({

            success: true,

            message: "Reply sent successfully"

        });


    } catch (error) {

        console.error(
            "Send support message error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to send reply"
        });

    }

});


/* ==========================================
   CUSTOMER GET SUPPORT CHAT MESSAGES
========================================== */

router.get("/:chatId/messages", async (req, res) => {

    try {

        const supportChat =
            await SupportChat.findOne({
                chatId: req.params.chatId
            });

        if (!supportChat) {

            return res.status(404).json({
                success: false,
                message: "Support chat not found"
            });

        }


        res.json({

            success: true,

            status: supportChat.status,

            messages: supportChat.messages

        });


    } catch (error) {

        console.error(
            "Get support messages error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to load messages"
        });

    }

});
/* ==========================================
   CUSTOMER SEND MESSAGE
========================================== */

router.post("/:chatId/customer-message", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message || !message.trim()) {

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });

        }

        const supportChat =
            await SupportChat.findOne({
                chatId: req.params.chatId
            });

        if (!supportChat) {

            return res.status(404).json({
                success: false,
                message: "Support chat not found"
            });

        }

        supportChat.messages.push({
            sender: "customer",
            message: message.trim(),
            createdAt: new Date()
        });

        await supportChat.save();

        res.json({
            success: true,
            message: "Message sent successfully"
        });

    } catch (error) {

        console.error(
            "Customer message error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to send message"
        });

    }

});
module.exports = router;