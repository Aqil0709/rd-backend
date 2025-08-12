// backend/api/orders/order.router.js

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
// These will be mounted under the /payment prefix in your main server file.
// =================================================================

// @route   POST /payment/create-order
paymentRouter.post('/create-order', authenticate, createRazorpayOrderController);

// @route   POST /payment/verify-payment
paymentRouter.post('/verify-payment', authenticate, verifyRazorpayPaymentController);


// =================================================================
// --- ORDER MANAGEMENT ROUTES ---
// These will be mounted under the /orders prefix in your main server file.
// =================================================================

// @route   GET /orders/my-orders
orderRouter.get('/my-orders', authenticate, getMyOrders);

// @route   GET /orders/:userId/:orderId
orderRouter.get('/:userId/:orderId', authenticate, getOrderById);

// @route   PUT /orders/:orderId/cancel
orderRouter.put('/:orderId/cancel', authenticate, cancelOrderController);


// =================================================================
// --- ADMIN ONLY ORDER ROUTES ---
// =================================================================

// @route   GET /orders
orderRouter.get('/', authenticate, authorizeAdmin, getAllOrders);

// @route   PUT /orders/:orderId/status
orderRouter.put('/:orderId/status', authenticate, authorizeAdmin, updateOrderStatus);


// --- EXPORT BOTH ROUTERS ---
module.exports = {
    paymentRouter,
    orderRouter
};
