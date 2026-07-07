// ================================
// DARVOZ Partner Login
// ================================

async function loginPartner(){

    const partnerId = document.getElementById("partnerId").value.trim();
    const password = document.getElementById("password").value.trim();

    if(partnerId==""){

        return showMessage("Enter Partner ID");

    }

    if(password==""){

        return showMessage("Enter Password");

    }

    try{

        const response = await fetch(

            "http://localhost:5000/partner/login",

            {

                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify({

                    partnerId:partnerId,

                    password:password

                })

            }

        );

        const data = await response.json();

        if(!data.success){

            return showMessage(data.message);

        }

        // Save Partner

        localStorage.setItem(

            "partner",

            JSON.stringify(data.partner)

        );

        // Login Success

        window.location.href="partner-dashboard.html";

    }

    catch(err){

        console.log(err);

        showMessage("Server not responding.");

    }

}

// ================================
// Error Message
// ================================

function showMessage(message){

    document.getElementById("message").innerHTML=message;

}