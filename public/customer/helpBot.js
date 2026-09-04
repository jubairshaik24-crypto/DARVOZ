/* =====================================================
   DARVOZ AI HELP BOT
   Works with:
   - help.html
   - help.html?orderId=123
   - track.html?id=123
   - track.html?orderId=123
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const API = window.location.origin;

    const helpBtn =
        document.getElementById("darvozHelpBtn");

    if (!helpBtn) {
        console.warn(
            "DARVOZ Help Bot: Help button not found."
        );
        return;
    }


    /* =====================================================
       ORDER / GENERAL CONTEXT
    ===================================================== */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const pageOrderId =
        params.get("orderId") ||
        params.get("id") ||
        "";


    /*
       Track page can have live order information
       inside its DOM.

       help.html may only have the orderId.
    */

    function getCurrentOrderData() {

        const orderId =
            pageOrderId ||
            document.getElementById("orderId")
                ?.innerText
                .trim() ||
            "";

        const eta =
            document.getElementById("eta")
                ?.innerText
                .trim() ||
            "";

        const status =
            document.getElementById("heroStatus")
                ?.innerText
                .trim() ||
            "";

        const statusDetails =
            document.getElementById("heroSubStatus")
                ?.innerText
                .trim() ||
            "";

        return {
            orderId,
            eta,
            status,
            statusDetails
        };
    }


    function isOrderSupport() {

        return !!getCurrentOrderData().orderId;

    }


    /* =====================================================
       SUPPORT CHAT STATE
    ===================================================== */

    let activeSupportChatId = null;

    let supportPollingTimer = null;

    let lastSupportMessageCount = 0;

    let supportJoined = false;


    /*
       Store chat separately for each customer/order context.

       General support:
       darvozSupportChat_general_customerId

       Order support:
       darvozSupportChat_order_123_customerId
    */

    function getCustomerId() {

        return (
            localStorage.getItem("customerId") ||
            ""
        );
    }


    function getSupportStorageKey() {

        const customerId =
            getCustomerId();

        const orderId =
            getCurrentOrderData().orderId;

        if (orderId) {

            return (
                `darvozSupportChat_order_${orderId}_${customerId}`
            );

        }

        return (
            `darvozSupportChat_general_${customerId}`
        );
    }


    function saveSupportChatId(chatId) {

        if (!chatId) return;

        activeSupportChatId = chatId;

        localStorage.setItem(
            getSupportStorageKey(),
            chatId
        );

        /*
           Keep old keys too so other existing
           DARVOZ code doesn't break.
        */

        localStorage.setItem(
            "darvozSupportChatId",
            chatId
        );
    }


    function getSavedSupportChatId() {

    const saved =
        localStorage.getItem(
            getSupportStorageKey()
        );

    return saved || null;
}

// =====================================================
// LOAD CUSTOMER SUPPORT HISTORY
// =====================================================

async function loadSupportHistory() {

    const customerId = getCustomerId();

    if (!customerId) {
        return;
    }

    const orderId =
        getCurrentOrderData().orderId;

    try {

        let url =
            `${API}/api/support/customer-history` +
            `?customerId=${encodeURIComponent(customerId)}`;

        if (orderId) {

            url +=
                `&orderId=${encodeURIComponent(orderId)}`;

        }

        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {

            console.warn(
                "Unable to load support history"
            );

            return;
        }

        renderSupportHistory(
            data.chats || []
        );

    }
    catch (error) {

        console.error(
            "❌ Support history error:",
            error
        );

    }

}

// =====================================================
// RENDER SUPPORT HISTORY
// =====================================================

function renderSupportHistory(chats) {

    const historySection =
        document.getElementById(
            "supportHistorySection"
        );

    const historyList =
        document.getElementById(
            "supportHistoryList"
        );

    if (
        !historySection ||
        !historyList
    ) {
        return;
    }

    historyList.innerHTML = "";

    if (
        !Array.isArray(chats) ||
        chats.length === 0
    ) {

        historySection.style.display =
            "none";

        return;
    }

    historySection.style.display =
        "block";


    chats.forEach(chat => {

        const item =
            document.createElement("div");

        item.className =
            "support-history-item";


        const status =
            String(
                chat.status || "closed"
            ).toLowerCase();


        const statusText =
            status === "active"
                ? "Active"
                : status === "waiting"
                    ? "Waiting"
                    : "Closed";


        const orderText =
            chat.order_id
                ? `Order #${chat.order_id}`
                : "General Support";


        item.innerHTML = `

            <div class="support-history-top">

                <div class="support-history-title">

                    <i class="fa-solid fa-headset"></i>

                    <span>
                        Previous conversation
                    </span>

                </div>

                <div class="support-history-status">
                    ${statusText}
                </div>

            </div>


            <div class="support-history-id">
                ${chat.chat_id || ""}
            </div>


            <div class="support-history-order">
                ${orderText}
            </div>


            <button
                type="button"
                class="support-history-view"
                data-history-chat-id="${chat.chat_id}"
            >
                View conversation
                <i class="fa-solid fa-arrow-right"></i>
            </button>

        `;


        historyList.appendChild(item);

    });

}



// =====================================================
// LOAD PREVIOUS SUPPORT CONVERSATION
// =====================================================

async function viewPreviousSupportConversation(
    chatId
)

