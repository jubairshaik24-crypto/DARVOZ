// =====================================================
// API
// =====================================================

const API = window.location.origin;

// =====================================================
// LOGIN
// =====================================================

const delivery =
    JSON.parse(
        localStorage.getItem("deliveryPartner")
    );

if (!delivery) {

    window.location.href =
        "delivery-login.html";

    throw new Error(
        "Delivery partner not logged in"
    );

}

// =====================================================
// SOCKET.IO
// =====================================================

const socket =
    io(API);

socket.on("connect", () => {

    console.log(
        "✅ Delivery Socket Connected:",
        socket.id
    );

    socket.emit(
        "joinDelivery",
        delivery.id
    );

    console.log(
        "Joined:",
        `delivery_${delivery.id}`
    );

});

socket.on("disconnect", () => {

    console.log(
        "❌ Delivery Socket Disconnected"
    );

});

// =====================================================
// ELEMENT HELPER
// =====================================================

function el(id) {

    return document.getElementById(id);

}

// =====================================================
// MAIN ELEMENTS
// =====================================================

const onlineToggle =
    el("onlineToggle");

const onlineTitle =
    el("onlineTitle");

const onlineSubtitle =
    el("onlineSubtitle");

const onlineDot =
    el("onlineDot");

const searchingCard =
    el("searchingCard");

const newOrderCard =
    el("newOrderCard");

const currentOrder =
    el("currentOrder");

const badge =
    el("badge");

const acceptOrderButton =
    el("acceptOrder");

const rejectOrderButton =
    el("rejectOrder");

// =====================================================
// STATE
// =====================================================

let currentOrderId =
    null;

let currentOrderData =
    null;

let orderTimerInterval =
    null;

let orderReceivedAt =
    null;

let isLoadingCurrentOrder =
    false;

// =====================================================
// NAVIGATION STATE
// =====================================================

let darvozNavigation =
    null;

let googleMapsLoading =
    false;

let googleMapsCallback =
    null;

// =====================================================
// LOCATION STATE
// =====================================================

let lastLocationSentAt =
    0;

const LOCATION_SEND_INTERVAL =
    5000;

// =====================================================
// PROFILE
// =====================================================

async function loadProfile() {

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/profile/${delivery.id}`
            );

        if (!response.ok) {

            console.log(
                "PROFILE HTTP ERROR:",
                response.status
            );

            return;

        }

        const data =
            await response.json();

        console.log(
            "DELIVERY PROFILE:",
            data
        );

        if (
            !data.success ||
            !data.partner
        ) {

            return;

        }

        const partner =
            data.partner;

        // -----------------------------------------
        // NAME
        // -----------------------------------------

        const nameElement =
            el("deliveryName");

        if (
            nameElement &&
            partner.name
        ) {

            nameElement.innerHTML =
                `Hi, ${escapeHTML(partner.name)} 👋`;

        }

        // -----------------------------------------
        // PROFILE IMAGE
        // -----------------------------------------

        if (
            partner.profile_image
        ) {

            const image =
                el("profileImage");

            const icon =
                el("profileIcon");

            if (image) {

                image.src =
                    partner.profile_image;

                image.style.display =
                    "block";

            }

            if (icon) {

                icon.style.display =
                    "none";

            }

        }

        // -----------------------------------------
        // ONLINE STATUS
        // -----------------------------------------

        setOnlineUI(
            partner.online_status === "Online"
        );

    }

    catch (error) {

        console.log(
            "PROFILE ERROR:",
            error
        );

    }

}

// =====================================================
// ONLINE UI
// =====================================================

function setOnlineUI(isOnline) {

    if (!onlineToggle) {

        return;

    }

    onlineToggle.checked =
        isOnline;

    if (isOnline) {

        if (onlineDot) {

            onlineDot.className =
                "online-dot online";

        }

        if (onlineTitle) {

            onlineTitle.innerHTML =
                "You are Online";

        }

        if (onlineSubtitle) {

            onlineSubtitle.innerHTML =
                "You will receive orders";

        }

        if (
            !currentOrderData &&
            newOrderCard &&
            newOrderCard.style.display !== "block"
        ) {

            showSearching();

        }

    }

    else {

        if (onlineDot) {

            onlineDot.className =
                "online-dot offline";

        }

        if (onlineTitle) {

            onlineTitle.innerHTML =
                "You are Offline";

        }

        if (onlineSubtitle) {

            onlineSubtitle.innerHTML =
                "Go online to receive orders";

        }

        hideSearching();

    }

}

// =====================================================
// SEARCHING UI
// =====================================================

function showSearching() {

    if (!searchingCard) {

        return;

    }

    if (
        !onlineToggle ||
        !onlineToggle.checked
    ) {

        hideSearching();

        return;

    }

    if (currentOrderData) {

        hideSearching();

        return;

    }

    if (
        newOrderCard &&
        newOrderCard.style.display === "block"
    ) {

        hideSearching();

        return;

    }

    searchingCard.style.display =
        "block";

    const title =
        el("searchTitle");

    const text =
        el("searchText");

    if (title) {

        title.innerHTML =
            "Searching for orders...";

    }

    if (text) {

        text.innerHTML =
            "Looking for nearby delivery orders";

    }

}

function hideSearching() {

    if (searchingCard) {

        searchingCard.style.display =
            "none";

    }

}

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

async function loadDashboard() {

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/dashboard/${delivery.id}`
            );

        if (!response.ok) {

            console.log(
                "DASHBOARD HTTP ERROR:",
                response.status
            );

            return;

        }

        const data =
            await response.json();

        console.log(
            "DASHBOARD:",
            data
        );

        if (!data.success) {

            return;

        }

        const earnings =
            Number(
                data.todayEarnings || 0
            );

        const walletBalance =
            Number(
                data.walletBalance || 0
            );

        const deliveries =
            Number(
                data.todayDeliveries || 0
            );

        const earningsElement =
            el("earnings");

        const walletBalanceElement =
            el("walletBalance");

        const deliveriesElement =
            el("deliveries");

        const summaryEarnings =
            el("summaryEarnings");

        const summaryOrders =
            el("summaryOrders");

        if (earningsElement) {

            earningsElement.innerHTML =
                `₹${earnings.toFixed(2)}`;

        }

        if (walletBalanceElement) {

            walletBalanceElement.innerHTML =
                `₹${walletBalance.toFixed(2)}`;

        }

        if (deliveriesElement) {

            deliveriesElement.innerHTML =
                deliveries;

        }

        if (summaryEarnings) {

            summaryEarnings.innerHTML =
                `₹${earnings.toFixed(2)}`;

        }

        if (summaryOrders) {

            summaryOrders.innerHTML =
                deliveries;

        }

        // -----------------------------------------
        // ONLINE TIME
        // -----------------------------------------

        if (
            data.onlineTime !== undefined
        ) {

            const onlineTime =
                el("onlineTime");

            const summaryTime =
                el("summaryTime");

            if (onlineTime) {

                onlineTime.innerHTML =
                    data.onlineTime;

            }

            if (summaryTime) {

                summaryTime.innerHTML =
                    data.onlineTime;

            }

        }

        // -----------------------------------------
        // DISTANCE
        // -----------------------------------------

        if (
            data.distance !== undefined
        ) {

            const distance =
                el("distance");

            if (distance) {

                distance.innerHTML =
                    `${data.distance} km`;

            }

        }

    }

    catch (error) {

        console.log(
            "DASHBOARD ERROR:",
            error
        );

    }

}

// =====================================================
// CURRENT ORDER
// =====================================================

