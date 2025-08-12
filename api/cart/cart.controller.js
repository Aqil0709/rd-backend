const mongoose = require('mongoose'); // Added: Import Mongoose for ObjectId validation
const CartItem = require('../models/cartItem.model'); // Assuming your CartItem model is here
const Product = require('../models/product.model');    // Assuming your Product model is here
const User = require('../models/user.model');          // Assuming your User model is here (for userId reference)

// --- Helper function to fetch full cart details (including product images and originalPrice) ---
const fetchUserCartDetails = async (userId) => {
    try {
        // Find cart items for the given user and populate product details
        const cartItems = await CartItem.find({ userId: userId })
            .populate({
                path: 'productId', // Populate the 'productId' field
                model: 'Product',  // Specify the model to use for population
                select: 'name price originalPrice images description category' // Select specific fields from the Product
            })
            .lean(); // Use .lean() for plain JavaScript objects, faster for reads

        // Map and parse the data to match the desired output structure
        const parsedCartItems = cartItems.map(item => {
            // Check if product details were successfully populated
            if (!item.productId) {
                console.warn(`Product details not found for cart item ID: ${item._id}`);
                return null; // Or handle as an error
            }

            return {
                id: item._id, // Mongoose document ID for the cart item
                userId: item.userId,
                productId: item.productId._id, // Mongoose document ID for the product
                name: item.productId.name, // Get name from populated product
                price: parseFloat(item.productId.price.toString()), // Convert Decimal128 to float
                originalPrice: item.productId.originalPrice ? parseFloat(item.productId.originalPrice.toString()) : null, // Convert Decimal128 to float
                quantity: item.quantity,
                images: item.productId.images || [], // Images are already an array in Mongoose schema
                category: item.productId.category,
                description: item.productId.description
            };
        }).filter(item => item !== null); // Filter out any null items if product not found

        return parsedCartItems;
    } catch (error) {
        console.error('Error in fetchUserCartDetails:', error);
        throw new Error('Failed to fetch user cart details.');
    }
};

// --- Get User Cart ---
const getCart = async (req, res) => {
    const { userId } = req.params; // userId is now expected to be a MongoDB ObjectId string

    // Basic validation for userId
    if (!mongoose.Types.ObjectId.isValid(userId)) { // Requires mongoose import
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }

    try {
        const cartItems = await fetchUserCartDetails(userId);
        res.status(200).json(cartItems);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

// --- Add Product to Cart ---
const addToCart = async (req, res) => {
    const { userId } = req.params; // userId is now expected to be a MongoDB ObjectId string
    const { id: productId } = req.body; // productId is also expected to be a MongoDB ObjectId string

    // Basic validation for IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) { // Requires mongoose import
        return res.status(400).json({ message: 'Invalid User ID or Product ID format.' });
    }

    try {
        // Fetch product details from the products collection for security and consistency
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Find if the item already exists in the cart for this user
        let cartItem = await CartItem.findOne({ userId: userId, productId: productId });

        if (cartItem) {
            // If item exists, increment quantity
            cartItem.quantity += 1;
            await cartItem.save();
        } else {
            // If item does not exist, create a new cart item
            cartItem = new CartItem({
                userId: userId,
                productId: productId,
                name: product.name, // Use product name from DB
                price: product.price, // Use product price from DB
                quantity: 1
            });
            await cartItem.save();
        }

        // Fetch the updated cart to send back
        const updatedCart = await fetchUserCartDetails(userId);
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error while adding to cart.' });
    }
};

// --- Update Cart Item Quantity or Remove if Quantity is Zero ---
const updateCartItem = async (req, res) => {
    const { userId, productId: cartItemId } = req.params; // cartItemId is the _id of the cart item document
    const { quantity } = req.body;

    // Basic validation for IDs and quantity
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(cartItemId)) { // Requires mongoose import
        return res.status(400).json({ message: 'Invalid User ID or Cart Item ID format.' });
    }
    const numericQuantity = Number(quantity);
    if (isNaN(numericQuantity) || numericQuantity < 0) {
        return res.status(400).json({ message: 'Quantity must be a non-negative number.' });
    }

    try {
        if (numericQuantity === 0) {
            // If quantity is 0, remove the item from the cart
            const result = await CartItem.deleteOne({ _id: cartItemId, userId: userId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: 'Cart item not found or not belonging to user.' });
            }
        } else {
            // Update the quantity of the cart item
            const result = await CartItem.updateOne(
                { _id: cartItemId, userId: userId },
                { quantity: numericQuantity }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: 'Cart item not found or not belonging to user.' });
            }
            if (result.modifiedCount === 0) {
                // Item found, but quantity was already the same
                console.log('Cart item quantity already up-to-date.');
            }
        }

        // Fetch the updated cart to send back
        const updatedCart = await fetchUserCartDetails(userId);
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ message: 'Server error while updating cart item.' });
    }
};

// --- Remove Cart Item ---
const removeCartItem = async (req, res) => {
    const { userId, productId: cartItemId } = req.params; // cartItemId is the _id of the cart item document

    // Basic validation for IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(cartItemId)) { // Requires mongoose import
        return res.status(400).json({ message: 'Invalid User ID or Cart Item ID format.' });
    }

    try {
        // Delete the cart item by its _id and ensure it belongs to the user
        const result = await CartItem.deleteOne({ _id: cartItemId, userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Cart item not found or not belonging to user.' });
        }

        // Fetch the updated cart to send back
        const updatedCart = await fetchUserCartDetails(userId);
        res.status(200).json(updatedCart);

    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ message: 'Server error while removing cart item.' });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    fetchUserCartDetails
};