{   const history =
    document.getElementById(
        "darvozSupportHistory"
    );

if (history) {
    history.remove();
}

    try {

        const response =
            await fetch(
                `${API}/api/support/${encodeURIComponent(
                    chatId
                )}`,
                {
                    cache: "no-store"
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success ||
            !data.chat
        ) {

            throw new Error(
                data.message ||
                "Unable to load conversation"
            );

        }

        const messages =
            Array.isArray(
                data.chat.messages
            )
                ? data.chat.messages
                : [];

        /*
           Clear current bot screen.
        */

        chat.innerHTML = "";

        options.innerHTML = "";

        /*
           Stop any live support polling.
        */

        clearSupportPolling();

        activeSupportChatId = null;

        supportJoined = false;

        /*
           Conversation heading.
        */

        addBotMessage(`

            <strong>
                Previous Support Conversation
            </strong>

            <br><br>

            ${
                data.chat.order_id
                    ? `
                        Order #${escapeHTML(
                            data.chat.order_id
                        )}
                    `
                    : `
                        General Support
                    `
            }

            <br>

            <small>
                ${escapeHTML(
                    data.chat.chat_id
                )}
            </small>

            <br><br>

            <strong>
                ${
                    data.chat.status === "closed"
                        ? "🕘 Closed"
                        : "🟢 " +
                          escapeHTML(
                              data.chat.status
                          )
                }
            </strong>

        `);

        /*
           Display complete old conversation.
        */

        messages.forEach(item => {

            if (
                item.sender === "customer"
            ) {

                addUserMessage(
                    item.message
                );

            }

            else if (
                item.sender === "support"
            ) {

                /*
                   Don't show the backend
                   closing marker as a normal
                   support bubble.
                */

                if (
                    item.message !==
                    "DARVOZ Support has ended this conversation."
                ) {

                    addHumanSupportMessage(
                        item.message
                    );

                }

            }

            else if (
                item.sender === "ai"
            ) {

                addBotMessage(
                    escapeHTML(
                        item.message
                    )
                );

            }

        });

        /*
           Closed conversation message.
        */

        if (
            data.chat.status === "closed"
        ) {

            addBotMessage(`

                <strong>
                    DARVOZ Support disconnected.
                </strong>

                <br><br>

                This conversation has ended.

                <br><br>

                Your conversation is safely saved
                with Order #${
                    escapeHTML(
                        data.chat.order_id ||
                        "General Support"
                    )
                }. 🧡

            `);

        }

        /*
           Back button.
        */

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                id="backToSupportHistory"
            >

                <i class="fa-solid fa-arrow-left"></i>

                Back to Support History

            </button>

            <button
                class="bot-option bot-sub-option"
                data-response="mainMenu"
            >

                <i class="fa-solid fa-house"></i>

                Back to Help Menu

            </button>

        `;

        scrollChat();

    }
    catch (error) {

        console.error(
            "❌ Previous support conversation error:",
            error
        );

        addBotMessage(`

            <strong>
                We couldn't load that conversation.
            </strong>

            <br><br>

            Please try again. 🧡

        `);

    }

}



    function clearSupportPolling() {

        if (supportPollingTimer) {

            clearInterval(
                supportPollingTimer
            );

            supportPollingTimer = null;
        }

    }


    /* =====================================================
       CREATE BOT UI
    ===================================================== */

    const botHTML = `

        <div
            class="darvoz-bot-overlay"
            id="darvozBotOverlay"
        >

            <div class="darvoz-bot">


                <!-- HEADER -->

                <div class="darvoz-bot-header">

                    <div class="darvoz-bot-brand">

                        <div class="darvoz-bot-avatar">

                            <i class="fa-solid fa-robot"></i>

                        </div>


                        <div>

                            <h3>
                                DARVOZ Assistant
                            </h3>

                            <p>

                                <span></span>

                                Online • Here to help

                            </p>

                        </div>

                    </div>


                    <button
                        class="darvoz-bot-close"
                        id="darvozBotClose"
                        aria-label="Close help"
                    >

                        <i class="fa-solid fa-xmark"></i>

                    </button>

                </div>


                <!-- CHAT -->

                <div
                    class="darvoz-chat"
                    id="darvozChat"
                ></div>


                <!-- OPTIONS -->

                <div
                    class="darvoz-bot-options"
                    id="darvozBotOptions"
                >

                    <button
                        class="bot-option"
                        data-action="delayed"
                    >

                        <i class="fa-solid fa-clock"></i>

                        Order is delayed

                    </button>


                    <button
                        class="bot-option"
                        data-action="where"
                    >

                        <i class="fa-solid fa-location-dot"></i>

                        Where is my order?

                    </button>


                    <button
                        class="bot-option"
                        data-action="rider"
                    >

                        <i class="fa-solid fa-motorcycle"></i>

                        Delivery issues

                    </button>


                    <button
                        class="bot-option"
                        data-action="cancel"
                    >

                        <i class="fa-solid fa-ban"></i>

                        Cancel my order

                    </button>


                    <button
                        class="bot-option"
                        data-action="other"
                    >

                        <i class="fa-solid fa-circle-question"></i>

                        Something else

                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.insertAdjacentHTML(
        "beforeend",
        botHTML
    );


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const overlay =
        document.getElementById(
            "darvozBotOverlay"
        );

    const closeBtn =
        document.getElementById(
            "darvozBotClose"
        );

    const chat =
        document.getElementById(
            "darvozChat"
        );

    const options =
        document.getElementById(
            "darvozBotOptions"
        );

        
        // =====================================================
// VIEW PREVIOUS SUPPORT CONVERSATION
// =====================================================

options.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-history-chat-id]"
            );

        if (!button) {
            return;
        }

        const chatId =
            button.dataset.historyChatId;

        if (!chatId) {
            return;
        }

        await viewPreviousSupportConversation(
            chatId
        );

    }
);


/* =====================================================
   BACK TO SUPPORT HISTORY
===================================================== */

