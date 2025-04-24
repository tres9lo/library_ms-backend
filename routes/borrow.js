const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, async (req, res) => {
  const { bookIds } = req.body; // Expecting an array of book IDs

  // Validation
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return res.status(400).json({ message: 'At least one book ID is required' });
  }

  try {
    // Check availability of all books
    const [books] = await db.query('SELECT id, quantity FROM books WHERE id IN (?)', [bookIds]);
    const unavailableBooks = books.filter((book) => book.quantity <= 0);
    if (unavailableBooks.length > 0) {
      return res.status(400).json({
        message: `The following books are not available: ${unavailableBooks
          .map((b) => b.id)
          .join(', ')}`,
      });
    }

    // Borrow each book
    for (const bookId of bookIds) {
      if (!books.find((b) => b.id === bookId)) {
        return res.status(400).json({ message: `Book ID ${bookId} not found` });
      }
      await db.query('INSERT INTO borrows (user_id, book_id, borrow_date) VALUES (?, ?, CURDATE())', [
        req.user.id,
        bookId,
      ]);
      await db.query('UPDATE books SET quantity = quantity - 1 WHERE id = ?', [bookId]);
    }

    res.json({ message: `${bookIds.length} book(s) borrowed successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error borrowing books', error });
  }
});

router.post('/return/:id', auth, async (req, res) => {
  try {
    const [borrows] = await db.query('SELECT * FROM borrows WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (borrows.length === 0) {
      return res.status(404).json({ message: 'Borrow record not found' });
    }
    if (borrows[0].status === 'returned') {
      return res.status(400).json({ message: 'Book already returned' });
    }

    await db.query(
      'UPDATE borrows SET status = "returned", return_date = CURDATE() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    await db.query('UPDATE books SET quantity = quantity + 1 WHERE id = ?', [borrows[0].book_id]);
    res.json({ message: 'Book returned successfully' });
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

router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  try {
    const [borrows] = await db.query(
      'SELECT b.*, u.username, bk.title FROM borrows b JOIN users u ON b.user_id = u.id JOIN books bk ON b.book_id = bk.id'
    );
    res.json(borrows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all borrow records', error });
  }
});

router.post('/admin/return/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  try {
    const [borrows] = await db.query('SELECT * FROM borrows WHERE id = ?', [req.params.id]);
    if (borrows.length === 0) {
      return res.status(404).json({ message: 'Borrow record not found' });
    }
    if (borrows[0].status === 'returned') {
      return res.status(400).json({ message: 'Book already returned' });
    }

    await db.query(
      'UPDATE borrows SET status = "returned", return_date = CURDATE() WHERE id = ?',
      [req.params.id]
    );
    await db.query('UPDATE books SET quantity = quantity + 1 WHERE id = ?', [borrows[0].book_id]);
    res.json({ message: 'Book marked as returned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking book as returned', error });
  }
});

module.exports = router;