async function loadCurrentOrder() {

    if (isLoadingCurrentOrder) {

        return;

    }

    isLoadingCurrentOrder =
        true;

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/current/${delivery.id}`
            );

        if (!response.ok) {

            console.log(
                "❌ CURRENT ORDER HTTP ERROR:",
                response.status
            );

            return;

        }

        const data =
            await response.json();

        console.log(
            "📦 CURRENT ORDER RESPONSE:",
            data
        );

        // -----------------------------------------
        // CURRENT ORDER FOUND
        // -----------------------------------------

        if (
            data.success &&
            data.order
        ) {

            console.log(
                "✅ CURRENT ORDER FOUND:",
                data.order.id
            );

            currentOrderData =
                data.order;

            currentOrderId =
                data.order.id;

            hideSearching();

            if (newOrderCard) {

                newOrderCard.style.display =
                    "none";

                newOrderCard.dataset.visible =
                    "";

            }

            if (badge) {

                badge.style.display =
                    "none";

            }

            if (currentOrder) {

                currentOrder.style.display =
                    "block";

            }

            renderCurrentOrder(
                data.order
            );

            return;

        }

        // -----------------------------------------
        // NO CURRENT ORDER
        // -----------------------------------------

        console.log(
            "ℹ️ No active accepted delivery."
        );

        if (
            newOrderCard &&
            newOrderCard.style.display === "block" &&
            currentOrderId !== null &&
            !currentOrderData
        ) {

            console.log(
                "⏳ Pending order exists. Keeping it."
            );

            return;

        }

        currentOrderData =
            null;

        currentOrderId =
            null;

        if (currentOrder) {

            currentOrder.style.display =
                "none";

        }

        if (
            onlineToggle &&
            onlineToggle.checked
        ) {

            showSearching();

        }

    }

    catch (error) {

        console.log(
            "❌ CURRENT ORDER ERROR:",
            error
        );

    }

    finally {

        isLoadingCurrentOrder =
            false;

    }

}

// =====================================================
// ONLINE / OFFLINE TOGGLE
// =====================================================

if (onlineToggle) {

    onlineToggle.onchange =
        async function () {

            const toggle =
                this;

            const status =
                toggle.checked
                    ? "Online"
                    : "Offline";

            try {

                const response =
                    await fetch(
                        `${API}/deliveryPartner/status`,
                        {

                            method:
                                "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    id:
                                        delivery.id,

                                    status:
                                        status

                                })

                        }
                    );

                if (!response.ok) {

                    toggle.checked =
                        !toggle.checked;

                    return;

                }

                const data =
                    await response.json();

                console.log(
                    "STATUS RESPONSE:",
                    data
                );

                if (!data.success) {

                    toggle.checked =
                        !toggle.checked;

                    return;

                }

                setOnlineUI(
                    status === "Online"
                );

            }

            catch (error) {

                console.log(
                    "STATUS ERROR:",
                    error
                );

                toggle.checked =
                    !toggle.checked;

            }

        };

}

// =====================================================
// NEW ORDER SOCKET
// =====================================================

socket.on(
    "newDeliveryOrder",
    (order) => {

        console.log(
            "🔥 NEW DELIVERY ORDER:",
            order
        );

        if (
            !order ||
            !order.id
        ) {

            console.log(
                "Invalid order received"
            );

            return;

        }

        // -----------------------------------------
        // MUST BE ONLINE
        // -----------------------------------------

        if (
            !onlineToggle ||
            !onlineToggle.checked
        ) {

            console.log(
                "Rider is offline."
            );

            return;

        }

        // -----------------------------------------
        // ALREADY HAS ORDER
        // -----------------------------------------

        if (currentOrderData) {

            console.log(
                "Rider already has current order."
            );

            return;

        }

        currentOrderId =
            order.id;

        currentOrderData =
            null;

        if (newOrderCard) {

            newOrderCard.style.display =
                "block";

            newOrderCard.dataset.visible =
                "true";

        }

        hideSearching();

        renderNewOrder(
            order
        );

        if (badge) {

            badge.style.display =
                "flex";

            badge.innerHTML =
                "1";

        }

        orderReceivedAt =
            Date.now();

        startOrderTimer();

        // -----------------------------------------
        // SOUND
        // -----------------------------------------

        try {

            const audio =
                new Audio(
                    "/assets/sounds/notification.mp3"
                );

            audio.play().catch(
                () => {}
            );

        }

        catch (error) {

            console.log(
                "Audio error:",
                error
            );

        }

        // -----------------------------------------
        // VIBRATION
        // -----------------------------------------

        if (
            navigator.vibrate
        ) {

            navigator.vibrate(
                [500, 300, 500]
            );

        }

        // -----------------------------------------
        // BROWSER NOTIFICATION
        // -----------------------------------------

        if (
            "Notification" in window &&
            Notification.permission === "granted"
        ) {

            try {

                new Notification(
                    "DARVOZ",
                    {

                        body:
                            `New order from ${
                                order.restaurant_name ||
                                "Partner"
                            }`

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

    }

);

// =====================================================
// RENDER NEW ORDER
// =====================================================

function renderNewOrder(order) {

    const restaurant =
        el("restaurant");

    const customer =
        el("customer");

    const restaurantAddress =
        el("restaurantAddress");

    const customerAddress =
        el("customerAddress");

    const deliveryFee =
        el("deliveryFee");

    const amount =
        el("amount");

    const pickupDistance =
        el("pickupDistance");

    const dropDistance =
        el("dropDistance");

    if (restaurant) {

        restaurant.innerHTML =
            escapeHTML(
                order.restaurant_name ||
                "Partner"
            );

    }

    if (customer) {

        customer.innerHTML =
            escapeHTML(
                order.customer_name ||
                "Customer"
            );

    }

    if (restaurantAddress) {

        restaurantAddress.innerHTML =
            escapeHTML(
                order.restaurant_address ||
                order.pickup_address ||
                ""
            );

    }

    if (customerAddress) {

        customerAddress.innerHTML =
            escapeHTML(
                order.address ||
                ""
            );

    }

    if (deliveryFee) {

        deliveryFee.innerHTML =
            `₹${Number(
                order.delivery_fee || 0
            ).toFixed(2)}`;

    }

    if (amount) {

        amount.innerHTML =
            `₹${Number(
                order.grand_total || 0
            ).toFixed(2)}`;

    }

    const pickup =
        order.pickup_distance ??
        order.restaurant_distance;

    const drop =
        order.drop_distance ??
        order.customer_distance;

    if (pickupDistance) {

        pickupDistance.innerHTML =
            pickup !== undefined &&
            pickup !== null
                ? `${pickup} km`
                : "";

    }

    if (dropDistance) {

        dropDistance.innerHTML =
            drop !== undefined &&
            drop !== null
                ? `${drop} km`
                : "";

    }

}

// =====================================================
// ORDER TIMER
// =====================================================

function startOrderTimer() {

    clearInterval(
        orderTimerInterval
    );

    orderTimerInterval =
        setInterval(
            () => {

                if (!orderReceivedAt) {

                    return;

                }

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            orderReceivedAt
                        ) / 1000
                    );

                const timer =
                    el("orderTimer");

                if (timer) {

                    timer.innerHTML =
                        `${seconds} sec`;

                }

            },
            1000
        );

}

// =====================================================
// ACCEPT ORDER
// FIRST RIDER WINS
// =====================================================

if (acceptOrderButton) {

    acceptOrderButton.onclick =
        async function () {

            if (
                currentOrderId === null ||
                currentOrderId === undefined
            ) {

                alert(
                    "No order available to accept."
                );

                return;

            }

            const orderId =
                currentOrderId;

            this.disabled =
                true;

            this.innerHTML =
                "Accepting...";

            try {

                const response =
                    await fetch(
                        `${API}/deliveryPartner/accept/${orderId}`,
                        {

                            method:
                                "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    deliveryId:
                                        delivery.id

                                })

                        }
                    );

                const data =
                    await response.json();

                console.log(
                    "ACCEPT RESPONSE:",
                    data
                );

                if (data.success) {

                    clearInterval(
                        orderTimerInterval
                    );

                    orderReceivedAt =
                        null;

                    if (newOrderCard) {

                        newOrderCard.style.display =
                            "none";

                        newOrderCard.dataset.visible =
                            "";

                    }

                    if (badge) {

                        badge.style.display =
                            "none";

                    }

                    currentOrderId =
                        orderId;

                    await loadCurrentOrder();

                    alert(
                        "✅ Order Accepted!"
                    );

                }

                else {

                    alert(
                        "❌ " +
                        (
                            data.message ||
                            "Order was already accepted by another rider."
                        )
                    );

                    hideNewOrder();

                    currentOrderId =
                        null;

                    currentOrderData =
                        null;

                    if (
                        onlineToggle &&
                        onlineToggle.checked
                    ) {

                        showSearching();

                    }

                }

            }

            catch (error) {

                console.log(
                    "ACCEPT ERROR:",
                    error
                );

                alert(
                    "Unable to accept order."
                );

            }

            finally {

                this.disabled =
                    false;

                this.innerHTML =
                    "Accept Order";

            }

        };

}

// =====================================================
// HIDE NEW ORDER
// =====================================================

function hideNewOrder() {

    clearInterval(
        orderTimerInterval
    );

    orderReceivedAt =
        null;

    if (newOrderCard) {

        newOrderCard.style.display =
            "none";

        newOrderCard.dataset.visible =
            "";

    }

    if (badge) {

        badge.style.display =
            "none";

    }

}

// =====================================================
// REJECT ORDER
// =====================================================

if (rejectOrderButton) {

    rejectOrderButton.onclick =
        async function () {

            if (
                currentOrderId === null ||
                currentOrderId === undefined
            ) {

                return;

            }

            const orderId =
                currentOrderId;

            this.disabled =
                true;

            try {

                const response =
                    await fetch(
                        `${API}/deliveryPartner/reject/${orderId}`,
                        {

                            method:
                                "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    deliveryId:
                                        delivery.id

                                })

                        }
                    );

                let data =
                    null;

                try {

                    data =
                        await response.json();

                }

                catch {

                    data =
                        null;

                }

                console.log(
                    "REJECT RESPONSE:",
                    data
                );

            }

            catch (error) {

                console.log(
                    "REJECT API ERROR:",
                    error
                );

            }

            hideNewOrder();

            currentOrderId =
                null;

            currentOrderData =
                null;

            if (
                onlineToggle &&
                onlineToggle.checked
            ) {

                showSearching();

            }

            this.disabled =
                false;

        };

}

// =====================================================
// RENDER CURRENT ORDER
// =====================================================

function renderCurrentOrder(order) {

    if (!order) {

        return;

    }

    const orderId =
        el("currentOrderId");

    const restaurant =
        el("currentRestaurant");

    const restaurantAddress =
        el("currentRestaurantAddress");

    const customer =
        el("currentCustomer");

    const customerAddress =
        el("currentCustomerAddress");

    if (orderId) {

        orderId.innerHTML =
            `Order ID: #${escapeHTML(order.id)}`;

    }

    if (restaurant) {

        restaurant.innerHTML =
            escapeHTML(
                order.restaurant_name ||
                "Partner"
            );

    }

    if (restaurantAddress) {

        restaurantAddress.innerHTML =
            escapeHTML(
                order.restaurant_address ||
                order.pickup_address ||
                ""
            );

    }

    const status =
        getDeliveryStatus(order);

    const pickedUp =
        isPickedUpOrLater(status);

    if (customer) {

        if (pickedUp) {

            customer.innerHTML =
                escapeHTML(
                    order.customer_name ||
                    "Customer"
                );

        }

        else {

            customer.innerHTML =
                "Customer location";

        }

    }

    if (customerAddress) {

        if (pickedUp) {

            customerAddress.innerHTML =
                escapeHTML(
                    order.address ||
                    ""
                );

        }

        else {

            customerAddress.innerHTML =
                "Available after pickup";

        }

    }

    updateProgress(
        order
    );

    setupPhoneButtons(
        order,
        pickedUp
    );

    setupNavigation(
        order
    );

    updateDeliveryActions(
        order
    );

}

// =====================================================
// DELIVERY STATUS
// =====================================================

