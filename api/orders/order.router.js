// backend/api/routes/order.routes.js

const express = require('express');
const paymentRouter = express.Router();
const orderRouter = express.Router();


// --- Import all necessary controller functions ---
const orderController = require('../controllers/order.controller');

// --- NEW DEBUGGING LINE ---
// This will show us exactly what is being imported from the controller file.
console.log("--- Imported from order.controller.js ---", orderController);
// --- END DEBUGGING LINE ---

const {
    createRazorpayOrderController,
    verifyRazorpayPaymentController,
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrderController
} = orderController; // Use the imported object

// --- Import your authentication middleware ---
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// =================================================================
// --- PAYMENT ROUTES ---
// =================================================================

paymentRouter.post('/create-order', authenticate, createRazorpayOrderController);
paymentRouter.post('/verify-payment', authenticate, verifyRazorpayPaymentController);


// =================================================================
// --- ORDER MANAGEMENT ROUTES ---
// =================================================================

orderRouter.get('/my-orders', authenticate, getMyOrders);
orderRouter.get('/:userId/:orderId', authenticate, getOrderById);
orderRouter.put('/:orderId/cancel', authenticate, cancelOrderController);


// =================================================================
// --- ADMIN ONLY ORDER ROUTES ---
// =================================================================

orderRouter.get('/', authenticate, authorizeAdmin, getAllOrders);
orderRouter.put('/:orderId/status', authenticate, authorizeAdmin, updateOrderStatus);


// --- EXPORT BOTH ROUTERS ---
module.exports = {
    paymentRouter,
    orderRouter
};
