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

    products.forEach(product => {

        db.query(
            `INSERT INTO products
            (partner_id,product_name,price,category,image,business_type)
            VALUES(?,?,?,?,?,?)`,
            [
                product.partner_id,
                product.name,
                product.price,
                product.category,
                product.image,
                product.business_type || "Food"
            ],
            (err) => {

                if (err) {
                    console.log("INSERT ERROR:", err);
                    return;
                }

                completed++;

                if (completed === products.length) {

                    res.json({
                        success: true,
                        message: "Products Saved Successfully"
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
                products: result
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

    db.query(

        `SELECT
            p.*,
            r.restaurant_name
         FROM products p
         JOIN restaurants r
         ON p.partner_id = r.id
         ORDER BY p.id DESC
         LIMIT 10`,

        (err, result) => {

            if (err) {

                console.log(err);

                return res.json([]);

            }

            res.json(result);

        }

    );

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
module.exports = router;