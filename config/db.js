const mysql = require("mysql2");

// ==========================================
// MYSQL CONNECTION POOL
// ==========================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),

    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // Connection handling
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // Give Render enough time to connect
    connectTimeout: 30000,

    // Keep TCP connections alive
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// ==========================================
// INITIAL CONNECTION TEST
// ==========================================

db.getConnection((err, connection) => {

    if (err) {

        console.error("❌ MySQL Connection Failed");
        console.error("Code:", err.code);
        console.error("Message:", err.message);

        return;
    }

    console.log("✅ MySQL Connected");
    console.log("MySQL Thread ID:", connection.threadId);

    connection.release();
});

// ==========================================
// MYSQL POOL ERROR HANDLER
// ==========================================

db.on("error", (err) => {

    console.error("❌ MySQL Pool Error");
    console.error("Code:", err.code);
    console.error("Message:", err.message);

});

// ==========================================
// KEEP MYSQL CONNECTION ACTIVE
// ==========================================

setInterval(() => {

    db.query("SELECT 1", (err) => {

        if (err) {

            console.error(
                "❌ MySQL Keep-Alive Error:",
                err.code || err.message
            );

            return;
        }

        console.log("💓 MySQL connection alive");

    });

}, 4 * 60 * 1000);

// ==========================================
// EXPORT
// ==========================================

module.exports = db;