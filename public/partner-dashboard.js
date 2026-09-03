// =====================================================
// DARVOZ PARTNER DASHBOARD
// =====================================================

const API = window.location.origin;


// =====================================================
// CHECK LOGIN
// =====================================================

const partner =
    JSON.parse(localStorage.getItem("partner"));

if (!partner) {
    window.location.href = "partner-login.html";
}


// =====================================================
// SIDE MENU
// =====================================================

const menuBtn =
    document.querySelector(".menu-btn");

const closeBtn =
    document.querySelector(".close");

const sideMenu =
    document.getElementById("sideMenu");

const overlay =
    document.getElementById("overlay");


if (menuBtn) {
    menuBtn.onclick = () => {

        if (sideMenu) {
            sideMenu.classList.add("active");
        }

        if (overlay) {
            overlay.classList.add("active");
        }

    };
}


if (closeBtn) {
    closeBtn.onclick = closeMenu;
}


if (overlay) {
    overlay.onclick = closeMenu;
}


function closeMenu() {

    if (sideMenu) {
        sideMenu.classList.remove("active");
    }

    if (overlay) {
        overlay.classList.remove("active");
    }

}


// =====================================================
// PARTNER DETAILS
// =====================================================

if (partner) {

    const partnerName =
        document.getElementById("partnerName");

    const partnerId =
        document.getElementById("partnerId");


    if (partnerName) {

        partnerName.textContent =
            partner.owner_name ||
            partner.ownerName ||
            partner.restaurant_name ||
            "Partner";

    }


    if (partnerId) {

        partnerId.textContent =
            partner.partnerId ||
            partner.partner_id ||
            partner.id ||
            "N/A";

    }

}


// =====================================================
// SOCKET.IO
// =====================================================

const socket = io(API, {

    transports: [
        "websocket",
        "polling"
    ],

    reconnection: true,

    reconnectionAttempts: Infinity,

    reconnectionDelay: 1000

});


socket.on("connect", () => {

    console.log(
        "✅ Socket Connected:",
        socket.id
    );


    if (
        partner &&
        partner.id
    ) {

        socket.emit(
            "joinPartner",
            partner.id
        );


        console.log(
            "Joined Room:",
            "partner_" + partner.id
        );

    }

});


socket.on(
    "disconnect",
    (reason) => {

        console.log(
            "❌ Socket Disconnected:",
            reason
        );

    }
);


socket.on(
    "connect_error",
    (error) => {

        console.error(
            "❌ Socket Connection Error:",
            error.message
        );

    }
);


// =====================================================
// BROWSER NOTIFICATION PERMISSION
// =====================================================

if ("Notification" in window) {

    Notification.requestPermission()
        .catch(() => {});

}


// =====================================================
// STORE STATUS
// =====================================================

let onlineStatus = "Open";


// =====================================================
// LOAD STORE STATUS
// =====================================================

