const mongoose = require('mongoose');
require('dotenv').config(); // Ensure environment variables are loaded

const connectDB = async () => {
    try {
        // Use the MONGO_URI directly from environment variables.
        // This expects the MONGO_URI to be the complete connection string,
        // e.g., "mongodb+srv://user:pass@cluster.mongodb.net/dbname?..."
        const uri = process.env.MONGO_URI;

        if (!uri) {
            console.error('MONGO_URI is not defined in environment variables! Cannot connect to MongoDB.');
            process.exit(1); // Exit if URI is missing
        }

        await mongoose.connect(uri);
        console.log('Successfully connected to MongoDB.'); // Changed message as it might be local or Atlas
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        // It's often good practice to exit the process if the DB connection fails at startup
        process.exit(1);
    }
};

module.exports = connectDB; // Export the function to connect to the database
