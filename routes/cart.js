const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ======================================
// ADD TO CART
// ======================================

router.post("/add", (req, res) => {

    const {
        customer_id,
        partner_id,
        product_id,
        quantity
    } = req.body;

    // Check if already exists
    db.query(
        `SELECT * FROM cart
         WHERE customer_id=? AND product_id=?`,
        [customer_id, product_id],
        (err, result) => {

            if (err) {
                console.log(err);
                return res.json({
                    success: false
                });
            }

            if (result.length > 0) {

                db.query(
                    `UPDATE cart
                     SET quantity=quantity+?
                     WHERE id=?`,
                    [
                        quantity,
                        result[0].id
                    ],
                    (err) => {

                        if (err) {
                            return res.json({
                                success: false
                            });
                        }

                        res.json({
                            success: true,
                            message: "Quantity Updated"
                        });

                    }
                );

            } else {

                db.query(
                    `INSERT INTO cart
                    (
                        customer_id,
                        partner_id,
                        product_id,
                        quantity
                    )
                    VALUES(?,?,?,?)`,
                    [
                        customer_id,
                        partner_id,
                        product_id,
                        quantity
                    ],
                    (err) => {

                        if (err) {
                            console.log(err);
                            return res.json({
                                success: false
                            });
                        }

                        res.json({
                            success: true,
                            message: "Added To Cart"
                        });

                    }
                );

            }

        }

    );

});
// ======================================
// INCREASE QUANTITY
// ======================================

router.post("/increase", (req, res) => {

    const { customer_id, product_id } = req.body;

    db.query(
        `UPDATE cart
         SET quantity = quantity + 1
         WHERE customer_id=? AND product_id=?`,
        [customer_id, product_id],
        (err) => {

            if (err) {
                console.log(err);
                return res.json({ success:false });
            }

            res.json({ success:true });

        }
    );

});

// ======================================
// DECREASE QUANTITY
// ======================================

router.post("/decrease", (req, res) => {

    const { customer_id, product_id } = req.body;

    db.query(
        `SELECT * FROM cart
         WHERE customer_id=? AND product_id=?`,
        [customer_id, product_id],
        (err, result) => {

            if (err) {
                console.log(err);
                return res.json({ success:false });
            }

            if(result.length==0){
                return res.json({ success:false });
            }

            if(result[0].quantity==1){

                db.query(
                    `DELETE FROM cart
                     WHERE id=?`,
                    [result[0].id],
                    (err)=>{

                        if(err){
                            return res.json({success:false});
                        }

                        res.json({success:true});

                    }
                );

            }else{

                db.query(
                    `UPDATE cart
                     SET quantity=quantity-1
                     WHERE id=?`,
                    [result[0].id],
                    (err)=>{

                        if(err){
                            return res.json({success:false});
                        }

                        res.json({success:true});

                    }
                );

            }

        }
    );

});
// ======================================
// GET CART
// ======================================

router.get("/:customerId", (req, res) => {

    db.query(

        `SELECT

        cart.id,
        cart.quantity,

        menu_items.id AS product_id,
        menu_items.product_name,
        menu_items.price,
        menu_items.offer_price,
        menu_items.image,

        restaurants.restaurant_name,
        restaurants.id AS partner_id

        FROM cart

        JOIN menu_items
        ON cart.product_id=menu_items.id

        JOIN restaurants
        ON cart.partner_id=restaurants.id

        WHERE cart.customer_id=?`,

        [req.params.customerId],

        (err, result) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            res.json(result);

        }

    );

});

// ======================================
// UPDATE CART QUANTITY
// ======================================

router.put("/update/:id", (req, res) => {

    const { quantity } = req.body;

    db.query(

        "UPDATE cart SET quantity=? WHERE id=?",

        [quantity, req.params.id],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});
// ======================================
// REMOVE CART ITEM
// ======================================

router.delete("/remove/:id", (req, res) => {

    db.query(

        "DELETE FROM cart WHERE id=?",

        [req.params.id],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});
// ======================================
// CLEAR CART
// ======================================

router.delete("/clear/:customerId", (req, res) => {

    db.query(

        "DELETE FROM cart WHERE customer_id=?",

        [req.params.customerId],

        (err) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false
                });

            }

            res.json({
                success: true
            });

        }

    );

});


async function syncCartToDatabase() {

    const customerId =
        localStorage.getItem("customerId");

    if (!customerId || !Array.isArray(cart)) {
        return false;
    }

    try {

        // Clear customer's existing DB cart
        await fetch(
            `${API}/cart/clear/${customerId}`,
            {
                method: "DELETE"
            }
        );


        // Add every local item to DB
        for (const item of cart) {

            const response =
                await fetch(
                    `${API}/cart/add`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            customer_id:
                                customerId,

                            partner_id:
                                item.partner_id,

                            product_id:
                                item.product_id,

                            quantity:
                                Number(item.quantity)

                        })
                    }
                );


            const data =
                await response.json();


            if (!data.success) {

                console.log(
                    "MYSQL CART ADD FAILED:",
                    data
                );

                return false;

            }

        }

        console.log(
            "✅ LOCAL CART SYNCED TO MYSQL"
        );

        return true;

    }

    catch (error) {

        console.log(
            "MYSQL CART SYNC ERROR:",
            error
        );

        return false;

    }

}

module.exports = router;