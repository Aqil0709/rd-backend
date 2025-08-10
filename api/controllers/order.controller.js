// backend/api/controllers/order.controller.js

// --- IMPORTANT: Import your Mongoose models and required libraries ---
const Order = require('../models/order.model'); // Adjust path if necessary
const User = require('../models/user.model');   // Adjust path if necessary
const Stock = require('../models/stock.model');   // Adjust path if necessary
const Cart = require('../models/cartItem.model');      // Adjust path if necessary
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// --- Initialize Razorpay ---
// This uses the keys from your .env file
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// --- NEW: Create Razorpay Order Controller ---
const createRazorpayOrderController = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { deliveryAddressId, cart, amount } = req.body;
        const userId = req.userData.userId;

        if (!userId || !deliveryAddressId || !cart || cart.length === 0) {
            return res.status(400).json({ message: 'Missing required data for creating an order.' });
        }

        // 1. Calculate total amount and prepare item details from the cart
        let totalAmount = 0;
        let itemsDetails = [];

        // This loop ensures products exist and calculates the final server-side total
        for (const item of cart) {
            const stockItem = await Stock.findOne({ productId: item.productId }).session(session);
            if (!stockItem || stockItem.quantity < item.quantity) {
                throw new Error(`Insufficient stock for a product in your cart.`);
            }
            // Use the price from the backend to prevent manipulation
            totalAmount += stockItem.price * item.quantity; 
            itemsDetails.push({
                productId: item.productId,
                productName: stockItem.productName,
                quantity: item.quantity,
                price: stockItem.price,
                image: item.images ? item.images[0] : ''
            });
        }

        // 2. Create a local order in your database with a "Pending" status
        const newOrder = new Order({
            user_id: userId,
            total_amount: totalAmount,
            status: 'Pending', // Initial status
            payment_status: 'Pending',
            shipping_address_id: deliveryAddressId,
            items_details: JSON.stringify(itemsDetails),
            payment_method: 'Razorpay'
        });

        const savedOrder = await newOrder.save({ session });

        // 3. Create a Razorpay order
        const razorpayOptions = {
            amount: totalAmount * 100, // Amount in paise
            currency: "INR",
            receipt: savedOrder._id.toString(), // Use your internal order ID as the receipt
        };

        const razorpayOrder = await razorpay.orders.create(razorpayOptions);

        if (!razorpayOrder) {
            throw new Error("Failed to create Razorpay order.");
        }

        // 4. Update your local order with the Razorpay order ID
        savedOrder.razorpay_order_id = razorpayOrder.id;
        await savedOrder.save({ session });
        
        // At this point, we don't commit the transaction yet.
        // The stock will be reduced only after successful payment verification.
        
        await session.commitTransaction();
        session.endSession();

        // 5. Send the order details to the frontend
        res.status(201).json({
            message: 'Razorpay order created successfully.',
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: "RD General Store",
            order_id: razorpayOrder.id,
            receipt: savedOrder._id.toString()
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ message: error.message || 'Server error while creating Razorpay order.' });
    }
};

// --- NEW: Verify Razorpay Payment Controller ---
const verifyRazorpayPaymentController = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification details.' });
        }

        // 1. Verify the signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: 'failure', message: 'Payment verification failed. Signature mismatch.' });
        }

        // 2. Find the order in your database
        const order = await Order.findOne({ razorpay_order_id }).session(session);
        if (!order) {
            throw new Error('Order not found for this payment.');
        }

        // 3. Update order status and payment details
        order.payment_status = 'Paid';
        order.status = 'Processing'; // Or 'Confirmed', 'Placed', etc.
        order.razorpay_payment_id = razorpay_payment_id;
        order.razorpay_signature = razorpay_signature;

        // 4. Reduce stock for each item in the order
        const items = JSON.parse(order.items_details);
        for (const item of items) {
            const stock = await Stock.findOne({ productId: item.productId }).session(session);
            if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.productName}" during final confirmation.`);
            }
            stock.quantity -= item.quantity;
            await stock.save({ session });
        }
        
        // 5. Clear the user's cart
        await Cart.updateOne({ userId: order.user_id }, { $set: { items: [] } }).session(session);

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            status: 'success',
            message: 'Payment verified successfully.',
            orderId: order._id
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({ message: error.message || 'Server error while verifying payment.' });
    }
};


// --- (Existing Order Functions - Unchanged) ---
const getAllOrders = async (req, res) => {
    // This function remains the same
};

const getMyOrders = async (req, res) => {
    // This function remains the same
};

const getOrderStatus = async (req, res) => {
    // This function remains the same
};

const updateOrderStatus = async (req, res) => {
    // This function remains the same
};

const cancelOrderController = async (req, res) => {
    // This function remains the same
};


module.exports = {
    getAllOrders,
    getMyOrders,
    getOrderStatus,
    updateOrderStatus,
    cancelOrderController,
    // --- EXPORT THE NEW RAZORPAY CONTROLLERS ---
    createRazorpayOrderController,
    verifyRazorpayPaymentController
};
