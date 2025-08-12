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
    // --- NEW DEBUGGING LOGS ---
    console.log("--- createRazorpayOrderController: Entered function ---");
    console.log("--- Request Body Received: ---", JSON.stringify(req.body, null, 2));
    // --- END DEBUGGING LOGS ---

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { deliveryAddressId, cart, amount } = req.body;
        const userId = req.userData.userId;

        if (!userId || !deliveryAddressId || !cart || cart.length === 0) {
            return res.status(400).json({ message: 'Missing required data for creating an order.' });
        }

        let totalAmount = 0;
        let itemsDetails = [];

        for (const item of cart) {
            // --- FIX: Check for both 'productId' and 'id' from the frontend cart item ---
            const productId = item.productId || item.id;
            if (!productId) {
                throw new Error('Cart item is missing a product ID.');
            }

            const stockItem = await Stock.findOne({ productId: productId }).populate('productId').session(session);
            if (!stockItem || stockItem.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product: ${stockItem?.productId?.name || 'Unknown Product'}`);
            }
            
            const price = stockItem.productId.price;
            totalAmount += price * item.quantity; 
            itemsDetails.push({
                productId: stockItem.productId._id,
                productName: stockItem.productId.name,
                quantity: item.quantity,
                price: price,
                image: item.images ? item.images[0] : (stockItem.productId.images ? stockItem.productId.images[0] : '')
            });
        }

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

        const razorpayOptions = {
            amount: totalAmount * 100,
            currency: "INR",
            receipt: savedOrder._id.toString(),
        };

        const razorpayOrder = await razorpay.orders.create(razorpayOptions);

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

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('--- ERROR in createRazorpayOrderController: ---', error);
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


// --- Get All Orders (For Admin) ---
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({ path: 'user_id', select: 'name mobileNumber' }) // Populate user's name and mobile
            .populate('shipping_address_id') // Populate the full address document
            .sort({ order_date: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error('CRITICAL Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

// --- Get Logged-in User's Orders ---
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

// --- Get a Single Order by ID ---
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

// --- Update Order Status (For Admin) ---
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
            { new: true } // Returns the updated document
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

// --- Cancel an Order ---
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

        // Allow cancellation only if the order is 'Pending' or 'Processing'
        if (!['Pending', 'Processing'].includes(order.status)) {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }

        order.status = 'Cancelled';
        order.payment_status = 'Refunded'; // Or 'Cancelled' depending on if payment was captured
        await order.save({ session });

        // Restore the stock for each item in the cancelled order
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
    // --- EXPORT THE NEW RAZORPAY CONTROLLERS ---
    createRazorpayOrderController,
    verifyRazorpayPaymentController
};