function getDeliveryStatus(order) {

    let raw =
        order.delivery_status ??
        order.status ??
        "RiderAccepted";

    raw =
        String(raw)
            .trim()
            .toLowerCase();

    if (
        raw === "waiting"
    ) {

        return "rideraccepted";

    }

    if (
        raw === "delivery assigned" ||
        raw === "deliveryassigned"
    ) {

        return "rideraccepted";

    }

    return raw
        .replace(
            /[\s_-]+/g,
            ""
        );

}

// =====================================================
// STATUS HELPERS
// =====================================================

function isReachedRestaurant(status) {

    return (
        status === "reachedrestaurant" ||
        status === "reached"
    );

}

function isPickedUpOrLater(status) {

    return (
        status === "readyforpickup" ||
        status === "pickedup" ||
        status === "picked" ||
        status === "reachedcustomer" ||
        status === "otpverified" ||
        status === "delivered"
    );

}

function isReachedCustomer(status) {

    return (
        status === "reachedcustomer"
    );

}

function isDelivered(status) {

    return (
        status === "otpverified" ||
        status === "delivered"
    );

}

// =====================================================
// PROGRESS
// =====================================================

function updateProgress(order) {

    const status =
        getDeliveryStatus(order);

    console.log(
        "📊 PROGRESS STATUS:",
        status
    );

    const accepted =
        el("stepAccepted");

    const reached =
        el("stepReached");

    const picked =
        el("stepPicked");

    const delivered =
        el("stepDelivered");

    const currentStatus =
        el("currentStatus");

    const steps = [

        accepted,
        reached,
        picked,
        delivered

    ];

    steps.forEach(
        step => {

            if (step) {

                step.classList.remove(
                    "active"
                );

            }

        }
    );

    // -----------------------------------------
    // ACCEPTED
    // -----------------------------------------

    if (
        status === "rideraccepted" ||
        status === "accepted" ||
        status === "rideraccept" ||
        status === "assigned" ||
        status === "acceptedbyrider"
    ) {

        if (accepted) {

            accepted.classList.add(
                "active"
            );

        }

        if (currentStatus) {

            currentStatus.innerHTML =
                "Going to Restaurant";

        }

        return;

    }

    // -----------------------------------------
    // REACHED RESTAURANT
    // -----------------------------------------

    if (
        status === "reachedrestaurant" ||
        status === "reached"
    ) {

        if (accepted)
            accepted.classList.add("active");

        if (reached)
            reached.classList.add("active");

        if (currentStatus) {

            currentStatus.innerHTML =
                "Reached Restaurant";

        }

        return;

    }

    // -----------------------------------------
    // PICKED UP
    // -----------------------------------------

    if (
        status === "readyforpickup" ||
        status === "pickedup" ||
        status === "picked"
    ) {

        if (accepted)
            accepted.classList.add("active");

        if (reached)
            reached.classList.add("active");

        if (picked)
            picked.classList.add("active");

        if (currentStatus) {

            currentStatus.innerHTML =
                "Picked Up";

        }

        return;

    }

    // -----------------------------------------
    // REACHED CUSTOMER
    // -----------------------------------------

    if (
        status === "reachedcustomer"
    ) {

        if (accepted)
            accepted.classList.add("active");

        if (reached)
            reached.classList.add("active");

        if (picked)
            picked.classList.add("active");

        if (currentStatus) {

            currentStatus.innerHTML =
                "Reached Customer";

        }

        return;

    }

    // -----------------------------------------
    // DELIVERED
    // -----------------------------------------

    if (
        status === "otpverified" ||
        status === "delivered"
    ) {

        steps.forEach(
            step => {

                if (step) {

                    step.classList.add(
                        "active"
                    );

                }

            }
        );

        if (currentStatus) {

            currentStatus.innerHTML =
                "Delivered";

        }

        return;

    }

    // -----------------------------------------
    // FALLBACK
    // -----------------------------------------

    if (accepted) {

        accepted.classList.add(
            "active"
        );

    }

    if (currentStatus) {

        currentStatus.innerHTML =
            "Going to Restaurant";

    }

}

// =====================================================
// DELIVERY ACTIONS
// =====================================================

function updateDeliveryActions(order) {

    const status =
        getDeliveryStatus(order);

    console.log(
        "🚚 DELIVERY STATUS:",
        status
    );

    const navigatePickup =
        el("navigatePickup");

    const navigateCustomer =
        el("navigateCustomer");

    if (navigatePickup) {

        navigatePickup.style.display =
            "none";

    }

    if (navigateCustomer) {

        navigateCustomer.style.display =
            "none";

    }

    // -----------------------------------------
    // RIDER ACCEPTED
    // -----------------------------------------

    if (
        status === "rideraccepted" ||
        status === "accepted" ||
        status === "rideraccept" ||
        status === "assigned" ||
        status === "acceptedbyrider"
    ) {

        if (navigatePickup) {

            navigatePickup.style.display =
                "block";

            navigatePickup.innerHTML = `
                <i class="fa-solid fa-map"></i>
                Navigate to Restaurant
                <i
                    class="fa-solid fa-chevron-right"
                    style="float:right;margin-top:3px">
                </i>
            `;

        }

        setupRestaurantReachedButton(
            order
        );

        return;

    }

    // -----------------------------------------
    // REACHED RESTAURANT
    // -----------------------------------------

    if (
        status === "reachedrestaurant" ||
        status === "reached"
    ) {

        showPickupWaitingUI(
            order
        );

        return;

    }

    // -----------------------------------------
    // PICKED UP
    // -----------------------------------------

    if (
        status === "readyforpickup" ||
        status === "pickedup" ||
        status === "picked"
    ) {

        if (navigateCustomer) {

            navigateCustomer.style.display =
                "block";

            navigateCustomer.innerHTML = `
                <i class="fa-solid fa-location-arrow"></i>
                Navigate to Customer
                <i
                    class="fa-solid fa-chevron-right"
                    style="float:right;margin-top:3px">
                </i>
            `;

        }

        setupReachedCustomerButton(
            order
        );

        return;

    }

    // -----------------------------------------
    // REACHED CUSTOMER
    // -----------------------------------------

    if (
        status === "reachedcustomer"
    ) {

        showOTPUI(
            order
        );

        return;

    }

    // -----------------------------------------
    // DELIVERED
    // -----------------------------------------

    if (
        status === "otpverified" ||
        status === "delivered"
    ) {

        showDeliverySuccess(
            order
        );

        return;

    }

    // -----------------------------------------
    // FALLBACK
    // -----------------------------------------

    if (navigatePickup) {

        navigatePickup.style.display =
            "block";

        navigatePickup.innerHTML = `
            <i class="fa-solid fa-map"></i>
            Navigate to Restaurant
            <i
                class="fa-solid fa-chevron-right"
                style="float:right;margin-top:3px">
            </i>
        `;

    }

    setupRestaurantReachedButton(
        order
    );

}

// =====================================================
// STAGE CONTAINER
// =====================================================

function getStageContainer() {

    let container =
        el("darvozStageActions");

    if (container) {

        return container;

    }

    const current =
        el("currentOrder");

    if (!current) {

        return null;

    }

    container =
        document.createElement("div");

    container.id =
        "darvozStageActions";

    container.style.marginTop =
        "10px";

    current.appendChild(
        container
    );

    return container;

}

// =====================================================
// RESTAURANT REACHED BUTTON
// =====================================================

function setupRestaurantReachedButton(order) {

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    container.innerHTML =
        "";

    const button =
        document.createElement("button");

    button.className =
        "map-btn";

    button.innerHTML = `
        <i class="fa-solid fa-location-dot"></i>
        I Reached Restaurant
    `;

    button.onclick =
        async function () {

            await markReachedRestaurant(
                order
            );

        };

    container.appendChild(
        button
    );

}

// =====================================================
// MARK REACHED RESTAURANT
// =====================================================

async function markReachedRestaurant(order) {

    if (!order) {

        return;

    }

    try {

        // This simple button does not know GPS.
        // The navigation button uses the GPS-aware
        // checkReachedRestaurantFromNavigation() below.

        if (
            !navigator.geolocation
        ) {

            alert(
                "GPS is not available."
            );

            return;

        }

        navigator.geolocation.getCurrentPosition(
            async function(position) {

                try {

                    const response =
                        await fetch(
                            `${API}/deliveryPartner/reached-restaurant/${order.id}`,
                            {

                                method:
                                    "PUT",

                                headers: {

                                    "Content-Type":
                                        "application/json"

                                },

                                body:
                                    JSON.stringify({

                                        deliveryId:
                                            delivery.id,

                                        latitude:
                                            position.coords.latitude,

                                        longitude:
                                            position.coords.longitude

                                    })

                            }
                        );

                    const data =
                        await response.json();

                    console.log(
                        "REACHED RESTAURANT:",
                        data
                    );

                    if (!data.success) {

                        alert(
                            data.message ||
                            "Unable to update restaurant status."
                        );

                        return;

                    }

                    currentOrderData.delivery_status =
                        "ReachedRestaurant";

                    renderCurrentOrder(
                        currentOrderData
                    );

                }

                catch (error) {

                    console.log(
                        "REACHED RESTAURANT ERROR:",
                        error
                    );

                    alert(
                        "Unable to mark restaurant reached."
                    );

                }

            },

            function(error) {

                console.log(
                    "GPS ERROR:",
                    error
                );

                alert(
                    "Unable to get your current location."
                );

            },

            {

                enableHighAccuracy:
                    true,

                maximumAge:
                    5000,

                timeout:
                    10000

            }
        );

    }

    catch (error) {

        console.log(
            "REACHED RESTAURANT ERROR:",
            error
        );

    }

}

// =====================================================
// PICKUP WAITING UI
// =====================================================

