// backend/server.js

// --- FIX: Load environment variables at the absolute top ---
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// --- Import the centralized DB connection function ---
const connectDB = require('./config/db'); 

// Import route handlers
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
const { paymentRouter, orderRouter } = require('./api/orders/order.router'); 
const stockRoutes = require('./api/stock/stock.routes');

const app = express();
const PORT = process.env.PORT || 5002;

// --- Initiate MongoDB Connection ---
connectDB();

// --- CORS Configuration ---
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];
const corsOptions = {
    origin: function (origin, callback) {
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

// --- API ROUTES ---
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/profile', profileRoutes);
app.use('/products', productRoutes);
app.use('/stock', stockRoutes);
app.use('/payment', paymentRouter);
app.use('/orders', orderRouter);


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
