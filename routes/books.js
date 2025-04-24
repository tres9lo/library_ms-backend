const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [books] = await db.query('SELECT * FROM books');
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { title, author, isbn, quantity } = req.body;
  try {
    await db.query('INSERT INTO books (title, author, isbn, quantity) VALUES (?, ?, ?, ?)', [
      title,
      author,
      isbn,
      quantity,
    ]);
    res.status(201).json({ message: 'Book added' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding book', error });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  try {
    await db.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    res.json({ message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting book', error });
  }
});

module.exports = router;