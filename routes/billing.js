const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const protect = require('../middleware/authMiddleware');

// Generate invoice number
const generateInvoiceNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${random}`;
};

// GET all invoices
router.get('/', protect, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CREATE invoice
router.post('/', protect, async (req, res) => {
  try {
    const { customerName, items, tax } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ message: 'Customer name and items are required' });
    }

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = (subtotal * (tax || 0)) / 100;
    const totalAmount = subtotal + taxAmount;

    const invoice = await Invoice.create({
      user: req.user.id,
      invoiceNumber: generateInvoiceNumber(),
      customerName,
      items,
      tax: tax || 0,
      subtotal,
      totalAmount,
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;