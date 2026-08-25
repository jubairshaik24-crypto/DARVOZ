const express = require("express");
const router = express.Router();
const db = require("../config/db");


router.post("/import", (req, res) => {

    const products = req.body.products;

    if (!products || products.length === 0) {

        return res.json({
            success: false,
            message: "No products received"
        });

    }

    let completed = 0;
    let failed = false;

    products.forEach(product => {

        db.query(

            `INSERT INTO menu_items
            (
                partner_id,
                business_type,
                product_name,
                type,
                category,
                price,
                offer_price,
                featured,
                image,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                product.partner_id,
                product.business_type,
                product.name,
                product.type || "Veg",
                product.category || "Other",
                Number(product.price) || 0,
                product.offer_price || null,
                product.featured || 0,
                product.image_url || null,
                "Available"
            ],

            (err) => {

                completed++;

                if (err) {

                    console.log(
                        "MENU ITEM INSERT ERROR:",
                        err
                    );

                    failed = true;
                }

                if (completed === products.length) {

                    if (failed) {

                        return res.json({

                            success: false,

                            message:
                                "Some products could not be saved."

                        });

                    }

                    return res.json({

                        success: true,

                        message:
                            "Products Saved Successfully"

                    });

                }

            }

        );

    });

});


router.get("/partner/:id",(req,res)=>{

db.query(

"SELECT * FROM products WHERE partner_id=? ORDER BY id DESC",

[req.params.id],

(err,result)=>{

if(err){

return res.json({

success:false

});

}

res.json({

success:true,

products:result

});

}

);

});
// Get Partner Products
router.get("/partner/:partnerId/:businessType", (req, res) => {

    const { partnerId, businessType } = req.params;

    db.query(
        `SELECT * FROM products
         WHERE partner_id = ?
         AND business_type = ?
         ORDER BY display_order ASC, id DESC`,
        [partnerId, businessType],
        (err, result) => {

            if (err) {
                console.log(err);
                return res.json({
                    success: false,
                    message: "Database Error"
                });
            }

            res.json({
                success: true,
                products: products
            });

        }
    );

});
router.delete("/:id",(req,res)=>{

db.query(

"DELETE FROM products WHERE id=?",

[req.params.id],

(err)=>{

if(err){

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
router.patch("/status/:id",(req,res)=>{

db.query(

"UPDATE products SET available=NOT available WHERE id=?",

[req.params.id],

(err)=>{

if(err){

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
router.patch("/bestseller/:id",(req,res)=>{

db.query(

"UPDATE products SET bestseller=NOT bestseller WHERE id=?",

[req.params.id],

(err)=>{

if(err){

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
// ======================================
// Newly Added Products
// ======================================

router.get("/new/latest", (req, res) => {

    const sql = `
        SELECT
            p.id,
            p.partner_id,
            p.product_name,
            p.price,
            p.category,
            p.image,
            p.business_type,
            p.available,
            p.bestseller,
            r.restaurant_name

        FROM products p

        LEFT JOIN restaurants r
        ON p.partner_id = r.id

        WHERE p.available = 1

        ORDER BY RAND()

        LIMIT 10
    `;

    db.query(sql, (err, result) => {

        if (err) {

            console.log(
                "DARVOZ PICKS SQL ERROR:",
                err
            );

            return res.status(500).json([]);

        }

        console.log(
            "DARVOZ PICKS:",
            result
        );

        res.json({
    success: true,
    products: result
});

    });

});

router.get("/business/Food", (req,res)=>{

db.query(

"SELECT * FROM restaurants WHERE business_type='Food'",

(err,result)=>{

if(err){

return res.json([]);

}

res.json(result);

}

);

});

router.get("/business/Groceries",(req,res)=>{

db.query(

"SELECT * FROM restaurants WHERE business_type='Groceries'",

(err,result)=>{

if(err){

return res.json([]);

}

res.json(result);

}

);

});
router.get("/business/Meat",(req,res)=>{

db.query(

"SELECT * FROM restaurants WHERE business_type='Meat'",

(err,result)=>{

if(err){

return res.json([]);

}

res.json(result);

}

);

});


// ======================================
// DARVOZ PICKS
// Random real menu items near customer
// ======================================

router.get("/picks", (req, res) => {

    const sql = `
        SELECT
            m.id,
            m.partner_id,
            m.product_name,
            m.price,
            m.offer_price,
            m.image,
            m.category,
            m.business_type,
            m.status,

            r.restaurant_name,
            r.logo AS restaurant_logo

        FROM menu_items m

        INNER JOIN restaurants r
            ON r.id = m.partner_id

        WHERE m.status = 'Available'
          AND r.online_status = 'Open'

        ORDER BY RAND()

        LIMIT 10
    `;

    db.query(sql, (err, result) => {

        if (err) {

            console.error(
                "DARVOZ PICKS SQL ERROR:",
                err
            );

            return res.status(500).json({
                success: false,
                products: [],
                message: "Database error"
            });
        }

        console.log(
            "DARVOZ PICKS FOUND:",
            result.length
        );

        console.log(
            "DARVOZ PICKS DATA:",
            result
        );

        return res.json({
            success: true,
            products: result
        });

    });

});
// ======================================
// DARVOZ PICKS - RANDOM PRODUCTS
// ======================================

router.get("/darvoz-picks", (req, res) => {

    const limit = 10;

    const sql = `
        SELECT
            p.id,
            p.partner_id,
            p.product_name,
            p.description,
            p.price,
            p.offer_price,
            p.image,
            p.category,
            p.business_type,
            p.available,
            p.bestseller,
            p.rating,
            r.restaurant_name,
            r.logo AS restaurant_logo
        FROM products p
        INNER JOIN restaurants r
            ON p.partner_id = r.id
        WHERE p.available = 1
          AND p.status = 'Active'
        ORDER BY RAND()
        LIMIT ?
    `;

    db.query(sql, [limit], (err, result) => {

        if (err) {

            console.log(
                "DARVOZ PICKS ERROR:",
                err
            );

            return res.json({
                success: false,
                products: []
            });

        }

        res.json({
            success: true,
            products: result
        });

    });

});

router.get("/default-grocery-products", (req, res) => {

    db.query(

        `
        SELECT
            id,
            product_name,
            category,
            image_url,
            active
        FROM default_grocery_products
        WHERE active = 1
        ORDER BY id
        `,

        (err, products) => {

            if (err) {

                console.log(
                    "DEFAULT GROCERY PRODUCTS ERROR:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    products: [],

                    message:
                        "Unable to load default grocery products"

                });

            }

            console.log(
                "DEFAULT GROCERY PRODUCTS:",
                products.length
            );

            return res.json({

                success: true,

                products: products

            });

        }

    );

});

module.exports = router;