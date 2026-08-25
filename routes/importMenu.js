const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Tesseract = require("tesseract.js");
const db = require("../config/db");

// ================================
// Multer Storage
// ================================

const storage = multer.diskStorage({

    destination: function(req,file,cb){

        cb(null,"uploads/menus");

    },

    filename: function(req,file,cb){

        const fileName =
        Date.now() +
        "-" +
        Math.round(Math.random()*10000) +
        path.extname(file.originalname);

        cb(null,fileName);

    }

});

const upload = multer({

    storage: storage,

    limits:{
        fileSize:10*1024*1024
    },

    fileFilter:function(req,file,cb){

        const allowedExt = /\.(jpg|jpeg|png|webp)$/i;

const allowedMime = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
];

const ext = allowedExt.test(file.originalname);
const mime = allowedMime.includes(file.mimetype);

if (ext && mime) {
    return cb(null, true);
}

cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));

        if(ext && mime){

            return cb(null,true);

        }

        cb(new Error("Only JPG images are allowed."));

    }

});

// ================================
// Upload Route
// ================================

router.post(

"/upload",

upload.single("menuImage"),

async(req,res)=>{

try{

// ================================
// Check Image
// ================================

if(!req.file){

return res.json({

success:false,

message:"Please upload a menu image."

});

}

const partner_id = req.body.partner_id;

const business_type = req.body.business_type;

const imagePath=req.file.path;

console.log("Image Uploaded :",imagePath);

// ================================
// OCR
// ================================

const result = await Tesseract.recognize(

imagePath,

"eng"

);

const text = result.data.text;

console.log("========== RAW OCR ==========");
console.log(text);
console.log("=============================");

console.log("============= OCR TEXT =============");

console.log(text);

console.log("===================================");

// ================================
// Split Lines
// ================================

const lines=text

.split("\n")

.map(line=>line.trim())

.filter(line=>line.length>2);

console.log(lines);



// ==========================================
// Clean OCR Text & Extract Products
// ==========================================

const products = [];

const headings = [

"MENU",
"STARTERS",
"MAIN COURSE",
"BIRYANI",
"SOUPS",
"SALADS",
"DESSERTS",
"BEVERAGES",
"BREAKFAST",
"LUNCH",
"DINNER",
"COMBOS",
"VEG",
"NON VEG",
"PURE VEG",
"SPECIAL",
"TODAY SPECIAL"

];

for(const line of lines){

    let textLine = line.trim();

    if(textLine.length < 4)
        continue;

    // Ignore headings
    if(headings.includes(textLine.toUpperCase()))
        continue;

    // Ignore lines without a price
    const priceMatch = textLine.match(/\d{2,4}/);

    if(!priceMatch)
        continue;

    const price = parseInt(priceMatch[0]);

    // Remove price from product name
    let productName = textLine
        .replace(/\d{2,4}/g,"")
        .replace(/[₹,:.\-]/g,"")
        .trim();

    if(productName.length < 3)
        continue;

    // Ignore common OCR garbage
    if(
        productName.toLowerCase()=="menu" ||
        productName.toLowerCase()=="food" ||
        productName.toLowerCase()=="veg" ||
        productName.toLowerCase()=="non veg"
    ){
        continue;
    }

    // =============================
    // Detect Category
    // =============================

    let category = "Other";

    const name = productName.toLowerCase();

    if(name.includes("biryani")){

        category = "Biryani";

    }

    else if(

        name.includes("65") ||
        name.includes("dragon") ||
        name.includes("lollipop") ||
        name.includes("tikka") ||
        name.includes("starter")

    ){

        category = "Starters";

    }

    else if(

        name.includes("naan") ||
        name.includes("roti") ||
        name.includes("kulcha") ||
        name.includes("paratha")

    ){

        category = "Breads";

    }

    else if(

        name.includes("coke") ||
        name.includes("sprite") ||
        name.includes("pepsi") ||
        name.includes("thumbs")

    ){

        category = "Beverages";

    }

    else if(

        name.includes("ice cream") ||
        name.includes("gulab") ||
        name.includes("dessert")

    ){

        category = "Desserts";

    }

    // =============================
    // Default Image
    // =============================

    let image = "other.jpg";

    switch(category){

        case "Biryani":
            image = "biryani.jpg";
            break;

        case "Starters":
            image = "starter.jpg";
            break;

        case "Breads":
            image = "bread.jpg";
            break;

        case "Beverages":
            image = "beverage.jpg";
            break;

        case "Desserts":
            image = "dessert.jpg";
            break;

    }

    products.push({
    name: productName,
    type: getVegType(productName),
    category: getCategory(productName),
    price: price
});
}

// Remove duplicate products
const uniqueProducts = products.filter((item,index,self)=>

index === self.findIndex(

p => p.name.toLowerCase() === item.name.toLowerCase()

)

);

console.log("Products Found:");

console.table(uniqueProducts);
// ==========================================
// Send Products to Frontend
// ==========================================

return res.json({

    success: true,

    message: "Menu Imported Successfully",

    partner_id,

    business_type,

    image: req.file.filename,

    totalProducts: uniqueProducts.length,

    products: uniqueProducts

});

}catch(err){

    console.error("OCR ERROR :", err);

    return res.status(500).json({

        success: false,

        message: err.message

    });

}

});
  
