// backend/api/routes/order.routes.js

const express = require('express');
const paymentRouter = express.Router();
const orderRouter = express.Router();


// --- Import all necessary controller functions ---
const {
    createRazorpayOrderController,
    verifyRazorpayPaymentController,
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrderController
} = require('../controllers/order.controller');

// --- Import your authentication middleware ---
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// =================================================================
// --- PAYMENT ROUTES ---
// These will be mounted under the /api/payment prefix in your main server file.
// =================================================================

// @route   POST /api/payment/create-order
// @desc    Create a Razorpay order
// @access  Private (User must be logged in)
paymentRouter.post('/create-order', authenticate, createRazorpayOrderController);

// @route   POST /api/payment/verify-payment
// @desc    Verify a Razorpay payment after successful completion
// @access  Private (User must be logged in)
paymentRouter.post('/verify-payment', authenticate, verifyRazorpayPaymentController);


// =================================================================
// --- ORDER MANAGEMENT ROUTES ---
// These will be mounted under the /api/orders prefix in your main server file.
// =================================================================

// @route   GET /api/orders/my-orders
// @desc    Get all orders for the currently logged-in user
// @access  Private
orderRouter.get('/my-orders', authenticate, getMyOrders);

// @route   GET /api/orders/:userId/:orderId
// @desc    Get a specific order by its ID for a specific user
// @access  Private
orderRouter.get('/:userId/:orderId', authenticate, getOrderById);

// @route   PUT /api/orders/:orderId/cancel
// @desc    Cancel an order
// @access  Private
orderRouter.put('/:orderId/cancel', authenticate, cancelOrderController);


// =================================================================
// --- ADMIN ONLY ORDER ROUTES ---
// =================================================================

// @route   GET /api/orders
// @desc    Get all orders in the system
// @access  Admin
orderRouter.get('/', authenticate, authorizeAdmin, getAllOrders);

// @route   PUT /api/orders/:orderId/status
// @desc    Update the status of an order
// @access  Admin
orderRouter.put('/:orderId/status', authenticate, authorizeAdmin, updateOrderStatus);


// --- EXPORT BOTH ROUTERS ---
module.exports = {
    paymentRouter,
    orderRouter
};
