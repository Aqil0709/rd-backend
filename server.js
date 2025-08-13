const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

// --- Mongoose Import and DB Connection Function ---
const mongoose = require('mongoose'); // Import Mongoose
const connectDB = require('./config/db'); // Import the centralized DB connection function

const path = require('path');

// Import route handlers
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
// --- UPDATED: Import both payment and order routers ---
const { paymentRouter, orderRouter } = require('./api/orders/order.router');
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


// --- CORS Configuration ---
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];

const corsOptions = {
    origin: function (origin, callback) {
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
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`[SERVER LOG] Request Received: ${req.method} ${req.originalUrl}`);
    next();
});


// --- API ROUTES ---
// ⭐ CRITICAL FIX: Add '/api' prefix to match frontend's API_BASE_URL
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);

// --- UPDATED: Mount payment and order routes separately ---
app.use('/api/payment', paymentRouter); // Also added /api here
app.use('/api/orders', orderRouter); // Also added /api here


// Static file serving
app.use('/public', express.static(path.join(__dirname, 'public')));

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});

// Global Error Handler
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
