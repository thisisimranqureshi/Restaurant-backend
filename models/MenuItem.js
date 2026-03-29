const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, enum: ['mg', 'g', 'kg', 'ml', 'litre'], required: true },
});

const menuItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  ingredients: [ingredientSchema],
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);