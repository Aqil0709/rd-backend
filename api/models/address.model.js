const mongoose = require('mongoose');

// --- Define the Address Schema ---
const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // References the User model
        ref: 'User', // The name of the User model
        required: true,
        index: true // Index for efficient lookups by userId
    },
    name: { // Name of the person receiving the package
        type: String,
        required: true,
        trim: true
    },
    mobile: { // Mobile number for delivery contact
        type: String,
        required: true,
        trim: true,
        match: [/^\d{10}$/, 'Please fill a valid 10-digit mobile number']
    },
    pincode: {
        type: String,
        required: true,
        trim: true
    },
    locality: { // Area or subdivision
        type: String,
        required: true,
        trim: true
    },
    address: { // Full address line (house no., building, street)
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    addressType: { // e.g., 'Home', 'Work', 'Other'
        type: String,
        enum: ['Home', 'Work', 'Other'],
        default: 'Home',
        required: true
    },
    isDefault: { // Optional: A flag for default address (you'd manage uniqueness in your logic)
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// --- Create and Export the Address Model ---
// The 'Address' string becomes the name of the collection in MongoDB (it will be pluralized to 'addresses').
const Address = mongoose.model('Address', addressSchema);
module.exports = Address;
