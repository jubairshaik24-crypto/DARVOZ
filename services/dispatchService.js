const db = require("../config/db");

// =======================================
// HAVERSINE FORMULA
// =======================================

function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371;

    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2) *
        Math.sin(dLon/2);

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );

    return R*c;
}

async function dispatchOrder(orderId, io){

    db.query(

`SELECT *

FROM orders

WHERE id=?`,

[orderId],

(err,orders)=>{

    if(err || orders.length==0){

        return;

    }

    const order=orders[0];

    db.query(

    `SELECT
        latitude,
        longitude

    FROM restaurants

    WHERE id=?`,

    [order.partner_id],

    (err,restaurant)=>{

        if(err || restaurant.length==0){

            return;

        }

        console.log("Restaurant Loaded");

    });

});

}

module.exports = {
    dispatchOrder
};