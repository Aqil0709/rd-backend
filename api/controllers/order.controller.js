// backend/api/controllers/order.controller.js

<<<<<<< HEAD
const Order = require('../models/order.model');
const User = require('../models/user.model');
const Stock = require('../models/stock.model');
const CartItem = require('../models/cartItem.model'); // Corrected from Cart to CartItem
=======
// --- IMPORTANT: Import your Mongoose models and required libraries ---
const Order = require('../models/order.model'); // Adjust path if necessary
const User = require('../models/user.model');    // Adjust path if necessary
const Stock = require('../models/stock.model');    // Adjust path if necessary
const Cart = require('../models/cartItem.model');      // Adjust path if necessary
>>>>>>> 9ba6b503cbfd7ac83684feda9cc2165cc3c4806e
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrderController = async (req, res) => {
<<<<<<< HEAD
    const { deliveryAddressId, cart } = req.body;
    const userId = req.userData.userId;

    console.log("--- Creating Order: Received Cart from Frontend ---", JSON.stringify(cart, null, 2));

    if (!userId || !deliveryAddressId || !cart || !cart.length) {
        return res.status(400).json({ message: 'Missing required data for creating an order.' });
    }

    let totalAmount = 0;
    let itemsDetails = [];
    try {
        for (const item of cart) {
            console.log(`--- Backend: Querying stock for productId: ${item.productId} ---`); // Diagnostic Log 1
            const stockItem = await Stock.findOne({ productId: item.productId }).populate('productId');
            
            // --- THIS IS THE NEW, CRITICAL LOG ---
            console.log("--- Backend: Found stockItem from DB ---", stockItem); // Diagnostic Log 2

            if (!stockItem || stockItem.quantity < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${stockItem?.productId?.name || 'a product'}. Available: ${stockItem?.quantity || 0}, Requested: ${item.quantity}.` });
            }

            if (!stockItem.productId) {
                throw new Error(`Product details could not be found for a cart item. Product ID: ${item.productId}.`);
            }

            const price = stockItem.productId.price;
            totalAmount += parseFloat(price.toString()) * item.quantity;
            itemsDetails.push({
                productId: item.productId,
=======
    console.log("--- createRazorpayOrderController: Entered function ---");
    console.log("--- Request Body Received: ---", JSON.stringify(req.body, null, 2));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Destructure the fields you need
        const { deliveryAddressId, cart } = req.body;
        const userId = req.userData.userId;

        // Critical validation check
        if (!userId || !deliveryAddressId || !cart || cart.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Missing required data for creating an order.' });
        }

        let totalAmount = 0;
        let itemsDetails = [];

        for (const item of cart) {
            // FIX: Changed from `item.id` to `item.productId` to match the frontend body
            const productId = item.productId;
            if (!productId) {
                throw new Error('Cart item is missing a product ID.');
            }

            // Populate the product details directly from the Stock model
            const stockItem = await Stock.findOne({ productId: productId }).populate('productId').session(session);

            if (!stockItem) {
                throw new Error(`Product with ID ${productId} not found in stock.`);
            }
            if (stockItem.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product: ${stockItem.productId.name || 'Unknown Product'}`);
            }
            
            const price = stockItem.productId.price;
            totalAmount += price * item.quantity; 
            
            itemsDetails.push({
                productId: stockItem.productId._id,
>>>>>>> 9ba6b503cbfd7ac83684feda9cc2165cc3c4806e
                productName: stockItem.productId.name,
                quantity: item.quantity,
                price: parseFloat(price.toString()),
                image: item.images ? item.images[0] : (stockItem.productId.images ? stockItem.productId.images[0] : '')
            });
        }
    } catch (validationError) {
        console.error('Error during pre-transaction validation:', validationError);
        return res.status(500).json({ message: validationError.message || 'Server error during order validation.' });
    }

<<<<<<< HEAD
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
=======
        // Create a new order document
>>>>>>> 9ba6b503cbfd7ac83684feda9cc2165cc3c4806e
        const newOrder = new Order({
            user_id: userId,
            total_amount: totalAmount,
            status: 'Pending',
            payment_status: 'Pending',
            shipping_address_id: deliveryAddressId,
            items_details: JSON.stringify(itemsDetails),
            payment_method: 'Razorpay'
        });
        const savedOrder = await newOrder.save({ session });

