/* =====================================================
   DARVOZ AI HELP BOT
   Works with track.html
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const helpBtn = document.getElementById("darvozHelpBtn");

    if (!helpBtn) {
        console.warn("DARVOZ Help Bot: Help button not found.");
        return;
    }


    /* =====================================================
       CREATE BOT UI
    ===================================================== */

    const botHTML = `
        <div class="darvoz-bot-overlay" id="darvozBotOverlay">

            <div class="darvoz-bot">

                <!-- HEADER -->
                <div class="darvoz-bot-header">

                    <div class="darvoz-bot-brand">

                        <div class="darvoz-bot-avatar">
                            <i class="fa-solid fa-robot"></i>
                        </div>

                        <div>
                            <h3>DARVOZ Assistant</h3>
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
                >


                </div>


                <!-- OPTIONS -->
                <div
                    class="darvoz-bot-options"
                    id="darvozBotOptions"
                >

                    <button class="bot-option" data-action="delayed">
                        <i class="fa-solid fa-clock"></i>
                        Order is delayed
                    </button>

                    <button class="bot-option" data-action="where">
                        <i class="fa-solid fa-location-dot"></i>
                        Where is my order?
                    </button>

                    <button class="bot-option" data-action="rider">
                        <i class="fa-solid fa-motorcycle"></i>
                        Delivery issues
                    </button>

                    <button class="bot-option" data-action="cancel">
                        <i class="fa-solid fa-ban"></i>
                        Cancel my order
                    </button>

                    <button class="bot-option" data-action="other">
                        <i class="fa-solid fa-circle-question"></i>
                        Something else
                    </button>

                </div>

            </div>

        </div>
    `;


    document.body.insertAdjacentHTML("beforeend", botHTML);


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const overlay = document.getElementById("darvozBotOverlay");
    const closeBtn = document.getElementById("darvozBotClose");
    const chat = document.getElementById("darvozChat");
    const options = document.getElementById("darvozBotOptions");


    /* =====================================================
       OPEN BOT
    ===================================================== */

    
