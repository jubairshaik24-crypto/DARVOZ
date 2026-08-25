const multer=require("multer");

const storage=multer.diskStorage({

destination:(req,file,cb)=>{

if(file.fieldname==="logo"){

cb(null,"uploads/logos");

}else{

cb(null,"uploads/banners");

}

},

filename:(req,file,cb)=>{

cb(null,Date.now()+"-"+file.originalname);

}

});

module.exports=multer({storage});