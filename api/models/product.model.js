const mongoose = require('mongoose');

// --- Define the Product Schema ---
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true // Product names should ideally be unique
    },
    description: { // Added based on controller usage
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: mongoose.Schema.Types.Decimal128, // Use Decimal128 for precise monetary values
        required: true,
        min: [0, 'Price cannot be negative']
    },
    originalPrice: { // Optional: for sale items
        type: mongoose.Schema.Types.Decimal128,
        min: [0, 'Original price cannot be negative']
    },
    images: [
        {
            type: String, // Storing image URLs from Cloudinary
            trim: true
        }
    ],
    category: { // Added based on controller usage
        type: String,
        required: true,
        trim: true,
        index: true // Add an index for faster category-based lookups
    },
    stock: { // This field will still exist on the Product model
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    stockId: { // Added: Reference to the separate Stock model for quantity
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock', // Refers to the 'Stock' Mongoose model
        // This is not 'required' initially because product and stock are created in two steps.
        // It will be set after the Stock document is created and linked.
        // You might want to add a validation later to ensure it's always set.
    },
    // You might want to add other fields like:
    // brand: { type: String, trim: true },
    // ratings: { type: Number, min: 0, max: 5, default: 0 },
    // numReviews: { type: Number, default: 0 },
    // reviews: [
    //     {
    //         userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    //         rating: Number,
    //         comment: String,
    //         createdAt: { type: Date, default: Date.now }
    //     }
    // ]
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// --- Create and Export the Product Model ---
// The 'Product' string becomes the name of the collection in MongoDB (it will be pluralized to 'products').
const Product = mongoose.model('Product', productSchema);
module.exports = Product;