async function loadStoreStatus() {

    if (
        !partner ||
        !partner.id
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API}/partner/store-status/${partner.id}`
            );


        const data =
            await response.json();


        if (data.success) {

            onlineStatus =
                data.online_status;

            updateStoreButton();

        }

    }

    catch (error) {

        console.error(
            "STORE STATUS ERROR:",
            error
        );

    }

}


// =====================================================
// UPDATE STORE BUTTON
// =====================================================

function updateStoreButton() {

    const status =
        document.getElementById(
            "storeStatus"
        );

    const btn =
        document.getElementById(
            "toggleStoreBtn"
        );


    if (!status || !btn) {
        return;
    }


    if (
        onlineStatus === "Open"
    ) {

        status.innerHTML =
            "🟢 OPEN";

        status.className =
            "store-status open";

        btn.innerHTML =
            "Go Offline";

    }

    else {

        status.innerHTML =
            "🔴 CLOSED";

        status.className =
            "store-status closed";

        btn.innerHTML =
            "Go Online";

    }

}


// =====================================================
// TOGGLE STORE
// =====================================================

const toggleStoreBtn =
    document.getElementById(
        "toggleStoreBtn"
    );


if (toggleStoreBtn) {

    toggleStoreBtn.onclick =
        async () => {

            if (
                !partner ||
                !partner.id
            ) {
                return;
            }


            const oldStatus =
                onlineStatus;


            onlineStatus =
                onlineStatus === "Open"
                    ? "Closed"
                    : "Open";


            updateStoreButton();


            try {

                const response =
                    await fetch(
                        `${API}/partner/store-status`,
                        {

                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    partnerId:
                                        partner.id,

                                    online_status:
                                        onlineStatus

                                })

                        }
                    );


                const data =
                    await response.json();


                if (!data.success) {

                    onlineStatus =
                        oldStatus;

                    updateStoreButton();

                    alert(
                        data.message ||
                        "Unable to update store status."
                    );

                }

            }

            catch (error) {

                console.error(
                    "STORE STATUS UPDATE ERROR:",
                    error
                );


                onlineStatus =
                    oldStatus;

                updateStoreButton();


                alert(
                    "Unable to update store status."
                );

            }

        };

}


// =====================================================
// PARTNER DASHBOARD STATS
// =====================================================

async function loadDashboardStats() {

    if (
        !partner ||
        !partner.id
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API}/partner/dashboard/${partner.id}`
            );


        const data =
            await response.json();


        console.log(
            "Dashboard Stats:",
            data
        );


        const todayOrders =
            document.getElementById(
                "todayOrders"
            );

        const todayRevenue =
            document.getElementById(
                "todayRevenue"
            );

        const pendingOrders =
            document.getElementById(
                "pendingOrders"
            );

        const completedOrders =
            document.getElementById(
                "completedOrders"
            );


        if (todayOrders) {

            todayOrders.textContent =
                data.todayOrders || 0;

        }


        if (todayRevenue) {

            todayRevenue.textContent =
                "₹" +
                Number(
                    data.todayRevenue || 0
                ).toFixed(2);

        }


        if (pendingOrders) {

            pendingOrders.textContent =
                data.pendingOrders || 0;

        }


        if (completedOrders) {

            completedOrders.textContent =
                data.completedOrders || 0;

        }

    }

    catch (error) {

        console.error(
            "DASHBOARD STATS ERROR:",
            error
        );

    }

}


// =====================================================
// PARTNER WALLET BALANCE
// =====================================================

