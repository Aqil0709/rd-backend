const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Import jwt for token generation
const fetch = require('node-fetch'); // Import node-fetch for making HTTP requests

// Load environment variables if not already loaded in your main server file
// require('dotenv').config();

// Import the User model
const User = require('../models/user.model'); // Ensure this path points to your Mongoose User model

// Ensure your 2Factor API Key is in your .env file
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

// --- Helper function to check for API Key presence ---
const checkTwoFactorApiKey = () => {
    if (!TWOFACTOR_API_KEY) {
        console.error('TWOFACTOR_API_KEY is not defined in environment variables!');
        return false;
    }
    return true;
};

// --- Send OTP for Registration ---
const sendOtp = async (req, res) => {
    const { mobileNumber } = req.body;

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error: 2Factor API key missing.' });
    }

    if (!mobileNumber) {
        return res.status(400).json({ success: false, message: 'Mobile number is required to send OTP.' });
    }

    try {
        // For registration, check if user already exists using Mongoose's findOne
        const existingUser = await User.findOne({ mobileNumber });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User with this mobile number already exists.' });
        }

        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`;

        console.log(`Sending registration OTP to ${mobileNumber} via 2Factor...`);
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();
        console.log('2Factor Send OTP Response:', twoFactorData);

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, sessionId: twoFactorData.Details, message: 'OTP sent successfully!' });
        } else {
            console.error("2Factor Send OTP Error:", twoFactorData);
            res.status(500).json({ success: false, message: twoFactorData.Details || 'Failed to send OTP via 2Factor.' });
        }
    } catch (error) {
        console.error('Error in sendOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
    }
};

// --- Verify OTP (Used for both Registration and Password Reset) ---
const verifyOtp = async (req, res) => {
    const { mobileNumber, otp, sessionId } = req.body; // mobileNumber might not be strictly needed for 2Factor API, but useful for logging

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error: 2Factor API key missing.' });
    }

    if (!otp || !sessionId) {
        return res.status(400).json({ success: false, message: 'OTP and Session ID are required for verification.' });
    }

    try {
        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;

        console.log(`Verifying OTP for mobile number (if provided: ${mobileNumber}) with Session ID ${sessionId}...`);
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();
        console.log('2Factor Verify OTP Response:', twoFactorData);

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, message: 'OTP verified successfully!' });
        } else {
            console.error("2Factor Verify OTP Error:", twoFactorData);
            res.status(400).json({ success: false, message: twoFactorData.Details || 'Invalid OTP.' });
        }
    } catch (error) {
        console.error('Error in verifyOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while verifying OTP.' });
    }
};

// --- Send OTP for Password Reset ---
const sendResetOtp = async (req, res) => {
    const { mobileNumber } = req.body;

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error: 2Factor API key missing.' });
    }

    if (!mobileNumber) {
        return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    try {
        // For password reset, check if the user *exists* using Mongoose's findOne.
        const existingUser = await User.findOne({ mobileNumber });
        if (!existingUser) {
            return res.status(404).json({ success: false, message: 'User with this mobile number not found.' });
        }

        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`;

        console.log(`Sending password reset OTP to ${mobileNumber} via 2Factor...`);
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();
        console.log('2Factor Send OTP Response:', twoFactorData);

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, sessionId: twoFactorData.Details, message: 'Password reset OTP sent successfully!' });
        } else {
            console.error("2Factor Send Reset OTP Error:", twoFactorData);
            res.status(500).json({ success: false, message: twoFactorData.Details || 'Failed to send OTP.' });
        }
    } catch (error) {
        console.error('Error in sendResetOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while sending reset OTP.' });
    }
};

// --- Reset Password ---
const resetPassword = async (req, res) => {
    const { mobileNumber, newPassword, sessionId } = req.body;

    if (!mobileNumber || !newPassword || !sessionId) {
        return res.status(400).json({ success: false, message: 'Mobile number, new password, and session ID are required.' });
    }

    // The frontend should have already verified the OTP using the /verify-otp endpoint.
    // The sessionId here acts as a "ticket" to proceed. For higher security, you could
    // implement a one-time use token system.

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user's password using Mongoose's updateOne
        const result = await User.updateOne(
            { mobileNumber: mobileNumber },
            { password: hashedPassword }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        if (result.modifiedCount === 0) {
            // This case means the user was found, but the password was the same, or another issue prevented modification.
            return res.status(400).json({ success: false, message: 'Password could not be updated (might be the same as current).' });
        }

        res.status(200).json({ success: true, message: 'Password has been reset successfully.' });

    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset.' });
    }
};

const registerUser = async (req, res) => {
    const { mobileNumber, password, name } = req.body;

    if (!mobileNumber || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required.' });
    }

    try {
        // Check if user exists using Mongoose's findOne
        const existingUser = await User.findOne({ mobileNumber });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this mobile number already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userName = name || mobileNumber;
        // Create a new User document and save it using Mongoose
        const newUser = new User({
            name: userName,
            mobileNumber: mobileNumber,
            password: hashedPassword,
            role: 'user'
        });
        const savedUser = await newUser.save();

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined in environment variables!');
            return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
        }

        const token = jwt.sign(
            { userId: savedUser._id, role: savedUser.role }, // Use _id for Mongoose documents
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            id: savedUser._id, // Use _id for Mongoose documents
            name: savedUser.name,
            mobileNumber: savedUser.mobileNumber,
            role: savedUser.role,
            token: token,
            message: 'Registration successful.'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// Inside your loginUser function in auth.controller.js

const loginUser = async (req, res) => {
    const { mobileNumber, password } = req.body;

    console.log('--- LOGIN ATTEMPT ---');
    console.log('Received mobileNumber:', mobileNumber);
    console.log('Received password (do NOT log in production!):', password);

    if (!mobileNumber || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required.' });
    }

    try {
        const user = await User.findOne({ mobileNumber });
        console.log('User found in DB:', user ? user.mobileNumber : 'NONE');

        if (!user) {
            console.log('Login failed: User not found.');
            return res.status(401).json({ message: 'Invalid credentials. (User not found)' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password comparison result (isMatch):', isMatch);

        if (!isMatch) {
            console.log('Login failed: Password mismatch.');
            return res.status(401).json({ message: 'Invalid credentials. (Password mismatch)' });
        }

        console.log('Login successful for user:', user.mobileNumber);

        // --- THIS IS THE MISSING PART ---
        if (!process.env.JWT_SECRET) {
            console.error('FATAL ERROR: JWT_SECRET is not defined in .env file!');
            return res.status(500).json({ message: 'Server configuration error.' });
        }

        const payload = { userId: user._id, role: user.role };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );
        // --- END OF MISSING PART ---

        console.log('Backend sending 200 OK response with token.');
        res.status(200).json({
            id: user._id,
            name: user.name,
            mobileNumber: user.mobileNumber,
            role: user.role,
            token: token, // Now the 'token' variable exists
            message: 'Login successful.'
        });

    } catch (error) {
        console.error('Error during login process:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    sendOtp,
    verifyOtp,
    sendResetOtp,
    resetPassword
};
