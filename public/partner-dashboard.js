// ======================================
// DARVOZ Partner Dashboard
// ======================================

// Logged In Partner

const partner = JSON.parse(localStorage.getItem("partner"));

if(!partner){

    window.location.href="partner-login.html";

}

// =====================================
// REAL TIME NOTIFICATIONS
// =====================================

let lastOrderCount = 0;

async function checkNotifications(){

    try{

        const response = await fetch(

        `http://localhost:5000/partner/orders/${partner.id}`

        );

        const orders = await response.json();

        document.getElementById("notificationCount").innerHTML = orders.length;

        if(lastOrderCount!==0 && orders.length>lastOrderCount){

            new Audio("notification.mp3").play();

            alert("🔔 New Order Received");

        }

        lastOrderCount = orders.length;

    }

    catch(err){

        console.log(err);

    }

}

setInterval(checkNotifications,5000);

checkNotifications();
// ======================================
// SHOW PARTNER DETAILS
// ======================================

// Store Name
document.getElementById("storeName").textContent =
partner.restaurant_name || "Store Name";

// Partner ID
document.getElementById("partnerId").textContent =
partner.partnerId || "DAR0000";

// Owner Name
document.getElementById("ownerName").textContent =
partner.owner_name || "Partner";

// Profile Image
const profileImage = document.querySelector(".profile img");

if(partner.image){

    profileImage.src =
    "http://localhost:5000/uploads/partners/" + partner.image;

}else{

    profileImage.src =
    "images/default-store.png";

}
// ======================================
// STORE PROFILE
// ======================================
async function showProfile(){
    

    try{

        

        const data = await response.json();

        document.querySelector(".content").innerHTML = `

        <div class="profilePage">

            <h2>🏪 Store Profile</h2>

            <br>

            <img
            src="http://localhost:5000/uploads/partners/${data.image}"
            class="profileImage">

            <br><br>

            <label>Store Name</label>

            <input
            id="storeNameInput"
            value="${data.restaurant_name}">

            <label>Owner Name</label>

            <input
            id="ownerNameInput"
            value="${data.owner_name}">

            <label>Mobile</label>

            <input
            id="mobileInput"
            value="${data.mobile}">

            <label>Email</label>

            <input
            id="emailInput"
            value="${data.email}">

            <label>Address</label>

            <textarea
            id="addressInput">${data.address}</textarea>

            <button onclick="saveProfile()">

                Save Changes

            </button>

        </div>

        `;

    }

    catch(err){

        console.log(err);

    }

}
async function saveProfile(){

    const body={

        restaurant_name:
        document.getElementById("storeNameInput").value,

        owner_name:
        document.getElementById("ownerNameInput").value,

        mobile:
        document.getElementById("mobileInput").value,

        email:
        document.getElementById("emailInput").value,

        address:
        document.getElementById("addressInput").value

    };

    const response=await fetch(

        `http://localhost:5000/partner/profile/${partner.id}`,

        {

            method:"PUT",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify(body)

        }

    );

    const result=await response.json();

    if(result.success){

        alert("✅ Profile Updated");

    }

}
