// ===============================
// DARVOZ Partner Registration JS
// Part 3
// ===============================

const category = document.getElementById("category");

const foodSection = document.getElementById("foodSection");
const store24 = document.getElementById("store24");

const breakfast = document.getElementById("breakfast");
const lunch = document.getElementById("lunch");
const dinner = document.getElementById("dinner");

const breakfastTime = document.getElementById("breakfastTime");
const lunchTime = document.getElementById("lunchTime");
const dinnerTime = document.getElementById("dinnerTime");

// Hide sections on page load
foodSection.style.display = "none";
store24.style.display = "none";

breakfastTime.style.display = "none";
lunchTime.style.display = "none";
dinnerTime.style.display = "none";

// =================================
// Category Change
// =================================

category.addEventListener("change", function(){

    if(this.value === "Food"){

        foodSection.style.display = "block";
        store24.style.display = "none";

    }

    else if(this.value === "Groceries" || this.value === "Meat"){

        foodSection.style.display = "none";
        store24.style.display = "block";

    }

    else{

        foodSection.style.display = "none";
        store24.style.display = "none";

    }

});

// =================================
// Breakfast
// =================================

breakfast.addEventListener("change", function(){

    if(this.checked){

        breakfastTime.style.display = "block";

    }else{

        breakfastTime.style.display = "none";

        document.getElementById("breakfastFrom").value = "";
        document.getElementById("breakfastTo").value = "";

    }

});

// =================================
// Lunch
// =================================

lunch.addEventListener("change", function(){

    if(this.checked){

        lunchTime.style.display = "block";

    }else{

        lunchTime.style.display = "none";

        document.getElementById("lunchFrom").value = "";
        document.getElementById("lunchTo").value = "";

    }

});

// =================================
// Dinner
// =================================

dinner.addEventListener("change", function(){

    if(this.checked){

        dinnerTime.style.display = "block";

    }else{

        dinnerTime.style.display = "none";

        document.getElementById("dinnerFrom").value = "";
        document.getElementById("dinnerTo").value = "";

    }

});
// =====================================
// DARVOZ MAP
// =====================================

let map = null;

let selectedLat = null;
let selectedLng = null;
let selectedAddress = "";

// Open Map
document.getElementById("locationBtn").addEventListener("click", openMap);

async function openMap(){

    document.getElementById("mapModal").style.display="block";

    if(map){

        map.remove();

        map = null;

    }

    navigator.geolocation.getCurrentPosition(

        function(position){

            loadMap(

                position.coords.latitude,

                position.coords.longitude

            );

        },

        function(){

            // Default Location (Ongole)

            loadMap(

                15.5057,

                80.0499

            );

        }

    );

}
function loadMap(lat,lng){

    selectedLat = lat;
    selectedLng = lng;

    map = L.map("map").setView([lat,lng],16);

    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom:19,

            attribution:"© OpenStreetMap"

        }

    ).addTo(map);

    reverseGeocode(lat,lng);

    map.on("moveend",function(){

        const center = map.getCenter();

        selectedLat = center.lat;
        selectedLng = center.lng;

        reverseGeocode(

            selectedLat,

            selectedLng

        );

    });

}
async function reverseGeocode(lat,lng){

    try{

        const response = await fetch(

        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`

        );

        const data = await response.json();

        selectedAddress = data.display_name;

        document.getElementById("selectedLocation").innerHTML = selectedAddress;

    }

    catch(err){

        console.log(err);

    }

}

// ======================================
// SEARCH LOCATION
// ======================================

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

searchInput.addEventListener("keyup", async function(){

    const keyword = this.value.trim();

    if(keyword.length < 3){

        searchResults.style.display = "none";
        return;

    }

    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&countrycodes=in&limit=5`
    );

    const places = await response.json();

    searchResults.innerHTML = "";

    searchResults.style.display = "block";

    places.forEach(place=>{

        const div = document.createElement("div");

        div.className = "searchItem";

        div.innerHTML = place.display_name;

        div.onclick = function(){

            map.setView(
                [parseFloat(place.lat), parseFloat(place.lon)],
                18
            );

            searchResults.style.display = "none";

            searchInput.value = "";

        };

        searchResults.appendChild(div);

    });

});

// ======================================
// CONFIRM LOCATION
// ======================================

document

.getElementById("confirmLocation")