options.addEventListener(
    "click",
    async event => {

        if (
            !event.target.closest(
                "#backToSupportHistory"
            )
        ) {
            return;
        }


        /*
           Stop any support polling
           because we are leaving the conversation view.
        */

        clearSupportPolling();

        activeSupportChatId =
            null;

        supportJoined =
            false;

        lastSupportMessageCount =
            0;


        /*
           Close the bot.
           Support history is displayed on help.html,
           outside the bot overlay.
        */

        closeBot();


        /*
           Reload the support history cards
           so the latest status is shown.
        */

        await loadSupportHistory();


        /*
           Bring the history section into view.
        */

        const historySection =
            document.getElementById(
                "supportHistorySection"
            );

        if (historySection) {

            historySection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

    }
);

    /* =====================================================
       SAFE TEXT
    ===================================================== */

    function escapeHTML(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value ?? "";

        return div.innerHTML;
    }


    /* =====================================================
       OPEN BOT
    ===================================================== */

    helpBtn.addEventListener(
        "click",
        () => {

            const orderData =
                getCurrentOrderData();
                
            const viewingHistoryChatId =
    window.darvozViewingHistoryChatId || null;

            overlay.classList.add(
                "show"
            );

            document.body.style.overflow =
                "hidden";


            chat.innerHTML =
                "";

               


            options.innerHTML = `

                <button
                    class="bot-option"
                    data-action="delayed"
                >
                    <i class="fa-solid fa-clock"></i>
                    Order is delayed
                </button>

                <button
                    class="bot-option"
                    data-action="where"
                >
                    <i class="fa-solid fa-location-dot"></i>
                    Where is my order?
                </button>

                <button
                    class="bot-option"
                    data-action="rider"
                >
                    <i class="fa-solid fa-motorcycle"></i>
                    Delivery issues
                </button>

                <button
                    class="bot-option"
                    data-action="cancel"
                >
                    <i class="fa-solid fa-ban"></i>
                    Cancel my order
                </button>

                <button
                    class="bot-option"
                    data-action="other"
                >
                    <i class="fa-solid fa-circle-question"></i>
                    Something else
                </button>

            `;
supportJoined =
    false;

lastSupportMessageCount =
    0;


/* =====================================================
   VIEW OLD SUPPORT CONVERSATION
===================================================== */

if (viewingHistoryChatId) {

    // Clear the flag immediately
    // so the next normal Help click works normally.
    window.darvozViewingHistoryChatId = null;

    viewPreviousSupportConversation(
        viewingHistoryChatId
    );

    return;
}


/* =====================================================
   NORMAL BOT OPEN
===================================================== */

loadSupportHistory();
            


            if (orderData.orderId) {

                addBotMessage(`
                    Hi! 👋 I'm the DARVOZ Assistant.
                `);


                setTimeout(() => {

                    addBotMessage(`
                        I can help you with
                        <strong>
                            Order #${escapeHTML(
                                orderData.orderId
                            )}
                        </strong>.

                        What do you need help with?
                    `);

                }, 300);

            } else {

                addBotMessage(`
                    Hi! 👋 I'm the DARVOZ Assistant.
                `);


                setTimeout(() => {

                    addBotMessage(`
                        I'm here to help with your
                        DARVOZ experience. 🧡

                        What do you need help with?
                    `);

                }, 300);

            }

        }
    );


    /* =====================================================
       CLOSE BOT
    ===================================================== */

    function closeBot() {

        overlay.classList.remove(
            "show"
        );

        document.body.style.overflow =
            "";

        clearSupportPolling();

    }


    closeBtn.addEventListener(
        "click",
        closeBot
    );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                closeBot();

            }

        }
    );


    /* =====================================================
       ADD CUSTOMER MESSAGE
    ===================================================== */

    function addUserMessage(text) {

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "user-message";


        const content =
            document.createElement("div");

        content.className =
            "message-content";


        /*
           Safe text rendering.
        */

        content.textContent =
            text ?? "";


        wrapper.appendChild(
            content
        );


        chat.appendChild(
            wrapper
        );


        scrollChat();

    }


    /* =====================================================
       ADD BOT MESSAGE
    ===================================================== */

    function addBotMessage(text) {

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "bot-message";


        const avatar =
            document.createElement("div");

        avatar.className =
            "message-avatar";


        avatar.innerHTML =
            `<i class="fa-solid fa-robot"></i>`;


        const content =
            document.createElement("div");

        content.className =
            "message-content";


        /*
           Bot messages intentionally allow
           our own trusted HTML formatting.
        */

        content.innerHTML =
            text;


        wrapper.appendChild(
            avatar
        );

        wrapper.appendChild(
            content
        );


        chat.appendChild(
            wrapper
        );


        scrollChat();

    }


    /* =====================================================
       SCROLL
    ===================================================== */

    function scrollChat() {

        setTimeout(
            () => {

                chat.scrollTo({
                    top: chat.scrollHeight,
                    behavior: "smooth"
                });

            },
            100
        );

    }




    /* =====================================================
       DELAYED OPTIONS
    ===================================================== */

    function showDelayedOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="whyDelayed"
            >
                Why is my order delayed?
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="arrival"
            >
                When will my order arrive?
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="track"
            >
                Track my order
            </button>


            <button
                class="bot-option bot-back-option"
                data-response="mainMenu"
            >
                <i class="fa-solid fa-arrow-left"></i>
                Back to Help
            </button>

        `;

    }


    /* =====================================================
       WHERE OPTIONS
    ===================================================== */

    function showWhereOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="currentStatus"
            >
                What is my current order status?
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="track"
            >
                Show my order tracking
            </button>


            <button
                class="bot-option bot-back-option"
                data-response="mainMenu"
            >
                <i class="fa-solid fa-arrow-left"></i>
                Back to Help
            </button>

        `;

    }


    /* =====================================================
       DELIVERY OPTIONS
    ===================================================== */

    function showDeliveryOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="cantContact"
            >
                I can't contact the delivery partner
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="riderDelayed"
            >
                Delivery partner is taking too long
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="wrongLocation"
            >
                Delivery partner is at the wrong location
            </button>


            <button
                class="bot-option bot-back-option"
                data-response="mainMenu"
            >
                <i class="fa-solid fa-arrow-left"></i>
                Back to Help
            </button>

        `;

    }


    /* =====================================================
       CANCEL OPTIONS
    ===================================================== */

    function showCancelOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="cancelReason"
            >
                Why can't I cancel my order?
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="requestCancel"
            >
                Request order cancellation
            </button>


            <button
                class="bot-option bot-back-option"
                data-response="mainMenu"
            >
                <i class="fa-solid fa-arrow-left"></i>
                Back to Help
            </button>

        `;

    }


    /* =====================================================
       OTHER OPTIONS
    ===================================================== */

    function showOtherOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="payment"
            >
                Payment issue
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="missing"
            >
                Missing or wrong items
            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="support"
            >
                Talk to DARVOZ Support
            </button>


            <button
                class="bot-option bot-back-option"
                data-response="mainMenu"
            >
                <i class="fa-solid fa-arrow-left"></i>
                Back to Help
            </button>

        `;

    }


    /* =====================================================
       RESPONSE CLICK
    ===================================================== */

    options.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-response]"
                );


            if (!button) return;


            const response =
                button.dataset.response;


            const text =
                button.innerText.trim();


            addUserMessage(
                text
            );


            options.innerHTML =
                "";


            setTimeout(
                () => {

                    handleResponse(
                        response
                    );

                },
                500
            );

        }
    );

/* =====================================================
   MAIN MENU BUTTON CLICK
===================================================== */

options.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) {
            return;
        }


        const action =
            button.dataset.action;


        const text =
            button.innerText.trim();


        /*
           Show customer's selected option
        */

        addUserMessage(
            text
        );


        /*
           Remove current buttons
        */

        options.innerHTML =
            "";


        /*
           Handle selected action
        */

        setTimeout(
            () => {

                switch (action) {

                    case "delayed":

                        addBotMessage(`
                            I can help you with your
                            delayed order. 🧡

                            <br><br>

                            What would you like to know?
                        `);

                        showDelayedOptions();

                        break;


                    case "where":

                        addBotMessage(`
                            Sure! Let's check your
                            order status. 📍
                        `);

                        showWhereOptions();

                        break;


                    case "rider":

                        addBotMessage(`
                            I'm sorry you're having a
                            delivery issue. 🛵

                            <br><br>

                            What happened?
                        `);

                        showDeliveryOptions();

                        break;


                    case "cancel":

                        addBotMessage(`
                            I can help you with your
                            cancellation question. 🧡

                            <br><br>

                            What would you like to know?
                        `);

                        showCancelOptions();

                        break;


                    case "other":

                        addBotMessage(`
                            No problem. 😊

                            <br><br>

                            Please choose what you need
                            help with.
                        `);

                        showOtherOptions();

                        break;

                }

            },
            400
        );

    }
);
    /* =====================================================
       HANDLE RESPONSES
    ===================================================== */

    async function handleResponse(
        response
    ) {

        const orderData =
            getCurrentOrderData();


        switch (response) {


            /* ==========================================
               WHY DELAYED
            ========================================== */

            case "whyDelayed": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        This option is available for
                        a specific order. 🧡

                        Please open Help from
                        <strong>My Orders</strong>
                        or
                        <strong>Track Order</strong>
                        for order-specific information.
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            We understand the wait can
                            be frustrating. 💛
                        </strong>

                        <br><br>

                        ${
                            orderData.status
                                ? `
                                    Your order is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : `
                                    Your order is currently
                                    being processed.
                                `
                        }

                        ${
                            orderData.statusDetails
                                ? `
                                    <br><br>
                                    ${escapeHTML(
                                        orderData.statusDetails
                                    )}
                                `
                                : ""
                        }

                        ${
                            orderData.eta
                                ? `
                                    <br><br>
                                    🕒
                                    <strong>
                                        Current estimated arrival:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : ""
                        }

                        <br><br>

                        Our team is actively tracking your
                        order and working to get it to you
                        as soon as possible. 🧡

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               ARRIVAL
            ========================================== */

            case "arrival": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        To give you an accurate arrival
                        estimate, please open Help from
                        a specific order. 🧡
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            Your order is moving through
                            the next steps. 🛵✨
                        </strong>

                        <br><br>

                        ${
                            orderData.eta
                                ? `
                                    🕒
                                    <strong>
                                        Estimated arrival:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : `
                                    We're calculating the
                                    latest estimated arrival
                                    time for you.
                                `
                        }

                        ${
                            orderData.status
                                ? `
                                    <br><br>
                                    Your order is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        <br><br>

                        We're keeping a close eye on your
                        delivery and will continue to update
                        you. 🧡

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               TRACK
            ========================================== */

            case "track": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        Please open a specific order first
                        to view its live tracking. 📍🧡
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            Your delivery can be tracked live. 📍✨
                        </strong>

                        <br><br>

                        <strong>
                            Order #${escapeHTML(
                                orderData.orderId
                            )}
                        </strong>

                        ${
                            orderData.status
                                ? `
                                    is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        ${
                            orderData.statusDetails
                                ? `
                                    <br><br>
                                    ${escapeHTML(
                                        orderData.statusDetails
                                    )}
                                `
                                : ""
                        }

                        ${
                            orderData.eta
                                ? `
                                    <br><br>
                                    🕒
                                    <strong>
                                        Latest estimated arrival:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : ""
                        }

                        <br><br>

                        We'll continue following your order
                        and keep you updated. 🧡

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               CURRENT STATUS
            ========================================== */

            case "currentStatus": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        I need a specific order to show
                        its current status. 🧡

                        Open Help from one of your orders
                        and I'll show the available details.
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            Here's the latest update on
                            Order #${escapeHTML(
                                orderData.orderId
                            )} ✨
                        </strong>

                        <br><br>

                        ${
                            orderData.status
                                ? `
                                    Your order is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : `
                                    Your order is currently
                                    being processed.
                                `
                        }

                        ${
                            orderData.statusDetails
                                ? `
                                    <br><br>
                                    ${escapeHTML(
                                        orderData.statusDetails
                                    )}
                                `
                                : ""
                        }

                        ${
                            orderData.eta
                                ? `
                                    <br><br>
                                    🕒
                                    <strong>
                                        Estimated arrival:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : ""
                        }

                        <br><br>

                        We're tracking every step and will
                        keep you updated. 🧡

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               CAN'T CONTACT RIDER
            ========================================== */

            case "cantContact": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        For delivery-partner issues,
                        please open Help from the relevant
                        order so we can connect the issue
                        to that order. 🧡
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            We're sorry you're having trouble
                            reaching your delivery partner. 💛
                        </strong>

                        <br><br>

                        ${
                            orderData.status
                                ? `
                                    Your order is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        ${
                            orderData.statusDetails
                                ? `
                                    <br><br>
                                    ${escapeHTML(
                                        orderData.statusDetails
                                    )}
                                `
                                : ""
                        }

                        ${
                            orderData.eta
                                ? `
                                    <br><br>
                                    🕒
                                    <strong>
                                        Estimated arrival:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : ""
                        }

                        <br><br>

                        Don't worry — your order is still being
                        actively tracked by DARVOZ.

                        If the delivery partner remains
                        unavailable, our support team can step
                        in to help. 🧡

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               RIDER DELAYED
            ========================================== */

            case "riderDelayed":

                addBotMessage(`

                    We understand the wait can be
                    frustrating. 😔

                    <br><br>

                    Traffic, weather, restaurant delays,
                    or road conditions can sometimes
                    affect delivery time.

                    <br><br>

                    DARVOZ is keeping track of your order
                    and our support team can help if the
                    delay continues. 🧡

                `);

                showAfterAnswerOptions();

                break;


            /* ==========================================
               WRONG LOCATION
            ========================================== */

            case "wrongLocation": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        Please open Help from the affected
                        order so DARVOZ Support can identify
                        the correct delivery. 📍🧡
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            We've got you — your delivery
                            location matters. 📍✨
                        </strong>

                        <br><br>

                        <strong>
                            Order #${escapeHTML(
                                orderData.orderId
                            )}
                        </strong>

                        ${
                            orderData.status
                                ? `
                                    is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        ${
                            orderData.statusDetails
                                ? `
                                    <br><br>
                                    ${escapeHTML(
                                        orderData.statusDetails
                                    )}
                                `
                                : ""
                        }

                        ${
                            orderData.eta
                                ? `
                                    <br><br>
                                    🕒
                                    <strong>
                                        Expected at your doorstep:
                                    </strong>
                                    ${escapeHTML(
                                        orderData.eta
                                    )}
                                `
                                : ""
                        }

                        <br><br>

                        If your delivery partner is moving
                        in the wrong direction, don't worry.

                        DARVOZ is keeping a close watch on
                        your order and our support team can
                        step in to help.

                        <br><br>

                        <strong>
                            Your order is being looked after. 🧡
                        </strong>

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               CANCEL REASON
            ========================================== */

            case "cancelReason": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        Cancellation information is
                        order-specific. 🧡

                        Please open Help from the order
                        you want to cancel.
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            Your order may not be cancellable
                            at this stage. 🧡
                        </strong>

                        <br><br>

                        Order #${escapeHTML(
                            orderData.orderId
                        )}

                        ${
                            orderData.status
                                ? `
                                    is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        <br><br>

                        Cancellation availability depends
                        on the current order stage.

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               REQUEST CANCEL
            ========================================== */

            case "requestCancel": {

                if (!orderData.orderId) {

                    addBotMessage(`
                        To request help with cancelling an
                        order, please open Help from that
                        specific order. 🧡
                    `);

                } else {

                    addBotMessage(`

                        <strong>
                            We've checked the available
                            order information. ✨
                        </strong>

                        <br><br>

                        Order #${escapeHTML(
                            orderData.orderId
                        )}

                        ${
                            orderData.status
                                ? `
                                    is currently
                                    <strong>
                                        ${escapeHTML(
                                            orderData.status
                                        )}
                                    </strong>.
                                `
                                : ""
                        }

                        <br><br>

                        If cancellation is unavailable at
                        the current stage, DARVOZ Support
                        can review the situation for you.

                    `);

                }

                showAfterAnswerOptions();

                break;
            }


            /* ==========================================
               PAYMENT
            ========================================== */

            case "payment":

                addBotMessage(`

                    If money was deducted but you have
                    a payment problem, DARVOZ Support can
                    check the payment and help resolve it.

                    <br><br>

                    Please keep your payment/order details
                    available if support asks for them. 🧡

                `);

                showAfterAnswerOptions();

                break;


            /* ==========================================
               MISSING ITEMS
            ========================================== */

            case "missing":

                addBotMessage(`

                    Sorry about that. 😔

                    <br><br>

                    You can report missing or incorrect
                    items, and our support team can review
                    the issue.

                    <br><br>

                    Tap
                    <strong>
                        Talk to DARVOZ Support
                    </strong>
                    if you need direct assistance. 🧡

                `);

                showAfterAnswerOptions();

                break;


            /* ==========================================
               SUPPORT
            ========================================== */

            case "support": {

                await connectToSupport();

                break;
            }


            /* ==========================================
               MAIN MENU
            ========================================== */

            case "mainMenu":

                addBotMessage(`
                    Sure! What else can I help you with? 😊
                `);

                showMainMenu();

                break;

        }

    }


    /* =====================================================
   CONNECT TO DARVOZ SUPPORT
===================================================== */

async function connectToSupport() {

    const orderData =
        getCurrentOrderData();


    options.innerHTML =
        "";


    addBotMessage(`
        <strong>
            Just a moment... ✨
        </strong>

        <br><br>

        We're connecting you with
        DARVOZ Support.
    `);


    /*
       --------------------------------------------------
       CHECK EXISTING CHAT
       --------------------------------------------------

       IMPORTANT:

       If the saved chat is CLOSED,
       we DO NOT reuse it.

       A new support request must create
       a completely new chat ID.

       Old closed chat remains in MySQL
       as conversation history.
    */

    const existingChatId =
        getSavedSupportChatId();


    if (existingChatId) {

        try {

            const checkResponse =
                await fetch(
                    `${API}/api/support/${encodeURIComponent(
                        existingChatId
                    )}`,
                    {
                        cache: "no-store"
                    }
                );


            const checkData =
                await checkResponse.json();


            if (
                checkResponse.ok &&
                checkData.success &&
                checkData.chat
            ) {

                const chatStatus =
                    checkData.chat.status;


                /*
                   --------------------------------------
                   EXISTING ACTIVE CHAT
                   --------------------------------------

                   Continue the current conversation.
                */

                if (
                    chatStatus === "active"
                ) {

                    activeSupportChatId =
                        existingChatId;

                    lastSupportMessageCount =
                        0;

                    supportJoined =
                        false;


                    addBotMessage(`

                        <strong>
                            Welcome back to DARVOZ Support. 🧡
                        </strong>

                        <br><br>

                        Your support conversation is still
                        active.

                    `);


                    showWaitingForSupport();


                    startSupportChat(
                        existingChatId
                    );


                    return;

                }


                /*
                   --------------------------------------
                   EXISTING WAITING CHAT
                   --------------------------------------

                   Continue waiting instead of creating
                   another duplicate request.
                */

                if (
                    chatStatus === "waiting"
                ) {

                    activeSupportChatId =
                        existingChatId;

                    lastSupportMessageCount =
                        0;

                    supportJoined =
                        false;


                    addBotMessage(`

                        <strong>
                            Your support request is already
                            waiting. 🧡
                        </strong>

                        <br><br>

                        A DARVOZ Support member will join
                        this conversation shortly.

                    `);


                    showWaitingForSupport();


                    startSupportChat(
                        existingChatId
                    );


                    return;

                }


                /*
                   --------------------------------------
                   CLOSED CHAT
                   --------------------------------------

                   VERY IMPORTANT:

                   Do NOT reuse this chat.

                   Remove the old chat ID from the
                   customer's active localStorage key.

                   Then continue below and CREATE A NEW CHAT.
                */

                if (
                    chatStatus === "closed"
                ) {

                    localStorage.removeItem(
                        getSupportStorageKey()
                    );


                    /*
                       Also clear old generic key if
                       it points to this closed chat.
                    */

                    if (
                        localStorage.getItem(
                            "darvozSupportChatId"
                        ) === existingChatId
                    ) {

                        localStorage.removeItem(
                            "darvozSupportChatId"
                        );

                    }


                    activeSupportChatId =
                        null;

                    supportJoined =
                        false;

                    lastSupportMessageCount =
                        0;


                    addBotMessage(`

                        <strong>
                            Your previous support conversation
                            has ended. 🧡
                        </strong>

                        <br><br>

                        We'll create a new support request
                        for you now.

                    `);

                }

            }

        }
        catch (error) {

            console.warn(
                "Unable to check existing support chat:",
                error
            );


            /*
               If checking the old chat fails,
               continue with normal creation below.
            */

            localStorage.removeItem(
                getSupportStorageKey()
            );


            if (
                localStorage.getItem(
                    "darvozSupportChatId"
                ) === existingChatId
            ) {

                localStorage.removeItem(
                    "darvozSupportChatId"
                );

            }


            activeSupportChatId =
                null;

        }

    }


    /* =====================================================
       CREATE NEW SUPPORT CHAT
    ===================================================== */

    try {

        const issue =
            orderData.orderId
                ? (
                    "Customer requested DARVOZ Support " +
                    "for Order #" +
                    orderData.orderId +
                    "."
                )
                : (
                    "Customer requested DARVOZ General Support."
                );


        const response =
            await fetch(
                `${API}/api/support/create`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        orderId:
                            orderData.orderId ||
                            null,

                        customerId:
                            getCustomerId(),

                        customerName:
                            localStorage.getItem(
                                "customerName"
                            ) ||
                            "DARVOZ Customer",

                        issue

                    })

                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to create support request"
            );

        }


        /*
           ------------------------------------------------
           SAVE BRAND NEW CHAT ID
           ------------------------------------------------
        */

        saveSupportChatId(
            data.chatId
        );


        /*
           Keep existing DARVOZ compatibility.
        */

        if (
            data.supportLink
        ) {

            localStorage.setItem(
                "darvozSupportLink",
                data.supportLink
            );

        }


        /*
           ------------------------------------------------
           CUSTOMER MESSAGE
           ------------------------------------------------
        */

        if (
            orderData.orderId
        ) {

            addBotMessage(`

                <strong>
                    Your new support request has been
                    created. 🧡
                </strong>

                <br><br>

                We've received your request regarding
                <strong>
                    Order #${escapeHTML(
                        orderData.orderId
                    )}
                </strong>.

                <br><br>

                A DARVOZ Support member will join
                this conversation shortly.

            `);

        }
        else {

            addBotMessage(`

                <strong>
                    Your new support request has been
                    created. 🧡
                </strong>

                <br><br>

                We've received your request for
                <strong>
                    General Support
                </strong>.

                <br><br>

                A DARVOZ Support member will join
                this conversation shortly.

            `);

        }


        /*
           ------------------------------------------------
           RESET SUPPORT STATE
           ------------------------------------------------
        */

        lastSupportMessageCount =
            0;

        supportJoined =
            false;


        showWaitingForSupport();


        /*
           ------------------------------------------------
           START LIVE CHAT
           ------------------------------------------------
        */

        startSupportChat(
            data.chatId
        );


    }
    catch (error) {

        console.error(
            "❌ Support request error:",
            error
        );


        addBotMessage(`

            <strong>
                We're sorry — we couldn't connect
                to support right now.
            </strong>

            <br><br>

            Please try again in a moment. 🧡

        `);


        showAfterAnswerOptions();

    }

}


    /* =====================================================
       AFTER ANSWER
    ===================================================== */

    function showAfterAnswerOptions() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                data-response="mainMenu"
            >

                <i class="fa-solid fa-house"></i>

                Back to Help Menu

            </button>


            <button
                class="bot-option bot-sub-option"
                data-response="support"
            >

                <i class="fa-solid fa-headset"></i>

                Still need help

            </button>

        `;

    }


    /* =====================================================
       MAIN MENU
    ===================================================== */

    function showMainMenu() {

        options.innerHTML = `

            <button
                class="bot-option"
                data-action="delayed"
            >

                <i class="fa-solid fa-clock"></i>

                Order is delayed

            </button>


            <button
                class="bot-option"
                data-action="where"
            >

                <i class="fa-solid fa-location-dot"></i>

                Where is my order?

            </button>


            <button
                class="bot-option"
                data-action="rider"
            >

                <i class="fa-solid fa-motorcycle"></i>

                Delivery issues

            </button>


            <button
                class="bot-option"
                data-action="cancel"
            >

                <i class="fa-solid fa-ban"></i>

                Cancel my order

            </button>


            <button
                class="bot-option"
                data-action="other"
            >

                <i class="fa-solid fa-circle-question"></i>

                Something else

            </button>

        `;

    }


    /* =====================================================
       WAITING FOR SUPPORT
    ===================================================== */

    function showWaitingForSupport() {

        options.innerHTML = `

            <button
                class="bot-option bot-sub-option"
                disabled
            >

                <i class="fa-solid fa-clock"></i>

                Waiting for DARVOZ Support...

            </button>

        `;

    }

    /* =====================================================
   CLOSED SUPPORT OPTIONS
===================================================== */

