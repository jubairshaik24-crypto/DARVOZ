
const express = require("express");
const router = express.Router();

router.get("/test", (req, res) => {
    res.send("Partner Route Working");
});

const db = require("../config/db");

const bcrypt = require("bcryptjs");

const multer = require("multer");

const path = require("path");

/* =========================================
   MULTER CONFIGURATION
========================================= */

const storage = multer.diskStorage({

    destination: function(req, file, cb){

        cb(null, "uploads/partners");

    },

    filename: function(req, file, cb){

        const fileName =
        Date.now() +
        "-" +
        Math.round(Math.random() * 100000) +
        path.extname(file.originalname);

        cb(null, fileName);

    }

});

const upload = multer({

    storage: storage,

    limits: {

        fileSize: 5 * 1024 * 1024   // 5MB

    },

    fileFilter: function(req, file, cb){

        const allowed = /jpg|jpeg|png|webp/;

        const ext = allowed.test(

            path.extname(file.originalname).toLowerCase()

        );

        const mime = allowed.test(file.mimetype);

        if(ext && mime){

            return cb(null, true);

        }

        cb(new Error("Only JPG, PNG and WEBP images are allowed"));

    }

});
// =====================================
// PARTNER REGISTRATION
// =====================================

router.post(

"/register",

upload.single("image"),

async(req,res)=>{

try{

const{

category,

store_name,

owner_name,

mobile,

email,

password,

address,

latitude,

longitude,

fssai,

gst,

breakfast,

breakfast_from,

breakfast_to,

lunch,

lunch_from,

lunch_to,

dinner,

dinner_from,

dinner_to

}=req.body;

// Check Existing Email

db.query(

"SELECT id FROM restaurants WHERE email=?",

[email],

async(err,exist)=>{

if(err){

console.log(err);

return res.json({

success:false,

message:"Database Error"

});

}

if(exist.length>0){

return res.json({

success:false,

message:"Email already registered"

});

}

const image=req.file?req.file.filename:"";

const hash=await bcrypt.hash(password,10);

// Insert Partner

db.query(

`INSERT INTO restaurants(

business_type,

restaurant_name,

owner_name,

mobile,

email,

password,

address,

latitude,

longitude,

fssai,

gst,

image,

status,

breakfast,

breakfast_from,

breakfast_to,

lunch,

lunch_from,

lunch_to,

dinner,

dinner_from,

dinner_to

)

VALUES(

?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?

)`,

[

category,

store_name,

owner_name,

mobile,

email,

hash,

address,

latitude,

longitude,

fssai,

gst,

image,

"Pending",

breakfast,

breakfast_from,

breakfast_to,

lunch,

lunch_from,

lunch_to,

dinner,

dinner_from,

dinner_to

],

(err,result)=>{

if(err){

console.log(err);

return res.json({

success:false,

message:"Registration Failed"

});

}

// Generate Partner ID

const partnerId=

"DAR"+

String(result.insertId)

.padStart(4,"0");

db.query(

"UPDATE restaurants SET restaurant_id=? WHERE id=?",

[partnerId,result.insertId],

(updateErr)=>{

if(updateErr){

console.log(updateErr);

return res.json({

success:false,

message:"Partner ID Error"

});

}

res.json({

success:true,

message:"Registration Successful",

partnerId:partnerId

});

}

);

}

);

}

);

}catch(err){

console.log(err);

res.json({

success:false,

message:"Server Error"

});

}

}

);
// =====================================
// PARTNER LOGIN
// =====================================

