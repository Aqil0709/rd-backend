const mongoose = require('mongoose');

// --- Define the Stock Schema ---
const stockSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the Product model
        ref: 'Product', // The name of the Product model
        required: true,
        unique: true, // Each product should have only one stock entry
        index: true // Index for efficient lookups by productId
    },
    productName: { // Denormalized product name for easier reporting/debugging
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: [0, 'Stock quantity cannot be negative'],
        default: 0
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// --- Create and Export the Stock Model ---
// The 'Stock' string becomes the name of the collection in MongoDB (it will be pluralized to 'stocks').
const Stock = mongoose.model('Stock', stockSchema);
module.exports = Stock;
