// =========================
// DARVOZ Script
// =========================

// Welcome
console.log("Welcome to DARVOZ 🚀");

// Search

const search = document.querySelector(".search-box input");

if (search) {

search.addEventListener("keyup", function(){

console.log("Searching:", this.value);

});

}

// Buttons Animation

document.querySelectorAll("a").forEach(btn=>{

btn.addEventListener("mouseenter",()=>{

btn.style.transform="scale(1.05)";

});

btn.addEventListener("mouseleave",()=>{

btn.style.transform="scale(1)";

});

});

// Scroll Animation

const cards=document.querySelectorAll(".category-card,.restaurant-card");

const observer=new IntersectionObserver((entries)=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.style.opacity="1";

entry.target.style.transform="translateY(0)";

}

});

});

cards.forEach(card=>{

card.style.opacity="0";

card.style.transform="translateY(40px)";

card.style.transition=".6s";

observer.observe(card);

});

// Restaurant Loading

window.addEventListener("load",()=>{

console.log("Restaurants Loaded");

});

// Bottom Navigation Active

const navLinks=document.querySelectorAll(".bottom-nav a");

navLinks.forEach(link=>{

link.addEventListener("click",()=>{

navLinks.forEach(l=>l.classList.remove("active"));

link.classList.add("active");

});

});

// Hero Auto Animation

const hero=document.querySelector(".hero");

let colors=[
"linear-gradient(135deg,#ff6b00,#ff8f3d)",
"linear-gradient(135deg,#ff4d4d,#ff914d)",
"linear-gradient(135deg,#ff7a18,#ffb347)"
];

let i=0;

setInterval(()=>{

if(hero){

hero.querySelector(".hero-content").style.background=colors[i];

i++;

if(i>=colors.length)i=0;

}

},4000);

// Card Click

document.querySelectorAll(".category-card").forEach(card=>{

card.addEventListener("click",()=>{

card.style.transform="scale(.95)";

setTimeout(()=>{

card.style.transform="scale(1)";

},150);

});

});