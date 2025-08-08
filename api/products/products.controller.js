const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose'); // Import mongoose for ObjectId validation

// Import Mongoose Models
const Product = require('../models/product.model');
const Stock = require('../models/stock.model');

// Helper function to extract filename from URL
const getFilenameFromUrl = (url) => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        return path.basename(pathname);
    } catch (error) {
        console.warn('Invalid URL provided to getFilenameFromUrl:', url, error);
        return null;
    }
};

// Helper function to delete a file from the uploads directory
const deleteFile = (filename) => {
    if (!filename) return;

    // Adjust path based on your project structure:
    // Assuming this file is in backend/api/controllers,
    // and public/uploads is in backend/public/uploads
    const filePath = path.join(__dirname, '../../public/uploads', filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`File not found, could not delete: ${filePath}`);
            } else {
                console.error(`Error deleting file ${filePath}:`, err);
            }
        } else {
            console.log(`Successfully deleted file: ${filePath}`);
        }
    });
};

// --- PUBLIC ---
const getAllProducts = async (req, res) => {
    try {
        // Find all products and populate their stock quantity
        const products = await Product.find({})
            .populate({
                path: 'stockId', // Assuming you've added a 'stockId' reference to Product schema
                model: 'Stock',
                select: 'quantity' // Select only the quantity from the Stock document
            })
            .lean(); // Return plain JavaScript objects for faster reads

        const parsedProducts = products.map(p => ({
            ...p,
            id: p._id, // Use Mongoose _id as 'id' for consistency with frontend
            price: parseFloat(p.price.toString()), // Convert Decimal128 to float
            originalPrice: p.originalPrice ? parseFloat(p.originalPrice.toString()) : null, // Convert Decimal128
            // If stockId is populated, get quantity from it, otherwise default to 0
            quantity: p.stockId ? parseInt(p.stockId.quantity, 10) : 0,
            images: p.images || [], // Images are already an array
            // Remove the Mongoose-specific _id and __v from the top level if desired
            _id: undefined,
            __v: undefined,
            stockId: undefined // Remove the populated stockId object
        }));

        // DIAGNOSTIC LOG: Check the quantity before sending to frontend
        console.log('Products data sent to frontend (ID, Name, Quantity):');
        parsedProducts.forEach(p => {
            console.log(`     ID: ${p.id}, Name: ${p.name}, Quantity: ${p.quantity}`);
        });
        // END DIAGNOSTIC LOG

        res.status(200).json(parsedProducts);
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ message: 'Server error while fetching products.' });
    }
};

const getProductById = async (req, res) => {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        // Find product by ID and populate its stock quantity
        const product = await Product.findById(productId)
            .populate({
                path: 'stockId', // Assuming you've added a 'stockId' reference to Product schema
                model: 'Stock',
                select: 'quantity'
            })
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const parsedProduct = {
            ...product,
            id: product._id, // Use Mongoose _id as 'id' for frontend
            price: parseFloat(product.price.toString()), // Convert Decimal128 to float
            originalPrice: product.originalPrice ? parseFloat(product.originalPrice.toString()) : null, // Convert Decimal128
            quantity: product.stockId ? parseInt(product.stockId.quantity, 10) : 0,
            images: product.images || [],
            imageUrl: (product.images && product.images.length > 0) ? product.images[0] : '', // For frontend convenience
            // Remove Mongoose-specific fields
            _id: undefined,
            __v: undefined,
            stockId: undefined
        };

        res.status(200).json(parsedProduct);
    } catch (error) {
        console.error('Get product by ID error:', error);
        res.status(500).json({ message: 'Server error while fetching product by ID.' });
    }
};

