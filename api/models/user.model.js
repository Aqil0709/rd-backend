const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Import bcryptjs for password hashing (pre-save hook)

// --- Define the User Schema ---
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true // Remove whitespace from both ends of a string
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true, // Ensures mobile numbers are unique in the collection
        trim: true,
        match: [/^\d{10}$/, 'Please fill a valid 10-digit mobile number'] // Basic 10-digit number validation
    },
    password: {
        type: String,
        required: true,
        minlength: [6, 'Password must be at least 6 characters long'] // Minimum password length
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Enforces that role can only be 'user' or 'admin'
        default: 'user' // Default role for new users
    },
    // You might want to add more fields like:
    // email: { type: String, unique: true, sparse: true, trim: true }, // 'sparse' allows nulls while maintaining unique constraint
    // profilePicture: { type: String, default: 'https://placehold.co/150x150/png?text=Profile' },
    // addresses: [
    //     {
    //         street: String,
    //         city: String,
    //         state: String,
    //         zipCode: String,
    //         country: String
    //     }
    // ],
}, {
    // Add timestamps for createdAt and updatedAt fields
    timestamps: true
});

// --- Pre-save hook to hash password before saving a new user or updating password ---
// This middleware runs before a document is saved to the database.
// 'this' refers to the document being saved.
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error); // Pass any error to the next middleware
    }
});

// --- Method to compare entered password with hashed password (for login) ---
// This method can be called directly on a user document (e.g., user.comparePassword(candidatePassword))
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(error);
    }
};

// --- Create and Export the User Model ---
// The 'User' string becomes the name of the collection in MongoDB (it will be pluralized to 'users').
const User = mongoose.model('User', userSchema);
module.exports = User;