function showPickupWaitingUI(order) {

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    container.innerHTML =
        "";

    const box =
        document.createElement("div");

    box.style.background =
        "#fff7f0";

    box.style.border =
        "1px solid #ffe1cd";

    box.style.borderRadius =
        "14px";

    box.style.padding =
        "15px";

    box.innerHTML = `

        <div style="
            font-weight:800;
            color:#ff5a00;
            margin-bottom:8px;
        ">

            📦 Pickup Details

        </div>

        <div style="
            font-size:13px;
            margin-bottom:6px;
        ">

            <strong>Order ID:</strong>
            #${escapeHTML(order.id)}

        </div>

        <div style="
            font-size:13px;
            color:#555;
        ">

            Tell the restaurant this Order ID.

        </div>

        <div style="
            margin-top:10px;
            font-size:13px;
            font-weight:700;
            color:#777;
        ">

            Waiting for restaurant pickup confirmation...

        </div>

    `;

    container.appendChild(
        box
    );

}

// =====================================================
// REACHED CUSTOMER BUTTON
// =====================================================

function setupReachedCustomerButton(order) {

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    container.innerHTML =
        "";

    const button =
        document.createElement("button");

    button.className =
        "map-btn";

    button.innerHTML = `
        <i class="fa-solid fa-location-dot"></i>
        I Reached Customer
    `;

    button.onclick =
        async function () {

            await markReachedCustomer(
                order
            );

        };

    container.appendChild(
        button
    );

}

// =====================================================
// MARK REACHED CUSTOMER
// =====================================================

async function markReachedCustomer(order) {

    if (!order) {

        return;

    }

    try {

        if (
            !navigator.geolocation
        ) {

            alert(
                "GPS is not available."
            );

            return;

        }

        navigator.geolocation.getCurrentPosition(
            async function(position) {

                try {

                    const response =
                        await fetch(
                            `${API}/deliveryPartner/reached-customer/${order.id}`,
                            {

                                method:
                                    "PUT",

                                headers: {

                                    "Content-Type":
                                        "application/json"

                                },

                                body:
                                    JSON.stringify({

                                        deliveryId:
                                            delivery.id,

                                        latitude:
                                            position.coords.latitude,

                                        longitude:
                                            position.coords.longitude

                                    })

                            }
                        );

                    const data =
                        await response.json();

                    console.log(
                        "REACHED CUSTOMER:",
                        data
                    );

                    if (!data.success) {

                        alert(
                            data.message ||
                            "Unable to update customer status."
                        );

                        return;

                    }

                    currentOrderData.delivery_status =
                        "ReachedCustomer";

                    renderCurrentOrder(
                        currentOrderData
                    );

                }

                catch (error) {

                    console.log(
                        "REACHED CUSTOMER ERROR:",
                        error
                    );

                    alert(
                        "Unable to mark customer reached."
                    );

                }

            },

            function(error) {

                console.log(
                    "GPS ERROR:",
                    error
                );

                alert(
                    "Unable to get your current location."
                );

            },

            {

                enableHighAccuracy:
                    true,

                maximumAge:
                    5000,

                timeout:
                    10000

            }
        );

    }

    catch (error) {

        console.log(
            "REACHED CUSTOMER ERROR:",
            error
        );

    }

}

// =====================================================
// OTP UI
// =====================================================

function showOTPUI(order) {

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    const existingInput =
        el("deliveryOtpInput");

    const existingButton =
        el("verifyDeliveryOtp");

    if (
        existingInput &&
        existingButton
    ) {

        console.log(
            "🔐 OTP UI already exists - keeping user input"
        );

        return;

    }

    container.innerHTML =
        "";

    const box =
        document.createElement("div");

    box.style.background =
        "#fff7f0";

    box.style.border =
        "1px solid #ffe1cd";

    box.style.borderRadius =
        "14px";

    box.style.padding =
        "15px";

    box.innerHTML = `

        <div style="
            font-weight:800;
            color:#ff5a00;
            margin-bottom:8px;
        ">

            🔐 Verify Delivery

        </div>

        <div style="
            font-size:13px;
            color:#666;
            margin-bottom:10px;
        ">

            Ask the customer for the delivery OTP.

        </div>

        <input
            id="deliveryOtpInput"
            type="text"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            placeholder="Enter OTP"
            style="
                width:100%;
                height:48px;
                border:1px solid #ddd;
                border-radius:10px;
                padding:0 12px;
                font-size:18px;
                text-align:center;
                letter-spacing:5px;
                outline:none;
            "
        >

        <button
            type="button"
            id="verifyDeliveryOtp"
            class="map-btn"
            style="
                background:#ff5a00;
                color:white;
                margin-top:10px;
            "
        >

            Verify OTP & Deliver

        </button>

    `;

    container.appendChild(
        box
    );

    // =================================================
    // OTP INPUT
    // =================================================

    const input =
        el("deliveryOtpInput");

    if (input) {

        input.addEventListener(
            "input",
            function () {

                this.value =
                    this.value
                        .replace(/\D/g, "")
                        .slice(0, 6);

            }
        );

    }

    // =================================================
    // VERIFY BUTTON
    // =================================================

    const verifyButton =
        el("verifyDeliveryOtp");

    if (!verifyButton) {

        return;

    }

    verifyButton.onclick =
        async function () {

            const input =
                el("deliveryOtpInput");

            const otp =
                input
                    ? input.value.trim()
                    : "";

            if (!otp) {

                alert(
                    "Please enter the OTP."
                );

                return;

            }

            if (!/^\d{4}$/.test(otp)) {

                alert(
                    "Please enter the 4-digit OTP."
                );

                return;

            }

            this.disabled =
                true;

            this.innerHTML =
                "Verifying...";

            try {

                const response =
                    await fetch(
                        `${API}/deliveryPartner/verify-otp/${order.id}`,
                        {

                            method:
                                "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    deliveryId:
                                        delivery.id,

                                    otp:
                                        otp

                                })

                        }
                    );

                const data =
                    await response.json();

                console.log(
                    "OTP RESPONSE:",
                    data
                );

                if (!data.success) {

                    alert(
                        data.message ||
                        "Invalid OTP."
                    );

                    this.disabled =
                        false;

                    this.innerHTML =
                        "Verify OTP & Deliver";

                    return;

                }

                currentOrderData.delivery_status =
                    "Delivered";

                alert(
                    "✅ Delivery completed successfully!"
                );

                renderCurrentOrder(
                    currentOrderData
                );

            }

            catch (error) {

                console.log(
                    "OTP ERROR:",
                    error
                );

                alert(
                    "Unable to verify OTP."
                );

                this.disabled =
                    false;

                this.innerHTML =
                    "Verify OTP & Deliver";

            }

        };

}

// =====================================================
// DELIVERY SUCCESS
// =====================================================

function showDeliverySuccess(order) {

    stopDarvozNavigation();

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    if (
        container.dataset.completed === "true"
    ) {

        return;

    }

    container.dataset.completed =
        "true";

    const fee =
        Number(
            order.delivery_fee || 0
        );

    container.innerHTML = `

        <div style="
            background:#effaf5;
            border:1px solid #bfe8d4;
            border-radius:15px;
            padding:18px;
            text-align:center;
        ">

            <div style="
                font-size:34px;
                margin-bottom:8px;
            ">

                ✅

            </div>

            <div style="
                font-size:18px;
                font-weight:800;
                color:#1ba672;
            ">

                Delivery Completed

            </div>

            <div style="
                margin-top:10px;
                font-size:14px;
                color:#555;
            ">

                Thank you for delivering with DARVOZ.

            </div>

            <div style="
                margin-top:14px;
                font-size:20px;
                font-weight:800;
                color:#1ba672;
            ">

                You earned ₹${fee.toFixed(2)}

            </div>

            <div style="
                margin-top:5px;
                font-size:12px;
                color:#777;
            ">

                Delivery fee credited to your earnings.

            </div>

        </div>

    `;

    setTimeout(
        async () => {

            currentOrderData =
                null;

            currentOrderId =
                null;

            if (currentOrder) {

                currentOrder.style.display =
                    "none";

            }

            if (
                onlineToggle &&
                onlineToggle.checked
            ) {

                showSearching();

            }

            await loadDashboard();

        },
        5000
    );

}

// =====================================================
// PHONE BUTTONS
// =====================================================

function setupPhoneButtons(
    order,
    customerAvailable
) {

    const restaurantPhone =
        order.restaurant_mobile ||
        order.partner_mobile ||
        null;

    const customerPhone =
        order.mobile ||
        order.customer_mobile ||
        null;

    const restaurantCall =
        el("restaurantCall");

    const customerCall =
        el("customerCall");

    if (restaurantCall) {

        restaurantCall.onclick =
            function () {

                if (restaurantPhone) {

                    window.location.href =
                        `tel:${restaurantPhone}`;

                }

                else {

                    alert(
                        "Restaurant phone number is not available."
                    );

                }

            };

    }

    if (customerCall) {

        customerCall.style.display =
            customerAvailable
                ? "block"
                : "none";

        customerCall.onclick =
            function () {

                if (customerPhone) {

                    window.location.href =
                        `tel:${customerPhone}`;

                }

                else {

                    alert(
                        "Customer phone number is not available."
                    );

                }

            };

    }

}

// =====================================================
// NAVIGATION SETUP
// =====================================================

