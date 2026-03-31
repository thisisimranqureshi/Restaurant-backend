const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const MenuItem = require('../models/MenuItem');
const protect = require('../middleware/authMiddleware');

// GET /api/usage
// Query params:
//   ?month=2026-03          → filter by month (YYYY-MM)
//   ?from=2026-03-01&to=2026-03-31  → filter by date range
router.get('/', protect, async (req, res) => {
  try {
    const { month, from, to } = req.query;

    // --- Build date filter ---
    let dateFilter = {};

    if (month) {
      // e.g. month=2026-03
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);          // Mar 1
      const end   = new Date(year, mon, 1);               // Apr 1 (exclusive)
      dateFilter = { createdAt: { $gte: start, $lt: end } };
    } else if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) {
        // include the full "to" day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = toDate;
      }
    }

    // --- Fetch invoices for this user ---
    const invoices = await Invoice.find({
      user: req.user.id,
      ...dateFilter,
    });

    if (invoices.length === 0) {
      return res.json({ ingredients: [], totalInvoices: 0 });
    }

    // --- Collect all unique menu item names sold ---
    // Invoice items store name (string) — we use name to match MenuItem
    // Aggregate: { itemName -> totalQuantitySold }
    const soldMap = {}; // { menuItemName: totalQtySold }
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const key = item.name.toLowerCase().trim();
        soldMap[key] = (soldMap[key] || 0) + item.quantity;
      }
    }

    // --- Fetch all MenuItems for this user ---
    const menuItems = await MenuItem.find({ user: req.user.id });

    // --- Calculate ingredient usage ---
    // ingredientUsage: { "ingredient name|unit": { name, unit, totalQuantity } }
    const ingredientUsage = {};

    for (const menuItem of menuItems) {
      const key = menuItem.name.toLowerCase().trim();
      const qtySold = soldMap[key] || 0;
      if (qtySold === 0) continue; // not sold in this period

      for (const ing of menuItem.ingredients) {
        const ingKey = `${ing.name.toLowerCase().trim()}|${ing.unit}`;
        if (!ingredientUsage[ingKey]) {
          ingredientUsage[ingKey] = {
            name: ing.name,
            unit: ing.unit,
            totalQuantity: 0,
            usedInItems: [],
          };
        }
        ingredientUsage[ingKey].totalQuantity += ing.quantity * qtySold;
        ingredientUsage[ingKey].usedInItems.push({
          menuItem: menuItem.name,
          qtySold,
          quantityPerItem: ing.quantity,
        });
      }
    }

    // --- Sort by totalQuantity descending ---
    const ingredients = Object.values(ingredientUsage).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    res.json({
      ingredients,
      totalInvoices: invoices.length,
      filter: month
        ? { type: 'month', value: month }
        : from || to
        ? { type: 'range', from, to }
        : { type: 'all' },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;