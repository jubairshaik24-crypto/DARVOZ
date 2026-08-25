const mongoose = require("mongoose");

const supportChatSchema = new mongoose.Schema(
    {
        chatId: {
            type: String,
            required: true,
            unique: true
        },

        orderId: {
            type: String,
            required: true
        },

        customerId: {
            type: String,
            default: ""
        },

        customerName: {
            type: String,
            default: "DARVOZ Customer"
        },

        status: {
            type: String,
            enum: ["waiting", "active", "closed"],
            default: "waiting"
        },

        messages: [
            {
                sender: {
                    type: String,
                    enum: ["customer", "ai", "support"],
                    required: true
                },

                message: {
                    type: String,
                    required: true
                },

                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        supportJoinedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "SupportChat",
    supportChatSchema
);