const mongoose = require('mongoose');

// --- Define the CartItem Schema ---
const cartItemSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // References the User model
        ref: 'User', // The name of the User model
        required: true,
        index: true // Add an index for faster lookups by userId
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId, // References the Product model
        ref: 'Product', // The name of the Product model
        required: true,
        index: true // Add an index for faster lookups by productId
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity cannot be less than 1'], // Ensure quantity is at least 1
        default: 1
    },
    // Denormalized product details for quicker access and snapshotting current price/name
    // These fields capture the product's state at the time it was added to the cart
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: mongoose.Schema.Types.Decimal128, // Use Decimal128 for precise monetary values
        required: true
    }
}, {
    timestamps: true, // Automatically add createdAt and updatedAt fields
    // Ensure that a user can only have one entry for a given product in their cart
    // This creates a compound unique index
    unique: ['userId', 'productId']
});

// --- Create and Export the CartItem Model ---
// The 'CartItem' string becomes the name of the collection in MongoDB (it will be pluralized to 'cartitems').
const CartItem = mongoose.model('CartItem', cartItemSchema);
module.exports = CartItem;
