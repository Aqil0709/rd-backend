// backend/api/controllers/cart.controller.js

const mongoose = require('mongoose');
const Cart = require('../models/cart.model'); // This is the main Cart model that holds an array of items
const Product = require('../models/product.model');
const Stock = require('../models/stock.model');


// --- Helper function to fetch full cart details with product info ---
const getPopulatedCart = async (userId) => {
    try {
        const userCart = await Cart.findOne({ userId });

        if (!userCart) {
            return [];
        }

        const populatedItems = await Promise.all(
            userCart.items.map(async item => {
                const productDetails = await Product.findById(item.productId).lean();
                
                if (productDetails) {
                    return {
                        // Merge product details with cart item details
                        ...productDetails,
                        id: productDetails._id.toString(),
                        quantity: item.quantity,
                        originalPrice: item.originalPrice || productDetails.price,
                        price: item.price || productDetails.price,
                        images: productDetails.images || [],
                    };
                }
                console.warn(`Product details not found for cart item ID: ${item.productId}`);
                return null; // Return null for invalid items
            })
        );

        // Filter out any null entries
        return populatedItems.filter(item => item !== null);
        
    } catch (error) {
        console.error('Error in getPopulatedCart:', error);
        return [];
    }
};

// --- Controller to get a user's cart ---
const getCartItems = async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID.' });
        }

        const populatedCart = await getPopulatedCart(userId);
        res.status(200).json(populatedCart);
    } catch (error) {
        console.error("Error getting cart items:", error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

// --- Controller to add a product to the cart ---
const addToCart = async (req, res) => {
    try {
        const userId = req.params.userId;
        const { id, name, price, originalPrice, images } = req.body;
        const quantity = 1;

        let userCart = await Cart.findOne({ userId });

        if (!userCart) {
            userCart = new Cart({ userId, items: [] });
        }

        const existingItemIndex = userCart.items.findIndex(item => item.productId.toString() === id);

        if (existingItemIndex !== -1) {
            userCart.items[existingItemIndex].quantity += 1;
        } else {
            userCart.items.push({ productId: id, quantity, price, originalPrice, name, images });
        }

        await userCart.save();

        const updatedCartItems = await getPopulatedCart(userId);
        res.status(200).json(updatedCartItems);

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ message: 'Server error while adding to cart.' });
    }
};

// --- Controller to update cart item quantity ---
const updateCartItemQuantity = async (req, res) => {
    try {
        const { userId, productId } = req.params;
        const { quantity } = req.body;

        const userCart = await Cart.findOne({ userId });
        if (!userCart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const item = userCart.items.find(i => i.productId.toString() === productId);
        if (!item) {
            return res.status(404).json({ message: 'Product not found in cart.' });
        }

        item.quantity = quantity;
        await userCart.save();
        
        const updatedCartItems = await getPopulatedCart(userId);
        res.status(200).json(updatedCartItems);
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ message: 'Server error while updating cart quantity.' });
    }
};

// --- Controller to remove a product from the cart ---
const removeFromCart = async (req, res) => {
    try {
        const { userId, productId } = req.params;
        const userCart = await Cart.findOne({ userId });

        if (!userCart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        userCart.items = userCart.items.filter(item => item.productId.toString() !== productId);
        await userCart.save();
        
        const updatedCartItems = await getPopulatedCart(userId);
        res.status(200).json(updatedCartItems);
    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({ message: 'Server error while removing from cart.' });
    }
};


module.exports = {
    getCartItems,
    addToCart,
    updateCartItemQuantity,
    removeFromCart
};