function setupNavigation(order) {

    const navigatePickup =
        el("navigatePickup");

    const navigateCustomer =
        el("navigateCustomer");

    // -----------------------------------------
    // RESTAURANT
    // -----------------------------------------

    if (navigatePickup) {

        navigatePickup.onclick =
            function () {

                const restaurantLat =
                    getNumber(
                        order.restaurant_lat ??
                        order.pickup_lat ??
                        order.restaurant_latitude
                    );

                const restaurantLng =
                    getNumber(
                        order.restaurant_lng ??
                        order.pickup_lng ??
                        order.restaurant_longitude
                    );

                console.log(
                    "🏪 RESTAURANT GPS:",
                    restaurantLat,
                    restaurantLng
                );

                if (
                    !Number.isFinite(restaurantLat) ||
                    !Number.isFinite(restaurantLng)
                ) {

                    alert(
                        "Restaurant GPS location is not available."
                    );

                    return;

                }

                openDarvozNavigation({

                    type:
                        "restaurant",

                    destinationLat:
                        restaurantLat,

                    destinationLng:
                        restaurantLng,

                    destinationName:
                        order.restaurant_name ||
                        "Partner Store"

                });

            };

    }

    // -----------------------------------------
    // CUSTOMER
    // -----------------------------------------

    if (navigateCustomer) {

        navigateCustomer.onclick =
            function () {

                const customerLat =
                    getNumber(
                        order.customer_lat ??
                        order.delivery_lat ??
                        order.customer_latitude
                    );

                const customerLng =
                    getNumber(
                        order.customer_lng ??
                        order.delivery_lng ??
                        order.customer_longitude
                    );

                console.log(
                    "🏠 CUSTOMER GPS:",
                    customerLat,
                    customerLng
                );

                if (
                    !Number.isFinite(customerLat) ||
                    !Number.isFinite(customerLng)
                ) {

                    alert(
                        "Customer GPS location is not available."
                    );

                    return;

                }

                openDarvozNavigation({

                    type:
                        "customer",

                    destinationLat:
                        customerLat,

                    destinationLng:
                        customerLng,

                    destinationName:
                        order.customer_name ||
                        "Customer"

                });

            };

    }

}

// =====================================================
// OPEN DARVOZ NAVIGATION
// =====================================================

function openDarvozNavigation(options) {

    console.log(
        "🗺️ OPENING DARVOZ NAVIGATION:",
        options
    );

    const lat =
        Number(
            options.destinationLat
        );

    const lng =
        Number(
            options.destinationLng
        );

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        alert(
            "Destination coordinates are invalid."
        );

        return;

    }

    stopDarvozNavigation();

    darvozNavigation = {

        type:
            options.type,

        destinationLat:
            lat,

        destinationLng:
            lng,

        destinationName:
            options.destinationName ||
            "Destination",

        map:
            null,

        directionsService:
            null,

        directionsRenderer:
            null,

        riderMarker:
            null,

        destinationMarker:
            null,

        riderLocation:
            null,

        watchId:
            null,

        navigationStarted:
            false,

        mapCentered:
            false,

        routeRequestRunning:
            false,

        lastRouteTime:
            0,

        gpsFallbackStarted:
            false,

        gpsReceived:
            false,

        lastHeading:
            0

    };

    createDarvozNavigationScreen();

    const screen =
        el("darvozNavigationScreen");

    if (screen) {

        screen.style.display =
            "flex";

    }

    const destinationElement =
        el("darvozNavDestination");

    if (destinationElement) {

        destinationElement.innerHTML =
            escapeHTML(
                darvozNavigation.destinationName
            );

    }

    setNavigationInfo(
        "Getting GPS...",
        "Getting GPS..."
    );

    loadDarvozGoogleMaps(
        function () {

            initializeDarvozNavigation();

        }
    );

}

// =====================================================
// CREATE NAVIGATION SCREEN
// =====================================================

function createDarvozNavigationScreen() {

    let screen =
        el("darvozNavigationScreen");

    if (screen) {

        return;

    }

    screen =
        document.createElement("div");

    screen.id =
        "darvozNavigationScreen";

    screen.innerHTML = `

        <div
            class="darvoz-nav-header"
            id="darvozNavHeader">

            <button
                type="button"
                id="darvozNavBack"
                class="darvoz-nav-back">

                <i class="fa-solid fa-arrow-left"></i>

            </button>

            <div>

                <div class="darvoz-nav-title">

                    DARVOZ Navigation

                </div>

                <div
                    id="darvozNavDestination"
                    class="darvoz-nav-destination">

                    Destination

                </div>

            </div>

        </div>

        <div
            id="darvozGoogleMap"
            class="darvoz-google-map">

        </div>

        <div class="darvoz-nav-bottom">

            <div class="darvoz-next-turn">

                <div
                    id="darvozTurnIcon"
                    class="darvoz-turn-icon">

                    ⬆️

                </div>

                <div class="darvoz-turn-details">

                    <div
                        id="darvozTurnInstruction"
                        class="darvoz-turn-instruction">

                        Continue straight

                    </div>

                    <div
                        id="darvozTurnDistance"
                        class="darvoz-turn-distance">

                        --

                    </div>

                </div>

            </div>

            <div class="darvoz-nav-summary">

                <div class="darvoz-nav-main">

                    <span
                        id="darvozNavTime">

                        --

                    </span>

                    <span class="darvoz-summary-dot">

                        ·

                    </span>

                    <span
                        id="darvozNavDistance">

                        --

                    </span>

                </div>

                <div
                    id="darvozArrivalTime"
                    class="darvoz-arrival-time">

                    Arrive --

                </div>

                <button
                    type="button"
                    class="darvoz-recenter-btn"
                    onclick="recenterDarvozNavigationMap()">

                    <i class="fa-solid fa-crosshairs"></i>

                </button>

            </div>

            <button
                id="darvozStartNavigation"
                class="darvoz-start-btn">

                <i class="fa-solid fa-location-arrow"></i>

                START NAVIGATION

            </button>

            <button
                id="darvozReachedPartner"
                class="darvoz-reached-btn"
                style="display:none">

                <i class="fa-solid fa-store"></i>

                Reached at Partner Store

            </button>

            <button
                id="darvozReachedCustomer"
                class="darvoz-reached-btn"
                style="display:none">

                <i class="fa-solid fa-location-dot"></i>

                Reached Customer

            </button>

        </div>

    `;

    document.body.appendChild(
        screen
    );

    addDarvozNavigationCSS();

    // -----------------------------------------
    // BACK
    // -----------------------------------------

    const back =
        el("darvozNavBack");

    if (back) {

        back.onclick =
            function () {

                stopDarvozNavigation();

                screen.style.display =
                    "none";

            };

    }

    // -----------------------------------------
    // START
    // -----------------------------------------

    const start =
        el("darvozStartNavigation");

    if (start) {

        start.onclick =
            function () {

                startDarvozNavigation();

            };

    }

    // -----------------------------------------
    // REACHED RESTAURANT
    // -----------------------------------------

    const reachedPartner =
        el("darvozReachedPartner");

    if (reachedPartner) {

        reachedPartner.onclick =
            async function () {

                this.disabled =
                    true;

                this.innerHTML =
                    "Checking location...";

                await checkReachedRestaurantFromNavigation();

                this.disabled =
                    false;

                this.innerHTML = `
                    <i class="fa-solid fa-store"></i>
                    Reached at Partner Store
                `;

            };

    }

    // -----------------------------------------
    // REACHED CUSTOMER
    // -----------------------------------------

    const reachedCustomer =
        el("darvozReachedCustomer");

    if (reachedCustomer) {

        reachedCustomer.onclick =
            async function () {

                this.disabled =
                    true;

                this.innerHTML =
                    "Checking location...";

                await checkReachedCustomerFromNavigation();

                this.disabled =
                    false;

                this.innerHTML = `
                    <i class="fa-solid fa-location-dot"></i>
                    Reached Customer
                `;

            };

    }

}

// =====================================================
// GOOGLE MAPS LOADER
// =====================================================

function loadDarvozGoogleMaps(callback) {

    if (
        window.google &&
        window.google.maps
    ) {

        callback();

        return;

    }

    if (googleMapsLoading) {

        googleMapsCallback =
            callback;

        return;

    }

    googleMapsLoading =
        true;

    googleMapsCallback =
        callback;

    const script =
        document.createElement("script");

    script.src =
        "https://maps.googleapis.com/maps/api/js?key=AIzaSyDFSLc0npyYLrB-JMhkaCg6Q1xlPNE8TfQ&libraries=geometry";

    script.async =
        true;

    script.defer =
        true;

    script.onload =
        function () {

            console.log(
                "✅ GOOGLE MAPS API LOADED"
            );

            googleMapsLoading =
                false;

            if (googleMapsCallback) {

                const callbackFunction =
                    googleMapsCallback;

                googleMapsCallback =
                    null;

                callbackFunction();

            }

        };

    script.onerror =
        function () {

            console.log(
                "❌ GOOGLE MAPS API FAILED"
            );

            googleMapsLoading =
                false;

            googleMapsCallback =
                null;

            alert(
                "Unable to load Google Maps."
            );

        };

    document.head.appendChild(
        script
    );

}

// =====================================================
// INITIALIZE GOOGLE MAP
// =====================================================

function initializeDarvozNavigation() {

    if (!darvozNavigation) {

        return;

    }

    const mapElement =
        el("darvozGoogleMap");

    if (!mapElement) {

        console.log(
            "❌ MAP ELEMENT NOT FOUND"
        );

        return;

    }

    const destination = {

        lat:
            darvozNavigation.destinationLat,

        lng:
            darvozNavigation.destinationLng

    };

    darvozNavigation.map =
        new google.maps.Map(
            mapElement,
            {

                center:
                    destination,

                zoom:
                    15,

                mapTypeControl:
                    false,

                streetViewControl:
                    false,

                fullscreenControl:
                    false,

                zoomControl:
                    true

            }
        );

    darvozNavigation.directionsService =
        new google.maps.DirectionsService();

    darvozNavigation.directionsRenderer =
        new google.maps.DirectionsRenderer({

            map:
                darvozNavigation.map,

            suppressMarkers:
                true,

            preserveViewport:
                true,

            polylineOptions: {

                strokeColor:
                    "#1557D5",

                strokeOpacity:
                    0.9,

                strokeWeight:
                    6

            }

        });

    darvozNavigation.destinationMarker =
        new google.maps.Marker({

            position:
                destination,

            map:
                darvozNavigation.map,

            title:
                darvozNavigation.destinationName,

            label: {

                text:
                    darvozNavigation.type ===
                    "customer"
                        ? "📍"
                        : "🏪",

                fontSize:
                    "24px"

            }

        });

    console.log(
        "✅ DARVOZ MAP READY"
    );

    startDarvozGPS();

    setTimeout(
        () => {

            if (
                darvozNavigation &&
                !darvozNavigation.gpsReceived
            ) {

                requestHighAccuracyGPS();

            }

        },
        8000
    );

}

