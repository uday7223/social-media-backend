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
    const insertQuery = `INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)`;
    
    db.query(insertQuery, [user_id, title, content], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error creating post' });
        
        const newPostId = result.insertId;

        // Fetch the post with username
        const fetchQuery = `
            SELECT p.post_id, p.title, p.content, p.created_at, u.username 
            FROM posts p 
            JOIN users u ON p.user_id = u.user_id
            WHERE p.post_id = ?
        `;
        
        db.query(fetchQuery, [newPostId], (err, results) => {
            if (err) return res.status(500).json({ error: 'Error fetching created post' });

            const newPost = results[0];
            res.status(201).json({ message: 'Post created successfully', ...newPost });
        });
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


//api for comments
app.post('/comments', (req, res) => {
    const { post_id, user_id, content } = req.body;
    const query = `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`;

    db.query(query, [post_id, user_id, content], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed to add comment' });
        
        const newComment = {
            comment_id: result.insertId,
            post_id,
            content,
            created_at: new Date()
        };

        // Fetch username for the comment
        const fetchQuery = `SELECT username FROM users WHERE user_id = ?`;
        db.query(fetchQuery, [user_id], (fetchErr, fetchResult) => {
            if (fetchErr) return res.status(500).json({ error: 'Error fetching user' });
            newComment.username = fetchResult[0].username;
            res.status(201).json(newComment);
        });
    });
});



app.get('/comments/:post_id', (req, res) => {
    const { post_id } = req.params;
    const query = `
        SELECT c.comment_id, c.content, c.created_at, u.username 
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at DESC
    `;

    db.query(query, [post_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error fetching comments' });
        res.status(200).json(results);
    });
});

// Add a reply to a comment
app.post('/replies', (req, res) => {
    const { comment_id, user_id, content } = req.body;
    const query = `INSERT INTO replies (comment_id, user_id, content) VALUES (?, ?, ?)`;
    
    db.query(query, [comment_id, user_id, content], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error adding reply' });
        const newReply = {
            reply_id: result.insertId,
            comment_id,
            user_id,
            content,
            created_at: new Date()
        };
        res.status(201).json(newReply);
    });
});

// Fetch replies for a comment
app.get('/replies/:comment_id', (req, res) => {
    const { comment_id } = req.params;
    const query = `
        SELECT r.reply_id, r.content, r.created_at, u.username 
        FROM replies r
        JOIN users u ON r.user_id = u.user_id
        WHERE r.comment_id = ?
        ORDER BY r.created_at ASC
    `;
    
    db.query(query, [comment_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error fetching replies' });
        res.status(200).json(results);
    });
});

// Like a post
app.post('/likes', (req, res) => {
    const { post_id, user_id } = req.body;
    const checkQuery = `SELECT * FROM likes WHERE post_id = ? AND user_id = ?`;

    db.query(checkQuery, [post_id, user_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error checking like' });
        
        if (result.length > 0) {
            const deleteQuery = `DELETE FROM likes WHERE post_id = ? AND user_id = ?`;
            db.query(deleteQuery, [post_id, user_id], (err) => {
                if (err) return res.status(500).json({ error: 'Error unliking post' });
                return res.status(200).json({ message: 'Post unliked' });
            });
        } else {
            const insertQuery = `INSERT INTO likes (post_id, user_id) VALUES (?, ?)`;
            db.query(insertQuery, [post_id, user_id], (err) => {
                if (err) return res.status(500).json({ error: 'Error liking post' });
                res.status(201).json({ message: 'Post liked' });
            });
        }
    });
});

// Get likes for each post
app.get('/likes/:post_id', (req, res) => {
    const { post_id } = req.params;
    const query = `SELECT COUNT(*) AS likeCount FROM likes WHERE post_id = ?`;

    db.query(query, [post_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error fetching likes' });
        res.status(200).json(results[0]);
    });
});


// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
