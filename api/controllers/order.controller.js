// backend/api/controllers/order.controller.js

// --- IMPORTANT: Import your Mongoose models ---
const Order = require('../models/order.model'); // Adjust path if necessary
const User = require('../models/user.model');   // Adjust path if necessary
const Address = require('../models/address.model'); // Adjust path if necessary
const Stock = require('../models/stock.model');   // Adjust path if necessary
const Cart = require('../models/cart.model');     // Adjust path if necessary
const mongoose = require('mongoose');

// --- Rewritten for Mongoose ---
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({ path: 'user_id', select: 'name' }) // Populate user's name
            .populate('shipping_address_id') // Populate the full address document
            .sort({ order_date: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error('CRITICAL Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

// --- Rewritten for Mongoose ---
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

// --- Rewritten for Mongoose ---
const createCashOnDeliveryOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const { deliveryAddressId } = req.body;

        if (!userId || !deliveryAddressId) {
            return res.status(400).json({ message: 'Missing user ID or address ID for COD order.' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            throw new Error('Cannot place order with an empty cart.');
        }

        let totalAmount = 0;
        let itemsDetails = [];

        for (const item of cart.items) {
            const stock = await Stock.findOne({ productId: item.productId._id }).session(session);
            if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.productId.name}".`);
            }
            stock.quantity -= item.quantity;
            await stock.save({ session });

            totalAmount += item.productId.price * item.quantity;
            itemsDetails.push({
                productId: item.productId._id,
                productName: item.productId.name,
                quantity: item.quantity,
                price: item.productId.price,
                image: item.productId.images?.[0]
            });
        }

        const newOrder = new Order({
            user_id: userId,
            total_amount: totalAmount,
            status: 'Processing',
            payment_status: 'Pending (COD)',
            shipping_address_id: deliveryAddressId,
            items_details: JSON.stringify(itemsDetails),
            payment_method: 'COD'
        });

        const savedOrder = await newOrder.save({ session });
        
        cart.items = [];
        await cart.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: 'Cash on Delivery order placed successfully!',
            order: savedOrder
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating Cash on Delivery order:', error);
        res.status(500).json({ message: error.message || 'Server error while placing COD order.' });
    }
};

// --- Rewritten for Mongoose ---
const createPendingUpiOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const { deliveryAddressId, transactionRef } = req.body;

        if (!userId || !deliveryAddressId || !transactionRef) {
            return res.status(400).json({ message: 'Missing user ID, address ID, or transaction reference.' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            throw new Error('Cannot place order with an empty cart.');
        }

        let totalAmount = 0;
        let itemsDetails = [];

        for (const item of cart.items) {
            const stock = await Stock.findOne({ productId: item.productId._id }).session(session);
            if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.productId.name}".`);
            }
            stock.quantity -= item.quantity;
            await stock.save({ session });

            totalAmount += item.productId.price * item.quantity;
            itemsDetails.push({
                productId: item.productId._id,
                productName: item.productId.name,
                quantity: item.quantity,
                price: item.productId.price,
                image: item.productId.images?.[0]
            });
        }

        const newOrder = new Order({
            user_id: userId,
            total_amount: totalAmount,
            status: 'Processing',
            payment_status: 'Pending',
            transaction_ref: transactionRef,
            shipping_address_id: deliveryAddressId,
            items_details: JSON.stringify(itemsDetails),
            payment_method: 'UPI'
        });

        const savedOrder = await newOrder.save({ session });
        
        cart.items = [];
        await cart.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: 'Order initiated successfully. Please complete payment.',
            orderId: savedOrder._id,
            transactionRef: transactionRef,
            totalAmount: totalAmount
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating pending UPI order:', error);
        res.status(500).json({ message: error.message || 'Server error while initiating order.' });
    }
};

// --- Rewritten for Mongoose ---
const getOrderStatus = async (req, res) => {
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

// --- Rewritten for Mongoose ---
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

// --- Rewritten for Mongoose ---
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

        const orderDate = new Date(order.order_date);
        const now = new Date();
        const hoursDifference = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

        if (hoursDifference > 4) {
            throw new Error('The 4-hour cancellation window has passed.');
        }

        if (['Cancelled', 'Delivered'].includes(order.status)) {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }

        order.status = 'Cancelled';
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
    createCashOnDeliveryOrder,
    createPendingUpiOrder,
    getOrderStatus,
    updateOrderStatus,
    cancelOrderController
};
