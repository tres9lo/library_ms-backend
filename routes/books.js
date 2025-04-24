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

  // Validation
  if (!title || title.length < 1) {
    return res.status(400).json({ message: 'Title is required' });
  }
  if (!author || author.length < 1) {
    return res.status(400).json({ message: 'Author is required' });
  }
  if (!isbn || !/^\d{10,13}$/.test(isbn)) {
    return res.status(400).json({ message: 'Valid ISBN (10-13 digits) is required' });
  }
  if (!quantity || quantity < 0) {
    return res.status(400).json({ message: 'Quantity must be non-negative' });
  }

  try {
    const [existingBooks] = await db.query('SELECT * FROM books WHERE isbn = ?', [isbn]);
    if (existingBooks.length > 0) {
      return res.status(400).json({ message: 'ISBN already exists' });
    }

    await db.query('INSERT INTO books (title, author, isbn, quantity) VALUES (?, ?, ?, ?)', [
      title,
      author,
      isbn,
      quantity,
    ]);
    res.status(201).json({ message: 'Book added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding book', error });
  }
});

router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });

  const { title, author, isbn, quantity } = req.body;

  // Validation
  if (!title || title.length < 1) {
    return res.status(400).json({ message: 'Title is required' });
  }
  if (!author || author.length < 1) {
    return res.status(400).json({ message: 'Author is required' });
  }
  if (!isbn || !/^\d{10,13}$/.test(isbn)) {
    return res.status(400).json({ message: 'Valid ISBN (10-13 digits) is required' });
  }
  if (!quantity || quantity < 0) {
    return res.status(400).json({ message: 'Quantity must be non-negative' });
  }

  try {
    const [existingBooks] = await db.query('SELECT * FROM books WHERE isbn = ? AND id != ?', [
      isbn,
      req.params.id,
    ]);
    if (existingBooks.length > 0) {
      return res.status(400).json({ message: 'ISBN already exists' });
    }

    const [result] = await db.query(
      'UPDATE books SET title = ?, author = ?, isbn = ?, quantity = ? WHERE id = ?',
      [title, author, isbn, quantity, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json({ message: 'Book updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating book', error });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  try {
    const [result] = await db.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting book', error });
  }
});

module.exports = router;