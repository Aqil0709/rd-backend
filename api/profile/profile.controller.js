const mongoose = require('mongoose'); // Import mongoose for ObjectId validation

// Import Mongoose Models
const User = require('../models/user.model');
const Address = require('../models/address.model');

// --- User Profile ---
const updateUserProfile = async (req, res) => {
    const { userId } = req.params; // userId is now expected to be a MongoDB ObjectId string
    const { name, mobileNumber } = req.body;

    // Build update fields dynamically
    const updateFields = {};

    // Crucial security check to ensure users can only update their own profile
    // Compare req.userData.userId (from JWT payload) with the userId from params
    // Both should be MongoDB ObjectIds or converted to strings for comparison.
    if (!req.userData || req.userData.userId.toString() !== userId) {
        console.error("Security check failed in updateUserProfile. req.userData:", req.userData, "userId from params:", userId);
        return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    // Add name to update if provided
    if (name !== undefined) { // Use undefined to allow empty string as a valid update
        updateFields.name = name;
    }

    // Add mobileNumber to update if provided
    if (mobileNumber !== undefined) {
        // Check for mobile number uniqueness (excluding the current user)
        try {
            const existingUserWithMobile = await User.findOne({ 
                mobileNumber: mobileNumber, 
                _id: { $ne: userId } // Exclude the current user by their _id
            });
            if (existingUserWithMobile) {
                return res.status(409).json({ message: 'This mobile number is already registered by another user.' });
            }
        } catch (error) {
            console.error('Database error checking mobile number uniqueness:', error);
            return res.status(500).json({ message: 'Server error during mobile number uniqueness check.' });
        }

        updateFields.mobileNumber = mobileNumber;
    }

    // If no fields are provided for update
    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ message: 'No fields provided for profile update.' });
    }

    try {
        // Find and update the user profile
        const result = await User.updateOne(
            { _id: userId },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (result.modifiedCount === 0) {
            return res.status(200).json({ message: 'Profile updated successfully (no changes made).' });
        }

        // Fetch the updated user data to send back to the frontend
        // Select specific fields to return
        const updatedUser = await User.findById(userId).select('name mobileNumber role').lean();

        res.status(200).json({
            message: 'Profile updated successfully!',
            id: updatedUser._id,
            name: updatedUser.name,
            mobileNumber: updatedUser.mobileNumber,
            role: updatedUser.role
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
};

// --- User Addresses ---
const getUserAddresses = async (req, res) => {
    const { userId } = req.params; // userId is now expected to be a MongoDB ObjectId string

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    try {
        // FIXED: Added security check to prevent unauthorized access to addresses
        if (!req.userData || req.userData.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own addresses.' });
        }

        const addresses = await Address.find({ userId: userId }).lean(); // Find addresses by userId
        res.status(200).json(addresses);

    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ message: 'Server error while fetching addresses.' });
    }
};

const addUserAddress = async (req, res) => {
    const { userId } = req.params; // userId is now expected to be a MongoDB ObjectId string
    const { name, mobile, pincode, locality, address, city, state, addressType } = req.body; // Changed address_type to addressType for consistency with Mongoose schema

    // Validation for required fields
    if (!name || !mobile || !pincode || !locality || !address || !city || !state || !addressType) {
        return res.status(400).json({ message: `All address fields are required.` });
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    try {
        // FIXED: Added security check to prevent adding addresses to other users' profiles
        if (!req.userData || req.userData.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only add an address to your own profile.' });
        }

        // Create a new Address document
        const newAddressDoc = new Address({
            userId: userId,
            name,
            mobile,
            pincode,
            locality,
            address,
            city,
            state,
            addressType // Use addressType
        });

        await newAddressDoc.save(); // Save the new address to the database

        res.status(201).json({
            message: 'Address added successfully!',
            address: newAddressDoc.toObject() // Convert Mongoose document to plain object for response
        });

    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ message: 'Server error while adding address.' });
    }
};

module.exports = {
    updateUserProfile,
    getUserAddresses,
    addUserAddress
};
