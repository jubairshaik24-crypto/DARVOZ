-- Run after backing up the database. Records one verified COD payment per order.
CREATE TABLE IF NOT EXISTS delivery_cod_collections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    delivery_partner_id BIGINT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('cash', 'razorpay_upi') NOT NULL,
    status ENUM('pending', 'collected') NOT NULL DEFAULT 'collected',
    razorpay_order_id VARCHAR(80) NULL,
    razorpay_payment_id VARCHAR(80) NULL,
    collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_cod_collection_order (order_id),
    KEY idx_cod_collection_rider_date (delivery_partner_id, collected_at)
);
