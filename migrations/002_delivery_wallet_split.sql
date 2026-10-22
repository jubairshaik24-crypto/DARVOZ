-- Run manually after taking a database backup. Existing orders remain NULL so
-- their historical rider/admin split is not guessed or credited retroactively.
ALTER TABLE orders
    ADD COLUMN delivery_rider_earning DECIMAL(10,2) NULL DEFAULT NULL,
    ADD COLUMN admin_delivery_fee DECIMAL(10,2) NULL DEFAULT NULL,
    ADD COLUMN delivery_subsidy DECIMAL(10,2) NULL DEFAULT NULL,
    ADD COLUMN admin_delivery_wallet_credited TINYINT(1) NOT NULL DEFAULT 0;
