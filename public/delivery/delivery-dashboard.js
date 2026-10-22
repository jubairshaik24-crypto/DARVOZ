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
// ONLINE TIME TRACKING
// =====================================================

let onlineSessionStartedAt = null;
let totalOnlineSecondsToday = 0;
let onlineTimeInterval = null;

const ONLINE_TIME_KEY =
    `darvoz_online_time_${delivery.id}`;

const ONLINE_START_KEY =
    `darvoz_online_start_${delivery.id}`;

const ONLINE_DATE_KEY =
    `darvoz_online_date_${delivery.id}`;


// =====================================================
// LOAD TODAY'S ONLINE TIME
// =====================================================

function loadOnlineTime() {

    const today =
        new Date().toISOString().slice(0, 10);

    const savedDate =
        localStorage.getItem(ONLINE_DATE_KEY);

    // New day → reset
    if (savedDate !== today) {

        totalOnlineSecondsToday = 0;

        onlineSessionStartedAt = null;

        localStorage.setItem(
            ONLINE_DATE_KEY,
            today
        );

        localStorage.setItem(
            ONLINE_TIME_KEY,
            "0"
        );

        localStorage.removeItem(
            ONLINE_START_KEY
        );

        updateOnlineTimeUI();

        return;
    }

    totalOnlineSecondsToday =
        Number(
            localStorage.getItem(
                ONLINE_TIME_KEY
            ) || 0
        );

    const savedStart =
        localStorage.getItem(
            ONLINE_START_KEY
        );

    if (savedStart) {

        onlineSessionStartedAt =
            Number(savedStart);

    }

    updateOnlineTimeUI();

}


// =====================================================
// FORMAT ONLINE TIME
// =====================================================

function formatOnlineTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(
                Number(seconds) || 0
            )
        );

    const hours =
        Math.floor(
            seconds / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    return `${hours}h ${String(minutes).padStart(2, "0")}m`;

}


// =====================================================
// UPDATE ONLINE TIME UI
// =====================================================

function updateOnlineTimeUI() {

    let seconds =
        totalOnlineSecondsToday;

    // Add current active session
    if (
        onlineSessionStartedAt !== null
    ) {

        seconds +=
            Math.floor(
                (
                    Date.now() -
                    onlineSessionStartedAt
                ) / 1000
            );

    }

    const formatted =
        formatOnlineTime(
            seconds
        );

    const onlineTime =
        el("onlineTime");

    const summaryTime =
        el("summaryTime");

    if (onlineTime) {

        onlineTime.textContent =
            formatted;

    }

    if (summaryTime) {

        summaryTime.textContent =
            formatted;

    }

}


// =====================================================
// START ONLINE TIMER
// =====================================================

function startOnlineTimeTracking() {

    // If there is no existing session,
    // start a new one.
    if (onlineSessionStartedAt === null) {

        onlineSessionStartedAt =
            Date.now();

        localStorage.setItem(
            ONLINE_START_KEY,
            String(
                onlineSessionStartedAt
            )
        );

        console.log(
            "🟢 ONLINE TIME SESSION STARTED"
        );

    }

    // IMPORTANT:
    // Always restart the display timer after refresh.
    clearInterval(
        onlineTimeInterval
    );

    onlineTimeInterval =
        setInterval(
            updateOnlineTimeUI,
            1000
        );

    // Show immediately
    updateOnlineTimeUI();

    console.log(
        "⏱️ ONLINE TIME DISPLAY RUNNING"
    );
}

// =====================================================
// STOP ONLINE TIMER
// =====================================================

function stopOnlineTimeTracking() {

    if (
        onlineSessionStartedAt === null
    ) {

        return;

    }

    const elapsed =
        Math.floor(
            (
                Date.now() -
                onlineSessionStartedAt
            ) / 1000
        );

    totalOnlineSecondsToday +=
        Math.max(
            0,
            elapsed
        );

    onlineSessionStartedAt =
        null;

    localStorage.setItem(
        ONLINE_TIME_KEY,
        String(
            totalOnlineSecondsToday
        )
    );

    localStorage.removeItem(
        ONLINE_START_KEY
    );

    clearInterval(
        onlineTimeInterval
    );

    onlineTimeInterval =
        null;

    updateOnlineTimeUI();

if (onlineSessionStartedAt !== null) {
    startOnlineTimeTracking();
} 
    console.log(
        "🔴 ONLINE TIME STOPPED:",
        formatOnlineTime(
            totalOnlineSecondsToday
        )
    );

}

// =====================================================
// NAVIGATION STATE
// =====================================================

let darvozNavigation =
    null;

let googleMapsLoading =
    false;

let googleMapsCallback =
    null;

let searchingMap = null;
let searchingMapMarker = null;
let searchingMapRequestingLocation = false;
let lastNewOrderAlertId = null;
let newOrderAlertRingsRemaining = 0;

const newOrderAlertAudio = new Audio(
    "/delivery/sounds/notification.mp3"
);
newOrderAlertAudio.preload = "auto";
newOrderAlertAudio.addEventListener("ended", () => {
    if(newOrderAlertRingsRemaining > 1){
        newOrderAlertRingsRemaining--;
        newOrderAlertAudio.currentTime = 0;
        newOrderAlertAudio.play().catch(error => {
            newOrderAlertRingsRemaining = 0;
            console.log("New order sound could not continue:", error.message);
        });
        return;
    }
    newOrderAlertRingsRemaining = 0;
});

function primeNewOrderAlertAudio(){
    if(!newOrderAlertAudio.paused) return;
    newOrderAlertAudio.muted = true;
    const playAttempt = newOrderAlertAudio.play();
    if(playAttempt && typeof playAttempt.then === "function"){
        playAttempt.then(() => {
            newOrderAlertAudio.pause();
            newOrderAlertAudio.currentTime = 0;
            newOrderAlertAudio.muted = false;
        }).catch(() => {
            newOrderAlertAudio.muted = false;
        });
    } else {
        newOrderAlertAudio.muted = false;
    }
}

function playNewOrderAlert(orderId){
    const orderKey = String(orderId);
    if(lastNewOrderAlertId === orderKey) return;
    lastNewOrderAlertId = orderKey;
    newOrderAlertAudio.pause();
    newOrderAlertAudio.currentTime = 0;
    newOrderAlertAudio.muted = false;
    newOrderAlertRingsRemaining = 3;
    newOrderAlertAudio.play().catch(error => {
        newOrderAlertRingsRemaining = 0;
        console.log("New order sound could not play:", error.message);
    });
}

document.addEventListener("pointerdown", primeNewOrderAlertAudio, {once:true, passive:true});

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
function setSearchStatePill(label, state){
    const pill = el("searchStatePill");
    if(!pill) return;
    const icon = state === "order"
        ? "fa-solid fa-bell"
        : state === "offline"
            ? "fa-solid fa-circle"
            : state === "active"
                ? "fa-solid fa-motorcycle"
                : "fa-solid fa-rotate";
    pill.className = `search-state-pill ${state === "searching" || state === "active" ? "is-searching" : state === "order" ? "has-order" : ""}`;
    pill.innerHTML = `<i class="${icon}"></i><span>${escapeHTML(label)}</span>`;
}

function setOnlineUI(isOnline) {

    if (!onlineToggle) {

        return;

    }

    onlineToggle.checked =
        isOnline;


    // =================================================
    // ONLINE
    // =================================================

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

        const hasIncomingOrder = newOrderCard && newOrderCard.style.display === "block";
        setSearchStatePill(
            currentOrderData ? "On delivery" : hasIncomingOrder ? "New order" : "Searching...",
            currentOrderData ? "active" : hasIncomingOrder ? "order" : "searching"
        );

        startOnlineTimeTracking();

        if (
            !currentOrderData &&
            newOrderCard &&
            newOrderCard.style.display !== "block"
        ) {

            showSearching();

        }

    }


    // =================================================
    // OFFLINE
    // =================================================

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

        setSearchStatePill("Offline", "offline");

        stopOnlineTimeTracking();

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

    document.body.classList.add("delivery-searching-mode");

    const title =
        el("searchTitle");

    const text =
        el("searchText");

    if (title) {

        title.innerHTML =
            "Searching for Orders";

    }

    if (text) {

        text.innerHTML =
            "We’ll notify you when a new order is available";

    }

    setSearchStatePill("Searching...", "searching");

    const mapLabel = el("searchMapLabel");
    if(mapLabel){
        mapLabel.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i><span>Searching...</span>';
        mapLabel.classList.remove("new-order-map-label");
    }

    initializeSearchingMap();

}

function hideSearching() {

    if (searchingCard) {

        const keepOnlineMapVisible =
            Boolean(onlineToggle && onlineToggle.checked && !currentOrderData);

        document.body.classList.toggle(
            "delivery-searching-mode",
            keepOnlineMapVisible
        );

        searchingCard.style.display =
            keepOnlineMapVisible ? "block" : "none";

    }

}

