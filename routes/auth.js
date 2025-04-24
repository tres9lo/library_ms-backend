const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  // Validation
  if (!username || username.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters long' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  if (role !== 'user') {
    return res.status(403).json({ message: 'Admin registration is not allowed' });
  }

  try {
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
      username,
      hashedPassword,
      role,
    ]);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Optimize queries with a single database call
    const [stats] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM borrows WHERE user_id = ?) AS booksBorrowed,
        (SELECT COUNT(*) FROM borrows WHERE user_id = ? AND status = 'borrowed') AS currentlyReading,
        (SELECT COUNT(*) FROM borrows WHERE user_id = ? AND status = 'returned') AS completedBooks,
        (SELECT COUNT(*) FROM borrows WHERE user_id = ? AND status = 'borrowed' AND borrow_date <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS booksDueSoon
    `, [userId, userId, userId, userId]);

    res.json({
      booksBorrowed: stats[0].booksBorrowed || 0,
      currentlyReading: stats[0].currentlyReading || 0,
      completedBooks: stats[0].completedBooks || 0,
      booksDueSoon: stats[0].booksDueSoon || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user stats', error: error.message });
  }
});

module.exports = router;