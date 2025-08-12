// backend/api/cart/cart.routes.js

const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller'); // Import the entire controller object
const authenticate = require('../middleware/auth.middleware');

// GET /api/cart/:userId - Get a user's cart
// Using getCartItems from the controller
router.get('/:userId', authenticate, cartController.getCartItems);

// POST /api/cart/:userId/add - Add an item to the cart
router.post('/:userId/add', authenticate, cartController.addToCart);

// PUT /api/cart/:userId/update/:productId - Update an item's quantity
// Using updateCartItemQuantity from the controller
router.put('/:userId/update/:productId', authenticate, cartController.updateCartItemQuantity);

// DELETE /api/cart/:userId/remove/:productId - Remove an item from the cart
router.delete('/:userId/remove/:productId', authenticate, cartController.removeFromCart);

module.exports = router;
