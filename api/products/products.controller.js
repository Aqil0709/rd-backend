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
            console.log(`     ID: ${p.id}, Name: ${p.name}, Quantity: ${p.quantity}`);
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
    const { name, price, originalPrice, quantity, description, category } = req.body;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }
    if (!name || !price || !quantity || !description || !category) {
        // If validation fails, delete the already uploaded files from Cloudinary
        for (const file of req.files) {
            await deleteCloudinaryImage(file.path); // file.path is the URL from Cloudinary
        }
        return res.status(400).json({ message: 'Name, price, quantity, description, and category are required.' });
    }

    // Get the secure URLs from the Cloudinary upload response
    const imageURLs = req.files.map(file => file.path);

    let newProductDoc;

    try {
        newProductDoc = new Product({
            name,
            description,
            price: parseFloat(price),
            originalPrice: originalPrice ? parseFloat(originalPrice) : null,
            images: imageURLs,
            category,
        });
        await newProductDoc.save();

        const newStockDoc = new Stock({
            productId: newProductDoc._id,
            productName: name,
            quantity: parseInt(quantity, 10)
        });
        await newStockDoc.save();

        newProductDoc.stockId = newStockDoc._id;
        await newProductDoc.save();

        const newProductResponse = {
            id: newProductDoc._id,
            name: newProductDoc.name,
            description: newProductDoc.description,
            price: parseFloat(newProductDoc.price.toString()),
            originalPrice: newProductDoc.originalPrice ? parseFloat(newProductDoc.originalPrice.toString()) : null,
            images: newProductDoc.images,
            imageUrl: newProductDoc.images[0] || '',
            category: newProductDoc.category,
            quantity: newStockDoc.quantity
        };

        res.status(201).json(newProductResponse);

    } catch (error) {
        console.error('Add product error:', error);
        // Clean up uploaded files from Cloudinary if there's a database error
        for (const url of imageURLs) {
            await deleteCloudinaryImage(url);
        }
        if (newProductDoc && newProductDoc._id) {
            await Product.deleteOne({ _id: newProductDoc._id }).catch(console.error);
            await Stock.deleteOne({ productId: newProductDoc._id }).catch(console.error);
        }
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const { name, price, originalPrice, quantity, description, category, currentImageUrlsToRetain } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }

    let finalImageURLs = [];

    try {
        const currentProduct = await Product.findById(productId);
        if (!currentProduct) {
            return res.status(404).json({ message: 'Product not found for update.' });
        }
        const oldImageURLs = currentProduct.images || [];

        if (req.files && req.files.length > 0) {
            // New files were uploaded, they replace the old ones
            finalImageURLs = req.files.map(file => file.path);
            // Delete all old images from Cloudinary
            for (const url of oldImageURLs) {
                await deleteCloudinaryImage(url);
            }
        } else if (currentImageUrlsToRetain) {
            // No new files, but a list of old URLs to keep was sent
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;
            // Delete only the URLs that are not in the retained list
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            for (const url of urlsToDelete) {
                await deleteCloudinaryImage(url);
            }
        } else {
            // No new files and no retention list, keep the old images
            finalImageURLs = oldImageURLs;
        }

        if (finalImageURLs.length === 0) {
            return res.status(400).json({ message: 'At least one product image is required.' });
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
            }
        );

        // Update Stock in DB
        await Stock.updateOne(
            { productId: productId },
            { quantity: parseInt(quantity, 10), productName: name }
        );

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
        console.error('Update product error:', error);
        // If the DB update fails, clean up any newly uploaded Cloudinary files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await deleteCloudinaryImage(file.path);
            }
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
        const productToDelete = await Product.findById(productId);
        if (!productToDelete) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Delete all associated images from Cloudinary
        if (productToDelete.images && productToDelete.images.length > 0) {
            for (const url of productToDelete.images) {
                await deleteCloudinaryImage(url);
            }
        }

        // Delete from stock and product collections
        await Stock.deleteOne({ productId: productId });
        await Product.deleteOne({ _id: productId });

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
