const API = window.location.origin;

/* =====================================================
   SEND OTP
===================================================== */
async function sendOTP() {

    const mobileInput =
        document.getElementById("mobile");

    const otpButton =
        document.getElementById("otpBtn");

    if (!mobileInput) {
        console.error("Mobile input not found");
        return;
    }

    const mobile =
        mobileInput.value.trim();

    // ==============================
    // VALIDATE MOBILE
    // ==============================

    if (!/^[0-9]{10}$/.test(mobile)) {

        alert(
            "Please enter a valid 10-digit mobile number."
        );

        mobileInput.focus();

        return;
    }

    const originalText =
        otpButton.innerHTML;

    try {

        otpButton.disabled = true;

        otpButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Please wait...
        `;


        // ==============================
        // CHECK IF CUSTOMER EXISTS
        // ==============================

        const checkResponse =
            await fetch(
                `${API}/api/whatsapp/check-customer`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone: mobile
                    })
                }
            );


        const checkData =
            await checkResponse.json();


        console.log(
            "CUSTOMER CHECK:",
            checkData
        );


        if (
            !checkResponse.ok ||
            !checkData.success
        ) {

            alert(
                checkData.message ||
                "Unable to check customer."
            );

            return;
        }


        // ==============================
        // EXISTING CUSTOMER
        // ==============================

        if (checkData.exists) {

            const customer =
                checkData.customer;


            // SAVE LOGIN DETAILS

            localStorage.setItem(
                "customerId",
                customer._id
            );

            localStorage.setItem(
                "customerName",
                customer.name || ""
            );

            localStorage.setItem(
                "mobile",
                customer.mobile || mobile
            );

            localStorage.setItem(
                "customerEmail",
                customer.email || ""
            );

            localStorage.setItem(
                "customerLoggedIn",
                "true"
            );

            localStorage.setItem(
                "customerLoginTime",
                new Date().toISOString()
            );


            console.log(
                "Existing customer found:",
                customer
            );


            // DIRECTLY OPEN HOME PAGE

            window.location.href =
                "index.html";

            return;
        }


        // ==============================
        // NEW CUSTOMER
        // SEND OTP
        // ==============================

        otpButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending OTP...
        `;


        const response =
            await fetch(
                `${API}/api/whatsapp/send-otp`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone: "91" + mobile
                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "OTP RESPONSE:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            alert(
                data.message ||
                "Unable to send OTP."
            );

            return;
        }


        // SAVE MOBILE FOR VERIFY PAGE

        localStorage.setItem(
            "otpMobile",
            mobile
        );


        // OPEN OTP PAGE

        window.location.href =
            "verify-otp.html";

    }
    catch (error) {

        console.error(
            "SEND OTP ERROR:",
            error
        );

        alert(
            "Unable to connect to server. Please try again."
        );

    }
    finally {

        otpButton.disabled = false;

        otpButton.innerHTML =
            originalText;
    }
}

/* =====================================================
   MOBILE INPUT
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const mobileInput =
            document.getElementById("mobile");

        if (mobileInput) {

            mobileInput.addEventListener(
                "input",
                function () {

                    this.value =
                        this.value
                            .replace(/\D/g, "")
                            .slice(0, 10);

                }
            );

            mobileInput.addEventListener(
                "keydown",
                function (event) {

                    if (event.key === "Enter") {
                        sendOTP();
                    }

                }
            );

        }

    }
);


/* =====================================================
   CHECK LOGIN
===================================================== */

function isCustomerLoggedIn() {

    return localStorage.getItem(
        "customerLoggedIn"
    ) === "true";

}


/* =====================================================
   GET CUSTOMER ID
===================================================== */

function getCustomerId() {

    return localStorage.getItem(
        "customerId"
    );

}


/* =====================================================
   LOGOUT
===================================================== */

function customerLogout() {

    localStorage.removeItem("customerId");
    localStorage.removeItem("customerName");
    localStorage.removeItem("mobile");
    localStorage.removeItem("customerEmail");
    localStorage.removeItem("customerLoggedIn");
    localStorage.removeItem("customerLoginTime");

    window.location.href =
        "customer-login.html";

}

function showTermsPopup(){

    document
        .getElementById("termsPopup")
        .classList.add("show");

}


function closeTermsPopup(){

    document
        .getElementById("termsPopup")
        .classList.remove("show");

}