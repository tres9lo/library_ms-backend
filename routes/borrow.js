const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, async (req, res) => {
  const { bookId } = req.body;
  try {
    const [books] = await db.query('SELECT quantity FROM books WHERE id = ?', [bookId]);
    if (books.length === 0 || books[0].quantity <= 0) {
      return res.status(400).json({ message: 'Book not available' });
    }

    await db.query('INSERT INTO borrows (user_id, book_id, borrow_date) VALUES (?, ?, CURDATE())', [
      req.user.id,
      bookId,
    ]);
    await db.query('UPDATE books SET quantity = quantity - 1 WHERE id = ?', [bookId]);
    res.json({ message: 'Book borrowed' });
  } catch (error) {
    res.status(500).json({ message: 'Error borrowing book', error });
  }
});

router.post('/return/:id', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE borrows SET status = "returned", return_date = CURDATE() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    const [borrows] = await db.query('SELECT book_id FROM borrows WHERE id = ?', [req.params.id]);
    await db.query('UPDATE books SET quantity = quantity + 1 WHERE id = ?', [borrows[0].book_id]);
    res.json({ message: 'Book returned' });
  } catch (error) {
    res.status(500).json({ message: 'Error returning book', error });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const [borrows] = await db.query(
      'SELECT b.*, bk.title FROM borrows b JOIN books bk ON b.book_id = bk.id WHERE b.user_id = ?',
      [req.user.id]
    );
    res.json(borrows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching borrow history', error });
  }
});

module.exports = router;