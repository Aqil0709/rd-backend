const mongoose = require('mongoose'); // Import mongoose for ObjectId validation

// Import Mongoose Models
const Product = require('../models/product.model'); // For checking product existence
const Stock = require('../models/stock.model');

// Function to get all stock levels
const getAllStock = async (req, res) => {
    try {
        // Fetch all stock data
        // Using .lean() for faster reads as we're just transforming the data
        const stock = await Stock.find({}).lean();

        // Map the stock data to a cleaner format if necessary,
        // though Mongoose's .lean() already gives plain objects.
        const parsedStock = stock.map(s => ({
            id: s._id, // Mongoose document ID
            productId: s.productId, // Reference to Product's _id
            productName: s.productName,
            quantity: s.quantity,
            last_updated: s.updatedAt // Mongoose automatically provides updatedAt
        }));

        res.status(200).json(parsedStock);
    } catch (error) {
        console.error('Error fetching all stock:', error);
        res.status(500).json({ message: 'Server error while fetching stock.' });
    }
};

// Function to add new stock for a product
const addStock = async (req, res) => {
    // --- DEBUG LOGS START ---
    console.log("Backend: addStock received request body:", req.body);
    // --- DEBUG LOGS END ---

    const { productId, productName, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    if (!productId || !productName || quantity === undefined || quantity < 0) {
        // --- DEBUG LOGS START ---
        console.log("Backend: addStock validation failed.");
        console.log("   productId:", productId, " (Type:", typeof productId, ")");
        console.log("   productName:", productName, " (Type:", typeof productName, ")");
        console.log("   quantity:", quantity, " (Type:", typeof quantity, ")");
        // --- DEBUG LOGS END ---
        return res.status(400).json({ message: 'Product ID, product name, and a valid quantity are required.' });
    }

    try {
        // First, check if the product_id actually exists in the products table
        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(400).json({ message: 'Product ID does not exist in the products collection. Please add the product first.' });
        }

        // Check if a stock entry for this product already exists
        const existingStock = await Stock.findOne({ productId: productId });

        if (existingStock) {
            // If stock already exists, it's an update operation, not an add.
            return res.status(409).json({ message: 'Stock for this product already exists. Use PUT to update it.' });
        }

        // If stock entry doesn't exist, create it
        const newStock = new Stock({
            productId: productId,
            productName: productName,
            quantity: parseInt(quantity, 10)
        });
        await newStock.save();
        res.status(201).json({ message: 'Stock added successfully!', stock: newStock.toObject() });

    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ message: 'Server error while adding stock.' });
    }
};


// Function to update stock for a specific product
const updateProductStock = async (req, res) => {
    const { productId } = req.params; // From URL parameter
    const { quantity, productName } = req.body; // productName is now optional for updates

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'Invalid quantity provided. Quantity must be a non-negative number.' });
    }

    try {
        // Build update fields dynamically
        const updateFields = { quantity: parseInt(quantity, 10) };
        if (productName !== undefined) {
            updateFields.productName = productName;
        }

        // Find and update the stock entry
        const result = await Stock.updateOne(
            { productId: productId },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            // If stock entry doesn't exist, it's an add operation, not an update.
            return res.status(404).json({ message: 'Stock for this product not found. Use POST to add new stock.' });
        }
        if (result.modifiedCount === 0) {
            return res.status(200).json({ message: 'Stock updated successfully (no changes made).' });
        }

        res.status(200).json({ message: 'Stock updated successfully.' });

    } catch (error) {
        console.error('Error updating product stock:', error);
        res.status(500).json({ message: 'Server error while updating stock.' });
    }
};

module.exports = {
    getAllStock,
    addStock,
    updateProductStock
};
