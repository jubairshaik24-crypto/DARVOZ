// const paymentRoutes = require("./routes/payment");
const adminRoutes = require("./routes/admin");

const customerRoutes = require("./routes/customer");
const walletRoutes = require("./routes/wallet");
const deliveryOrderRoutes=require("./routes/deliveryOrders");
const deliveryRoutes=require("./routes/delivery");
const adminDeliveryRoutes = require("./routes/adminDelivery");
const partnerOrderRoutes = require("./routes/partnerOrders");
const orderRoutes=require("./routes/orders");
const partnerRoutes = require("./routes/partner");
const importMenuRoutes=require("./routes/importmenu");
const productRoutes = require("./routes/products");
const adminRestaurantRoutes = require("./routes/adminRestaurants");
const restaurantRoutes = require("./routes/restaurant");
const express = require("express");
const dotenv = require("dotenv");
const db = require("./config/db");
const cartRoutes = require("./routes/cart");


dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("DARVOZ Server Running");
});

const PORT = process.env.PORT || 5000;
// app.use("/payment", paymentRoutes);
app.use("/customer", customerRoutes);
app.use("/orders",deliveryOrderRoutes);
app.use("/delivery",deliveryRoutes);
 app.use("/restaurant", restaurantRoutes);
 app.use("/admin", adminRestaurantRoutes);
 app.use("/import-menu",importMenuRoutes);
app.use("/uploads",express.static("uploads"));
 app.use("/partner", partnerRoutes);
 app.use("/products", productRoutes);
 app.use("/orders",orderRoutes);

app.use("/cart", cartRoutes);
 app.use("/partner-orders", partnerOrderRoutes);
 app.use("/admin", adminDeliveryRoutes);
 app.use("/wallet", walletRoutes);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});