// =====================================================
// START GPS
// =====================================================

function startDarvozGPS() {

    if (!navigator.geolocation) {

        console.log(
            "❌ GEOLOCATION NOT SUPPORTED"
        );

        setNavigationInfo(
            "GPS unavailable",
            "GPS unavailable"
        );

        alert(
            "Your phone does not support GPS."
        );

        return;

    }

    if (!darvozNavigation) {

        return;

    }

    if (
        darvozNavigation.watchId !== null
    ) {

        return;

    }

    console.log(
        "📍 STARTING GPS WATCH..."
    );

    darvozNavigation.watchId =
        navigator.geolocation.watchPosition(

            function (position) {

                handleDarvozGPS(
                    position
                );

            },

            function (error) {

                console.log(
                    "⚠️ GPS WATCH ERROR:",
                    error.code,
                    error.message
                );

                if (
                    error.code === 3 &&
                    darvozNavigation &&
                    !darvozNavigation.gpsReceived
                ) {

                    requestHighAccuracyGPS();

                }

                if (
                    error.code === 1
                ) {

                    setNavigationInfo(
                        "Permission denied",
                        "Permission denied"
                    );

                }

            },

            {

                enableHighAccuracy:
                    false,

                maximumAge:
                    10000,

                timeout:
                    20000

            }

        );

}

// =====================================================
// HIGH ACCURACY GPS FALLBACK
// =====================================================

function requestHighAccuracyGPS() {

    if (!darvozNavigation) {

        return;

    }

    if (
        darvozNavigation.gpsFallbackStarted
    ) {

        return;

    }

    darvozNavigation.gpsFallbackStarted =
        true;

    console.log(
        "📍 REQUESTING HIGH ACCURACY GPS..."
    );

    navigator.geolocation.getCurrentPosition(

        function (position) {

            handleDarvozGPS(
                position
            );

        },

        function (error) {

            console.log(
                "❌ HIGH ACCURACY GPS ERROR:",
                error.code,
                error.message
            );

            if (!darvozNavigation) {

                return;

            }

            if (
                !darvozNavigation.gpsReceived
            ) {

                if (
                    error.code === 1
                ) {

                    setNavigationInfo(
                        "Location denied",
                        "Location denied"
                    );

                    alert(
                        "Location permission is denied. Allow location permission for DARVOZ."
                    );

                }

                else if (
                    error.code === 2
                ) {

                    setNavigationInfo(
                        "Location unavailable",
                        "Location unavailable"
                    );

                    alert(
                        "Turn ON Location/GPS on your phone and try again."
                    );

                }

                else if (
                    error.code === 3
                ) {

                    setNavigationInfo(
                        "GPS timeout",
                        "GPS timeout"
                    );

                    console.log(
                        "❌ GPS TIMEOUT - CHECK ANDROID LOCATION SETTINGS"
                    );

                }

            }

        },

        {

            enableHighAccuracy:
                true,

            timeout:
                30000,

            maximumAge:
                5000

        }

    );

}

// =====================================================
// CREATE RIDER ARROW MARKER
// =====================================================

function createRiderMarker(
    map,
    position,
    heading = 0
) {

    if (window.riderMarker) {

        window.riderMarker.setMap(
            null
        );

    }

    const riderArrow = {

        path:
            google.maps.SymbolPath
                .FORWARD_CLOSED_ARROW,

        scale:
            7,

        fillColor:
            "#1557D5",

        fillOpacity:
            1,

        strokeColor:
            "#FFFFFF",

        strokeWeight:
            2,

        rotation:
            heading

    };

    const riderMarker =
        new google.maps.Marker({

            position:
                position,

            map:
                map,

            icon:
                riderArrow,

            anchorPoint:
                new google.maps.Point(
                    0,
                    0
                ),

            zIndex:
                1000,

            optimized:
                false

        });

    window.riderMarker =
        riderMarker;

    return riderMarker;

}

// =====================================================
// HANDLE GPS
// =====================================================

function handleDarvozGPS(position) {

    if (!darvozNavigation) {

        return;

    }

    const latitude =
        Number(
            position.coords.latitude
        );

    const longitude =
        Number(
            position.coords.longitude
        );

    const accuracy =
        Number(
            position.coords.accuracy
        );

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        console.log(
            "❌ INVALID GPS DATA"
        );

        return;

    }

    darvozNavigation.gpsReceived =
        true;

    darvozNavigation.riderLocation = {

        lat:
            latitude,

        lng:
            longitude

    };

    console.log(
        "📍 GPS:",
        latitude,
        longitude,
        "accuracy:",
        accuracy
    );

    // -----------------------------------------
    // RIDER DIRECTION / HEADING
    // -----------------------------------------

    const heading =
        Number(
            position.coords.heading
        );

    if (
        Number.isFinite(heading) &&
        heading >= 0
    ) {

        darvozNavigation.lastHeading =
            heading;

    }

    // -----------------------------------------
    // RIDER MARKER
    // -----------------------------------------

    updateDarvozRiderMarker(
        darvozNavigation.riderLocation
    );

    // -----------------------------------------
    // ROUTE
    // -----------------------------------------

    calculateDarvozRoute(
        false
    );

    // -----------------------------------------
    // BACKEND LOCATION
    // -----------------------------------------

    sendDarvozLocation(
        latitude,
        longitude
    );

}

// =====================================================
// START NAVIGATION BUTTON
// =====================================================

function startDarvozNavigation() {

    if (!darvozNavigation) {

        return;

    }

    console.log(
        "🚀 START NAVIGATION CLICKED"
    );

    darvozNavigation.navigationStarted =
        true;

    const startButton =
        el("darvozStartNavigation");

    if (startButton) {

        startButton.style.display =
            "none";

    }

    // -----------------------------------------
    // SHOW REACHED BUTTON
    // -----------------------------------------

    if (
        darvozNavigation.type ===
        "restaurant"
    ) {

        const button =
            el("darvozReachedPartner");

        if (button) {

            button.style.display =
                "block";

        }

    }

    if (
        darvozNavigation.type ===
        "customer"
    ) {

        const button =
            el("darvozReachedCustomer");

        if (button) {

            button.style.display =
                "block";

        }

    }

    // -----------------------------------------
    // GPS IS ALREADY RUNNING
    // -----------------------------------------

    if (
        darvozNavigation.watchId === null
    ) {

        startDarvozGPS();

    }

    // -----------------------------------------
    // FORCE ROUTE
    // -----------------------------------------

    if (
        darvozNavigation.riderLocation
    ) {

        calculateDarvozRoute(
            true
        );

    }

}

// =====================================================
// RIDER MARKER
// =====================================================

function updateDarvozRiderMarker(
    location
) {

    if (
        !darvozNavigation ||
        !darvozNavigation.map
    ) {

        return;

    }

    const heading =
        darvozNavigation.lastHeading || 0;

    if (
        !darvozNavigation.riderMarker
    ) {

        darvozNavigation.riderMarker =
            createRiderMarker(
                darvozNavigation.map,
                location,
                heading
            );

        window.riderMarker =
            darvozNavigation.riderMarker;

    }

    else {

        darvozNavigation
            .riderMarker
            .setPosition(
                location
            );

        const icon =
            darvozNavigation
                .riderMarker
                .getIcon();

        if (icon) {

            icon.rotation =
                heading;

            darvozNavigation
                .riderMarker
                .setIcon(
                    icon
                );

        }

    }

    if (
        !darvozNavigation.mapCentered
    ) {

        darvozNavigation.map.panTo(
            location
        );

        darvozNavigation.map.setZoom(
            17
        );

        darvozNavigation.mapCentered =
            true;

    }

}

// =====================================================
// RECENTER NAVIGATION MAP
// =====================================================

function recenterDarvozNavigationMap() {

    if (
        !darvozNavigation ||
        !darvozNavigation.map ||
        !darvozNavigation.riderLocation
    ) {

        return;

    }

    const map =
        darvozNavigation.map;

    const rider =
        new google.maps.LatLng(

            Number(
                darvozNavigation
                    .riderLocation
                    .lat
            ),

            Number(
                darvozNavigation
                    .riderLocation
                    .lng
            )

        );

    map.panTo(
        rider
    );

    const zoom =
        map.getZoom();

    if (
        !zoom ||
        zoom < 17
    ) {

        map.setZoom(
            17
        );

    }

    console.log(
        "🎯 RECENTERED ON RIDER"
    );

}

// =====================================================
// UPDATE NEXT TURN NAVIGATION
// =====================================================