<<<<<<< HEAD
        const razorpayOptions = {
            amount: totalAmount * 100,
=======
        // Double check the amount before sending to Razorpay
        if (totalAmount <= 0) {
            throw new Error("Order amount must be greater than zero.");
        }
        
        // Create Razorpay order
        const razorpayOptions = {
            amount: Math.round(totalAmount * 100), // Convert to paise and round to nearest integer
>>>>>>> 9ba6b503cbfd7ac83684feda9cc2165cc3c4806e
            currency: "INR",
            receipt: savedOrder._id.toString(),
        };
        const razorpayOrder = await razorpay.orders.create(razorpayOptions);
        console.log("Razorpay Order Created: ", razorpayOrder);

        if (!razorpayOrder) {
            throw new Error("Failed to create Razorpay order.");
        }

        savedOrder.razorpay_order_id = razorpayOrder.id;
        await savedOrder.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: 'Razorpay order created successfully.',
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: "RD General Store",
            order_id: razorpayOrder.id,
            receipt: savedOrder._id.toString()
        });

    } catch (transactionError) {
        await session.abortTransaction();
        session.endSession();
<<<<<<< HEAD
        console.error('Error creating Razorpay order within transaction:', transactionError);
        res.status(500).json({ message: transactionError.message || 'Server error while creating Razorpay order.' });
=======
        console.error('--- CRITICAL ERROR in createRazorpayOrderController: ---', error.message);
        res.status(500).json({ message: error.message || 'Server error while creating Razorpay order.' });
>>>>>>> 9ba6b503cbfd7ac83684feda9cc2165cc3c4806e
    }
};

const verifyRazorpayPaymentController = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification details.' });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: 'failure', message: 'Payment verification failed. Signature mismatch.' });
        }

        const order = await Order.findOne({ razorpay_order_id }).session(session);
        if (!order) {
            throw new Error('Order not found for this payment.');
        }

        order.payment_status = 'Paid';
        order.status = 'Processing';
        order.razorpay_payment_id = razorpay_payment_id;
        order.razorpay_signature = razorpay_signature;

        const items = JSON.parse(order.items_details);
        for (const item of items) {
            const stockUpdateResult = await Stock.updateOne(
                { productId: item.productId, quantity: { $gte: item.quantity } },
                { $inc: { quantity: -item.quantity } },
                { session }
            );

            if (stockUpdateResult.matchedCount === 0) {
                throw new Error(`Insufficient stock for product "${item.productName}" during final confirmation.`);
            }
        }

        await CartItem.deleteMany({ userId: order.user_id }).session(session);

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


const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({ path: 'user_id', select: 'name mobileNumber' })
            .populate('shipping_address_id')
            .sort({ order_date: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error('CRITICAL Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const getMyOrders = async (req, res) => {
    try {
        if (!req.userData || !req.userData.userId) {
            return res.status(401).json({ message: "Authentication error: User data is missing." });
        }
        const userId = req.userData.userId;
        const orders = await Order.find({ user_id: userId })
            .populate('shipping_address_id')
            .sort({ order_date: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error("CRITICAL Error in getMyOrders controller:", error);
        res.status(500).json({ message: "Internal server error while fetching user's orders." });
    }
};

const getOrderById = async (req, res) => {
    try {
        const { userId, orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid Order or User ID format.' });
        }

        const order = await Order.findOne({ _id: orderId, user_id: userId })
            .populate('shipping_address_id');

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Server error while fetching order status.' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'New status is required.' });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order status updated successfully.', order: updatedOrder });
    } catch (error) {
        console.error('CRITICAL ERROR during order status update:', error);
        res.status(500).json({ message: 'Server error while updating order status.' });
    }
};

const cancelOrderController = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId } = req.params;
        const { userId } = req.userData;

        const order = await Order.findOne({ _id: orderId, user_id: userId }).session(session);

        if (!order) {
            throw new Error('Order not found or you do not have permission to cancel it.');
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }

        order.status = 'Cancelled';
        order.payment_status = 'Refunded';
        await order.save({ session });

        const items = JSON.parse(order.items_details);
        for (const item of items) {
            await Stock.findOneAndUpdate(
                { productId: item.productId },
                { $inc: { quantity: item.quantity } },
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Order has been successfully cancelled.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: error.message || 'Failed to cancel order.' });
    }
};


module.exports = {
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrderController,
    createRazorpayOrderController,
    verifyRazorpayPaymentController
};
