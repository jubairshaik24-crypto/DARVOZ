const API = window.location.origin;

async function register() {

    const button = document.querySelector(".register-btn");

    const name =
        document.getElementById("name").value.trim();

    const mobile =
        document.getElementById("mobile").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;


    // =========================================
    // VALIDATION
    // =========================================

    if (!name) {
        alert("Please enter your name.");
        return;
    }

    if (!mobile) {
        alert("Please enter your mobile number.");
        return;
    }

    if (!/^[0-9]{10}$/.test(mobile)) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }

    if (!email) {
        alert("Please enter your email.");
        return;
    }

    if (!password) {
        alert("Please create a password.");
        return;
    }

    if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        return;
    }

    if (!confirmPassword) {
        alert("Please confirm your password.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }


    // =========================================
    // BUTTON LOADING
    // =========================================

    if (button) {

        button.disabled = true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Creating Account...
        `;

    }


    try {

        console.log("REGISTER REQUEST STARTED");

        console.log({
            name,
            mobile,
            email
        });


        // =========================================
        // SEND REQUEST
        // =========================================

        const response = await fetch(
            `${API}/customer/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    name: name,
                    mobile: mobile,
                    email: email,
                    password: password

                })
            }
        );


        console.log(
            "REGISTER RESPONSE STATUS:",
            response.status
        );


        // =========================================
        // READ RESPONSE
        // =========================================

        const data = await response.json();


        console.log(
            "REGISTER RESPONSE:",
            data
        );


        if (!response.ok || !data.success) {

            alert(
                data.message ||
                "Registration failed."
            );

            return;

        }


        // =========================================
        // SUCCESS
        // =========================================

        alert(
            "Registration Successful 🎉"
        );


        // Save basic customer information
        if (data.customer) {

            if (data.customer.id) {

                localStorage.setItem(
                    "customerId",
                    data.customer.id
                );

            }

            if (data.customer.name) {

                localStorage.setItem(
                    "customerName",
                    data.customer.name
                );

            }

            if (data.customer.mobile) {

                localStorage.setItem(
                    "mobile",
                    data.customer.mobile
                );

            }

        }


        // Go to login
        window.location.href =
            "customer-login.html";


    }
    catch (error) {

        console.error(
            "CUSTOMER REGISTER ERROR:",
            error
        );


        alert(
            "Unable to connect to server. Please try again."
        );


    }
    finally {

        // =========================================
        // RESTORE BUTTON
        // =========================================

        if (button) {

            button.disabled = false;

            button.innerHTML =
                "Create Account";

        }

    }

}