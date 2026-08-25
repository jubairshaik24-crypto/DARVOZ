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

    window.location.href =
        "partner-login.html";

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

        sideMenu.classList.add("active");
        overlay.classList.add("active");

    };

}


if (closeBtn) {

    closeBtn.onclick =
        closeMenu;

}


if (overlay) {

    overlay.onclick =
        closeMenu;

}


function closeMenu() {

    if (sideMenu) {

        sideMenu.classList.remove(
            "active"
        );

    }

    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }

}


// =====================================================
// PARTNER DETAILS
// =====================================================

if (partner) {

    const partnerName =
        document.getElementById(
            "partnerName"
        );

    const partnerId =
        document.getElementById(
            "partnerId"
        );


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

    reconnectionAttempts:
        Infinity,

    reconnectionDelay:
        1000

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
            "partner_" +
            partner.id
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
// STORE OPEN / CLOSE STATUS
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

        if (!partner || !partner.id) {

            console.log("❌ Partner ID not found");

            return;

        }

        console.log("=================================");
        console.log("💰 WALLET DEBUG");
        console.log("Partner object:", partner);
        console.log("Partner DB ID:", partner.id);
        console.log("Partner ID:", partner.partnerId);
        console.log(
            "Wallet URL:",
            `${API}/partner/wallet/${partner.id}`
        );
        console.log("=================================");


        const response =
            await fetch(
                `${API}/partner/wallet/${partner.id}`
            );


        console.log(
            "Wallet HTTP Status:",
            response.status
        );


        const data =
            await response.json();


        console.log(
            "💰 Wallet API Response:",
            data
        );


        if (data.success) {

            const balance =
                Number(data.balance || 0);


            const walletElement =
                document.getElementById(
                    "partnerWalletBalance"
                );


            if (walletElement) {

                walletElement.textContent =
                    "₹" +
                    balance.toFixed(2);

            }


            console.log(
                "✅ DISPLAYED WALLET:",
                balance
            );

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
                `${API}/partner/orders/${partner.id}`
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


        if (
            !Array.isArray(orders) ||
            orders.length === 0
        ) {

            container.innerHTML = `

                <div class="order-card">

                    <p>No Orders Yet</p>

                </div>

            `;

            return;

        }


        orders.forEach(
            (order) => {

                container.innerHTML += `

                    <div class="order-card">

                        <div class="order-top">

                            <span class="order-id">

                                #${order.order_id}

                            </span>


                            <span class="order-status">

                                ${order.status || "Pending"}

                            </span>

                        </div>


                        <div class="customer">

                            ${order.customer_name || "Customer"}

                        </div>


                        <div class="total">

                            ₹${Number(
                                order.total ||
                                order.grand_total ||
                                0
                            ).toFixed(2)}

                        </div>

                    </div>

                `;

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