const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcrypt');
const saltRounds = 10;


const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Routes
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Users API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    // console.log("user logged in : "+username+password);
    
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const query = `INSERT INTO users (username, password) VALUES (?, ?)`;
    db.query(query, [username, hashedPassword], (err, result) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).send(err);
        }
        res.status(201).send('User registered successfully!');
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query to get the user based on username
    const query = `SELECT * FROM users WHERE username = ?`;
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length > 0) {
            const user = results[0];

            // Compare the provided password with the hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                res.status(200).send({ user });
            } else {
                res.status(401).send('Invalid credentials');
            }
        } else {
            res.status(401).send('Invalid credentials');
        }
    });
});


app.post('/posts', (req, res) => {
    const { user_id, title, content } = req.body;
    const query = `INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)`;
    
    db.query(query, [user_id, title, content], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error creating post' });
        // res.status(201).json({ message: 'Post created successfully', });
        const newPost = {
            post_id: result.insertId,
            title,
            content,
            created_at: new Date()
        };

        res.status(201).json({message:'Post created successfully', ...newPost});

    });
});

app.get('/posts', (req, res) => {
    const query = `
        SELECT p.post_id, p.title, p.content, p.created_at, u.username 
        FROM posts p 
        JOIN users u ON p.user_id = u.user_id
        ORDER BY p.created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error fetching posts' });
        res.status(200).json(results);
    });
});


// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
