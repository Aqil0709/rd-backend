const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

// --- Mongoose Import and DB Connection Function ---
const mongoose = require('mongoose'); // Import Mongoose
const connectDB = require('./config/db'); // Import the centralized DB connection function

const path = require('path');

// Import route handlers (keep imports, but they are not used yet below)
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
const orderRoutes = require('./api/orders/order.router');
const stockRoutes = require('./api/stock/stock.routes');

const app = express();
const PORT = process.env.PORT || 5002;

// --- Initiate MongoDB Connection ---
connectDB();

mongoose.connection.on('connected', () => {
    console.log('Mongoose default connection open.');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose default connection error: ❌', err);
    process.exit(1);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose default connection disconnected');
});

process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});
// --- End MongoDB Connection Configuration ---


// --- CORS Configuration (Crucial for preflight requests) ---
// --- CORS Configuration (Crucial for preflight requests) ---
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];

const corsOptions = {
    origin: function (origin, callback) {
        // THIS IS THE DEBUGGING LINE TO ADD
        console.log('--- INCOMING REQUEST ORIGIN:', origin, '---');

        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
// Apply CORS middleware. This should be one of the *very first* middleware.
app.use(cors(corsOptions));

// Explicitly handle OPTIONS requests for all routes.
// This ensures that the preflight requests get the necessary CORS headers
// even if other middleware were to interfere later.
app.options('*', cors(corsOptions)); // This line needs to be UNCOMMENTED


// --- MIDDLEWARE ---
// These standard middleware are now confirmed as okay
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your custom logger is now confirmed as okay
app.use((req, res, next) => {
    console.log(`[SERVER LOG] Request Received: ${req.method} ${req.originalUrl}`);
    next();
});


// --- API ROUTES ---
// UNCOMMENT ONLY THE AUTH ROUTES FOR THIS TEST
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/profile', profileRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/stock', stockRoutes);

// Static file serving is now confirmed as okay
app.use('/public', express.static(path.join(__dirname, 'public')));

// 404 handler is now confirmed as okay
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});

// Global Error Handler is now confirmed as okay
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong on the server!', error: err.message });
});


// --- SERVER START ---
mongoose.connection.once('open', () => {
    app.listen(PORT, () => {
        console.log(`Backend server is running on port ${PORT}`);
    });
});
