const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            default: ""
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        email: {
            type: String,
            default: ""
        },
        password: {
            type: String,
            default: ""
        },
        is_verified: {
            type: Boolean,
            default: true
        },

        house: {
            type: String,
            default: ""
        },
        street: {
            type: String,
            default: ""
        },
        area: {
            type: String,
            default: ""
        },
        city: {
            type: String,
            default: ""
        },
        state: {
            type: String,
            default: ""
        },
        pincode: {
            type: String,
            default: ""
        },

        latitude: {
            type: String,
            default: ""
        },
        longitude: {
            type: String,
            default: ""
        },

        profile_image: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.Customer ||
    mongoose.model("Customer", customerSchema);