// ==========================================
// SAVE IMPORTED PRODUCTS
// ==========================================

router.post("/save-products", (req, res) => {

    const {
    partner_id,
    business_type,
    partner_category,
    products
} = req.body;

    if (!products || products.length === 0) {

        return res.json({
            success: false,
            message: "No products found."
        });

    }

    let completed = 0;

    products.forEach(product => {
   console.log("Business Type:", business_type);

console.log([
    partner_id,
    business_type,
    product.name,
    product.type,
    product.category,
    product.price,
    product.offer_price || null,
    product.featured || 0,
    product.image || "other.jpg"
]);
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
image
)
VALUES(?,?,?,?,?,?,?,?,?)`,

 [
    partner_id,
    business_type,
    product.name,
    product.type,
    product.category,
    product.price,
    product.offer_price || null,
    product.featured || 0,
    product.image || "other.jpg"
],
            (err) => {

                completed++;

                if (err)
                    console.log(err);

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

// ================================
// UPDATE PRODUCT
// ================================
router.put("/product/:id",(req,res)=>{

const{

product_name,
type,
category,
price,
offer_price,
featured

}=req.body;

db.query(

`UPDATE menu_items
SET
product_name=?,
type=?,
category=?,
price=?,
offer_price=?,
featured=?
WHERE id=?`,

[
product_name,
type,
category,
price,
offer_price || null,
featured || 0,
req.params.id
],

(err)=>{

if(err){

console.log(err);

return res.json({

success:false

});

}

res.json({

success:true

});

});

});

function getVegType(name) {

    const text = name.toLowerCase();

    const nonVeg = [
        "chicken",
        "mutton",
        "fish",
        "prawn",
        "shrimp",
        "egg",
        "crab",
        "keema",
        "bacon"
    ];

    for (const item of nonVeg) {
        if (text.includes(item)) {
            return "Non Veg";
        }
    }

    return "Veg";
}

function getCategory(name) {

    const text = name.toLowerCase();

    if (text.includes("biryani"))
        return "Biryani";

    if (text.includes("fried rice") || text.includes("rice"))
        return "Rice";

    if (text.includes("starter") ||
        text.includes("65") ||
        text.includes("manchurian") ||
        text.includes("chilli"))
        return "Starters";

    if (text.includes("naan") ||
        text.includes("roti") ||
        text.includes("paratha") ||
        text.includes("kulcha"))
        return "Breads";

    if (text.includes("juice") ||
        text.includes("coke") ||
        text.includes("sprite") ||
        text.includes("pepsi") ||
        text.includes("thums up") ||
        text.includes("coffee") ||
        text.includes("tea"))
        return "Beverages";

    if (text.includes("ice cream") ||
        text.includes("cake") ||
        text.includes("gulab") ||
        text.includes("sweet"))
        return "Desserts";

    return "Other";
}

// ==========================================
// Export Router
// ==========================================

module.exports = router;