function updateDarvozNextTurn(
    leg
) {

    if (
        !leg ||
        !leg.steps ||
        !leg.steps.length
    ) {

        return;

    }

    const steps =
        leg.steps;

    let nextStep =
        null;

    for (
        let i = 0;
        i < steps.length;
        i++
    ) {

        if (
            steps[i].distance &&
            Number(
                steps[i].distance.value
            ) > 0
        ) {

            nextStep =
                steps[i];

            break;

        }

    }

    if (!nextStep) {

        nextStep =
            steps[0];

    }

    const maneuver =
        nextStep.maneuver || "";

    const instruction =
        nextStep.instructions
            ? nextStep.instructions
                .replace(
                    /<[^>]*>/g,
                    ""
                )
            : "Continue straight";

    const distance =
        nextStep.distance &&
        nextStep.distance.text
            ? nextStep.distance.text
            : "--";

    const iconElement =
        el("darvozTurnIcon");

    const instructionElement =
        el("darvozTurnInstruction");

    const distanceElement =
        el("darvozTurnDistance");

    let icon =
        "⬆️";

    if (
        maneuver.includes(
            "left"
        )
    ) {

        icon =
            "⬅️";

    }

    else if (
        maneuver.includes(
            "right"
        )
    ) {

        icon =
            "➡️";

    }

    else if (
        maneuver.includes(
            "uturn"
        )
    ) {

        icon =
            "↩️";

    }

    else if (
        maneuver.includes(
            "roundabout"
        )
    ) {

        icon =
            "↪️";

    }

    if (iconElement) {

        iconElement.innerHTML =
            icon;

    }

    if (instructionElement) {

        instructionElement.textContent =
            instruction;

    }

    if (distanceElement) {

        distanceElement.textContent =
            distance;

    }

    console.log(
        "🧭 NEXT TURN:",
        maneuver,
        instruction,
        distance
    );

}

// =====================================================
// CALCULATE ROUTE
// =====================================================

function calculateDarvozRoute(
    force = false
) {

    if (!darvozNavigation) {

        return;

    }

    if (
        !darvozNavigation.riderLocation
    ) {

        console.log(
            "⏳ ROUTE WAITING FOR RIDER GPS"
        );

        return;

    }

    if (
        !darvozNavigation.directionsService ||
        !darvozNavigation.directionsRenderer
    ) {

        console.log(
            "⏳ ROUTE WAITING FOR GOOGLE MAPS"
        );

        return;

    }

    const now =
        Date.now();

    if (
        !force &&
        darvozNavigation.lastRouteTime &&
        (
            now -
            darvozNavigation.lastRouteTime
        ) < 15000
    ) {

        return;

    }

    if (
        darvozNavigation.routeRequestRunning
    ) {

        return;

    }

    darvozNavigation.routeRequestRunning =
        true;

    darvozNavigation.lastRouteTime =
        now;

    const origin = {

        lat:
            darvozNavigation.riderLocation.lat,

        lng:
            darvozNavigation.riderLocation.lng

    };

    const destination = {

        lat:
            darvozNavigation.destinationLat,

        lng:
            darvozNavigation.destinationLng

    };

    console.log(
        "🛣️ CALCULATING ROUTE"
    );

    console.log(
        "🚴 ORIGIN:",
        origin
    );

    console.log(
        "📍 DESTINATION:",
        destination
    );

    darvozNavigation.directionsService.route(

        {

            origin:
                origin,

            destination:
                destination,

            travelMode:
                google.maps.TravelMode.DRIVING,

            provideRouteAlternatives:
                false

        },

        function (
            result,
            status
        ) {

            if (!darvozNavigation) {

                return;

            }

            darvozNavigation.routeRequestRunning =
                false;

            console.log(
                "🗺️ DIRECTIONS STATUS:",
                status
            );

            if (
                status !== "OK"
            ) {

                console.log(
                    "❌ DIRECTIONS ERROR:",
                    status
                );

                setNavigationInfo(
                    "Unavailable",
                    "Unavailable"
                );

                return;

            }

            if (
                !result ||
                !result.routes ||
                !result.routes.length
            ) {

                console.log(
                    "❌ NO ROUTE"
                );

                return;

            }

            darvozNavigation
                .directionsRenderer
                .setDirections(
                    result
                );

            const route =
                result.routes[0];

            recenterDarvozNavigationMap();

            if (
                !route.legs ||
                !route.legs.length
            ) {

                console.log(
                    "❌ ROUTE LEG MISSING"
                );

                return;

            }

            const leg =
                route.legs[0];

            // -----------------------------------------
            // NEXT TURN
            // -----------------------------------------

            updateDarvozNextTurn(
                leg
            );

            // -----------------------------------------
            // DISTANCE
            // -----------------------------------------

            const distance =
                leg.distance &&
                leg.distance.text
                    ? leg.distance.text
                    : "--";

            // -----------------------------------------
            // ETA
            // -----------------------------------------

            const eta =
                leg.duration &&
                leg.duration.text
                    ? leg.duration.text
                    : "--";

            console.log(
                "📏 DISTANCE:",
                distance
            );

            console.log(
                "⏱️ ETA:",
                eta
            );

            setNavigationInfo(
                distance,
                eta
            );

        }

    );

}

// =====================================================
// SET NAVIGATION INFO
// =====================================================

function setNavigationInfo(
    distance,
    eta
) {

    const distanceElement =
        el("darvozNavDistance");

    const etaElement =
        el("darvozNavTime");

    const arrivalElement =
        el("darvozArrivalTime");

    if (distanceElement) {

        distanceElement.textContent =
            distance || "--";

    }

    if (etaElement) {

        etaElement.textContent =
            eta || "--";

    }

    if (arrivalElement) {

        if (
            eta &&
            eta !== "--" &&
            eta !== "Getting GPS..." &&
            eta !== "Unavailable"
        ) {

            const minutesMatch =
                String(eta).match(
                    /(\d+)\s*min/
                );

            if (minutesMatch) {

                const minutes =
                    Number(
                        minutesMatch[1]
                    );

                const arrival =
                    new Date(
                        Date.now() +
                        minutes * 60 * 1000
                    );

                const arrivalText =
                    arrival.toLocaleTimeString(
                        [],
                        {

                            hour:
                                "numeric",

                            minute:
                                "2-digit"

                        }
                    );

                arrivalElement.textContent =
                    `Arrive ${arrivalText}`;

            }

            else {

                arrivalElement.textContent =
                    `Arrive in ${eta}`;

            }

        }

        else {

            arrivalElement.textContent =
                "Arrive --";

        }

    }

}

// =====================================================
// SEND LOCATION TO SERVER
// =====================================================

async function sendDarvozLocation(
    latitude,
    longitude
) {

    const now =
        Date.now();

    if (
        now -
        lastLocationSentAt <
        LOCATION_SEND_INTERVAL
    ) {

        return;

    }

    lastLocationSentAt =
        now;

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/location`,
                {

                    method:
                        "PUT",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            deliveryId:
                                delivery.id,

                            latitude:
                                latitude,

                            longitude:
                                longitude

                        })

                }
            );

        if (!response.ok) {

            console.log(
                "❌ LOCATION HTTP ERROR:",
                response.status
            );

            return;

        }

        console.log(
            "📡 RIDER LOCATION SENT:",
            latitude,
            longitude
        );

    }

    catch (error) {

        console.log(
            "❌ LOCATION SEND ERROR:",
            error
        );

    }

}

// =====================================================
// STOP NAVIGATION
// =====================================================

function stopDarvozNavigation() {

    if (!darvozNavigation) {

        return;

    }

    console.log(
        "🛑 STOPPING DARVOZ NAVIGATION"
    );

    if (
        darvozNavigation.watchId !== null &&
        darvozNavigation.watchId !== undefined
    ) {

        navigator.geolocation.clearWatch(
            darvozNavigation.watchId
        );

    }

    darvozNavigation.watchId =
        null;

    darvozNavigation.navigationStarted =
        false;

    if (
        darvozNavigation.riderMarker
    ) {

        darvozNavigation.riderMarker.setMap(
            null
        );

    }

    if (window.riderMarker) {

        window.riderMarker.setMap(
            null
        );

        window.riderMarker =
            null;

    }

    darvozNavigation =
        null;

}

// =====================================================
// REACHED RESTAURANT FROM NAVIGATION
// =====================================================

async function checkReachedRestaurantFromNavigation() {

    if (!darvozNavigation) {

        alert(
            "Navigation is not active."
        );

        return;

    }

    if (
        darvozNavigation.type !==
        "restaurant"
    ) {

        return;

    }

    if (
        !currentOrderData
    ) {

        alert(
            "No active order found."
        );

        return;

    }

    if (
        !darvozNavigation.riderLocation
    ) {

        alert(
            "📍 Getting your GPS location. Please wait."
        );

        return;

    }

    const latitude =
        Number(
            darvozNavigation
                .riderLocation
                .lat
        );

    const longitude =
        Number(
            darvozNavigation
                .riderLocation
                .lng
        );

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/reached-restaurant/${currentOrderData.id}`,
                {

                    method:
                        "PUT",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            deliveryId:
                                delivery.id,

                            latitude:
                                latitude,

                            longitude:
                                longitude

                        })

                }
            );

        const result =
            await response.json();

        console.log(
            "🏪 REACHED RESTAURANT RESPONSE:",
            result
        );

        if (!result.success) {

            alert(
                result.message ||
                "You are not close enough to the restaurant."
            );

            return;

        }

        currentOrderData.delivery_status =
            "ReachedRestaurant";

        stopDarvozNavigation();

        const screen =
            el("darvozNavigationScreen");

        if (screen) {

            screen.style.display =
                "none";

        }

        renderCurrentOrder(
            currentOrderData
        );

        alert(
            "✅ You reached the restaurant."
        );

    }

    catch (error) {

        console.log(
            "❌ REACHED RESTAURANT ERROR:",
            error
        );

        alert(
            "Unable to verify your location."
        );

    }

}

// =====================================================
// REACHED CUSTOMER FROM NAVIGATION
// =====================================================

