const partner = JSON.parse(localStorage.getItem("partner"));

loadOrders();

async function loadOrders(){

    const response = await fetch(

        `http://localhost:5000/partner/orders/${partner.id}`

    );

    const orders = await response.json();

    let html="";

    html+=`

<div class="orderCard">

<div class="orderTop">

<div>

<h3>${order.order_id}</h3>

<p>${order.customer_name}</p>

</div>

<div class="orderAmount">

₹${order.total}

</div>

</div>

<div class="status">

${order.status}

</div>

<div class="timer">

⏳ Accept within 60 sec

</div>

<div class="actions">

<button
class="accept"
onclick="updateStatus(${order.id},'Accepted')">

Accept

</button>

<button
class="reject"
onclick="updateStatus(${order.id},'Rejected')">

Reject

</button>

<button
class="prepare"
onclick="updateStatus(${order.id},'Preparing')">

Preparing

</button>

<button
class="ready"
onclick="updateStatus(${order.id},'Ready')">

Ready

</button>

</div>

</div>

`;

async function updateStatus(id,status){

    await fetch(

        "http://localhost:5000/partner/update-order/"+id,

        {

            method:"PUT",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({status})

        }

    );

    loadOrders();

}
setInterval(function(){

loadOrders();

},5000);
}