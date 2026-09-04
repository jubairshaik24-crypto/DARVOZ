const partner = JSON.parse(localStorage.getItem("partner"));

if (!partner || !partner.id) {
    alert("Partner login required");
    window.location.href = "partner-login.html";
}

loadOrders();


async function loadOrders() {

    try {

        const response = await fetch(
            `${API}/partner/orders/${partner.id}`
        );

        const orders = await response.json();

        console.log("PARTNER ORDERS:", orders);

        let html = "";


        // ==============================
        // NO ORDERS
        // ==============================

        if (!Array.isArray(orders) || orders.length === 0) {

            html = `
                <div class="noOrders">
                    <h3>No orders available</h3>
                    <p>New customer orders will appear here.</p>
                </div>
            `;

            document.getElementById("ordersContainer").innerHTML = html;

            return;
        }


        // ==============================
        // LOOP ALL ORDERS
        // ==============================

        orders.forEach(function(order) {

            // ==============================
            // ORDER ITEMS
            // ==============================

            let itemsHTML = "";

            if (
                Array.isArray(order.items) &&
                order.items.length > 0
            ) {

                order.items.forEach(function(item) {

                    itemsHTML += `

                        <div class="orderItem">

                            <div>
                                <b>
                                    ${item.product_name || item.name || "Product"}
                                </b>

                                <p>
                                    Qty: ${item.quantity || 1}
                                    ${item.weight ? " • " + item.weight : ""}
                                </p>

                            </div>

                            <div>
                                ₹${Number(
                                    (item.price || 0) *
                                    (item.quantity || 1)
                                ).toFixed(2)}
                            </div>

                        </div>

                    `;

                });

            } else {

                itemsHTML = `

                    <div class="noItems">
                        No order items available
                    </div>

                `;

            }


            // ==============================
            // ORDER CARD
            // ==============================

            html += `

                <div class="orderCard">

                    <div class="orderTop">

                        <div>

                            <h3>
                                ${order.order_id || "Order #" + order.id}
                            </h3>

                            <p>
                                ${order.customer_name || "Customer"}
                            </p>

                        </div>

                        <div class="orderAmount">

                            ₹${order.total || order.amount || 0}

                        </div>

                    </div>


                    <!-- ORDER ITEMS -->

                    <div class="orderItemsList">

                        <h4>Order Items</h4>

                        ${itemsHTML}

                    </div>


                    <!-- STATUS -->

                    <div class="status">

                        ${order.status || "Pending"}

                    </div>


                    <!-- TIMER -->

                    ${
                        order.status === "Pending"
                        ? `
                            <div class="timer">
                                ⏳ Accept within 60 sec
                            </div>
                        `
                        : ""
                    }


                    <!-- ACTIONS -->

                    <div class="actions">

                        ${
                            order.status === "Pending"
                            ? `
                                <button
                                    class="accept"
                                    onclick="updateStatus(${order.id}, 'Accepted')"
                                >
                                    Accept
                                </button>

                                <button
                                    class="reject"
                                    onclick="updateStatus(${order.id}, 'Rejected')"
                                >
                                    Reject
                                </button>
                            `
                            : ""
                        }


                        ${
                            order.status === "Accepted"
                            ? `
                                <button
                                    class="prepare"
                                    onclick="updateStatus(${order.id}, 'Preparing')"
                                >
                                    Preparing
                                </button>
                            `
                            : ""
                        }


                        ${
                            order.status === "Preparing"
                            ? `
                                <button
                                    class="ready"
                                    onclick="updateStatus(${order.id}, 'Ready')"
                                >
                                    Ready
                                </button>
                            `
                            : ""
                        }

                    </div>

                </div>

            `;

        });


        // ==============================
        // DISPLAY ORDERS
        // ==============================

        document.getElementById("ordersContainer").innerHTML = html;

    }

    catch (error) {

        console.error("LOAD ORDERS ERROR:", error);

        document.getElementById("ordersContainer").innerHTML = `

            <div class="noOrders">

                <h3>Unable to load orders</h3>

                <p>Please try again.</p>

            </div>

        `;

    }

}


// ==========================================
// UPDATE ORDER STATUS
// ==========================================

async function updateStatus(id, status) {

    try {

        const response = await fetch(

            `${API}/partner/update-order/${id}`,

            {

                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status: status
                })

            }

        );


        const data = await response.json();

        console.log("STATUS UPDATE:", data);


        if (!response.ok) {

            alert(
                data.message ||
                "Unable to update order status"
            );

            return;

        }


        loadOrders();

    }

    catch (error) {

        console.error(
            "UPDATE STATUS ERROR:",
            error
        );

        alert("Unable to update order status.");

    }

}


// ==========================================
// AUTO REFRESH EVERY 5 SECONDS
// ==========================================

setInterval(function() {

    loadOrders();

}, 5000);