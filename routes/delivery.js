const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Delivery Login

router.post("/login",(req,res)=>{

const {mobile,password}=req.body;

db.query(

"SELECT * FROM delivery_partners WHERE mobile=? AND password=?",

[mobile,password],

(err,result)=>{

if(err){

return res.json({

success:false,

message:"Database Error"

});

}

if(result.length==0){

return res.json({

success:false,

message:"Invalid Mobile Number or Password"

});

}

const partner=result[0];

if(partner.status!="Approved"){

return res.json({

success:false,

message:"Waiting for Admin Approval"

});

}

res.json({

success:true,

partner

});

}

);

});

module.exports=router;