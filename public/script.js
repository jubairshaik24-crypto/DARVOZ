// ===============================
// DARVOZ JavaScript
// ===============================

// Welcome Message
window.addEventListener("load", () => {
    console.log("Welcome to DARVOZ 🚀");
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute("href")).scrollIntoView({
            behavior: "smooth"
        });
    });
});

// Navbar Shadow on Scroll
window.addEventListener("scroll", function () {

    const header = document.querySelector("header");

    if (window.scrollY > 50) {
        header.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)";
    } else {
        header.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)";
    }

});

// Button Click Animation
const buttons = document.querySelectorAll(".btn, .partner-btn");

buttons.forEach(btn => {

    btn.addEventListener("click", function () {

        this.style.transform = "scale(0.95)";

        setTimeout(() => {
            this.style.transform = "scale(1)";
        }, 150);

    });

});

// Reveal Animation
const revealElements = document.querySelectorAll(".card, .feature, .partner-box");

const revealOnScroll = () => {

    const trigger = window.innerHeight - 100;

    revealElements.forEach(el => {

        const top = el.getBoundingClientRect().top;

        if (top < trigger) {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
        }

    });

};

revealElements.forEach(el => {

    el.style.opacity = "0";
    el.style.transform = "translateY(50px)";
    el.style.transition = "0.8s ease";

});

window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

// Order Button
const orderBtn = document.querySelector(".order");

if(orderBtn){

orderBtn.addEventListener("click",function(e){

    e.preventDefault();



});

}

// Partner Button
const partnerBtn = document.querySelector(".partner");

if(partnerBtn){

partnerBtn.addEventListener("click",function(e){

    e.preventDefault();

    

});

}
function openModal(){
    document.getElementById("orderModal").style.display = "flex";
}

function closeModal(){
    document.getElementById("orderModal").style.display = "none";
}

window.onclick = function(event){
    const modal = document.getElementById("orderModal");

    if(event.target == modal){
        modal.style.display = "none";
    }
}