helpBtn.addEventListener("click", () => {

    const orderData = getCurrentOrderData();

    overlay.classList.add("show");
    document.body.style.overflow = "hidden";

    // Clear old chat when opening
    chat.innerHTML = "";

    // Welcome message
    addBotMessage(`
        Hi! 👋 I'm the DARVOZ Assistant.
    `);

    setTimeout(() => {

        addBotMessage(`
            I can help you with <strong>Order #${orderData.orderId}</strong>.
            What do you need help with?
        `);

    }, 300);

});
    /* =====================================================
       CLOSE BOT
    ===================================================== */

    function closeBot() {

        overlay.classList.remove("show");

        document.body.style.overflow = "";

    }


    closeBtn.addEventListener("click", closeBot);


    overlay.addEventListener("click", (event) => {

        if (event.target === overlay) {
            closeBot();
        }

    });


    /* =====================================================
       ADD CUSTOMER MESSAGE
    ===================================================== */

    function addUserMessage(text) {

        chat.insertAdjacentHTML(
            "beforeend",
            `
            <div class="user-message">
                <div class="message-content">
                    ${text}
                </div>
            </div>
            `
        );

        scrollChat();

    }


    /* =====================================================
       ADD BOT MESSAGE
    ===================================================== */

    function addBotMessage(text) {

        chat.insertAdjacentHTML(
            "beforeend",
            `
            <div class="bot-message">
                <div class="message-avatar">
                    <i class="fa-solid fa-robot"></i>
                </div>

                <div class="message-content">
                    ${text}
                </div>
            </div>
            `
        );

        scrollChat();

    }


    function scrollChat() {

        setTimeout(() => {

            chat.scrollTo({
                top: chat.scrollHeight,
                behavior: "smooth"
            });

        }, 100);

    }


    /* =====================================================
       OPTION CLICK
    ===================================================== */

   options.addEventListener("click", (event) => {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action; 

        const text = button.innerText.trim();

        addUserMessage(text);


        /* Hide first menu */

        options.innerHTML = "";


        /* =============================================
           DELAYED ORDER
        ============================================= */

        if (action === "delayed") {

            setTimeout(() => {

                addBotMessage(`
                    I understand your order is taking longer than expected. 😔
                    Let me help you with that.
                `);

                showDelayedOptions();

            }, 500);

        }


        /* =============================================
           WHERE IS ORDER
        ============================================= */

        else if (action === "where") {

            setTimeout(() => {

                addBotMessage(`
                    I can help you check your order location. 📍
                `);

                showWhereOptions();

            }, 500);

        }


        /* =============================================
           DELIVERY ISSUES
        ============================================= */

        else if (action === "rider") {

            setTimeout(() => {

                addBotMessage(`
                    What issue are you facing with the delivery?
                `);

                showDeliveryOptions();

            }, 500);

        }


        /* =============================================
           CANCEL
        ============================================= */

        else if (action === "cancel") {

            setTimeout(() => {

                addBotMessage(`
                    I can help with cancelling your order. Please choose an option below.
                `);

                showCancelOptions();

            }, 500);

        }


        /* =============================================
           OTHER
        ============================================= */

        else {

            setTimeout(() => {

                addBotMessage(`
                    No problem. Please choose the issue that best matches your situation.
                `);

                showOtherOptions();

            }, 500);

        }

    });


    /* =====================================================
       DELAYED ORDER OPTIONS
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
       WHERE IS ORDER OPTIONS
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
       DELIVERY ISSUE OPTIONS
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
       SUB OPTION / RESPONSE CLICK
    ===================================================== */

    options.addEventListener("click", (event) => {

        const button = event.target.closest("[data-response]");

        if (!button) return;

        const response = button.dataset.response;
        const text = button.innerText.trim();

        addUserMessage(text);

        options.innerHTML = "";


        setTimeout(() => {

            handleResponse(response);

        }, 500);

    });


    /* =====================================================
       HANDLE RESPONSES
    ===================================================== */

    async function handleResponse(response) {

        switch (response) {

            case "whyDelayed": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>We understand the wait can be frustrating. 💛</strong><br><br>

        Your order is currently <strong>${orderData.status}</strong>.
        ${orderData.statusDetails ? `<br><br>${orderData.statusDetails}` : ""}

        ${orderData.eta ? `<br><br>🕒 <strong>Current estimated arrival:</strong> ${orderData.eta}` : ""}

        <br><br>
        Our team is actively tracking your order and working to get it to you as soon as possible. We'll keep you updated every step of the way. 🧡
    `);

    showAfterAnswerOptions();
    break;
}


            case "arrival": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>Your order is on its way through the next steps. 🛵✨</strong><br><br>

        ${orderData.eta
            ? `🕒 <strong>Estimated arrival:</strong> ${orderData.eta}`
            : `We're calculating the latest estimated arrival time for you.`
        }

        ${orderData.status
            ? `<br><br>Your order is currently <strong>${orderData.status}</strong>.`
            : ""
        }

        <br><br>
        We're keeping a close eye on your delivery and will continue to update you as your order gets closer. 🧡
    `);

    showAfterAnswerOptions();
    break;
}


            case "track": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>Your delivery is being tracked live. 📍✨</strong><br><br>

        <strong>Order #${orderData.orderId}</strong> is currently
        <strong>${orderData.status}</strong>.

        ${orderData.statusDetails
            ? `<br><br>${orderData.statusDetails}`
            : ""
        }

        ${orderData.eta
            ? `<br><br>🕒 <strong>Latest estimated arrival:</strong> ${orderData.eta}`
            : ""
        }

        <br><br>
        We'll continue following your order in real time and keep you updated until it safely reaches you. 🧡
    `);

    showAfterAnswerOptions();
    break;
}


            case "currentStatus": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>Here's the latest update on Order #${orderData.orderId} ✨</strong><br><br>
        
        Your order is currently <strong>${orderData.status}</strong>.
        ${orderData.statusDetails ? `<br><br>${orderData.statusDetails}` : ""}
        
        ${orderData.eta ? `<br><br>🕒 <strong>Estimated arrival:</strong> ${orderData.eta}` : ""}
        <br><br>
        We're tracking every step and will keep you updated until your order reaches you. 🧡
    `);

    showAfterAnswerOptions();
    break;
}


            case "cantContact": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>We're sorry you're having trouble reaching your delivery partner. 💛</strong><br><br>

        Your order is currently <strong>${orderData.status}</strong>.

        ${orderData.statusDetails
            ? `<br><br>${orderData.statusDetails}`
            : ""
        }

        ${orderData.eta
            ? `<br><br>🕒 <strong>Estimated arrival:</strong> ${orderData.eta}`
            : ""
        }

        <br><br>
        Don't worry—your order is still being actively tracked by DARVOZ. If the delivery partner remains unavailable, our support team can step in to help resolve the issue. 🧡
    `);

    showAfterAnswerOptions();
    break;
}


            case "riderDelayed":

                addBotMessage(`
                    We understand the wait can be frustrating. 😔
                    Traffic, weather, or restaurant delays can sometimes affect delivery time.
                `);

                showAfterAnswerOptions();
                break;

             case "wrongLocation": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>We've got you — your delivery location matters. 📍✨</strong><br><br>

        <strong>Order #${orderData.orderId}</strong> is currently
        <strong>${orderData.status}</strong>.

        ${orderData.statusDetails
            ? `<br><br>${orderData.statusDetails}`
            : ""
        }

        ${orderData.eta
            ? `<br><br>🕒 <strong>Expected at your doorstep:</strong> ${orderData.eta}`
            : ""
        }

        <br><br>
        If your delivery partner is moving in the wrong direction, don't worry. DARVOZ is keeping a close watch on your order and our support team can step in to help guide the delivery back to the correct destination.

        <br><br>
        <strong>Your order is being looked after. 🧡</strong>
    `);

    showAfterAnswerOptions();
    break;
}


            case "cancelReason": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>Your order can't be cancelled at this stage. 🧡</strong><br><br>

        Order #${orderData.orderId} is currently <strong>being prepared at the restaurant</strong>.

        <br><br>
        Since preparation has already started, the order can no longer be cancelled. Our restaurant partner is actively preparing your order and we'll continue to keep you updated until it's ready for delivery. ✨
    `);

    showAfterAnswerOptions();
    break;
}


            case "requestCancel": {

    const orderData = getCurrentOrderData();

    addBotMessage(`
        <strong>We've checked the current stage of your order. ✨</strong><br><br>

        Order #${orderData.orderId} is currently
        <strong>${orderData.status}</strong>.

        ${orderData.statusDetails
            ? `<br><br>${orderData.statusDetails}`
            : ""
        }

        <br><br>
        Since your order is already <strong>being prepared at the restaurant</strong>,
        it can no longer be cancelled.

        <br><br>
        <strong>Don't worry — we'll continue to track your order and keep you updated until it reaches you. 🧡</strong>
    `);

    showAfterAnswerOptions();
    break;
}


            case "payment":

                addBotMessage(`
                    If money was deducted but you have a payment problem,
                    DARVOZ Support can check the payment and help resolve it.
                `);

                showAfterAnswerOptions();
                break;


            case "missing":

                addBotMessage(`
                    Sorry about that. 😔 You can report missing or incorrect items,
                    and our support team can review the issue.
                `);

                showAfterAnswerOptions();
                break;


            case "support": {

    const orderData = getCurrentOrderData();

    // Disable options while creating request
    options.innerHTML = "";

    addBotMessage(`
        <strong>Just a moment... ✨</strong><br><br>
        We're connecting you with DARVOZ Support.
    `);

    try {

        const response = await fetch("/api/support/create", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                orderId: orderData.orderId,

                customerId:
                    localStorage.getItem("customerId") || "",

                customerName:
                    localStorage.getItem("customerName") ||
                    "DARVOZ Customer",

                issue:
                    "Customer requested DARVOZ Support from Order #" +
                    orderData.orderId

            })

        });


        const data = await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to create support request"
            );

        }


        // Save chat ID for later use
        localStorage.setItem(
            "darvozSupportChatId",
            data.chatId
        );

        localStorage.setItem(
    "darvozSupportLink",
    data.supportLink
);


        addBotMessage(`
            <strong>You're connected to DARVOZ Support. 🧡</strong><br><br>

            We've received your request regarding
            <strong>Order #${orderData.orderId}</strong>.

            <br><br>

            A DARVOZ Support member will join this conversation shortly.
            You can stay right here — we'll keep this chat ready for you. ✨
        `);


        showWaitingForSupport();