async function loadPartnerWallet() {

    try {

        if (
            !partner ||
            !partner.id
        ) {

            console.log(
                "❌ Partner ID not found"
            );

            return;

        }


        const response =
            await fetch(
                `${API}/partner/wallet/${partner.id}`,
                {
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        console.log(
            "💰 Wallet API Response:",
            data
        );


        if (data.success) {

            const balance =
                Number(
                    data.balance || 0
                );


            const walletElement =
                document.getElementById(
                    "partnerWalletBalance"
                );


            if (walletElement) {

                walletElement.textContent =
                    "₹" +
                    balance.toFixed(2);

            }

        }

        else {

            console.log(
                "❌ Wallet API returned failure:",
                data.message
            );

        }

    }

    catch (error) {

        console.error(
            "❌ WALLET ERROR:",
            error
        );

    }

}


// =====================================================
// RECENT ORDERS
// =====================================================

async function loadOrders() {

    if (
        !partner ||
        !partner.id
    ) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API}/partner/orders/${partner.id}`,
                {
                    cache:"no-store"
                }
            );

        const orders =
            await response.json();

        const container =
            document.getElementById(
                "ordersTable"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";


        // =================================================
        // NO ORDERS
        // =================================================

        if (
            !Array.isArray(orders) ||
            orders.length === 0
        ) {

            container.innerHTML = `
                <div class="order-card">
                    <div class="order-main">
                        <span class="order-id">
                            No Orders Yet
                        </span>
                        <div class="customer">
                            New orders will appear here.
                        </div>
                    </div>
                </div>
            `;

            return;
        }


        // =================================================
        // STATUS CLASS
        // =================================================

        function getStatusClass(status){

            const value =
                String(status || "Pending")
                    .trim()
                    .toLowerCase();

            if (
                value === "new"
            ){
                return "new";
            }

            if (
                value === "preparing"
            ){
                return "preparing";
            }

            if (
                value === "confirmed"
            ){
                return "confirmed";
            }

            if (
                value === "accepted"
            ){
                return "accepted";
            }

            if (
                value === "out for delivery" ||
                value === "out_for_delivery" ||
                value === "out-delivery"
            ){
                return "out-delivery";
            }

            if (
                value === "delivered"
            ){
                return "delivered";
            }

            if (
                value === "cancelled" ||
                value === "canceled"
            ){
                return "cancelled";
            }

            return "pending";
        }


        // =================================================
        // PAYMENT TYPE
        // =================================================

        function getPaymentInfo(order){

            const method =
                String(
                    order.payment ||
                    order.payment_method ||
                    order.paymentMethod ||
                    ""
                )
                .trim()
                .toUpperCase();


            if (
                method === "COD" ||
                method === "CASH" ||
                method === "CASH ON DELIVERY"
            ){

                return {
                    text:"COD",
                    icon:"fa-money-bill-wave",
                    className:"cod"
                };

            }


            return {
                text:"UPI Payment",
                icon:"fa-credit-card",
                className:"upi"
            };

        }


        // =================================================
        // TIME FORMAT
        // =================================================

        function formatOrderTime(order){

            const raw =
                order.created_at ||
                order.createdAt ||
                order.order_date ||
                order.orderDate;

            if (!raw){
                return "";
            }

            const date =
                new Date(raw);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ){
                return "";
            }


            const now =
                new Date();

            const difference =
                Math.floor(
                    (
                        now.getTime() -
                        date.getTime()
                    ) / 60000
                );


            if (difference < 1){
                return "Just now";
            }

            if (difference < 60){
                return `${difference} min${difference === 1 ? "" : "s"} ago`;
            }


            const hours =
                Math.floor(
                    difference / 60
                );


            if (hours < 24){
                return `${hours} hour${hours === 1 ? "" : "s"} ago`;
            }


            const days =
                Math.floor(
                    hours / 24
                );


            return `${days} day${days === 1 ? "" : "s"} ago`;

        }


        // =================================================
        // RENDER ORDERS
        // =================================================

        orders.forEach(
            (order) => {

                const orderId =
                    order.order_id ||
                    order.id ||
                    "";

                const customerName =
                    order.customer_name ||
                    order.customerName ||
                    "Customer";


                const itemCount =
                    order.item_count ||
                    order.items_count ||
                    order.total_items ||
                    order.itemsCount ||
                    "";


                const amount =
                    Number(
                        order.total ||
                        order.grand_total ||
                        0
                    );


                const status =
                    order.status ||
                    "Pending";


                const statusClass =
                    getStatusClass(status);


                const payment =
                    getPaymentInfo(order);


                const orderTime =
                    formatOrderTime(order);


                container.innerHTML += `

                    <div
                        class="order-card"
                        data-order-id="${orderId}"
                    >


                        <!-- ORDER + CUSTOMER -->

                        <div class="order-main">

                            <span class="order-id">

                                #${orderId}

                            </span>


                            <div class="customer">

                                ${customerName}

                                ${
                                    itemCount
                                    ? ` • ${itemCount} Item${Number(itemCount) === 1 ? "" : "s"}`
                                    : ""
                                }

                            </div>

                        </div>


                        <!-- AMOUNT + PAYMENT -->

                        <div class="order-payment">

                            <span class="total">

                                ₹${amount.toFixed(2)}

                            </span>


                            <div
                                class="payment-method ${payment.className}"
                            >

                                <i
                                    class="fa-solid ${payment.icon}"
                                ></i>

                                <span>
                                    ${payment.text}
                                </span>

                            </div>

                        </div>


                        <!-- STATUS -->

                        <span
                            class="order-status ${statusClass}"
                        >

                            ${status}

                        </span>


                        <!-- TIME -->

                        <span class="order-time">

                            ${orderTime}

                        </span>


                        <!-- ARROW -->

                        <span class="order-arrow">

                            <i class="fa-solid fa-chevron-right"></i>

                        </span>


                    </div>

                `;

            }
        );


        // =================================================
        // CLICK ORDER
        // =================================================

        container
            .querySelectorAll(".order-card")
            .forEach(
                (card) => {

                    card.addEventListener(
                        "click",
                        () => {

                            const orderId =
                                card.dataset.orderId;

                            if (!orderId){
                                return;
                            }

                            window.location.href =
                                `partner-order.html?id=${orderId}`;

                        }
                    );

                }
            );

    }

    catch (error) {

        console.error(
            "ORDERS ERROR:",
            error
        );

    }

}



// =====================================================
// NEW ORDER POPUP
// =====================================================

let currentPopupOrder = null;


socket.on(
    "newOrder",
    (order) => {

        console.log(
            "🔥 NEW ORDER RECEIVED:",
            order
        );


        if (
            !order ||
            !(
                order.orderId ||
                order.id
            )
        ) {

            console.error(
                "Invalid new order data"
            );

            return;

        }


        currentPopupOrder =
            order;


        const orderId =
            order.orderId ||
            order.id;


        const customerName =
            order.customer_name ||
            "Customer";


        const amount =
            Number(
                order.grand_total ||
                order.total ||
                0
            );


        // -----------------------------------------
        // POPUP ORDER ID
        // -----------------------------------------

        const popupOrderId =
            document.getElementById(
                "popupOrderId"
            );


        if (popupOrderId) {

            popupOrderId.textContent =
                "#" +
                String(orderId)
                    .padStart(5, "0");

        }


        // -----------------------------------------
        // CUSTOMER
        // -----------------------------------------

        const popupCustomer =
            document.getElementById(
                "popupCustomer"
            );


        if (popupCustomer) {

            popupCustomer.textContent =
                customerName;

        }


        // -----------------------------------------
        // AMOUNT
        // -----------------------------------------

        const popupAmount =
            document.getElementById(
                "popupAmount"
            );


        if (popupAmount) {

            popupAmount.textContent =
                "₹" +
                amount.toFixed(2);

        }


        // -----------------------------------------
        // SHOW POPUP
        // -----------------------------------------

        const popup =
            document.getElementById(
                "newOrderPopup"
            );


        if (popup) {

            popup.classList.add(
                "show"
            );

        }


        // -----------------------------------------
        // SOUND
        // -----------------------------------------

        const sound =
            document.getElementById(
                "orderSound"
            );


        if (sound) {

            sound.currentTime = 0;

            sound.play()
                .catch(
                    (error) => {

                        console.log(
                            "Audio blocked:",
                            error
                        );

                    }
                );

        }


        // -----------------------------------------
        // VIBRATION
        // -----------------------------------------

        if (
            navigator.vibrate
        ) {

            navigator.vibrate([

                500,
                300,
                500,
                300,
                500

            ]);

        }


        // -----------------------------------------
        // BROWSER NOTIFICATION
        // -----------------------------------------

        if (

            "Notification" in window &&

            Notification.permission ===
                "granted"

        ) {

            try {

                new Notification(
                    "🍽 DARVOZ — New Order",
                    {

                        body:
                            `${customerName} placed an order • ₹${amount.toFixed(2)}`,

                        icon:
                            "/icons/icon-192.png"

                    }
                );

            }

            catch (error) {

                console.log(
                    "Notification error:",
                    error
                );

            }

        }


        // -----------------------------------------
        // REFRESH DASHBOARD
        // -----------------------------------------

        loadOrders();

        loadDashboardStats();

        loadPartnerWallet();

    }
);


// =====================================================
// VIEW ORDER BUTTON
// =====================================================

const viewOrderBtn =
    document.getElementById(
        "viewOrderBtn"
    );


if (viewOrderBtn) {

    viewOrderBtn.onclick =
        function () {

            if (
                !currentPopupOrder
            ) {
                return;
            }


            const orderId =
                currentPopupOrder.orderId ||
                currentPopupOrder.id;


            if (!orderId) {
                return;
            }


            window.location.href =
                `partner-order.html?id=${orderId}`;

        };

}


// =====================================================
// CLOSE ORDER POPUP
// =====================================================

const closeOrderPopup =
    document.getElementById(
        "closeOrderPopup"
    );


if (closeOrderPopup) {

    closeOrderPopup.onclick =
        function () {

            const popup =
                document.getElementById(
                    "newOrderPopup"
                );


            if (popup) {

                popup.classList.remove(
                    "show"
                );

            }


            const sound =
                document.getElementById(
                    "orderSound"
                );


            if (sound) {

                sound.pause();

                sound.currentTime = 0;

            }

        };

}


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.onclick =
        function (event) {

            event.preventDefault();


            if (
                confirm("Logout?")
            ) {

                localStorage.removeItem(
                    "partner"
                );

                localStorage.removeItem(
                    "partnerId"
                );


                window.location.href =
                    "partner-login.html";

            }

        };

}


// =====================================================
// INITIAL LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🚀 DARVOZ Partner Dashboard Loaded"
        );


        loadStoreStatus();

        loadDashboardStats();

        loadOrders();

        loadPartnerWallet();

    }
);


// =====================================================
// REFRESH WALLET EVERY 30 SECONDS
// =====================================================

setInterval(
    () => {

        loadPartnerWallet();

    },
    30000
);