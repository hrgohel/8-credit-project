const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// Database connection parameters
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
};

let pool;

async function initDB() {
    try {
        // First connect without database to create it if it doesn't exist
        const connection = await mysql.createConnection(dbConfig);
        const dbName = process.env.DB_NAME || 'smart_classroom';
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await connection.end();

        // Connect to the specific database
        pool = mysql.createPool({
            ...dbConfig,
            database: dbName,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Create users table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                contact VARCHAR(255),
                address TEXT,
                role VARCHAR(50)
            )
        `;
        await pool.query(createTableQuery);
        console.log('Database and users table initialized successfully.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

initDB();

// Register API
app.post('/api/register', async (req, res) => {
    const { name, password, contact, address, role } = req.body;
    
    if (!name || !password) {
        return res.status(400).json({ success: false, message: 'Name and Password are required.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO users (name, password, contact, address, role) VALUES (?, ?, ?, ?, ?)',
            [name, password, contact, address, role]
        );
        res.status(201).json({ success: true, message: 'Registration successful', userId: result.insertId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    // We will support login via name and password. (or contact as fallback depending on what frontend sends)
    const { name, password, contact } = req.body;

    try {
        let query = 'SELECT * FROM users WHERE name = ? AND password = ?';
        let params = [name, password];
        
        // If frontend still sends contact instead of password, we handle it as fallback for compatibility
        if (contact && !password) {
            query = 'SELECT * FROM users WHERE name = ? AND contact = ?';
            params = [name, contact];
        }

        const [rows] = await pool.query(query, params);

        if (rows.length > 0) {
            const user = rows[0];
            // Don't send password back
            delete user.password;
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