startSupportChat(data.chatId);

    } catch (error) {

        console.error(
            "Support request error:",
            error
        );


        addBotMessage(`
            <strong>We're sorry — we couldn't connect to support right now.</strong><br><br>

            Please try again in a moment. 🧡
        `);


        showAfterAnswerOptions();

    }

    break;
}


            case "mainMenu":

                addBotMessage(`
                    Sure! What else can I help you with? 😊
                `);

                showMainMenu();
                break;

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
       MAIN MENU AGAIN
    ===================================================== */

    function showMainMenu() {

        options.innerHTML = `

            <button class="bot-option" data-action="delayed">
                <i class="fa-solid fa-clock"></i>
                Order is delayed
            </button>

            <button class="bot-option" data-action="where">
                <i class="fa-solid fa-location-dot"></i>
                Where is my order?
            </button>

            <button class="bot-option" data-action="rider">
                <i class="fa-solid fa-motorcycle"></i>
                Delivery issues
            </button>

            <button class="bot-option" data-action="cancel">
                <i class="fa-solid fa-ban"></i>
                Cancel my order
            </button>

            <button class="bot-option" data-action="other">
                <i class="fa-solid fa-circle-question"></i>
                Something else
            </button>

        `;

    }

    

function getCurrentOrderData() {

    const params = new URLSearchParams(window.location.search);

    const orderId = params.get("id") || "";

    const eta =
        document.getElementById("eta")
            ?.innerText.trim() || "";

    const status =
        document.getElementById("heroStatus")
            ?.innerText.trim() || "being processed";

    const statusDetails =
        document.getElementById("heroSubStatus")
            ?.innerText.trim() || "";

    return {
        orderId,
        eta,
        status,
        statusDetails
    };

}

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
   LIVE DARVOZ SUPPORT CHAT