.addEventListener("click",function(){

    document.getElementById("address").value = selectedAddress;

    localStorage.setItem(

        "partnerLocation",

        JSON.stringify({

            address:selectedAddress,

            latitude:selectedLat,

            longitude:selectedLng

        })

    );

    document.getElementById("mapModal").style.display="none";

});
// =====================================
// REGISTER PARTNER
// =====================================

async function registerPartner(){

    // Basic Details
    const category = document.getElementById("category").value;
    const storeName = document.getElementById("storeName").value.trim();
    const ownerName = document.getElementById("ownerName").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const address = document.getElementById("address").value;

    const fssai = document.getElementById("fssai").value.trim();
    const gst = document.getElementById("gst").value.trim();

    const image = document.getElementById("image").files[0];

    // Validation

    if(category=="")
        return alert("Select Business Category");

    if(storeName=="")
        return alert("Enter Store Name");

    if(ownerName=="")
        return alert("Enter Owner Name");

    if(mobile.length!=10)
        return alert("Enter Valid Mobile Number");

    if(email=="")
        return alert("Enter Email");

    if(password.length<6)
        return alert("Password should be at least 6 characters");

    if(password!=confirmPassword)
        return alert("Passwords do not match");

    if(address=="")
        return alert("Please Select Store Location");

    // Meal Timings

    const breakfast = document.getElementById("breakfast").checked ? 1 : 0;
    const lunch = document.getElementById("lunch").checked ? 1 : 0;
    const dinner = document.getElementById("dinner").checked ? 1 : 0;

    // Location

    const location = JSON.parse(localStorage.getItem("partnerLocation"));

    const formData = new FormData();

    formData.append("category",category);
    formData.append("store_name",storeName);
    formData.append("owner_name",ownerName);
    formData.append("mobile",mobile);
    formData.append("email",email);
    formData.append("password",password);

    formData.append("address",location.address);
    formData.append("latitude",location.latitude);
    formData.append("longitude",location.longitude);

    formData.append("fssai",fssai);
    formData.append("gst",gst);

    if(image){

        formData.append("image",image);

    }

    // Breakfast

    formData.append("breakfast",breakfast);
    formData.append("breakfast_from",document.getElementById("breakfastFrom").value);
    formData.append("breakfast_to",document.getElementById("breakfastTo").value);

    // Lunch

    formData.append("lunch",lunch);
    formData.append("lunch_from",document.getElementById("lunchFrom").value);
    formData.append("lunch_to",document.getElementById("lunchTo").value);

    // Dinner

    formData.append("dinner",dinner);
    formData.append("dinner_from",document.getElementById("dinnerFrom").value);
    formData.append("dinner_to",document.getElementById("dinnerTo").value);

    try{

        const response = await fetch(

            "http://localhost:5000/partner/register",

            {

                method:"POST",

                body:formData

            }

        );

        const data = await response.json();

        if(data.success){

            showSuccess(data.partnerId);

        }

        else{

            alert(data.message);

        }

    }

    catch(err){

        console.log(err);

        alert("Server Error");

    }

}
function showSuccess(partnerId){

document.body.innerHTML=`

<div style="

height:100vh;

display:flex;

justify-content:center;

align-items:center;

background:#f5f5f5;

font-family:Poppins,sans-serif;

">

<div style="

background:white;

padding:40px;

width:420px;

border-radius:20px;

text-align:center;

box-shadow:0 5px 20px rgba(0,0,0,.1);

">

<h1 style="color:#28a745;">

🎉 Registration Successful

</h1>

<br>

<h3>

Partner ID

</h3>

<div style="

background:#fff3eb;

padding:20px;

font-size:30px;

font-weight:bold;

color:#ff6b00;

border-radius:10px;

">

${partnerId}

</div>

<br>

<p>

Status

</p>

<h3 style="color:orange;">

Pending Admin Approval

</h3>

<p>

Please save your Partner ID.

After approval,

use this Partner ID and Password

to login.

</p>

<br>

<button

onclick="window.location='partner-login.html'"

style="

width:100%;

padding:15px;

background:#ff6b00;

color:white;

border:none;

border-radius:10px;

font-size:18px;

cursor:pointer;

">

Go To Login

</button>

</div>

</div>

`;

}
// =====================================
// LOAD LOCATION FROM LOCAL STORAGE
// =====================================

window.onload = function(){

    const address = localStorage.getItem("partnerAddress");

    if(address){

        document.getElementById("address").value = address;

    }

}