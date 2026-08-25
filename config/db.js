const mysql = require("mysql2");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),   // <-- ADD THIS
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ MySQL Connection Failed");
        console.error(err);
        return;
    }

    console.log("✅ MySQL Connected");
    connection.release();
});

module.exports = db;