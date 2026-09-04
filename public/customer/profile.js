const API = window.location.origin;

const customerId = localStorage.getItem("customerId");

if(!customerId){

window.location="customer-login.html";

}

loadProfile();

async function loadProfile(){

const res = await fetch(`${API}/customer/profile/${customerId}`);

const data = await res.json();

if(!data.success){

alert("Unable to load profile");

return;

}

document.getElementById("customerName").innerHTML =
data.customer.name;

document.getElementById("customerMobile").innerHTML =
data.customer.mobile;

if(data.customer.profile_image){

document.getElementById("profileImage").src =
`${API}/uploads/${data.customer.profile_image}`;

}

}

function logout(){

localStorage.clear();

window.location="customer-login.html";

}