function showClosedSupportOptions() {

    options.innerHTML = `

        <button
            class="bot-option bot-sub-option"
            data-response="support"
        >

            <i class="fa-solid fa-headset"></i>

            Contact DARVOZ Support Again

        </button>


        <button
            class="bot-option bot-sub-option"
            data-response="mainMenu"
        >

            <i class="fa-solid fa-house"></i>

            Back to Help Menu

        </button>

    `;

}


    /* =====================================================
       LIVE SUPPORT CHAT
    ===================================================== */

    function startSupportChat(
        chatId
    ) {

        if (!chatId) return;


        /*
           Stop any previous timer.
        */

        clearSupportPolling();


        activeSupportChatId =
            chatId;


        /*
           Check immediately.
        */

        checkSupportMessages(
            chatId
        );


        /*
           Then every 3 seconds.
        */

        supportPollingTimer =
            setInterval(
                () => {

                    checkSupportMessages(
                        chatId
                    );

                },
                3000
            );

    }


   /* =====================================================
   CHECK SUPPORT MESSAGES
===================================================== */

async function checkSupportMessages(
    chatId
) {

    if (!chatId) return;


    /*
       Ignore responses from an old chat.
    */

    if (
        activeSupportChatId !== chatId
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API}/api/support/${encodeURIComponent(
                    chatId
                )}/messages`,
                {
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            return;

        }


        /*
           ------------------------------------------------
           MESSAGE LIST
           ------------------------------------------------
        */

        const supportMessages =
            Array.isArray(
                data.messages
            )
                ? data.messages
                : [];


        /*
           ------------------------------------------------
           FIRST LOAD
           ------------------------------------------------

           Remember existing messages so we don't
           duplicate them in the bot UI.
        */

        if (
            lastSupportMessageCount === 0
        ) {

            lastSupportMessageCount =
                supportMessages.length;

        }


        /*
           ------------------------------------------------
           NEW MESSAGES
           ------------------------------------------------
        */

        if (
            supportMessages.length >
            lastSupportMessageCount
        ) {

            const newMessages =
                supportMessages.slice(
                    lastSupportMessageCount
                );


            newMessages.forEach(
                item => {

                    /*
                       Only display support messages
                       here.

                       Customer messages are already
                       shown immediately when sent.
                    */

                    if (
                        item.sender ===
                        "support"
                    ) {

                        /*
                           Avoid displaying the
                           automatic "support ended"
                           message as a normal support
                           bubble because we display
                           a special disconnected state.
                        */

                        if (
                            item.message !==
                            "DARVOZ Support has ended this conversation."
                        ) {

                            addHumanSupportMessage(
                                item.message
                            );

                        }

                    }

                }
            );


            lastSupportMessageCount =
                supportMessages.length;

        }


        /* =================================================
           SUPPORT JOINED
        ================================================== */

        if (
            data.status === "active" &&
            !supportJoined
        ) {

            supportJoined =
                true;


            addBotMessage(`

                <strong>
                    You're now connected with
                    DARVOZ Support. ✨
                </strong>

                <br><br>

                A support specialist has joined
                the conversation and is here to help.

            `);


            showCustomerSupportInput();

        }


        /* =================================================
           SUPPORT CLOSED
        ================================================== */

        if (
            data.status === "closed"
        ) {

            /*
               Stop polling immediately.
            */

            clearSupportPolling();


            /*
               Disable customer input.
            */

            const supportInput =
                document.getElementById(
                    "darvozCustomerSupportInput"
                );


            if (
                supportInput
            ) {

                supportInput.remove();

            }


            /*
               Prevent the old closed chat from
               being reused for a future request.
            */

            if (
                localStorage.getItem(
                    getSupportStorageKey()
                ) === chatId
            ) {

                localStorage.removeItem(
                    getSupportStorageKey()
                );

            }


            if (
                localStorage.getItem(
                    "darvozSupportChatId"
                ) === chatId
            ) {

                localStorage.removeItem(
                    "darvozSupportChatId"
                );

            }


            /*
               Make sure this old chat can never
               accidentally receive another message.
            */

            activeSupportChatId =
                null;


            supportJoined =
                false;


            /*
               Show disconnected message.
            */

            addBotMessage(`

                <strong>
                    DARVOZ Support disconnected.
                </strong>

                <br><br>

                This support conversation has ended.

                <br><br>

                Don't worry — your previous conversation
                has been saved with your order history. 🧡

            `);


            /*
               Give customer option to create
               a completely NEW support chat.
            */

            showClosedSupportOptions();

        }


    }
    catch (error) {

        console.error(
            "❌ Live support error:",
            error
        );

    }

}


    /* =====================================================
       SUPPORT MESSAGE
    ===================================================== */

    function addHumanSupportMessage(
        text
    ) {

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "bot-message human-support-message";


        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "message-avatar support-avatar";


        avatar.innerHTML =
            `<i class="fa-solid fa-user"></i>`;


        const content =
            document.createElement(
                "div"
            );

        content.className =
            "message-content";


        const name =
            document.createElement(
                "div"
            );

        name.className =
            "support-name";

        name.textContent =
            "DARVOZ Support";


        const message =
            document.createElement(
                "div"
            );


        /*
           Safe rendering.
        */

        message.textContent =
            text ?? "";


        content.appendChild(
            name
        );

        content.appendChild(
            message
        );


        wrapper.appendChild(
            avatar
        );

        wrapper.appendChild(
            content
        );


        chat.appendChild(
            wrapper
        );


        scrollChat();

    }


    /* =====================================================
       CUSTOMER SUPPORT INPUT
    ===================================================== */

    function showCustomerSupportInput() {

        if (
            document.getElementById(
                "darvozCustomerSupportInput"
            )
        ) {

            return;
        }


        const inputHTML = `

            <div
                class="darvoz-customer-support-input"
                id="darvozCustomerSupportInput"
            >

                <input
                    type="text"
                    id="darvozCustomerMessage"
                    placeholder="Message DARVOZ Support..."
                    autocomplete="off"
                >


                <button
                    id="darvozCustomerSend"
                    aria-label="Send message"
                >

                    <i class="fa-solid fa-paper-plane"></i>

                </button>

            </div>

        `;


        options.insertAdjacentHTML(
            "afterend",
            inputHTML
        );


        const input =
            document.getElementById(
                "darvozCustomerMessage"
            );


        const sendButton =
            document.getElementById(
                "darvozCustomerSend"
            );


        sendButton.addEventListener(
            "click",
            sendCustomerSupportMessage
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    sendCustomerSupportMessage();

                }

            }
        );


        input.focus();

    }


    /* =====================================================
       SEND CUSTOMER MESSAGE
    ===================================================== */

    async function sendCustomerSupportMessage() {

    const chatId =
        activeSupportChatId;


    const input =
        document.getElementById(
            "darvozCustomerMessage"
        );


    const sendButton =
        document.getElementById(
            "darvozCustomerSend"
        );


    /*
       Never send a message using a closed/
       stale support chat.
    */

    if (
        !chatId ||
        !input ||
        !supportJoined
    ) {

        return;

    }


    const text =
        input.value.trim();


    if (!text) {

        return;

    }


        /*
           Prevent double sends.
        */

        if (sendButton) {

            sendButton.disabled =
                true;

        }


        input.value =
            "";


        /*
           Show immediately.
        */

        addUserMessage(
            text
        );


        try {

            const response =
                await fetch(
                    `${API}/api/support/${encodeURIComponent(
                        chatId
                    )}/customer-message`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            message: text
                        })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Failed to send message"
                );

            }


        } catch (error) {

            console.error(
                "❌ Customer support message error:",
                error
            );


            addBotMessage(`

                <strong>
                    We couldn't send that message.
                </strong>

                <br>

                Please try again. 🧡

            `);

        } finally {

            if (sendButton) {

                sendButton.disabled =
                    false;

            }

            input.focus();

        }

    }

});