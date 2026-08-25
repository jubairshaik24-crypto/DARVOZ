const db = require("../config/db");

function startOrderTimeoutChecker(io) {

    console.log("⏱️ DARVOZ Order Timeout Checker Started");

    // Check every 30 seconds
    setInterval(() => {

        // =====================================================
        // 1. PARTNER TIMEOUT
        // =====================================================

        db.query(
            `SELECT
                id,
                customer_id,
                partner_id,
                status
             FROM orders
             WHERE status='Pending'
             AND partner_response_deadline IS NOT NULL
             AND partner_response_deadline <= NOW()`,

            (err, orders) => {

                if (err) {

                    console.log(
                        "❌ Partner timeout check error:",
                        err
                    );

                    return;
                }

                orders.forEach(order => {

                    console.log(
                        "⏰ Partner response timeout:",
                        order.id
                    );

                    // Tell customer partner did not respond
                    if (
                        io &&
                        order.customer_id
                    ) {

                        io.to(
                            `customer_${order.customer_id}`
                        ).emit(
                            "partnerResponseTimeout",
                            {
                                orderId: order.id,
                                message:
                                    "Partner has not responded within 10 minutes."
                            }
                        );

                    }

                    // Prevent this order from being detected
                    // again by the timeout checker
                    db.query(
                        `UPDATE orders
                         SET partner_response_deadline=NULL
                         WHERE id=?`,

                        [order.id],

                        updateErr => {

                            if (updateErr) {

                                console.log(
                                    "❌ Partner timeout update error:",
                                    updateErr
                                );

                            }

                        }
                    );

                });

            }
        );


        // =====================================================
        // 2. RIDER TIMEOUT
        // =====================================================

        db.query(
            `SELECT
                id,
                customer_id,
                partner_id,
                status
             FROM orders
             WHERE status='Accepted'
             AND delivery_partner_id IS NULL
             AND rider_response_deadline IS NOT NULL
             AND rider_response_deadline <= NOW()`,

            (err, orders) => {

                if (err) {

                    console.log(
                        "❌ Rider timeout check error:",
                        err
                    );

                    return;
                }

                orders.forEach(order => {

                    console.log(
                        "⏰ Rider response timeout:",
                        order.id
                    );

                    // Tell customer no rider was assigned
                    if (
                        io &&
                        order.customer_id
                    ) {

                        io.to(
                            `customer_${order.customer_id}`
                        ).emit(
                            "riderResponseTimeout",
                            {
                                orderId: order.id,
                                message:
                                    "No delivery partner has accepted the order within 10 minutes."
                            }
                        );

                    }

                    // Prevent repeated timeout events
                    db.query(
                        `UPDATE orders
                         SET rider_response_deadline=NULL
                         WHERE id=?`,

                        [order.id],

                        updateErr => {

                            if (updateErr) {

                                console.log(
                                    "❌ Rider timeout update error:",
                                    updateErr
                                );

                            }

                        }
                    );

                });

            }
        );

    }, 30000);

}

module.exports = {
    startOrderTimeoutChecker
};