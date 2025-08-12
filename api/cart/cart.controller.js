// backend/api/controllers/cart.controller.js

const mongoose = require('mongoose');
const CartItem = require('../models/cartItem.model'); // Corrected model import
const Product = require('../models/product.model');
const Stock = require('../models/stock.model');


// --- Helper function to fetch full cart details with product info ---
const getPopulatedCart = async (userId) => {
    try {
        const rawCartItems = await CartItem.find({ userId: userId }).lean();

        const populatedItems = await Promise.all(
            rawCartItems.map(async item => {
                const productDetails = await Product.findById(item.productId).lean();
                
                if (productDetails) {
                    return {
                        // Merge product details with cart item details
                        ...productDetails,
                        id: productDetails._id.toString(), // The product ID
                        cartItemId: item._id.toString(), // The ID of the cart item document
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

        // Find an existing cart item for this product and user
        let cartItem = await CartItem.findOne({ userId: userId, productId: id });

        if (cartItem) {
            // If item exists, increment quantity
            cartItem.quantity += 1;
            await cartItem.save();
        } else {
            // If item does not exist, create a new cart item
            cartItem = new CartItem({
                userId: userId,
                productId: id,
                quantity: 1,
                price: price,
                originalPrice: originalPrice,
                name: name,
                images: images
            });
            await cartItem.save();
        }

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

        const userCartItem = await CartItem.findOne({ userId, productId });
        if (!userCartItem) {
            return res.status(404).json({ message: 'Cart item not found.' });
        }

        userCartItem.quantity = quantity;
        await userCartItem.save();
        
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
        const result = await CartItem.deleteOne({ userId, productId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Cart item not found or not belonging to user.' });
        }
        
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
