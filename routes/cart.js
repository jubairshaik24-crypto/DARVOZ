const express = require("express");
const router = express.Router();
const db = require("../config/db");


/* =========================================================
   ADD TO CART
========================================================= */

router.post("/add", (req, res) => {

    const {
        customer_id,
        partner_id,
        product_id,
        quantity
    } = req.body;

    if (!customer_id || !partner_id || !product_id) {
        return res.status(400).json({
            success: false,
            message: "Missing cart details"
        });
    }

    const qty = Number(quantity || 1);

    if (qty <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid quantity"
        });
    }


    /*
     * Existing cart row for this customer,
     * partner and product.
     */
    db.query(
        `
        SELECT id, quantity
        FROM cart
        WHERE customer_id = ?
          AND partner_id = ?
          AND product_id = ?
        LIMIT 1
        `,
        [
            customer_id,
            partner_id,
            product_id
        ],
        (err, result) => {

            if (err) {
                console.error("CART ADD SELECT ERROR:", err);

                return res.status(500).json({
                    success: false
                });
            }


            /* Existing item */
            if (result.length > 0) {

                db.query(
                    `
                    UPDATE cart
                    SET quantity = quantity + ?
                    WHERE id = ?
                    `,
                    [
                        qty,
                        result[0].id
                    ],
                    (err) => {

                        if (err) {
                            console.error(
                                "CART QUANTITY UPDATE ERROR:",
                                err
                            );

                            return res.status(500).json({
                                success: false
                            });
                        }

                        return res.json({
                            success: true,
                            message: "Quantity Updated",
                            cart_id: result[0].id
                        });

                    }
                );

                return;
            }


            /* New item */
            db.query(
                `
                INSERT INTO cart
                (
                    customer_id,
                    partner_id,
                    product_id,
                    quantity
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    customer_id,
                    partner_id,
                    product_id,
                    qty
                ],
                (err, insertResult) => {

                    if (err) {
                        console.error(
                            "CART INSERT ERROR:",
                            err
                        );

                        return res.status(500).json({
                            success: false
                        });
                    }

                    return res.json({
                        success: true,
                        message: "Added To Cart",
                        cart_id: insertResult.insertId
                    });

                }
            );

        }
    );

});


/* =========================================================
   INCREASE
========================================================= */

router.post("/increase", (req, res) => {

    const {
        customer_id,
        product_id,
        partner_id
    } = req.body;


    if (!customer_id || !product_id || !partner_id) {
        return res.status(400).json({
            success: false
        });
    }


    db.query(
        `
        UPDATE cart
        SET quantity = quantity + 1
        WHERE customer_id = ?
          AND partner_id = ?
          AND product_id = ?
        `,
        [
            customer_id,
            partner_id,
            product_id
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "CART INCREASE ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }


            if (result.affectedRows === 0) {
                return res.json({
                    success: false,
                    message: "Cart item not found"
                });
            }


            res.json({
                success: true
            });

        }
    );

});


/* =========================================================
   DECREASE
========================================================= */

router.post("/decrease", (req, res) => {

    const {
        customer_id,
        product_id,
        partner_id
    } = req.body;


    if (!customer_id || !product_id || !partner_id) {
        return res.status(400).json({
            success: false
        });
    }


    db.query(
        `
        SELECT id, quantity
        FROM cart
        WHERE customer_id = ?
          AND partner_id = ?
          AND product_id = ?
        LIMIT 1
        `,
        [
            customer_id,
            partner_id,
            product_id
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "CART DECREASE SELECT ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }


            if (result.length === 0) {
                return res.json({
                    success: false,
                    message: "Cart item not found"
                });
            }


            const cartId = result[0].id;
            const currentQty = Number(
                result[0].quantity || 1
            );


            /* Remove when quantity becomes zero */
            if (currentQty <= 1) {

                db.query(
                    `
                    DELETE FROM cart
                    WHERE id = ?
                      AND customer_id = ?
                    `,
                    [
                        cartId,
                        customer_id
                    ],
                    (err) => {

                        if (err) {
                            console.error(
                                "CART DELETE ERROR:",
                                err
                            );

                            return res.status(500).json({
                                success: false
                            });
                        }

                        res.json({
                            success: true
                        });

                    }
                );

                return;
            }


            /* Otherwise decrease */
            db.query(
                `
                UPDATE cart
                SET quantity = quantity - 1
                WHERE id = ?
                  AND customer_id = ?
                `,
                [
                    cartId,
                    customer_id
                ],
                (err) => {

                    if (err) {
                        console.error(
                            "CART DECREASE ERROR:",
                            err
                        );

                        return res.status(500).json({
                            success: false
                        });
                    }

                    res.json({
                        success: true
                    });

                }
            );

        }
    );

});


/* =========================================================
   GET CUSTOMER CART
   FOOD + GROCERY
========================================================= */

router.get("/:customerId", (req, res) => {

    const customerId = req.params.customerId;


    const sql = `

        SELECT
            c.id,
            c.customer_id,
            c.partner_id,
            c.product_id,
            c.quantity,
            c.created_at,

            m.product_name,
            m.price,
            m.offer_price,
            m.image,

            r.restaurant_name,

            'food' AS item_type,

            NULL AS weight

        FROM cart c

        INNER JOIN menu_items m
            ON m.id = c.product_id
           AND m.partner_id = c.partner_id

        INNER JOIN restaurants r
            ON r.id = c.partner_id

        WHERE c.customer_id = ?

        AND NOT EXISTS (

            SELECT 1

            FROM partner_grocery_products gp

            WHERE gp.id = c.product_id
              AND gp.partner_id = c.partner_id

        )


        UNION ALL


        SELECT
            c.id,
            c.customer_id,
            c.partner_id,
            c.product_id,
            c.quantity,
            c.created_at,

            gp.product_name,

            /*
             * For a normal grocery product,
             * use its first/default available price.
             */
            COALESCE(
                (
                    SELECT
                        pgv.price

                    FROM partner_grocery_variants pgv

                    WHERE pgv.partner_product_id = gp.id
                      AND pgv.status = 'Available'

                    ORDER BY pgv.id ASC

                    LIMIT 1
                ),
                0
            ) AS price,

            COALESCE(
                (
                    SELECT
                        pgv.offer_price

                    FROM partner_grocery_variants pgv

                    WHERE pgv.partner_product_id = gp.id
                      AND pgv.status = 'Available'

                    ORDER BY pgv.id ASC

                    LIMIT 1
                ),
                0
            ) AS offer_price,

            gp.image,

            r.restaurant_name,

            'grocery' AS item_type,

            NULL AS weight

        FROM cart c

        INNER JOIN partner_grocery_products gp
            ON gp.id = c.product_id
           AND gp.partner_id = c.partner_id

        INNER JOIN restaurants r
            ON r.id = c.partner_id

        WHERE c.customer_id = ?

        ORDER BY created_at DESC

    `;


    db.query(
        sql,
        [
            customerId,
            customerId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "CUSTOMER CART LOAD ERROR:",
                    err
                );

                return res.status(500).json([]);
            }


            res.json(result);

        }
    );

});


/* =========================================================
   UPDATE CART ROW
========================================================= */

router.put("/update/:id", (req, res) => {

    const {
        quantity,
        customer_id
    } = req.body;


    if (!customer_id) {
        return res.status(400).json({
            success: false
        });
    }


    const qty = Number(quantity);


    if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid quantity"
        });
    }


    db.query(
        `
        UPDATE cart
        SET quantity = ?
        WHERE id = ?
          AND customer_id = ?
        `,
        [
            qty,
            req.params.id,
            customer_id
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "CART UPDATE ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }


            if (result.affectedRows === 0) {
                return res.json({
                    success: false,
                    message: "Cart item not found"
                });
            }


            res.json({
                success: true
            });

        }
    );

});


/* =========================================================
   REMOVE CART ROW
========================================================= */

router.delete("/remove/:id", (req, res) => {

    const {
        customer_id
    } = req.body;


    if (!customer_id) {
        return res.status(400).json({
            success: false
        });
    }


    db.query(
        `
        DELETE FROM cart
        WHERE id = ?
          AND customer_id = ?
        `,
        [
            req.params.id,
            customer_id
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "CART REMOVE ERROR:",
                    err
                );

                return res.status(500).json({
                    success: false
                });
            }


            res.json({
                success: result.affectedRows > 0
            });

        }
    );

});


/* =========================================================
   CLEAR CUSTOMER CART
========================================================= */

router.delete("/clear/:customerId", (req, res) => {

    db.query(
        `
        DELETE FROM cart
        WHERE customer_id = ?
        `,
        [
            req.params.customerId
        ],
        (err) => {

            if (err) {
                console.error(
                    "CART CLEAR ERROR:",
                    err
                );

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


module.exports = router;