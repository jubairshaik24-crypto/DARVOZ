// ======================================
// DARVOZ Partner Location
// ======================================

let map;

let latitude = 15.5057;
let longitude = 80.0499;

let currentAddress = "";

// --------------------------------------
// Load Map
// --------------------------------------

function initMap(lat,lng){

    if(map){

        map.remove();

    }

    map = L.map("map").setView([lat,lng],18);

    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom:19,

            attribution:"© OpenStreetMap"

        }

    ).addTo(map);

    latitude = lat;
    longitude = lng;

    getAddress(lat,lng);

    map.on("moveend",()=>{

        const center = map.getCenter();

        latitude = center.lat;
        longitude = center.lng;

        getAddress(latitude,longitude);

    });

}

// --------------------------------------
// Current Location
// --------------------------------------

function getCurrentLocation(){

    if(!navigator.geolocation){

        alert("Geolocation not supported");

        initMap(latitude,longitude);

        return;

    }

    navigator.geolocation.getCurrentPosition(

        function(position){

            initMap(

                position.coords.latitude,

                position.coords.longitude

            );

        },

        function(){

            alert("Unable to fetch current location.");

            initMap(latitude,longitude);

        }

    );

}

// --------------------------------------
// Reverse Geocode
// --------------------------------------

async function getAddress(lat,lng){

    try{

        const response = await fetch(

        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`

        );

        const data = await response.json();

        currentAddress = data.display_name || "";

        document.getElementById("address").innerHTML = currentAddress;

    }

    catch(err){

        console.log(err);

    }

}

// --------------------------------------
// Current Location Button
// --------------------------------------

document

.getElementById("currentBtn")

.addEventListener("click",function(){

    getCurrentLocation();

});

// Load Automatically

getCurrentLocation();


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

    try{

        const response = await fetch(

            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&countrycodes=in&limit=5`

        );

        const places = await response.json();

        searchResults.innerHTML = "";

        if(places.length===0){

            searchResults.style.display="none";
            return;

        }

        searchResults.style.display="block";

        places.forEach(place=>{

            const item=document.createElement("div");

            item.className="searchItem";

            item.innerHTML=place.display_name;

            item.onclick=function(){

                map.setView(

                    [

                        parseFloat(place.lat),

                        parseFloat(place.lon)

                    ],

                    18

                );

                searchResults.style.display="none";

                searchInput.value="";

            };

            searchResults.appendChild(item);

        });

    }

    catch(err){

        console.log(err);

    }

});


// ======================================
// HIDE SEARCH
// ======================================

document.addEventListener("click",function(e){

    if(

        !searchResults.contains(e.target)

        &&

        e.target!==searchInput

    ){

        searchResults.style.display="none";

    }

});


// ======================================
// CONFIRM LOCATION
// ======================================

document

.getElementById("confirmBtn")

.addEventListener("click",function(){

    localStorage.setItem(

        "partnerAddress",

        currentAddress

    );

    localStorage.setItem(

        "partnerLatitude",

        latitude

    );

    localStorage.setItem(

        "partnerLongitude",

        longitude

    );

    window.location.href="partner-register.html";

});

// Load Saved Location

window.addEventListener("load",()=>{

    const address = localStorage.getItem("partnerAddress");

    if(address){``

        document.getElementById("address").value = address;

    }

});