const addProduct = async (req, res) => {
    const { name, price, originalPrice, quantity, description, category } = req.body; // Added description and category

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }
    // Validate required fields explicitly
    if (!name || !price || !quantity || !description || !category) {
        // Clean up uploaded files if validation fails
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        return res.status(400).json({ message: 'Name, price, quantity, description, and category are required.' });
    }

    const imageURLs = req.files.map(file =>
        `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`
    );

    let newProductDoc; // To store the newly created product document

    try {
        // Create new Product document
        newProductDoc = new Product({
            name,
            description, // Added
            price: parseFloat(price), // Mongoose will handle conversion to Decimal128 if schema type is set
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            images: imageURLs,
            category, // Added
            stock: 0 // Set initial stock to 0 in Product model, managed in Stock model
        });
        await newProductDoc.save();

        // Create new Stock document, linking it to the new product's _id
        const newStockDoc = new Stock({
            productId: newProductDoc._id, // Link to the newly created product
            productName: name, // Store product name in stock for convenience
            quantity: parseInt(quantity, 10)
        });
        await newStockDoc.save();

        // Update the Product document with the stockId reference
        newProductDoc.stockId = newStockDoc._id;
        await newProductDoc.save();


        const newProductResponse = {
            id: newProductDoc._id,
            name: newProductDoc.name,
            description: newProductDoc.description, // Added
            price: parseFloat(newProductDoc.price.toString()),
            originalPrice: newProductDoc.originalPrice ? parseFloat(newProductDoc.originalPrice.toString()) : null,
            images: newProductDoc.images,
            imageUrl: newProductDoc.images[0] || '',
            category: newProductDoc.category, // Added
            quantity: newStockDoc.quantity // Get quantity from the newly created stock
        };

        res.status(201).json(newProductResponse);

    } catch (error) {
        console.error('Add product error:', error);
        // If product or stock insertion fails, attempt to clean up:
        // 1. Delete uploaded files
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        // 2. If product was inserted but stock failed, delete the product entry
        if (newProductDoc && newProductDoc._id) {
            console.warn(`Attempting to clean up product ID ${newProductDoc._id} due to stock insert error.`);
            await Product.deleteOne({ _id: newProductDoc._id }).catch(console.error);
            // Also attempt to delete the stock entry if it was partially created
            await Stock.deleteOne({ productId: newProductDoc._id }).catch(console.error);
        }
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

// --- ADMIN ONLY ---
const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const { name, price, originalPrice, quantity, description, category, currentImageUrlsToRetain } = req.body; // Added description and category

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    let finalImageURLs = [];
    let oldImageURLs = []; // To store image URLs from DB before update for deletion

    try {
        // Fetch current product data to get existing image URLs
        const currentProduct = await Product.findById(productId);
        if (!currentProduct) {
            return res.status(404).json({ message: 'Product not found for update.' });
        }
        oldImageURLs = currentProduct.images || [];

        // Case 1: New files are uploaded
        if (req.files && req.files.length > 0) {
            finalImageURLs = req.files.map(file =>
                `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`
            );
            // Delete old images from the server's file system that are not being retained
            oldImageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        }
        // Case 2: No new files, but client sent currentImageUrlsToRetain (meaning existing images are to be kept)
        else if (currentImageUrlsToRetain) {
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;

            // Identify which old images are NOT retained and delete them
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            urlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));

        } else { // Case 3: No new files and no retention list - implicitly keep all old images
            finalImageURLs = oldImageURLs;
        }

        // Validate that at least one image exists after all logic
        if (finalImageURLs.length === 0) {
            return res.status(400).json({ message: 'At least one product image is required.' });
        }

        // Update products collection
        const productUpdateResult = await Product.updateOne(
            { _id: productId },
            {
                name: name,
                description: description, // Added
                price: parseFloat(price),
                images: finalImageURLs,
                originalPrice: originalPrice ? parseFloat(originalPrice) : null,
                category: category // Added
            }
        );

        // Update stock collection for quantity AND product_name
        const stockUpdateResult = await Stock.updateOne(
            { productId: productId }, // Link stock by productId
            { quantity: parseInt(quantity, 10), productName: name }
        );

        if (productUpdateResult.matchedCount === 0 && stockUpdateResult.matchedCount === 0) {
            return res.status(404).json({ message: 'Product or stock entry not found for update.' });
        }

        const updatedProductResponse = {
            id: productId,
            name: name,
            description: description, // Added
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            images: finalImageURLs,
            imageUrl: finalImageURLs[0] || '',
            category: category, // Added
            quantity: parseInt(quantity, 10)
        };

        res.status(200).json(updatedProductResponse);

    } catch (error) {
        console.error('Update product error:', error);
        // Optional: Clean up newly uploaded files if DB update fails
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        res.status(500).json({ message: 'Server error while updating product.' });
    }
};

const deleteProduct = async (req, res) => {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    try {
        // Get the image URLs to delete the files from storage before deleting the product
        const productToDelete = await Product.findById(productId);
        if (productToDelete && productToDelete.images && productToDelete.images.length > 0) {
            productToDelete.images.forEach(url => deleteFile(getFilenameFromUrl(url)));
        }

        // Delete from stock collection first
        const stockDeleteResult = await Stock.deleteOne({ productId: productId });
        if (stockDeleteResult.deletedCount === 0) {
            console.warn(`No stock entry found for product ID ${productId} during deletion.`);
        }

        // Then, delete the product from the products collection
        const productDeleteResult = await Product.deleteOne({ _id: productId });

        if (productDeleteResult.deletedCount === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({ message: 'Product deleted successfully.' });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error while deleting product.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct
};
