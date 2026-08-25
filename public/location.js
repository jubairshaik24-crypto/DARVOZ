
async function getLocation() {

    return new Promise((resolve, reject) => {

        if (!navigator.geolocation) {
            reject("Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(

            function(position){

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                localStorage.setItem("latitude", latitude);
                localStorage.setItem("longitude", longitude);

                const geocoder = new google.maps.Geocoder();

                geocoder.geocode(
                    {
                        location:{
                            lat:latitude,
                            lng:longitude
                        }
                    },

                    function(results,status){

                        if(status !== "OK" || !results.length){
                            reject(status);
                            return;
                        }

                        const parts = results[0].formatted_address.split(",");

                        const area = parts[1] ? parts[1].trim() : "";
                        const city = parts[3] ? parts[3].trim() : "";

                        const locationName = area + ", " + city;

                        localStorage.setItem("locationName", locationName);

                        console.log("Saved:", locationName);

                        resolve(locationName);

                    }

                );

            },

            function(error){
                reject(error);
            },

            {
                enableHighAccuracy:true,
                timeout:10000,
                maximumAge:0
            }

        );

    });

}

async function login() {

    console.log("1. Login button clicked");

    try {
        await getLocation();
        console.log("2. Location fetched successfully");
    } catch (err) {
        console.error("Location Error:", err);
        alert("Unable to get location");
        return;
    }

    const mobile = document.getElementById("mobile").value;
    const password = document.getElementById("password").value;

    console.log("3. Sending login request...");

    const res = await fetch(`${API}/customer/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            mobile,
            password
        })
    });

    console.log("4. Response received");

    const data = await res.json();

    console.log(data);
}