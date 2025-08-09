// backend/api/models/order.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    // Link to the User who placed the order
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User', // This must match the name you used when creating your User model
        required: true
    },
    // Link to the Address for shipping
    shipping_address_id: {
        type: Schema.Types.ObjectId,
        ref: 'Address', // This must match the name you used for your Address model
        required: true
    },
    // Total cost of the order
    total_amount: {
        type: Number,
        required: true
    },
    // The current status of the order (e.g., Processing, Shipped, Delivered)
    status: {
        type: String,
        required: true,
        default: 'Processing',
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Paid', 'Failed'] // Defines allowed values
    },
    // The payment status of the order
    payment_status: {
        type: String,
        required: true,
        default: 'Pending'
    },
    // The payment method used
    payment_method: {
        type: String,
        required: true,
        enum: ['COD', 'UPI'] // Cash on Delivery or UPI
    },
    // A JSON string containing details of the items in the order
    items_details: {
        type: String, // Storing as a JSON string
        required: true
    },
    // The date the order was placed
    order_date: {
        type: Date,
        default: Date.now
    },
    // Optional field for UPI transaction reference
    transaction_ref: {
        type: String,
        default: null
    }
}, {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