===================================================== */

let lastSupportMessageCount = 0;

function startSupportChat(chatId) {

    if (!chatId) return;


    /* Check messages immediately */

    checkSupportMessages(chatId);


    /* Then check every 3 seconds */

    setInterval(() => {

        checkSupportMessages(chatId);

    }, 3000);

}


async function checkSupportMessages(chatId) {

    try {

        const response = await fetch(
            `/api/support/${chatId}/messages`
        );


        const data = await response.json();


        if (!response.ok || !data.success) {

            return;

        }


        const messages = data.messages || [];


        /* First load:
           Remember existing messages
           Don't duplicate them
        */

        if (lastSupportMessageCount === 0) {

            lastSupportMessageCount =
                messages.length;

        }


        /* Show only NEW support replies */

        if (
            messages.length >
            lastSupportMessageCount
        ) {

            const newMessages =
                messages.slice(
                    lastSupportMessageCount
                );


            newMessages.forEach((item) => {

                if (item.sender === "support") {

                    addHumanSupportMessage(
                        item.message
                    );

                }

            });


            lastSupportMessageCount =
                messages.length;

        }


        /* Support joined */

        if (
            data.status === "active" &&
            !window.darvozSupportJoined
        ) {

            window.darvozSupportJoined = true;

addBotMessage(`
    <strong>You're now connected with DARVOZ Support. ✨</strong><br><br>
    A support specialist has joined the conversation and is here to help.
`);

showCustomerSupportInput();

        }


    } catch (error) {

        console.error(
            "Live support error:",
            error
        );

    }

}
function addHumanSupportMessage(text) {

    chat.insertAdjacentHTML(
        "beforeend",

        `
        <div class="bot-message human-support-message">

            <div class="message-avatar support-avatar">

                <i class="fa-solid fa-user"></i>

            </div>

            <div class="message-content">

                <div class="support-name">
                    DARVOZ Support
                </div>

                ${text}

            </div>

        </div>
        `
    );


    scrollChat();

}
});
/* =====================================================
   SHOW CUSTOMER SUPPORT INPUT
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
        (event) => {

            if (event.key === "Enter") {

                sendCustomerSupportMessage();

            }

        }
    );

}

/* =====================================================
   SEND CUSTOMER MESSAGE TO SUPPORT
===================================================== */

async function sendCustomerSupportMessage() {

    const chatId =
        localStorage.getItem(
            "darvozSupportChatId"
        );

    const input =
        document.getElementById(
            "darvozCustomerMessage"
        );


    if (!chatId || !input) return;


    const text =
        input.value.trim();


    if (!text) return;


    input.value = "";


    // Show immediately to customer
    addUserMessage(text);


    try {

        const response = await fetch(
            `/api/support/${chatId}/customer-message`,
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


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Failed to send message"
            );

        }

    } catch (error) {

        console.error(
            "Customer support message error:",
            error
        );


        addBotMessage(`
            <strong>We couldn't send that message.</strong><br>
            Please try again. 🧡
        `);

    }

}