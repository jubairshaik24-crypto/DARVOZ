const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Place Order

router.post("/place", (req, res) => {

const {

partner_id,
restaurant_name,
customer_name,
mobile,
address,
payment,
food_total,
delivery_fee,
platform_fee,
grand_total,
cart

}

=req.body;

db.query(

`INSERT INTO orders
(partner_id,restaurant_name,customer_name,mobile,address,payment,food_total,delivery_fee,platform_fee,grand_total,status)
VALUES (?,?,?,?,?,?,?,?,?,?,?)`,

[
partner_id,
restaurant_name,
customer_name,
mobile,
address,
payment,
food_total,
delivery_fee,
platform_fee,
grand_total,
"Pending"
],

(err,result)=>{

if(err){

return res.json({
success:false,
message:"Order Failed"
});

}

const orderId=result.insertId;

// Save Products

Object.keys(cart).forEach(name=>{

db.query(

`INSERT INTO order_items
(order_id,product_name,price,qty)
VALUES (?,?,?,?)`,

[
orderId,
name,
cart[name].price,
cart[name].qty
]

);

});

res.json({

success:true,

orderId

});

}

);

});

module.exports=router;