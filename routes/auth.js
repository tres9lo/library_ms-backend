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
    res.status(500).json({ message: 'Error registering user', error });
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
    res.status(500).json({ message: 'Error logging in', error });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Total books borrowed
    const [booksBorrowedResult] = await db.query('SELECT COUNT(*) as count FROM borrows WHERE user_id = ?', [userId]);
    const booksBorrowed = booksBorrowedResult[0].count;

    // Currently reading (status = 'borrowed')
    const [currentlyReadingResult] = await db.query(
      'SELECT COUNT(*) as count FROM borrows WHERE user_id = ? AND status = "borrowed"',
      [userId]
    );
    const currentlyReading = currentlyReadingResult[0].count;

    // Completed books (status = 'returned')
    const [completedBooksResult] = await db.query(
      'SELECT COUNT(*) as count FROM borrows WHERE user_id = ? AND status = "returned"',
      [userId]
    );
    const completedBooks = completedBooksResult[0].count;

    // Books due soon (borrowed > 7 days ago, assuming 14-day borrow period)
    const [booksDueSoonResult] = await db.query(
      'SELECT COUNT(*) as count FROM borrows WHERE user_id = ? AND status = "borrowed" AND borrow_date <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
      [userId]
    );
    const booksDueSoon = booksDueSoonResult[0].count;

    res.json({
      booksBorrowed,
      currentlyReading,
      completedBooks,
      booksDueSoon,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user stats', error });
  }
});

module.exports = router;