function initializeSearchingMap(){
    const stage = el("searchingMapStage");
    const mapElement = el("searchingMap");
    if(!stage || !mapElement || searchingMap || searchingMapRequestingLocation) return;

    const createMapAt = location => {
        loadDarvozGoogleMaps(() => {
            if(!window.google?.maps || !mapElement.isConnected) return;
            const center = {lat:Number(location.lat), lng:Number(location.lng)};
            if(!Number.isFinite(center.lat) || !Number.isFinite(center.lng) || (center.lat === 0 && center.lng === 0)){
                stage.classList.add("map-unavailable");
                return;
            }
            searchingMap = new google.maps.Map(mapElement, {
                center,
                zoom:14,
                disableDefaultUI:true,
                clickableIcons:false,
                gestureHandling:"none",
                styles:[
                    {elementType:"geometry",stylers:[{color:"#eef4f2"}]},
                    {elementType:"labels.text.fill",stylers:[{color:"#71818a"}]},
                    {elementType:"labels.text.stroke",stylers:[{color:"#f8fbfa"}]},
                    {featureType:"road",elementType:"geometry",stylers:[{color:"#ffffff"}]},
                    {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#dce9e5"}]},
                    {featureType:"poi",stylers:[{visibility:"off"}]},
                    {featureType:"transit",stylers:[{visibility:"off"}]},
                    {featureType:"water",elementType:"geometry",stylers:[{color:"#d7f0ef"}]},
                    {featureType:"landscape.natural",elementType:"geometry",stylers:[{color:"#e5f4e9"}]}
                ]
            });
            searchingMapMarker = new google.maps.Marker({
                map:searchingMap,
                position:center,
                title:"Your current location",
                icon:{
                    path:google.maps.SymbolPath.CIRCLE,
                    scale:9,
                    fillColor:"#007f78",
                    fillOpacity:1,
                    strokeColor:"#ffffff",
                    strokeWeight:4
                }
            });
            stage.classList.remove("map-unavailable");
            stage.classList.add("map-ready");
        });
    };

    const savedLocation = {
        lat:Number(delivery.latitude),
        lng:Number(delivery.longitude)
    };
    if(Number.isFinite(savedLocation.lat) && Number.isFinite(savedLocation.lng) && (savedLocation.lat !== 0 || savedLocation.lng !== 0)){
        createMapAt(savedLocation);
        return;
    }

    if(!navigator.geolocation){
        stage.classList.add("map-unavailable");
        const label = el("searchMapLabel");
        if(label) label.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>Location unavailable</span>';
        return;
    }

    searchingMapRequestingLocation = true;
    navigator.geolocation.getCurrentPosition(position => {
        searchingMapRequestingLocation = false;
        const location = {lat:position.coords.latitude, lng:position.coords.longitude};
        delivery.latitude = location.lat;
        delivery.longitude = location.lng;
        localStorage.setItem("deliveryPartner", JSON.stringify(delivery));
        createMapAt(location);
    }, () => {
        searchingMapRequestingLocation = false;
        stage.classList.add("map-unavailable");
        const label = el("searchMapLabel");
        if(label) label.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i><span>Turn on location to see your area</span>';
    }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
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

function restoreAcceptedRestaurantNavigation(order) {
    if (!order) return false;
    const status = getDeliveryStatus(order);
    if (!["rideraccepted", "accepted", "rideraccept", "assigned", "acceptedbyrider"].includes(status)) return false;
    const latitude = getNumber(order.restaurant_lat ?? order.pickup_lat ?? order.restaurant_latitude);
    const longitude = getNumber(order.restaurant_lng ?? order.pickup_lng ?? order.restaurant_longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    openDarvozNavigation({ type: "restaurant", orderId: order.id, destinationLat: latitude, destinationLng: longitude, destinationName: order.restaurant_name || "Partner Store", destinationAddress: order.restaurant_address || order.pickup_address || "", destinationPhone: order.restaurant_mobile || order.partner_mobile || "" });
    return true;
}

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

            const activeNavOrderLabel = el("darvozNavOrderId");
            if (activeNavOrderLabel && darvozNavigation) {
                darvozNavigation.orderId = data.order.id;
                activeNavOrderLabel.textContent = "Order ID: #" + data.order.id;
            }

            setSearchStatePill("On delivery", "active");

            hideSearching();

            document.body.classList.remove("has-new-order");

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

            restoreAcceptedRestaurantNavigation(data.order);

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

        document.body.classList.remove("active-delivery-mode");

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

            if(toggle.checked){
                primeNewOrderAlertAudio();
            }

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

        if(
            String(currentOrderId) === String(order.id) &&
            newOrderCard &&
            newOrderCard.style.display === "block"
        ){
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

        document.body.classList.add("has-new-order");

        hideSearching();

        if(el("searchTitle")) el("searchTitle").textContent = "New Order Available";
        if(el("searchText")) el("searchText").textContent = "Review the delivery request below";
        if(el("searchMapLabel")){
            el("searchMapLabel").innerHTML = '<i class="fa-solid fa-bell"></i><span>New order nearby</span>';
            el("searchMapLabel").classList.add("new-order-map-label");
        }
        setSearchStatePill("New order", "order");

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

        playNewOrderAlert(order.id);

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
                order.address || order.customer_address || order.delivery_address || order.full_address || ""
            );

    }

    if (deliveryFee) {

        deliveryFee.innerHTML =
            `₹${Number(
                order.delivery_rider_earning ?? order.delivery_fee ?? 0
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

    loadNewOrderItems(order);

}

async function loadNewOrderItems(order){
    const list = el("newOrderItemsList");
    if(!list) return;

    const renderItems = items => {
        const rows = (Array.isArray(items) ? items : []).filter(item =>
            item && (item.product_name || item.name || item.item_name)
        );
        if(!rows.length){
            list.textContent = "Item details are not available";
            return;
        }
        list.innerHTML = rows.map(item => {
            const name = escapeHTML(item.product_name || item.name || item.item_name);
            const qty = escapeHTML(String(item.qty ?? item.quantity ?? 1));
            return `<div class="new-order-item"><span class="new-order-item-qty">${qty} ×</span><span>${name}</span></div>`;
        }).join("");

    };

    if(Array.isArray(order.items) && order.items.length){
        renderItems(order.items);
        return;
    }
    if(!order.id){
        list.textContent = "Item details are not available";
        return;
    }

    list.textContent = "Loading items…";
    try{
        const response = await fetch(`${API}/orders/items/${encodeURIComponent(order.id)}`);
        const data = await response.json();
        if(!response.ok || !data.success) throw new Error("Items unavailable");
        renderItems(data.items);
    }catch(error){
        list.textContent = "Item details are not available";
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

                    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
                    const remainingSeconds = String(seconds % 60).padStart(2, "0");
                    timer.textContent =
                        `${minutes}:${remainingSeconds}`;

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

                    document.body.classList.remove("has-new-order");

                    if (badge) {

                        badge.style.display =
                            "none";

                    }

                    currentOrderId =
                        orderId;

                    await loadCurrentOrder();

                    const acceptedOrder =
                        currentOrderData || data.order;

                    if (acceptedOrder) {

                        const restaurantLat =
                            getNumber(
                                acceptedOrder.restaurant_lat ??
                                acceptedOrder.pickup_lat ??
                                acceptedOrder.restaurant_latitude
                            );

                        const restaurantLng =
                            getNumber(
                                acceptedOrder.restaurant_lng ??
                                acceptedOrder.pickup_lng ??
                                acceptedOrder.restaurant_longitude
                            );

                        if (
                            Number.isFinite(restaurantLat) &&
                            Number.isFinite(restaurantLng)
                        ) {

                            openDarvozNavigation({
                                type: "restaurant",
                                orderId: acceptedOrder.id,
                                destinationLat: restaurantLat,
                                destinationLng: restaurantLng,
                                destinationName:
                                    acceptedOrder.restaurant_name || "Partner Store",
                                destinationAddress:
                                    acceptedOrder.restaurant_address || acceptedOrder.pickup_address || "",
                                destinationPhone:
                                    acceptedOrder.restaurant_mobile || acceptedOrder.partner_mobile || ""
                            });

                        } else {

                            alert(
                                "Order accepted, but restaurant GPS location is not available."
                            );

                        }

                    } else {

                        alert(
                            "Order accepted, but its details could not be loaded. Please reopen the current order."
                        );

                    }

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

    document.body.classList.remove("has-new-order");

    if(String(lastNewOrderAlertId) === String(currentOrderId)){
        lastNewOrderAlertId = null;
    }

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

    document.body.classList.add("active-delivery-mode");

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
                    order.address || order.customer_address || order.delivery_address || order.full_address || ""
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

    loadCurrentOrderItems(order);

    setupNavigation(
        order
    );

    updateDeliveryActions(
        order
    );

}

async function loadCurrentOrderItems(order){
    const list = el("pickupItems");
    const heading = el("currentItemsHeading");
    if(!list) return;

    const renderItems = items => {
        const rows = (Array.isArray(items) ? items : []).filter(item =>
            item && (item.product_name || item.name || item.item_name)
        );
        if(heading){
            heading.textContent = `Order items (${rows.length})`;
        }
        if(!rows.length){
            list.textContent = "Item details are not available";
            return;
        }
        list.innerHTML = rows.map(item => {
            const name = escapeHTML(item.product_name || item.name || item.item_name);
            const qty = escapeHTML(String(item.qty ?? item.quantity ?? 1));
            return `<div class="new-order-item"><span class="new-order-item-qty">${qty} ×</span><span>${name}</span></div>`;
        }).join("");
        const readyItems = el("pickupStageItems");
        if (readyItems) readyItems.innerHTML = list.innerHTML;
    };

    if(Array.isArray(order.items) && order.items.length){
        renderItems(order.items);
        return;
    }
    if(!order.id){
        renderItems([]);
        return;
    }

    list.textContent = "Loading items…";
    try{
        const response = await fetch(`${API}/orders/items/${encodeURIComponent(order.id)}`);
        const data = await response.json();
        if(!response.ok || !data.success) throw new Error("Items unavailable");
        renderItems(data.items);
    }catch(error){
        renderItems([]);
    }
}

// =====================================================
// DELIVERY STATUS
// =====================================================

function getDeliveryStatus(order) {
    const terminalOrderStatus = String(order.status || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const deliveryStatus = String(order.delivery_status || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    const customerArrivalStatus = ["reachedcustomer", "otpverified", "delivered"].includes(deliveryStatus);
    const raw = customerArrivalStatus ? order.delivery_status : terminalOrderStatus === "outfordelivery" ? order.status : (order.delivery_status ?? order.status ?? "RiderAccepted");
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === "waiting" || normalized === "delivery assigned" || normalized === "deliveryassigned") return "rideraccepted";
    return normalized.replace(/[\s_-]+/g, "");
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
        status === "outfordelivery" ||
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
        status === "picked" ||
        status === "outfordelivery"
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

    if (!["reachedrestaurant", "reached", "readyforpickup", "pickedup", "picked"].includes(status)) {
        hidePickupConfirmationPage();
    }

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

        const actionRow = getStageContainer();
        if (actionRow) {
            actionRow.innerHTML = "";
            actionRow.classList.add("stage-action-row");
            if (navigatePickup) actionRow.appendChild(navigatePickup);
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

    // Partner pickup approval unlocks Pickup Completed.
    if (status === "readyforpickup") { showPickupWaitingUI(order); return; }
    if (status === "pickedup" || status === "picked") { showPickupReadyUI(order); return; }
    if (status === "outfordelivery") {
        if (navigateCustomer) {
            navigateCustomer.style.display = "block";
            navigateCustomer.innerHTML = '<i class="fa-solid fa-map"></i> Route to Customer <i class="fa-solid fa-chevron-right" style="float:right;margin-top:3px"></i>';
        }
        const actionRow = getStageContainer();
        if (actionRow) { actionRow.innerHTML = ""; actionRow.classList.add("stage-action-row"); if (navigateCustomer) actionRow.appendChild(navigateCustomer); }
        setupReachedCustomerButton(order);
        openCustomerRoute(order);
        return;
    }

    // REACHED CUSTOMER
    // -----------------------------------------

    if (
        status === "reachedcustomer"
    ) {

        if (String(order.payment || "").trim().toUpperCase() === "COD" && !order.cod_collected_method) {
            showCODCollectionUI(order);
        } else {
            showOTPUI(order);
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

    container.classList.add("stage-action-row");

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

    container.querySelectorAll(".stage-arrival-button").forEach(button => button.remove());

    const button =
        document.createElement("button");

    button.className =
        "map-btn stage-arrival-button";

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

function ensurePickupConfirmationPage() {
    let page = el("pickupConfirmationPage");
    if (!page) {
        page = document.createElement("main");
        page.id = "pickupConfirmationPage";
        page.className = "pickup-confirmation-page";
        page.setAttribute("aria-live", "polite");
        document.body.appendChild(page);
    }
    return page;
}
function hidePickupConfirmationPage() {
    const page = el("pickupConfirmationPage");
    if (page) page.style.display = "none";
    document.body.classList.remove("pickup-confirmation-active");
}
function renderPickupConfirmationUI(order, partnerConfirmed) {
    const container = ensurePickupConfirmationPage();
    if (!container || !order) return;
    const stage = partnerConfirmed ? "confirmed" : "waiting";
    if (container.style.display !== "none" && container.dataset.orderId === String(order.id) && container.dataset.pickupStage === stage) return;
    container.dataset.orderId = String(order.id);
    container.dataset.pickupStage = stage;
    const orderId = escapeHTML(String(order.id ?? currentOrderId ?? "--"));
    const restaurantName = escapeHTML(order.restaurant_name || order.partner_name || "Restaurant partner");
    const address = escapeHTML(order.restaurant_address || order.pickup_address || order.restaurant_location || "Address not available");
    const statusBlock = partnerConfirmed
        ? `<div class="pickup-stage-waiting pickup-stage-confirmed"><i class="fa-solid fa-circle-check"></i><span>Restaurant partner confirmed pickup. You can now collect the order.</span></div>`
        : `<div class="pickup-stage-waiting"><i class="fa-regular fa-clock"></i><span>Waiting for the restaurant partner to confirm pickup.</span></div>`;
    const button = partnerConfirmed
        ? `<button type="button" class="pickup-complete-button" onclick="completePickup(${Number(order.id)})"><i class="fa-solid fa-box"></i> Pickup Completed</button>`
        : `<button type="button" class="pickup-complete-button" disabled><i class="fa-solid fa-box"></i> Pickup Completed</button><div class="pickup-stage-hint">Available after the partner confirms pickup</div>`;
    container.innerHTML = `<section class="pickup-stage-card ${partnerConfirmed ? "pickup-stage-ready" : ""}">
        <div class="pickup-stage-hero"><img class="pickup-stage-bag-image" src="images/image.png" alt="DARVOZ pickup bag"><div><strong>Order is ready for pickup</strong><span>Show this order ID to the restaurant partner.</span></div></div>
        <div class="pickup-stage-order"><small>Order ID</small><strong>#${orderId}</strong></div>
        ${statusBlock}
        <div class="pickup-stage-items"><strong>Order items</strong><div id="pickupStageItems">Loading order items…</div></div>
        <div class="pickup-stage-partner"><strong>Restaurant partner</strong><div class="pickup-stage-partner-name">${restaurantName}</div><div class="pickup-stage-partner-address"><i class="fa-solid fa-location-dot"></i><span>${address}</span></div></div>
        ${button}
    </section>`;
    const list = el("pickupStageItems"), source = el("pickupItems");
    if (list && source) list.innerHTML = source.innerHTML;
    container.style.display = "flex";
    document.body.classList.add("pickup-confirmation-active");
}
function showPickupWaitingUI(order) { renderPickupConfirmationUI(order, false); }
function showPickupReadyUI(order) { renderPickupConfirmationUI(order, true); }
async function completePickup(orderId) {
    if (!currentOrderData || Number(currentOrderData.id)!==Number(orderId)) return;
    const button=document.querySelector(".pickup-complete-button"); if(button){button.disabled=true;button.textContent="Updating…";}
    try {
        const response=await fetch(`${API}/delivery-orders/outfordelivery/${encodeURIComponent(orderId)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({deliveryId:delivery.id})});
        const result=await response.json(); if(!response.ok||!result.success) throw new Error(result.message||"Pickup could not be completed.");
        currentOrderData.status="Out For Delivery"; currentOrderData.delivery_status="Out For Delivery"; renderCurrentOrder(currentOrderData);
    } catch(error) { alert(error.message||"Unable to complete pickup."); if(button){button.disabled=false;button.innerHTML='<i class="fa-solid fa-box"></i> Pickup Completed';} }
}

function setupReachedCustomerButton(order) {

    const container =
        getStageContainer();

    if (!container) {

        return;

    }

    container.querySelectorAll(".stage-arrival-button").forEach(button => button.remove());

    const button =
        document.createElement("button");

    button.className =
        "map-btn stage-arrival-button";

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
    if (!order) return;
    const button = getStageContainer()?.querySelector(".stage-arrival-button");
    const originalButtonHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }
    const restoreButton = () => {
        if (button?.isConnected) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = originalButtonHtml;
        }
    };
    try {
        if (!navigator.geolocation) throw new Error("GPS is not available on this device.");
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
        }));
        const response = await fetch(`${API}/deliveryPartner/reached-customer/${encodeURIComponent(order.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                deliveryId: delivery.id,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                customerLatitude: darvozNavigation.destinationLat != null && darvozNavigation.destinationLat !== "" && Number.isFinite(Number(darvozNavigation.destinationLat)) ? Number(darvozNavigation.destinationLat) : undefined,
                customerLongitude: darvozNavigation.destinationLng != null && darvozNavigation.destinationLng !== "" && Number.isFinite(Number(darvozNavigation.destinationLng)) ? Number(darvozNavigation.destinationLng) : undefined
            })
        });
        const data = await response.json();
        console.log("REACHED CUSTOMER:", data);
        if (!response.ok || !data.success) throw new Error(data.message || "Unable to verify that you are at the customer location.");

        currentOrderData = { ...currentOrderData, status: "Reached Customer", delivery_status: "Reached Customer" };
        renderCurrentOrder(currentOrderData);
    } catch (error) {
        console.error("REACHED CUSTOMER ERROR:", error);
        const message = error.code === 1
            ? "Location permission is blocked. Allow location access and try again."
            : error.code === 2
                ? "Your location is unavailable. Move outside or enable GPS, then try again."
                : error.code === 3
                    ? "Getting your location took too long. Try again."
                    : error.message || "Unable to verify the customer location.";
        alert(message);
        restoreButton();
    }
}

function ensureCustomerPaymentPage() {
    let page = el("customerPaymentPage");
    if (!page) {
        page = document.createElement("main");
        page.id = "customerPaymentPage";
        page.className = "customer-payment-page";
        page.setAttribute("aria-live", "polite");
        document.body.appendChild(page);
    }
    return page;
}

function hideCustomerPaymentPage() {
    const page = el("customerPaymentPage");
    if (page) {
        page.style.display = "none";
        if (page._paymentPollTimer) clearInterval(page._paymentPollTimer);
        page._paymentPollTimer = null;
    }
    document.body.classList.remove("customer-payment-active");
}

function showCODCollectionUI(order) {
    if (!order) return;
    const page = ensureCustomerPaymentPage();
    if (page.dataset.dismissedOrderId === String(order.id)) return;
    if (page.style.display !== "none" && page.dataset.orderId === String(order.id)) return;
    if (page._paymentPollTimer) clearInterval(page._paymentPollTimer);

    const amount = Number(order.grand_total || order.total_amount || 0);
    const customerName = escapeHTML(order.customer_name || order.name || "Customer");
    const customerAddress = escapeHTML(order.address || order.customer_address || order.delivery_address || order.full_address || "Customer address not available");
    const orderId = escapeHTML(String(order.id));
    page.dataset.orderId = String(order.id);
    page.dataset.dismissedOrderId = "";
    page.innerHTML = `
        <header class="customer-payment-header">
            <button type="button" id="customerPaymentBack" aria-label="Back to customer navigation"><i class="fa-solid fa-arrow-left"></i></button>
            <div><strong>DARVOZ</strong><small>Delivery Partner</small></div>
        </header>
        <div class="customer-payment-scroll"><div class="customer-payment-inner">
            <div class="customer-payment-title"><div><h2>Collect payment</h2><p>Customer location verified</p></div><span class="customer-payment-order-id">Order #${orderId}</span></div>
            <section class="customer-payment-card"><strong class="customer-payment-card-title">Deliver to</strong><div class="customer-payment-customer">${customerName}</div><div class="customer-payment-address">${customerAddress}</div></section>
            <section class="customer-payment-card"><strong class="customer-payment-card-title">Order items</strong><div class="customer-payment-items" id="customerPaymentItems">Loading items…</div></section>
            <section class="customer-payment-card customer-razorpay-card">
                <div id="customerPaymentQrSlot"><div class="customer-payment-qr-placeholder">Preparing secure QR…</div></div>
                <div class="customer-payment-amount">Ask customer to scan and pay ₹${amount.toFixed(2)}</div>
                <div class="customer-payment-status" id="customerPaymentQrStatus" role="status">Creating a single-use payment QR…</div>
                <button type="button" class="customer-payment-action customer-payment-secondary" id="checkCustomerQrPayment" disabled>Check payment</button>
            </section>
            <div class="customer-payment-or">OR</div>
            <section class="customer-payment-card">
                <label class="customer-cash-row" for="customerCashCollected">
                    <input id="customerCashCollected" type="checkbox">
                    <span class="customer-cash-copy"><strong>Collect cash</strong><span>Collect ₹${amount.toFixed(2)} from customer</span></span>
                    <i class="fa-solid fa-money-bill-wave" style="font-size:24px;color:#078e63"></i>
                </label>
            </section>
        </div></div>
        <footer class="customer-payment-footer"><div class="customer-payment-inner">
            <button type="button" class="customer-payment-action" id="confirmCustomerCash" disabled>Confirm cash collected</button>
            <div class="customer-payment-footer-note">Delivery OTP is still required after payment.</div>
        </div></footer>`;

    page.style.display = "flex";
    document.body.classList.add("customer-payment-active");

    el("customerPaymentBack")?.addEventListener("click", () => {
        page.dataset.dismissedOrderId = String(order.id);
        hideCustomerPaymentPage();
        openCustomerRoute(order, true);
    });

    const cashCheckbox = el("customerCashCollected");
    const cashButton = el("confirmCustomerCash");
    cashCheckbox?.addEventListener("change", () => { if (cashButton) cashButton.disabled = !cashCheckbox.checked; });

    const showPaymentStatus = (message, isError = false) => {
        const status = el("customerPaymentQrStatus");
        if (!status) return;
        status.textContent = message;
        status.classList.toggle("customer-payment-error", isError);
    };

    cashButton?.addEventListener("click", async () => {
        if (!cashCheckbox?.checked) return;
        cashButton.disabled = true;
        cashButton.textContent = "Recording cash…";
        try {
            const response = await fetch(`${API}/deliveryPartner/collect-cod/${encodeURIComponent(order.id)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deliveryId: delivery.id, method: "cash" })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Unable to record cash collection.");
            currentOrderData = { ...currentOrderData, cod_collected_method: data.method || "cash", cod_collected_amount: amount, cod_collected_at: new Date().toISOString() };
            hideCustomerPaymentPage();
            renderCurrentOrder(currentOrderData);
        } catch (error) {
            cashButton.disabled = false;
            cashButton.textContent = "Confirm cash collected";
            showPaymentStatus(error.message || "Unable to record cash collection.", true);
        }
    });

    const verifyQrPayment = async () => {
        const checkButton = el("checkCustomerQrPayment");
        if (!checkButton || checkButton.disabled) return;
        checkButton.disabled = true;
        checkButton.textContent = "Checking…";
        try {
            const response = await fetch(`${API}/deliveryPartner/verify-cod-qr/${encodeURIComponent(order.id)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deliveryId: delivery.id })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Could not verify Razorpay payment.");
            if (data.paid) {
                currentOrderData = { ...currentOrderData, cod_collected_method: data.method || "razorpay_upi", cod_collected_amount: amount, cod_collected_at: new Date().toISOString() };
                hideCustomerPaymentPage();
                renderCurrentOrder(currentOrderData);
                return;
            }
            showPaymentStatus("Waiting for payment. Ask the customer to scan the QR.");
        } catch (error) {
            showPaymentStatus(error.message || "Could not verify payment.", true);
        } finally {
            if (checkButton.isConnected) {
                checkButton.disabled = false;
                checkButton.textContent = "Check payment";
            }
        }
    };
    el("checkCustomerQrPayment")?.addEventListener("click", verifyQrPayment);

    const loadQr = async () => {
        const slot = el("customerPaymentQrSlot");
        const checkButton = el("checkCustomerQrPayment");
        try {
            const response = await fetch(`${API}/deliveryPartner/create-cod-payment/${encodeURIComponent(order.id)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deliveryId: delivery.id })
            });
            const data = await response.json();
            if (response.ok && data.success && data.paid) {
                currentOrderData = { ...currentOrderData, cod_collected_method: data.method || "razorpay_upi", cod_collected_amount: amount, cod_collected_at: new Date().toISOString() };
                hideCustomerPaymentPage();
                renderCurrentOrder(currentOrderData);
                return;
            }
            if (!response.ok || !data.success || !data.qr_code?.image_url) throw new Error(data.message || "Razorpay QR is unavailable.");
            const isRazorpayQr = String(data.qr_code.id || "").startsWith("qr_");
            if (slot) {
                slot.innerHTML = `<div class="customer-payment-qr-frame${isRazorpayQr ? " customer-payment-qr-frame-provider" : ""}"><img class="customer-payment-qr${isRazorpayQr ? " customer-payment-qr-provider" : ""}" src="${escapeHTML(data.qr_code.image_url)}" alt="Scan to pay"></div>`;
                if (isRazorpayQr) {
                    const qrImage = slot.querySelector(".customer-payment-qr-provider");
                    qrImage?.decode().then(async () => {
                        if (typeof BarcodeDetector !== "function") return;
                        const detector = new BarcodeDetector({ formats: ["qr_code"] });
                        const [detectedQr] = await detector.detect(qrImage);
                        if (!detectedQr?.rawValue) return;
                        const frame = qrImage.parentElement;
                        const cleanQrResponse = await fetch(`${API}/deliveryPartner/render-cod-qr/${encodeURIComponent(order.id)}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ deliveryId: delivery.id, payload: detectedQr.rawValue })
                        });
                        const cleanQr = await cleanQrResponse.json();
                        if (!cleanQrResponse.ok || !cleanQr.success || !cleanQr.image_url) return;
                        qrImage.src = cleanQr.image_url;
                        qrImage.removeAttribute("style");
                        frame.classList.add("customer-payment-qr-frame-isolated");
                    }).catch(() => {});
                }
            }
            showPaymentStatus(data.payment_url
                ? "Scan the QR to open the secure Razorpay UPI payment page."
                : "Waiting for payment. Ask the customer to scan the QR.");
            if (checkButton) checkButton.disabled = false;
            page._paymentPollTimer = setInterval(verifyQrPayment, 7000);
        } catch (error) {
            if (slot) slot.innerHTML = `<div class="customer-payment-qr-placeholder"><i class="fa-solid fa-triangle-exclamation"></i>&nbsp; QR unavailable</div>`;
            showPaymentStatus(error.message || "Could not create Razorpay QR. Check Razorpay QR access.", true);
        }
    };
    loadQr();

    const itemsSlot = el("customerPaymentItems");
    const renderPaymentItems = (items) => {
        const rows = (Array.isArray(items) ? items : []).filter(item => item && (item.product_name || item.name || item.item_name));
        if (itemsSlot) itemsSlot.innerHTML = rows.length
            ? rows.map(item => `<div class="customer-payment-item"><span>${escapeHTML(String(item.qty ?? item.quantity ?? 1))} × ${escapeHTML(item.product_name || item.name || item.item_name)}</span></div>`).join("")
            : "Item details are not available";
    };
    if (Array.isArray(order.items) && order.items.length) renderPaymentItems(order.items);
    else fetch(`${API}/orders/items/${encodeURIComponent(order.id)}`).then(response => response.json()).then(data => renderPaymentItems(data.items)).catch(() => renderPaymentItems([]));
}

// =====================================================
// OTP UI
// =====================================================

function showOTPUI(order) {
    if (!order) return;
    const page = ensureCustomerPaymentPage();
    if (page.style.display !== "none" && page.dataset.screen === "otp" && page.dataset.orderId === String(order.id)) return;
    if (page._paymentPollTimer) clearInterval(page._paymentPollTimer);
    page.dataset.screen = "otp";
    page.dataset.orderId = String(order.id);

    const orderId = escapeHTML(String(order.id));
    const customerName = escapeHTML(order.customer_name || order.name || "Customer");
    const customerAddress = escapeHTML(order.address || order.customer_address || order.delivery_address || order.full_address || "Customer address not available");
    const isCod = String(order.payment || "").trim().toUpperCase() === "COD";
    const paymentText = isCod && order.cod_collected_method
        ? `Payment received · ₹${Number(order.cod_collected_amount || order.grand_total || order.total_amount || 0).toFixed(2)} · ${order.cod_collected_method === "cash" ? "Cash" : "Razorpay UPI"}`
        : "Payment confirmed";

    page.innerHTML = `
        <header class="customer-payment-header">
            <button type="button" id="otpPageBack" aria-label="Back to customer navigation"><i class="fa-solid fa-arrow-left"></i></button>
            <div><strong>DARVOZ</strong><small>Delivery Partner</small></div>
        </header>
        <div class="customer-payment-scroll"><div class="customer-payment-inner customer-otp-inner">
            <div class="customer-payment-title"><div><h2>Verify delivery</h2><p>Get the OTP from the customer to complete this order.</p></div><span class="customer-payment-order-id">Order #${orderId}</span></div>
            <section class="customer-payment-card"><strong class="customer-payment-card-title">Deliver to</strong><div class="customer-payment-customer">${customerName}</div><div class="customer-payment-address">${customerAddress}</div></section>
            <section class="customer-otp-payment-status"><i class="fa-solid fa-circle-check"></i><span>${escapeHTML(paymentText)}</span></section>
            <section class="customer-payment-card customer-otp-card">
                <div class="customer-otp-lock"><i class="fa-solid fa-shield-halved"></i></div>
                <h3>Enter delivery OTP</h3>
                <p>Ask the customer for the 4-digit code.</p>
                <input id="deliveryOtpInput" class="customer-otp-input" type="text" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-label="4-digit delivery OTP">
                <div id="customerOtpStatus" class="customer-payment-status" role="status"></div>
            </section>
        </div></div>
        <footer class="customer-payment-footer"><div class="customer-payment-inner">
            <button type="button" class="customer-payment-action" id="verifyDeliveryOtp">Verify OTP &amp; Deliver</button>
            <div class="customer-payment-footer-note">The order completes after the OTP is verified.</div>
        </div></footer>`;
    page.style.display = "flex";
    document.body.classList.add("customer-payment-active");

    el("otpPageBack")?.addEventListener("click", () => {
        page.dataset.dismissedOrderId = String(order.id);
        hideCustomerPaymentPage();
        openCustomerRoute(order, true);
    });

    const input = el("deliveryOtpInput");
    input?.addEventListener("input", function () {
        this.value = this.value.replace(/\D/g, "").slice(0, 4);
    });
    input?.focus();

    const verifyButton = el("verifyDeliveryOtp");
    verifyButton?.addEventListener("click", async function () {
        const otp = input?.value.trim() || "";
        const status = el("customerOtpStatus");
        if (!/^\d{4}$/.test(otp)) {
            if (status) {
                status.textContent = "Enter the 4-digit OTP from the customer.";
                status.classList.add("customer-payment-error");
            }
            input?.focus();
            return;
        }

        this.disabled = true;
        this.textContent = "Verifying…";
        if (status) {
            status.textContent = "Checking OTP…";
            status.classList.remove("customer-payment-error");
        }
        try {
            const response = await fetch(`${API}/deliveryPartner/verify-otp/${encodeURIComponent(order.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deliveryId: delivery.id, otp })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Invalid OTP. Please check with the customer.");

            currentOrderData = { ...currentOrderData, delivery_status: "Delivered", status: "Delivered" };
            hideCustomerPaymentPage();
            renderCurrentOrder(currentOrderData);
        } catch (error) {
            if (status) {
                status.textContent = error.message || "Unable to verify OTP.";
                status.classList.add("customer-payment-error");
            }
            this.disabled = false;
            this.textContent = "Verify OTP & Deliver";
        }
    });
}

// =====================================================
// DELIVERY SUCCESS
// =====================================================

function showDeliverySuccess(order) {
    stopDarvozNavigation();
    const page = ensureCustomerPaymentPage();
    if (page.style.display !== "none" && page.dataset.screen === "delivery-success" && page.dataset.orderId === String(order.id)) return;
    if (page._paymentPollTimer) clearInterval(page._paymentPollTimer);

    const amount = Number(order.cod_collected_amount || order.grand_total || order.total_amount || 0);
    const fee = Number(order.delivery_rider_earning ?? order.delivery_fee ?? 0);
    const isCod = String(order.payment || "").trim().toUpperCase() === "COD";
    const method = isCod
        ? (order.cod_collected_method === "cash" ? "Cash collected" : "Razorpay UPI payment")
        : `Paid online${order.payment ? ` · ${escapeHTML(order.payment)}` : ""}`;
    const orderId = escapeHTML(String(order.id || "—"));

    page.dataset.screen = "delivery-success";
    page.dataset.orderId = String(order.id);
    page.innerHTML = `
        <header class="customer-payment-header delivery-success-header">
            <div class="delivery-success-brand-mark">D</div>
            <div><strong>DARVOZ</strong><small>Delivery Partner</small></div>
        </header>
        <main class="delivery-success-content">
            <div class="delivery-success-check"><i class="fa-solid fa-check"></i></div>
            <p class="delivery-success-eyebrow">ORDER #${orderId}</p>
            <h1>Delivered successfully!</h1>
            <p class="delivery-success-subtitle">${isCod ? "This order is complete. Here is the payment summary." : "This order is complete. Here is your delivery earning."}</p>
            ${isCod ? `<section class="delivery-success-receipt">
                <span class="delivery-success-receipt-label">Amount received</span>
                <strong>₹${amount.toFixed(2)}</strong>
                <span class="delivery-success-method"><i class="fa-solid ${order.cod_collected_method === "cash" ? "fa-money-bill-wave" : "fa-circle-check"}"></i> ${method}</span>
            </section>` : ""}
            <section class="delivery-success-earned">
                <span>Your delivery earning</span>
                <strong>₹${fee.toFixed(2)}</strong>
            </section>
            <div class="delivery-success-thanks">Thanks for delivering with DARVOZ.</div>
        </main>
        <footer class="customer-payment-footer"><div class="customer-payment-inner">
            <button type="button" class="customer-payment-action delivery-success-done" id="finishDeliverySuccess">Back to dashboard</button>
        </div></footer>`;
    page.style.display = "flex";
    document.body.classList.add("customer-payment-active", "active-delivery-mode");

    el("finishDeliverySuccess")?.addEventListener("click", async () => {
        hideCustomerPaymentPage();
        currentOrderData = null;
        currentOrderId = null;
        if (currentOrder) currentOrder.style.display = "none";
        document.body.classList.remove("active-delivery-mode");
        if (onlineToggle && onlineToggle.checked) showSearching();
        await loadDashboard();
    });
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

let customerRouteGeocodeOrderId = null;
let customerRouteGeocodeFailedOrderId = null;
let customerRouteDismissedOrderId = null;
function openCustomerRoute(order, retryGeocode = false) {
    if (!order) return;
    const orderId = order.id ?? currentOrderId;
    if (!retryGeocode && customerRouteDismissedOrderId === String(orderId)) return;
    if (retryGeocode) customerRouteDismissedOrderId = null;
    const navScreen = el("darvozNavigationScreen");
    if (darvozNavigation && darvozNavigation.type === "customer" && String(darvozNavigation.orderId) === String(orderId) && navScreen && navScreen.style.display !== "none") return;
    const destinationAddress = String(order.address || order.customer_address || order.delivery_address || order.full_address || "").trim();
    const destinationLat = getNumber(order.customer_lat ?? order.delivery_lat ?? order.customer_latitude);
    const destinationLng = getNumber(order.customer_lng ?? order.delivery_lng ?? order.customer_longitude);
    const options = {
        type: "customer",
        orderId,
        destinationLat,
        destinationLng,
        destinationName: order.customer_name || "Customer",
        destinationAddress,
        destinationPhone: order.mobile || order.customer_mobile || ""
    };
    if (Number.isFinite(destinationLat) && Number.isFinite(destinationLng)) {
        customerRouteGeocodeFailedOrderId = null;
        openDarvozNavigation(options);
        return;
    }
    if (!destinationAddress) {
        if (retryGeocode) alert("The customer address is not available for route guidance.");
        return;
    }
    if (customerRouteGeocodeOrderId === String(orderId)) return;
    if (!retryGeocode && customerRouteGeocodeFailedOrderId === String(orderId)) return;
    customerRouteGeocodeOrderId = String(orderId);
    loadDarvozGoogleMaps(() => {
        const geocoder = new google.maps.Geocoder();
        const geocodeAddress = /\b(India|भारत)\b/i.test(destinationAddress) ? destinationAddress : `${destinationAddress}, India`;
        geocoder.geocode({ address: geocodeAddress }, (results, status) => {
            customerRouteGeocodeOrderId = null;
            if (status !== "OK" || !results || !results[0]) {
                customerRouteGeocodeFailedOrderId = String(orderId);
                console.error("CUSTOMER ADDRESS GEOCODE FAILED:", status, geocodeAddress);
                if (retryGeocode) alert("Could not find this customer address on the map. Check the saved address and try again.");
                return;
            }
            customerRouteGeocodeFailedOrderId = null;
            const location = results[0].geometry.location;
            options.destinationLat = location.lat();
            options.destinationLng = location.lng();
            console.log("CUSTOMER DESTINATION GEOCODED:", options.destinationLat, options.destinationLng);
            openDarvozNavigation(options);
        });
    });
}
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
                    orderId: order.id,

                    destinationLat:
                        restaurantLat,

                    destinationLng:
                        restaurantLng,

                    destinationName:
                        order.restaurant_name ||
                        "Partner Store",
                    destinationAddress:
                        order.restaurant_address || order.pickup_address || "",
                    destinationPhone:
                        order.restaurant_mobile || order.partner_mobile || ""

                });

            };

    }

    // -----------------------------------------
    // CUSTOMER
    // -----------------------------------------

    if (navigateCustomer) {
        navigateCustomer.onclick = function () {
            openCustomerRoute(order, true);
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

    const existingScreen = el("darvozNavigationScreen");
    if (options.orderId && darvozNavigation && String(darvozNavigation.orderId) === String(options.orderId) && existingScreen && existingScreen.style.display !== "none") return;
    stopDarvozNavigation();
    if (options.type === "restaurant" && window.speechSynthesis) window.speechSynthesis.cancel();

    darvozNavigation = {

        type:
            options.type,

        orderId:
            options.orderId || currentOrderData?.id || currentOrderId || null,

        destinationLat:
            lat,

        destinationLng:
            lng,

        destinationName:
            options.destinationName ||
            "Destination",

        destinationAddress:
            options.destinationAddress || "",

        destinationPhone:
            options.destinationPhone || "",

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

        lastHeading: 0,
        currentLeg: null,
        activeStepIndex: 0,
        spokenTurnKeys: [],
        routePath: [],
        mapFollowing: true,
        voiceEnabled: options.type !== "restaurant",
        mapSatellite: false
    };

    createDarvozNavigationScreen();

    const orderIdLabel = el("darvozNavOrderId");
    if (orderIdLabel) orderIdLabel.textContent = "Order ID: #" + (darvozNavigation.orderId || currentOrderId || currentOrderData?.id || "--");

    const screen =
        el("darvozNavigationScreen");

    if (screen) {


                screen.classList.toggle("darvoz-customer-navigation", darvozNavigation.type === "customer");

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

    const addressText =
        el("darvozNavAddress")?.querySelector("span");

    if (addressText) {

        addressText.textContent =
            darvozNavigation.destinationAddress || "Address unavailable";

    }
    const isCustomerNavigation = darvozNavigation.type === "customer";
    const placeLabel = el("darvozNavPlaceLabel");
    if (placeLabel) placeLabel.textContent = isCustomerNavigation ? "Deliver to" : "Pickup from";
    const placeIcon = el("darvozNavPlaceIcon");
    if (placeIcon) placeIcon.className = isCustomerNavigation ? "fa-solid fa-house-user" : "fa-solid fa-store";
    const readyTitle = el("darvozNavReadyTitle");
    if (readyTitle) readyTitle.textContent = isCustomerNavigation ? "Customer location" : "Ready for pickup!";
    const readyText = el("darvozNavReadyText");
    if (readyText) readyText.textContent = isCustomerNavigation ? "Follow the route to the customer." : "Follow the route to the restaurant.";
const callLink =
        el("darvozNavCall");

    if (callLink) {

        const phone =
            String(darvozNavigation.destinationPhone || "").replace(/[^\d+]/g, "");

        if (phone) {

            callLink.href =
                `tel:${phone}`;

            callLink.style.display =
                "flex";

            const callLabel =
                callLink.querySelector("span");

            if (callLabel) {

                callLabel.textContent =
                    darvozNavigation.type === "restaurant" ? "Call Restaurant" : "Call Customer";

            }

        } else {

            callLink.style.display =
                "none";

        }

    }

    const reachedButton =
        darvozNavigation.type === "restaurant" ? null : el("darvozReachedCustomer");

    if (reachedButton) {

        reachedButton.style.display =
            "block";

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

            const navigationTemplate =
        el("darvozNavigationTemplate");

    if (!navigationTemplate) {

        return;

    }

    screen.innerHTML =
        navigationTemplate.innerHTML;

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

        back.onclick = function () {
                exitDarvozGuidance();
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

    const reachedRestaurantButton = el("darvozReachedRestaurant");
    if (reachedRestaurantButton) {
        reachedRestaurantButton.style.display = darvozNavigation.type === "restaurant" ? "block" : "none";
        reachedRestaurantButton.onclick = async function () {
            this.disabled = true;
            this.innerHTML = "Checking location...";
            await checkReachedRestaurantFromNavigation();
            if (darvozNavigation && el("darvozReachedRestaurant")) {
                const button = el("darvozReachedRestaurant");
                button.disabled = false;
                button.innerHTML = "<i class='fa-solid fa-location-dot'></i><span>Reached Restaurant</span>";
            }
        };
    }

    // -----------------------------------------
    // REACHED CUSTOMER
    // -----------------------------------------

    const voiceControl = el("darvozVoiceControl");
    if (voiceControl && darvozNavigation.type === "restaurant") voiceControl.style.display = "none";

    const reachedCustomer =
        el("darvozReachedCustomer");

    if (reachedCustomer) {

        reachedCustomer.onclick =
            async function () {

                this.disabled =
                    true;
                this.setAttribute("aria-busy", "true");

                await checkReachedCustomerFromNavigation();

                if (this.isConnected && this.style.display !== "none") {
                    this.disabled = false;
                    this.removeAttribute("aria-busy");
                }

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

    const mapForResize = darvozNavigation.map;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!darvozNavigation || darvozNavigation.map !== mapForResize) return;
        google.maps.event.trigger(mapForResize, "resize");
        mapForResize.setCenter(destination);
    }));

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

                enableHighAccuracy: true,
                maximumAge: 1500,
                timeout: 12000

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
// CREATE RIDER BIKE MARKER
// =====================================================

function getDarvozBikeMarkerIcon(heading = 0) {
    return {
        url: "/delivery/images/darvoz-rider-scooter.png",
        scaledSize: new google.maps.Size(60, 60),
        // The scooter image has transparent padding; anchor its wheelbase to the route.
        anchor: new google.maps.Point(40, 42)
    };
}

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

    const riderMarker =
        new google.maps.Marker({

            position:
                position,

            map:
                map,

            icon:
                getDarvozBikeMarkerIcon(heading),
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

    updateDarvozRiderMarker(darvozNavigation.riderLocation);

    if (darvozNavigation.navigationStarted && darvozNavigation.map) {
        if (darvozNavigation.mapFollowing !== false) {
            if (!darvozNavigation.map.getZoom() || darvozNavigation.map.getZoom() < 18) {
                darvozNavigation.map.setZoom(18);
            }
            darvozNavigation.map.setCenter(getDarvozSnappedLocation(darvozNavigation.riderLocation));
            darvozNavigation.map.panBy(0, Math.round(window.innerHeight * 0.14));
            if (darvozNavigation.map.setHeading && Number.isFinite(darvozNavigation.lastHeading)) {
            darvozNavigation.map.setHeading(getDarvozRouteHeading(darvozNavigation.riderLocation));
            darvozNavigation.map.setTilt(45);
        }
        }
        if (darvozNavigation.currentLeg) updateDarvozNextTurn(darvozNavigation.currentLeg, darvozNavigation.riderLocation);
    }

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

function startDarvozGuidance() {

    if (!darvozNavigation) {

        return;

    }

    const screen =
        el("darvozNavigationScreen");

    if (screen) {


        screen.classList.add("darvoz-guidance-active");

    }

    if (!darvozNavigation.riderLocation) {

        const instruction =
            el("darvozTurnInstruction");

        const distance =
            el("darvozTurnDistance");

        if (instruction) {

            instruction.textContent =
                "Finding your location…";

        }

        if (distance) {

            distance.textContent =
                "Waiting for GPS to build your route";

        }

    }

    startDarvozNavigation();

    if (darvozNavigation && darvozNavigation.riderLocation) {

        recenterDarvozNavigationMap();

    }

}

// =====================================================
// RIDER MARKER// =====================================================
// RIDER MARKER
// =====================================================

function getDarvozRouteSnap(location) {
    if (!darvozNavigation || !location || !window.google || !google.maps || !google.maps.geometry || !google.maps.geometry.spherical) return null;
    const path = darvozNavigation.routePath || [];
    if (path.length < 2) return null;
    const spherical = google.maps.geometry.spherical;
    const rider = new google.maps.LatLng(Number(location.lat), Number(location.lng));
    let best = null;
    for (let i = 0; i < path.length - 1; i++) {
        const start = path[i], end = path[i + 1];
        const segmentLength = spherical.computeDistanceBetween(start, end);
        if (!segmentLength) continue;
        const segmentHeading = spherical.computeHeading(start, end);
        const riderHeading = spherical.computeHeading(start, rider);
        const projected = spherical.computeDistanceBetween(start, rider) * Math.cos((riderHeading - segmentHeading) * Math.PI / 180);
        const offset = Math.max(0, Math.min(segmentLength, projected));
        const snapped = spherical.computeOffset(start, offset, segmentHeading);
        const gap = spherical.computeDistanceBetween(rider, snapped);
        if (!best || gap < best.gap) best = { position: snapped, heading: (segmentHeading + 360) % 360, gap: gap };
    }
    return best;
}
function getDarvozSnappedLocation(location) {
    const snap = getDarvozRouteSnap(location);
    return snap ? snap.position : location;
}
function getDarvozRouteHeading(location) {
    const snap = getDarvozRouteSnap(location);
    return snap ? snap.heading : (darvozNavigation ? darvozNavigation.lastHeading || 0 : 0);
}
function toggleDarvozVoice() {
    if (!darvozNavigation) return;
    darvozNavigation.voiceEnabled = !darvozNavigation.voiceEnabled;
    if (!darvozNavigation.voiceEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
    const button = el("darvozVoiceControl");
    if (button) {
        button.setAttribute("aria-label", darvozNavigation.voiceEnabled ? "Mute voice guidance" : "Turn on voice guidance");
        button.innerHTML = darvozNavigation.voiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    }
}
function toggleDarvozMapLayer() {
    if (!darvozNavigation || !darvozNavigation.map) return;
    darvozNavigation.mapSatellite = !darvozNavigation.mapSatellite;
    darvozNavigation.map.setMapTypeId(darvozNavigation.mapSatellite ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
    const button = el("darvozLayerControl");
    if (button) button.setAttribute("aria-label", darvozNavigation.mapSatellite ? "Switch to road map" : "Switch to satellite map");
}
function showDarvozRouteOverview() {
    if (!darvozNavigation || !darvozNavigation.map) return;
    const path = darvozNavigation.routePath || [];
    if (!path.length) return recenterDarvozNavigationMap();
    darvozNavigation.mapFollowing = false;
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    darvozNavigation.map.fitBounds(bounds, { top: 100, right: 80, bottom: 150, left: 45 });
}
function updateDarvozRiderMarker(
    location
) {

    if (
        !darvozNavigation ||
        !darvozNavigation.map
    ) {

        return;

    }

    const snappedPosition = getDarvozSnappedLocation(location);
    const heading = getDarvozRouteHeading(location);

    if (
        !darvozNavigation.riderMarker
    ) {

        darvozNavigation.riderMarker =
            createRiderMarker(
                darvozNavigation.map,
                snappedPosition,
                heading
            );

        window.riderMarker =
            darvozNavigation.riderMarker;

    }

    else {

        darvozNavigation
            .riderMarker
            .setPosition(snappedPosition);

        darvozNavigation.riderMarker.setIcon(getDarvozBikeMarkerIcon(heading));

    }

    if (
        !darvozNavigation.mapCentered
    ) {

        darvozNavigation.map.setCenter(snappedPosition);

        darvozNavigation.map.setZoom(18);
        darvozNavigation.map.panBy(0, Math.round(window.innerHeight * 0.14));

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

    darvozNavigation.mapFollowing = true;
    map.setCenter(getDarvozSnappedLocation(darvozNavigation.riderLocation));
    map.panBy(0, Math.round(window.innerHeight * 0.14));

    // Keep the rider arrow large enough to follow and show nearby turns clearly.
    map.setZoom(18);
    if (darvozNavigation.navigationStarted && map.setTilt) map.setTilt(45);

    console.log(
        "🎯 RECENTERED ON RIDER"
    );

}

// =====================================================
// UPDATE NEXT TURN NAVIGATION
// =====================================================

function updateDarvozNextTurn(leg, riderLocation) {
    if (!leg || !Array.isArray(leg.steps) || !leg.steps.length) return;
    const steps = leg.steps;
    const rider = riderLocation && window.google && google.maps ? new google.maps.LatLng(Number(riderLocation.lat), Number(riderLocation.lng)) : null;
    let activeIndex = Math.max(0, Math.min(darvozNavigation.activeStepIndex || 0, steps.length - 1));
    let nearestDistance = Infinity, nearestPathIndex = 0;
    if (rider && google.maps.geometry && google.maps.geometry.spherical) {
        const spherical = google.maps.geometry.spherical;
        for (let stepIndex = activeIndex; stepIndex < steps.length; stepIndex++) {
            const path = steps[stepIndex].path || [];
            if (path.length) {
                for (let pointIndex = 0; pointIndex < path.length; pointIndex++) {
                    const gap = spherical.computeDistanceBetween(rider, path[pointIndex]);
                    if (gap < nearestDistance) { nearestDistance = gap; activeIndex = stepIndex; nearestPathIndex = pointIndex; }
                }
            } else if (steps[stepIndex].end_location) {
                const gap = spherical.computeDistanceBetween(rider, steps[stepIndex].end_location);
                if (gap < nearestDistance) { nearestDistance = gap; activeIndex = stepIndex; nearestPathIndex = 0; }
            }
        }
    }
    darvozNavigation.activeStepIndex = activeIndex;
    const step = steps[activeIndex], nextStep = steps[activeIndex + 1];
    const instruction = (step.instructions || "Continue straight").replace(/<[^>]*>/g, "").trim();
    const maneuver = String(step.maneuver || "").toLowerCase(), path = step.path || [];
    let remainingMeters = Number(step.distance && step.distance.value) || 0;
    if (rider && path.length && google.maps.geometry && google.maps.geometry.spherical) {
        const spherical = google.maps.geometry.spherical, nearest = Math.min(nearestPathIndex, path.length - 1);
        remainingMeters = spherical.computeDistanceBetween(rider, path[nearest]);
        for (let i = nearest; i < path.length - 1; i++) remainingMeters += spherical.computeDistanceBetween(path[i], path[i + 1]);
    }
    const distanceText = remainingMeters < 1000 ? Math.max(0, Math.round(remainingMeters / 10) * 10) + " m" : (remainingMeters / 1000).toFixed(1) + " km";
    const icon = maneuver.includes("left") ? "↰" : maneuver.includes("right") ? "↱" : maneuver.includes("uturn") ? "↶" : maneuver.includes("roundabout") ? "⟳" : maneuver.includes("merge") ? "↗" : "↑";
    const iconElement = el("darvozTurnIcon"), instructionElement = el("darvozTurnInstruction"), distanceElement = el("darvozTurnDistance"), thenElement = el("darvozTurnThen");
    if (iconElement) iconElement.textContent = icon;
    if (instructionElement) instructionElement.textContent = instruction;
    if (distanceElement) distanceElement.textContent = "In " + distanceText;
    if (thenElement) {
        const nextInstruction = nextStep && nextStep.instructions ? nextStep.instructions.replace(/<[^>]*>/g, "").trim() : "";
        const nextManeuver = String(nextStep && nextStep.maneuver || "").toLowerCase();
        const nextArrow = nextManeuver.includes("left") ? "↰" : nextManeuver.includes("right") ? "↱" : nextManeuver.includes("uturn") ? "↶" : "↑";
        thenElement.textContent = nextInstruction ? "Then " + nextArrow + "  " + nextInstruction : "";
        thenElement.style.display = nextInstruction ? "block" : "none";
    }
    const end = step.end_location;
    const turnKey = (end && typeof end.lat === "function" ? end.lat() : "") + ":" + (end && typeof end.lng === "function" ? end.lng() : "") + ":" + instruction;
    if (!Array.isArray(darvozNavigation.spokenTurnKeys)) darvozNavigation.spokenTurnKeys = [];
    if (remainingMeters <= 220 && remainingMeters > 0 && !darvozNavigation.spokenTurnKeys.includes(turnKey)) {
        darvozNavigation.spokenTurnKeys.push(turnKey);
        if (darvozNavigation.voiceEnabled && window.speechSynthesis && window.SpeechSynthesisUtterance) {
            const speech = new SpeechSynthesisUtterance("In " + distanceText + ", " + instruction);
            speech.rate = 1;
            window.speechSynthesis.speak(speech);
        }
    }
    console.log("🧭 ACTIVE TURN:", activeIndex + 1, instruction, distanceText);
}

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
                true

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

            const routeDistance = route => (route.legs || []).reduce((total, leg) => total + Number(leg.distance?.value || 0), 0);
            const shortestRouteIndex = result.routes.reduce((bestIndex, route, index, routes) =>
                routeDistance(route) < routeDistance(routes[bestIndex]) ? index : bestIndex, 0);
            darvozNavigation.directionsRenderer.setDirections(result);
            darvozNavigation.directionsRenderer.setRouteIndex(shortestRouteIndex);

            const route = result.routes[shortestRouteIndex];
            darvozNavigation.routePath = route.overview_path || [];
            updateDarvozRiderMarker(darvozNavigation.riderLocation);

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

            const leg = route.legs[0];
            darvozNavigation.currentLeg = leg;
            darvozNavigation.activeStepIndex = 0;

            // -----------------------------------------
            // NEXT TURN
            // -----------------------------------------

            updateDarvozNextTurn(leg, darvozNavigation.riderLocation);

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

    const currentDistanceElement =
        el("currentRouteDistance");

    const currentEtaElement =
        el("currentRouteEta");

    if (currentDistanceElement) {
        currentDistanceElement.textContent = distance || "--";
    }

    if (currentEtaElement) {
        currentEtaElement.textContent = eta || "--";
    }

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
                    `${arrivalText}`;

            }

            else {

                arrivalElement.textContent =
                    `${eta}`;

            }

        }

        else {

            arrivalElement.textContent =
                "--";

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

function exitDarvozGuidance() {
    const screen = el("darvozNavigationScreen");
    if (darvozNavigation?.type === "customer" && screen?.classList.contains("darvoz-guidance-active")) {
        screen.classList.remove("darvoz-guidance-active");
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        darvozNavigation.navigationStarted = false;
        darvozNavigation.mapFollowing = true;
        const routeButton = el("darvozStartGuidance");
        if (routeButton) routeButton.style.display = "flex";
        const reachedButton = el("darvozReachedCustomer");
        if (reachedButton) reachedButton.style.display = "block";
        if (darvozNavigation.map && darvozNavigation.riderLocation) {
            darvozNavigation.map.setCenter(darvozNavigation.riderLocation);
        }
        return;
    }
    if (darvozNavigation?.type === "customer" && darvozNavigation.orderId != null) {
        customerRouteDismissedOrderId = String(darvozNavigation.orderId);
    }
    if (screen) {

        screen.classList.remove("darvoz-guidance-active");
        screen.style.display = "none";
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopDarvozNavigation();
}

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


            screen.classList.remove("darvoz-guidance-active");
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
                                longitude,

                            customerLatitude:
                                Number(darvozNavigation.destinationLat),

                            customerLongitude:
                                Number(darvozNavigation.destinationLng)

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


            screen.classList.remove("darvoz-guidance-active");
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
        #darvozNavigationScreen{box-sizing:border-box;position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;margin:0;padding:0;z-index:99999;display:none;background:#eef3f3;color:#112838;font-family:inherit;overflow:hidden;}
        #darvozNavigationScreen,#darvozNavigationScreen *:not(i){font-family:Roboto,Arial,sans-serif!important;}
        .darvoz-google-map{box-sizing:border-box;position:absolute!important;top:0!important;right:0!important;bottom:0!important;left:0!important;width:100%!important;height:100%!important;min-height:0;margin:0;padding:0;}
        .darvoz-nav-header{box-sizing:border-box;position:absolute;z-index:20;top:0;left:0;right:0;height:calc(48px + env(safe-area-inset-top));padding:calc(8px + env(safe-area-inset-top)) 18px 8px;background:transparent;display:flex;align-items:center;justify-content:flex-start;color:#fff;pointer-events:none;box-shadow:none;}.darvoz-nav-header strong{font-size:18px;letter-spacing:.02em;font-weight:800;text-shadow:0 1px 5px rgba(0,0,0,.8);}
        .darvoz-nav-back{width:42px;height:42px;flex:0 0 42px;border:0;border-radius:50%;background:transparent;color:#fff;font-size:24px;display:grid;place-items:center;}
        .darvoz-nav-brand-mark{width:46px;height:46px;flex:0 0 46px;border-radius:10px;background:#fff;color:#00766c;font-size:32px;font-weight:900;display:grid;place-items:center;}
        .darvoz-nav-brand-copy{display:flex;flex:1;min-width:0;flex-direction:column;line-height:1.05;}
        .darvoz-nav-brand-copy strong{font-size:19px;letter-spacing:.04em;font-weight:900;}
        .darvoz-nav-brand-copy span{font-size:11px;opacity:.82;margin-top:4px;}
        .darvoz-nav-notification{position:relative;display:grid;place-items:center;width:42px;height:46px;margin-left:4px;color:#fff;font-size:25px;}.darvoz-nav-notification em{position:absolute;top:3px;right:2px;width:11px;height:11px;border-radius:50%;background:#ff3f47;border:2px solid #00645e;}
        .darvoz-map-controls{position:absolute;z-index:10;right:16px;bottom:clamp(305px,43vh,390px);display:none;flex-direction:column;gap:12px;}
        .darvoz-map-control{width:52px;height:52px;border:0;border-radius:50%;background:#fff;color:#123044;font-size:20px;box-shadow:0 4px 14px rgba(19,43,57,.18);display:grid;place-items:center;}
        .darvoz-map-control:active,.darvoz-nav-route-button:active,.darvoz-reached-primary:active{transform:scale(.97);}
        .darvoz-next-turn{display:none!important;}
        .darvoz-turn-icon{width:42px;height:42px;flex:0 0 42px;border-radius:14px;background:#e8f8f1;color:#00786d;display:grid;place-items:center;font-size:21px;}
        .darvoz-turn-details{min-width:0;}
        .darvoz-turn-instruction{font-size:14px;font-weight:850;color:#102936;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .darvoz-turn-distance{margin-top:4px;font-size:12px;font-weight:650;color:#647582;}
        .darvoz-customer-navigation .darvoz-nav-bottom{max-height:72dvh;}.darvoz-customer-navigation .darvoz-nav-address{overflow-wrap:anywhere;word-break:break-word;line-height:1.4;}
        .darvoz-nav-bottom{position:absolute;z-index:15;left:0;right:0;bottom:0;max-height:67dvh;overflow-y:auto;overscroll-behavior:contain;padding:0 28px max(20px,env(safe-area-inset-bottom));border-radius:34px 34px 0 0;background:#fff;box-shadow:0 -8px 28px rgba(13,35,43,.18);}
        .darvoz-nav-handle{width:56px;height:7px;border-radius:8px;background:#bac2cb;margin:14px auto 20px;}
        .darvoz-nav-ready{display:flex;align-items:center;gap:13px;padding:14px 0 22px;border-radius:0;background:transparent;border-bottom:1px solid #e8edef;}
        .darvoz-nav-ready-icon{width:78px;height:78px;flex:0 0 78px;border-radius:50%;display:grid;place-items:center;background:#e6faef;color:#10a64b;font-size:32px;}
        .darvoz-nav-ready-copy{display:flex;min-width:0;flex-direction:column;gap:4px;}
        .darvoz-nav-ready-copy strong{font-size:19px;line-height:1.15;font-weight:900;color:#075a55;}
        .darvoz-nav-ready-copy span{font-size:13px;line-height:1.35;color:#64758a;font-weight:600;}
        .darvoz-nav-place-card{display:grid;grid-template-columns:44px minmax(0,1fr) 68px;align-items:center;gap:10px;padding:22px 2px 15px;margin-top:0;border-bottom:1px solid #e8edef;}
        .darvoz-nav-place-icon{width:42px;height:42px;border-radius:14px;background:#eff7f5;color:#607383;display:grid;place-items:center;font-size:19px;}
        .darvoz-nav-place-copy{min-width:0;display:flex;flex-direction:column;gap:4px;}
        .darvoz-nav-place-copy>span:first-child{font-size:12px;color:#687988;font-weight:700;}
        .darvoz-nav-place-copy strong{font-size:20px;color:#122a3a;font-weight:900;line-height:1.15;overflow-wrap:anywhere;}
        .darvoz-nav-address{display:flex;align-items:flex-start;gap:9px;font-size:14px;line-height:1.35;color:#667788;overflow-wrap:anywhere;}.darvoz-nav-address i{flex:0 0 18px;margin-top:2px;color:#748394;}
        .darvoz-nav-route-button{width:66px;height:66px;border:1px solid #d1f0e4;border-radius:18px;background:#effbf6;color:#006b63;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:21px;}
        .darvoz-nav-route-button span{font-size:12px;font-weight:800;}
        .darvoz-nav-call{min-height:53px;display:flex;align-items:center;gap:12px;padding:7px 2px;color:#ef4444;text-decoration:none;font-size:16px;font-weight:850;}
        .darvoz-nav-call i{width:30px;text-align:center;font-size:19px;}
        .darvoz-nav-summary{display:none!important;}
.darvoz-guidance-active .darvoz-nav-header{display:none!important;}
.darvoz-guidance-active .darvoz-google-map{inset:0!important;}
.darvoz-guidance-active .darvoz-next-turn{display:flex!important;top:calc(12px + env(safe-area-inset-top));left:16px;right:16px;min-height:78px;padding:13px 15px;border-radius:20px;background:linear-gradient(120deg,#006a63,#003f47);color:#fff;box-shadow:0 6px 20px rgba(0,35,40,.28);}
.darvoz-guidance-active .darvoz-turn-icon{width:50px;height:50px;flex-basis:50px;border-radius:16px;background:rgba(255,255,255,.16);color:#fff;font-size:26px;}
.darvoz-guidance-active .darvoz-turn-instruction{color:#fff;font-size:16px;}
.darvoz-guidance-active .darvoz-turn-distance{color:rgba(255,255,255,.82);font-size:13px;}
.darvoz-turn-then{margin-top:5px;color:#71808a;font-size:12px;font-weight:700;}
.darvoz-guidance-active .darvoz-turn-then{color:rgba(255,255,255,.72);font-size:13px;}
.darvoz-guidance-active .darvoz-nav-bottom{max-height:27dvh;padding:0 16px max(14px,env(safe-area-inset-bottom));border-radius:26px 26px 0 0;}
.darvoz-guidance-active .darvoz-nav-handle,.darvoz-guidance-active .darvoz-nav-ready,.darvoz-guidance-active .darvoz-nav-place-card,.darvoz-guidance-active .darvoz-nav-call{display:none!important;}
.darvoz-nav-ready{gap:8px;padding:10px 0 14px;}.darvoz-nav-ready-icon{width:24px;height:24px;flex-basis:24px;background:transparent;font-size:15px;}.darvoz-nav-ready-copy{gap:0;}.darvoz-nav-ready-copy strong{font-size:14px;}.darvoz-nav-ready-copy span{display:none;}
.darvoz-nav-reached-restaurant{min-height:58px;margin:14px 0 6px;border-radius:12px;background:#f04b17;color:#fff;font-size:16px;font-weight:800;box-shadow:none;}
.darvoz-guidance-active .darvoz-nav-reached-restaurant{display:none!important;}
.darvoz-guidance-active .darvoz-nav-summary{display:flex!important;margin:4px 0 10px;padding:10px 8px;background:#f3f7f8;}
.darvoz-guidance-active .darvoz-nav-bottom{height:auto;min-height:0;max-height:34dvh;overflow-y:auto;overflow-x:hidden;padding:6px 16px max(8px,env(safe-area-inset-bottom));border-radius:24px 24px 0 0;background:#f4f2f7;box-shadow:0 -3px 14px rgba(20,30,45,.12);}
.darvoz-guidance-exit{display:none;}.darvoz-guidance-active .darvoz-guidance-exit{position:absolute;z-index:2;left:20px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:48px;height:48px;border:1.5px solid #9299a3;border-radius:50%;background:transparent;color:#242a30;font-size:21px;cursor:pointer;}.darvoz-guidance-active .darvoz-guidance-exit:active{background:#e8e6eb;}
.darvoz-guidance-active .darvoz-nav-summary{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%;min-height:66px;margin:0;padding:0;background:transparent;text-align:center;}
.darvoz-google-summary>strong{color:#183d28;font-size:26px;line-height:1.1;font-weight:800;}
.darvoz-google-summary>span{display:flex;align-items:center;justify-content:center;gap:5px;color:#647080;font-size:13px;font-weight:600;}
.darvoz-google-summary-dot{color:#9aa2ad;}
.darvoz-guidance-active .darvoz-nav-metric-icon,.darvoz-guidance-active .darvoz-nav-summary-divider{display:none!important;}

.darvoz-guidance-active .darvoz-map-controls{display:flex!important;bottom:clamp(135px,19vh,175px);gap:10px;}.darvoz-guidance-active .darvoz-map-control{width:46px;height:46px;font-size:18px;}
        .darvoz-nav-metric{display:flex;align-items:center;gap:9px;flex:1;min-width:0;}
        .darvoz-nav-metric-icon{width:38px;height:38px;flex:0 0 38px;border-radius:13px;background:#fff;color:#00766c;display:grid;place-items:center;font-size:17px;}
        .darvoz-nav-metric>span:last-child{display:flex;min-width:0;flex-direction:column;gap:2px;}
        .darvoz-nav-metric small{font-size:10px;font-weight:700;color:#697887;line-height:1.2;}
        .darvoz-nav-metric strong{font-size:16px;font-weight:900;color:#102a3c;white-space:nowrap;}
        .darvoz-nav-metric em{font-style:normal;font-size:10px;color:#697887;}
        .darvoz-nav-summary-divider{width:1px;height:40px;background:#d9e0e4;}
        .darvoz-reached-btn{width:100%;min-height:70px;margin:0;border:0;border-radius:22px;background:linear-gradient(110deg,#00786e,#004b50);color:#fff;font-size:17px;font-weight:850;box-shadow:0 5px 12px rgba(0,95,86,.18);}
        .darvoz-reached-btn i{margin-right:8px;}
.darvoz-guidance-active.darvoz-customer-navigation .darvoz-nav-bottom{min-height:0;height:auto;max-height:34dvh;overflow-y:auto;}
.darvoz-customer-navigation:not(.darvoz-guidance-active) #darvozReachedCustomer{display:flex!important;align-items:center;justify-content:center;width:100%;min-height:58px;height:58px;margin:10px 0 2px;border:0;border-radius:14px;background:#f04b17;color:#fff;font-size:16px;font-weight:850;box-shadow:0 4px 10px rgba(240,75,23,.2);}
.darvoz-customer-navigation.darvoz-guidance-active #darvozReachedCustomer{display:none!important;}
.darvoz-guidance-active.darvoz-customer-navigation .darvoz-nav-summary{min-height:66px;}
.darvoz-customer-navigation:not(.darvoz-guidance-active) .darvoz-guidance-exit{display:none!important;}
        @media(max-width:380px){.darvoz-nav-bottom{padding-left:15px;padding-right:15px}.darvoz-nav-ready-copy strong{font-size:17px}.darvoz-nav-place-card{grid-template-columns:38px minmax(0,1fr) 58px;gap:8px}.darvoz-nav-place-icon{width:38px;height:38px}.darvoz-nav-place-copy strong{font-size:18px}.darvoz-nav-route-button{width:56px;height:58px}.darvoz-nav-metric-icon{width:34px;height:34px;flex-basis:34px}.darvoz-nav-metric small{font-size:9px}}
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

loadOnlineTime();

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