router.post("/login", async (req, res) => {

    try {

        const { partnerId, password } = req.body;

        if (!partnerId || !password) {

            return res.json({
                success: false,
                message: "Partner ID and Password are required."
            });

        }

        db.query(

            "SELECT * FROM restaurants WHERE restaurant_id=?",

            [partnerId],

            async (err, result) => {

                if (err) {

                    console.log(err);

                    return res.json({
                        success: false,
                        message: "Database Error"
                    });

                }

                if (result.length === 0) {

                    return res.json({
                        success: false,
                        message: "Partner ID not found"
                    });

                }

                const partner = result[0];

                // Check Password
                const match = await bcrypt.compare(
                    password,
                    partner.password
                );

                if (!match) {

                    return res.json({
                        success: false,
                        message: "Incorrect Password"
                    });

                }

                // Check Approval Status
                if (partner.status !== "Approved") {

                    return res.json({
                        success: false,
                        message: "Your account is still Pending Admin Approval."
                    });

                }

                // Login Success
                res.json({

                    success: true,

                    partner: {

                        id: partner.id,
                        partnerId: partner.restaurant_id,
                        restaurant_name: partner.restaurant_name,
                        owner_name: partner.owner_name,
                        business_type: partner.business_type,
                        email: partner.email,
                        mobile: partner.mobile,
                        image: partner.image

                    }

                });

            }

        );

    } catch (err) {

        console.log(err);

        res.json({

            success: false,
            message: "Server Error"

        });

    }

});

// ======================================
// PARTNER DASHBOARD
// ======================================

router.get("/dashboard/:id",(req,res)=>{

const partnerId=req.params.id;

const sql=`

SELECT

(SELECT COUNT(*) FROM orders
WHERE partner_id=?) AS todayOrders,

(SELECT IFNULL(SUM(grand_total),0)
FROM orders
WHERE partner_id=
? AND status='Completed') AS todayRevenue,

(SELECT COUNT(*)
FROM orders
WHERE partner_id=?
AND status='Pending') AS pendingOrders,

(SELECT COUNT(*)
FROM orders
WHERE partner_id=?
AND status='Completed') AS completedOrders

`;

db.query(

sql,

[

partnerId,
partnerId,
partnerId,
partnerId

],

(err,result)=>{

if(err){

console.log(err);

return res.json({

todayOrders:0,
todayRevenue:0,
pendingOrders:0,
completedOrders:0

});

}

res.json(result[0]);

});

});
// ======================================
// RECENT ORDERS
// ======================================

router.get("/orders/:id",(req,res)=>{

const partnerId=req.params.id;

db.query(

`

SELECT

id,

customer_name,

grand_total,

status

FROM orders

WHERE partner_id=?

ORDER BY id DESC

LIMIT 10

`,

[partnerId],

(err,result)=>{

if(err){

console.log(err);

return res.json([]);

}

const orders=result.map(order=>({

id:order.id,

order_id:"ORD"+String(order.id).padStart(5,"0"),

customer_name:order.customer_name,

total:order.grand_total,

status:order.status

}));

res.json(orders);

});

});
// ======================================
// UPDATE ORDER STATUS
// ======================================

router.put("/update-order/:id",(req,res)=>{

const orderId=req.params.id;

const {status}=req.body;

db.query(

"UPDATE orders SET status=? WHERE id=?",

[status,orderId],

(err,result)=>{

if(err){

console.log(err);

return res.json({

success:false,

message:"Database Error"

});

}

res.json({

success:true,

message:"Order Updated"

});

}

);

});

router.get("/profile/:id",(req,res)=>{

db.query(

"SELECT * FROM restaurants WHERE id=?",

[req.params.id],

(err,result)=>{

if(err) return res.json({});

res.json(result[0]);

});

});
/* =========================================
   EXPORT
========================================= */
// ======================================
// GET STORE PROFILE
// ======================================

router.get("/profile/:id", (req, res) => {

    db.query(

        "SELECT * FROM restaurants WHERE id=?",

        [req.params.id],

        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    success: false
                });

            }

            if(result.length === 0){

                return res.status(404).json({
                    success:false,
                    message:"Partner not found"
                });

            }

            res.json(result[0]);

        }

    );

});


// ======================================
// UPDATE STORE PROFILE
// ======================================

router.put("/profile/:id", (req, res) => {

    const {

        restaurant_name,
        owner_name,
        mobile,
        email,
        address

    } = req.body;

    db.query(

        `UPDATE restaurants
         SET restaurant_name=?,
             owner_name=?,
             mobile=?,
             email=?,
             address=?
         WHERE id=?`,

        [

            restaurant_name,
            owner_name,
            mobile,
            email,
            address,
            req.params.id

        ],

        (err) => {

            if(err){

                console.log(err);

                return res.json({
                    success:false
                });

            }

            res.json({
                success:true
            });

        }

    );

});
module.exports = router;