async function checkReachedCustomerFromNavigation() {

    if (!darvozNavigation) {

        alert(
            "Navigation is not active."
        );

        return;

    }

    if (
        darvozNavigation.type !==
        "customer"
    ) {

        return;

    }

    if (
        !currentOrderData
    ) {

        alert(
            "No active order found."
        );

        return;

    }

    if (
        !darvozNavigation.riderLocation
    ) {

        alert(
            "📍 Getting your GPS location. Please wait."
        );

        return;

    }

    const latitude =
        Number(
            darvozNavigation
                .riderLocation
                .lat
        );

    const longitude =
        Number(
            darvozNavigation
                .riderLocation
                .lng
        );

    try {

        const response =
            await fetch(
                `${API}/deliveryPartner/reached-customer/${currentOrderData.id}`,
                {

                    method:
                        "PUT",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            deliveryId:
                                delivery.id,

                            latitude:
                                latitude,

                            longitude:
                                longitude

                        })

                }
            );

        const result =
            await response.json();

        console.log(
            "🏠 REACHED CUSTOMER RESPONSE:",
            result
        );

        if (!result.success) {

            alert(
                result.message ||
                "You are not close enough to the customer."
            );

            return;

        }

        currentOrderData.delivery_status =
            "ReachedCustomer";

        stopDarvozNavigation();

        const screen =
            el("darvozNavigationScreen");

        if (screen) {

            screen.style.display =
                "none";

        }

        renderCurrentOrder(
            currentOrderData
        );

        alert(
            "✅ You reached the customer."
        );

    }

    catch (error) {

        console.log(
            "❌ REACHED CUSTOMER ERROR:",
            error
        );

        alert(
            "Unable to verify your location."
        );

    }

}

// =====================================================
// SOCKET ORDER STATUS
// =====================================================

socket.on(
    "orderStatusUpdated",
    data => {

        console.log(
            "ORDER STATUS UPDATED:",
            data
        );

        if (!currentOrderData) {

            return;

        }

        if (
            Number(data.orderId) !==
            Number(currentOrderData.id)
        ) {

            return;

        }

        if (data.status) {

            currentOrderData.delivery_status =
                data.status;

        }

        renderCurrentOrder(
            currentOrderData
        );

    }

);

// =====================================================
// DIRECT DELIVERY STATUS SOCKET
// =====================================================

socket.on(
    "deliveryStatusUpdated",
    data => {

        console.log(
            "DELIVERY STATUS UPDATED:",
            data
        );

        if (!currentOrderData) {

            return;

        }

        if (
            Number(data.orderId) !==
            Number(currentOrderData.id)
        ) {

            return;

        }

        if (data.status) {

            currentOrderData.delivery_status =
                data.status;

        }

        renderCurrentOrder(
            currentOrderData
        );

    }

);

// =====================================================
// NAVIGATION CSS
// =====================================================

function addDarvozNavigationCSS() {

    if (
        el("darvozNavigationCSS")
    ) {

        return;

    }

    const style =
        document.createElement("style");

    style.id =
        "darvozNavigationCSS";

    style.innerHTML = `

        #darvozNavigationScreen {

            position: fixed;

            inset: 0;

            z-index: 99999;

            background: white;

            display: none;

            flex-direction: column;

        }

        .darvoz-nav-header {

            height: 70px;

            background: white;

            display: flex;

            align-items: center;

            gap: 12px;

            padding: 10px 16px;

            box-shadow:
                0 2px 10px rgba(0,0,0,.12);

            z-index: 5;

        }

        .darvoz-nav-back {

            width: 42px;

            height: 42px;

            border: none;

            border-radius: 50%;

            background: #f5f5f5;

            font-size: 18px;

            cursor: pointer;

        }

        .darvoz-nav-title {

            font-size: 18px;

            font-weight: 800;

        }

        .darvoz-nav-destination {

            font-size: 13px;

            color: #777;

            margin-top: 2px;

        }

        .darvoz-google-map {

            flex: 1;

            width: 100%;

            min-height: 0;

        }

        .darvoz-nav-bottom {

            background: white;

            padding: 14px 16px 20px;

            box-shadow:
                0 -3px 15px rgba(0,0,0,.12);

            z-index: 5;

            position: relative;

        }

        .darvoz-nav-info {

            display: flex;

            justify-content: space-around;

            text-align: center;

            margin-bottom: 12px;

        }

        .darvoz-nav-info div {

            display: flex;

            flex-direction: column;

        }

        .darvoz-nav-info span {

            font-size: 20px;

            font-weight: 800;

        }

        .darvoz-nav-info small {

            color: #777;

            margin-top: 2px;

        }

        .darvoz-start-btn,
        .darvoz-reached-btn {

            width: 100%;

            border: none;

            border-radius: 12px;

            padding: 15px;

            background: #ff5a00;

            color: white;

            font-size: 15px;

            font-weight: 800;

            cursor: pointer;

            margin-bottom: 8px;

        }

        .darvoz-start-btn:active,
        .darvoz-reached-btn:active {

            transform:
                scale(.98);

        }

        .darvoz-start-btn:disabled,
        .darvoz-reached-btn:disabled {

            opacity: .6;

            cursor: not-allowed;

        }

        /* ==========================================
           NEXT TURN CARD
        ========================================== */

        .darvoz-next-turn {

            position: absolute;

            top: -82px;

            left: 16px;

            right: 16px;

            z-index: 100;

            display: flex;

            align-items: center;

            gap: 14px;

            padding: 14px 16px;

            background: #ffffff;

            border-radius: 16px;

            box-shadow:
                0 4px 16px
                rgba(0, 0, 0, 0.18);

        }

        .darvoz-turn-icon {

            width: 56px;

            height: 56px;

            border-radius: 16px;

            display: flex;

            align-items: center;

            justify-content: center;

            background: #fbfdff;

            color: white;

            font-size: 30px;

            flex-shrink: 0;

        }

        .darvoz-turn-details {

            min-width: 0;

        }

        .darvoz-turn-instruction {

            font-size: 16px;

            font-weight: 800;

            color: #111;

            white-space: nowrap;

            overflow: hidden;

            text-overflow: ellipsis;

        }

        .darvoz-turn-distance {

            margin-top: 4px;

            font-size: 14px;

            color: #666;

            font-weight: 600;

        }

        /* ==========================================
           GOOGLE MAPS STYLE SUMMARY
        ========================================== */

        .darvoz-nav-summary {

            position: relative;

            padding: 14px 52px 6px 0;

        }

        .darvoz-nav-main {

            font-size: 15px;

            font-weight: 800;

            color: #01060f;

        }

        .darvoz-summary-dot {

            color: #777;

            margin: 0 4px;

        }

        .darvoz-arrival-time {

            margin-top: 4px;

            font-size: 13px;

            color: #666;

            font-weight: 600;

        }

        /* ==========================================
           RECENTER BUTTON
        ========================================== */

        .darvoz-recenter-btn {

            position: absolute;

            right: 0;

            top: 14px;

            width: 42px;

            height: 42px;

            border: none;

            border-radius: 50%;

            background: #f5f5f5;

            color: #1557D5;

            font-size: 18px;

            cursor: pointer;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,.12);

        }

        .darvoz-recenter-btn:active {

            transform:
                scale(.94);

        }

    `;

    document.head.appendChild(
        style
    );

}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;

}

// =====================================================
// NUMBER
// =====================================================

function getNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return NaN;

    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : NaN;

}

// =====================================================
// NOTIFICATION PERMISSION
// =====================================================

if (
    "Notification" in window
) {

    Notification
        .requestPermission()
        .catch(
            () => {}
        );

}

// =====================================================
// INITIAL LOAD
// =====================================================

loadProfile();

loadDashboard();

loadCurrentOrder();

// =====================================================
// REFRESH DASHBOARD
// =====================================================

setInterval(
    loadDashboard,
    10000
);

// =====================================================
// REFRESH CURRENT ORDER
// =====================================================

setInterval(
    loadCurrentOrder,
    5000
);

// =====================================================
// INITIAL OFFLINE
// =====================================================

if (
    onlineToggle &&
    !onlineToggle.checked
) {

    hideSearching();

}

// =====================================================
// PAGE EXIT
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopDarvozNavigation();

        stopLocationTracking();

    }
);

// =======================================
// REAL GPS TRACKING
// =======================================

let locationWatcher =
    null;

function startLocationTracking() {

    if (
        !navigator.geolocation
    ) {

        console.log(
            "Geolocation is not supported."
        );

        return;

    }

    if (
        locationWatcher !== null
    ) {

        return;

    }

    locationWatcher =
        navigator.geolocation.watchPosition(

            async function(position) {

                const latitude =
                    position.coords.latitude;

                const longitude =
                    position.coords.longitude;

                console.log(
                    "DARVOZ GPS:",
                    latitude,
                    longitude
                );

                try {

                    const response =
                        await fetch(
                            `${API}/deliveryPartner/location`,
                            {

                                method:
                                    "PUT",

                                headers: {

                                    "Content-Type":
                                        "application/json"

                                },

                                body:
                                    JSON.stringify({

                                        deliveryId:
                                            delivery.id,

                                        latitude:
                                            latitude,

                                        longitude:
                                            longitude

                                    })

                            }
                        );

                    const data =
                        await response.json();

                    console.log(
                        "DARVOZ DISTANCE:",
                        data
                    );

                }

                catch(error) {

                    console.log(
                        "GPS UPDATE ERROR:",
                        error
                    );

                }

            },

            function(error) {

                console.log(
                    "GPS ERROR:",
                    error
                );

            },

            {

                enableHighAccuracy:
                    true,

                maximumAge:
                    5000,

                timeout:
                    10000

            }

        );

}

function stopLocationTracking() {

    if(
        locationWatcher !== null
    ){

        navigator.geolocation.clearWatch(
            locationWatcher
        );

        locationWatcher =
            null;

    }

}

// =====================================================
// START
// =====================================================

console.log(
    "🚴 DARVOZ Delivery Dashboard Loaded"
);

// =====================================================
// WALLET
// =====================================================

function openWallet() {

    if(
        !delivery ||
        !delivery.id
    ){

        alert(
            "Delivery partner information not found."
        );

        return;

    }

    window.location.href =
        `wallet.html?userType=delivery&userId=${encodeURIComponent(delivery.id)}`;

}

// =====================================================
// NOTIFICATIONS
// =====================================================

function openNotifications() {

    console.log(
        "Notifications clicked"
    );

}