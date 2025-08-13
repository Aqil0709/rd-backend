const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// Import Mongoose Models
const Product = require('../models/product.model');
const Stock = require('../models/stock.model');

// --- Helper function to delete an image from Cloudinary ---
const deleteCloudinaryImage = async (imageUrl) => {
    if (!imageUrl) return;
    try {
        // Extract the public_id from the full URL
        const publicIdWithFolder = imageUrl.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicIdWithFolder);
        console.log(`Successfully deleted image from Cloudinary: ${publicIdWithFolder}`);
    } catch (error) {
        console.error(`Error deleting image from Cloudinary: ${imageUrl}`, error);
    }
};


// --- PUBLIC ---
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({})
            .populate({
                path: 'stockId',
                model: 'Stock',
                select: 'quantity'
            })
            .lean();

        const parsedProducts = products.map(p => ({
            ...p,
            id: p._id,
            price: parseFloat(p.price.toString()),
            originalPrice: p.originalPrice ? parseFloat(p.originalPrice.toString()) : null,
            quantity: p.stockId ? parseInt(p.stockId.quantity, 10) : 0,
            images: p.images || [],
            _id: undefined,
            __v: undefined,
            stockId: undefined
        }));

        console.log('Products data sent to frontend (ID, Name, Quantity):');
        parsedProducts.forEach(p => {
            console.log(`    ID: ${p.id}, Name: ${p.name}, Quantity: ${p.quantity}`);
        });

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
        const product = await Product.findById(productId)
            .populate({
                path: 'stockId',
                model: 'Stock',
                select: 'quantity'
            })
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const parsedProduct = {
            ...product,
            id: product._id,
            price: parseFloat(product.price.toString()),
            originalPrice: product.originalPrice ? parseFloat(product.originalPrice.toString()) : null,
            quantity: product.stockId ? parseInt(product.stockId.quantity, 10) : 0,
            images: product.images || [],
            imageUrl: (product.images && product.images.length > 0) ? product.images[0] : '',
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

// --- ADMIN ONLY ---
const addProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    let newProductDoc;
    let imageURLs = [];

    try {
        const { name, price, originalPrice, quantity, description, category } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Product images are required.' });
        }
        if (!name || !price || quantity === undefined || !description || !category) {
            // If validation fails, delete the already uploaded files from Cloudinary
            for (const file of req.files) {
                await deleteCloudinaryImage(file.path); // file.path is the URL from Cloudinary
            }
            return res.status(400).json({ message: 'Name, price, quantity, description, and category are required.' });
        }

        // Get the secure URLs from the Cloudinary upload response
        imageURLs = req.files.map(file => file.path);

        // 1. Create the new Product document
        newProductDoc = new Product({
            name,
            description,
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            images: imageURLs,
            category,
        });
        await newProductDoc.save({ session }); // Save product within the transaction

        // 2. Create the corresponding Stock document
        const newStockDoc = new Stock({
            productId: newProductDoc._id,
            productName: name,
            quantity: parseInt(quantity, 10)
        });
        await newStockDoc.save({ session }); // Save stock within the transaction

        // 3. Link the Stock ID back to the Product document
        newProductDoc.stockId = newStockDoc._id;
        await newProductDoc.save({ session }); // Update product within the transaction

        // Commit the transaction if all operations succeed
        await session.commitTransaction();
        session.endSession();

        const newProductResponse = {
            id: newProductDoc._id,
            name: newProductDoc.name,
            description: newProductDoc.description,
            price: parseFloat(newProductDoc.price.toString()),
            originalPrice: newProductDoc.originalPrice ? parseFloat(newProductDoc.originalPrice.toString()) : null,
            images: newProductDoc.images,
            imageUrl: newProductDoc.images[0] || '',
            category: newProductDoc.category,
            quantity: newStockDoc.quantity // Include the stored quantity in the response
        };

        res.status(201).json(newProductResponse);

    } catch (error) {
        // Abort transaction if any error occurs
        await session.abortTransaction();
        session.endSession();
        console.error('Add product error:', error);
        // Clean up uploaded files from Cloudinary if there's a database error
        for (const url of imageURLs) {
            await deleteCloudinaryImage(url).catch(console.error); // Add catch for delete
        }
        // No need to delete Product/Stock if transaction is aborted, as they won't be saved
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

const updateProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    let finalImageURLs = [];
    let oldImageURLs = []; // Define here to ensure it's accessible in catch block

    try {
        const { productId } = req.params;
        const { name, price, originalPrice, quantity, description, category, currentImageUrlsToRetain } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }

        const currentProduct = await Product.findById(productId).session(session); // Fetch within transaction
        if (!currentProduct) {
            throw new Error('Product not found for update.'); // Throw error to abort transaction
        }
        oldImageURLs = currentProduct.images || [];

        if (req.files && req.files.length > 0) {
            finalImageURLs = req.files.map(file => file.path);
            for (const url of oldImageURLs) {
                await deleteCloudinaryImage(url).catch(console.error);
            }
        } else if (currentImageUrlsToRetain) {
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            for (const url of urlsToDelete) {
                await deleteCloudinaryImage(url).catch(console.error);
            }
        } else {
            finalImageURLs = oldImageURLs;
        }

        if (finalImageURLs.length === 0) {
            throw new Error('At least one product image is required.');
        }

        // Update Product in DB
        await Product.updateOne(
            { _id: productId },
            {
                name,
                description,
                price: parseFloat(price),
                images: finalImageURLs,
                originalPrice: originalPrice ? parseFloat(originalPrice) : null,
                category
            },
            { session } // Update within the transaction
        );

        // Update Stock in DB
        await Stock.updateOne(
            { productId: productId },
            { quantity: parseInt(quantity, 10), productName: name },
            { session, upsert: true } // Update/create stock within the transaction
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        const updatedProductResponse = {
            id: productId,
            name,
            description,
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            images: finalImageURLs,
            imageUrl: finalImageURLs[0] || '',
            category,
            quantity: parseInt(quantity, 10)
        };

        res.status(200).json(updatedProductResponse);

    } catch (error) {
        // Abort transaction if any error occurs
        await session.abortTransaction();
        session.endSession();
        console.error('Update product error:', error);
        // Clean up newly uploaded Cloudinary files if DB update fails (and they weren't original)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await deleteCloudinaryImage(file.path).catch(console.error);
            }
        }
        res.status(500).json({ message: error.message || 'Server error while updating product.' });
    }
};

const deleteProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid Product ID format.' });
        }

        const productToDelete = await Product.findById(productId).session(session);
        if (!productToDelete) {
            throw new Error('Product not found.');
        }

        // Delete all associated images from Cloudinary
        if (productToDelete.images && productToDelete.images.length > 0) {
            for (const url of productToDelete.images) {
                await deleteCloudinaryImage(url).catch(console.error);
            }
        }

        // Delete from stock and product collections within transaction
        await Stock.deleteOne({ productId: productId }).session(session);
        await Product.deleteOne({ _id: productId }).session(session);

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Product deleted successfully.' });

    } catch (error) {
        // Abort transaction if any error occurs
        await session.abortTransaction();
        session.endSession();
        console.error('Delete product error:', error);
        res.status(500).json({ message: error.message || 'Server error while deleting product.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct
};
