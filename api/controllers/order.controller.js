// backend/api/controllers/order.controller.js
const db = require('../../config/db');
const { fetchUserCartDetails } = require('../cart/cart.controller');

const getAllOrders = async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.id, o.user_id, u.name AS customerName, o.total_amount AS totalAmount,
                   o.status, o.payment_status AS paymentStatus, o.order_date AS orderDate,
                   o.items_details AS itemsDetails,
                   a.name AS shippingName, a.mobile AS shippingMobile, a.pincode AS shippingPincode,
                   a.locality AS shippingLocality, a.address AS shippingAddress,
                   a.city AS shippingCity, a.state AS shippingState, a.address_type AS shippingAddressType
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN addresses a ON o.shipping_address_id = a.id
            ORDER BY o.order_date DESC
        `);

        const formattedOrders = orders.map(order => {
            let parsedItems = [];
            try {
                if (order.itemsDetails && typeof order.itemsDetails === 'string') {
                    parsedItems = JSON.parse(order.itemsDetails);
                }
            } catch (e) {
                console.error(`Could not parse items_details for order ${order.id}:`, e);
            }

            const finalOrder = {
                id: order.id,
                user_id: order.user_id,
                customerName: order.customerName,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: order.paymentStatus,
                orderDate: order.orderDate,
                items: parsedItems,
                shippingDetails: {
                    name: order.shippingName || '',
                    mobile: order.shippingMobile || '',
                    pincode: order.shippingPincode || '',
                    locality: order.shippingLocality || '',
                    address: order.shippingAddress || '',
                    city: order.shippingCity || '',
                    state: order.shippingState || '',
                    address_type: order.shippingAddressType || ''
                }
            };
            return finalOrder;
        });
        res.status(200).json(formattedOrders);
    } catch (error) {
        console.error('CRITICAL Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const createPendingUpiOrder = async (req, res) => {
    const { userId } = req.params;
    const { deliveryAddressId, transactionRef } = req.body;

    if (!userId || !deliveryAddressId || !transactionRef) {
        return res.status(400).json({ message: 'Missing user ID, address ID, or transaction reference.' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const cartItems = await fetchUserCartDetails(Number(userId));
        if (cartItems.length === 0) {
            throw new Error('Cannot place order with an empty cart.');
        }

        for (const item of cartItems) {
            const [stockResult] = await connection.query('SELECT quantity FROM stock WHERE product_id = ? FOR UPDATE', [item.product_id]);
            if (stockResult.length === 0 || stockResult[0].quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.name}".`);
            }
            await connection.query('UPDATE stock SET quantity = quantity - ? WHERE product_id = ?', [item.quantity, item.product_id]);
        }

        const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const itemsDetailsJson = JSON.stringify(cartItems.map(item => ({
            productId: item.product_id, productName: item.name, quantity: item.quantity, price: item.price, image: item.images?.[0]
        })));

        const orderSql = `INSERT INTO orders (user_id, total_amount, status, payment_status, transaction_ref, shipping_address_id, items_details, payment_method)
                                  VALUES (?, ?, 'Processing', 'Pending', ?, ?, ?, 'UPI')`;
        const orderValues = [
            Number(userId), totalAmount, transactionRef,
            deliveryAddressId,
            itemsDetailsJson
        ];

        const [orderResult] = await connection.query(orderSql, orderValues);
        const orderId = orderResult.insertId;

        await connection.query('DELETE FROM cart_items WHERE user_id = ?', [Number(userId)]);
        await connection.commit();

        res.status(201).json({
            message: 'Order initiated successfully. Please complete payment.',
            orderId: orderId,
            transactionRef: transactionRef,
            totalAmount: totalAmount
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating pending UPI order:', error);
        res.status(500).json({ message: error.message || 'Server error while initiating order.' });
    } finally {
        connection.release();
    }
};

const createCashOnDeliveryOrder = async (req, res) => {
    const { userId } = req.params;
    const { deliveryAddressId } = req.body;

    if (!userId || !deliveryAddressId) {
        return res.status(400).json({ message: 'Missing user ID or address ID for COD order.' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const cartItems = await fetchUserCartDetails(Number(userId));
        if (cartItems.length === 0) {
            throw new Error('Cannot place order with an empty cart.');
        }

        for (const item of cartItems) {
            const [stockResult] = await connection.query('SELECT quantity FROM stock WHERE product_id = ? FOR UPDATE', [item.product_id]);
            if (stockResult.length === 0 || stockResult[0].quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.name}".`);
            }
            await connection.query('UPDATE stock SET quantity = quantity - ? WHERE product_id = ?', [item.quantity, item.product_id]);
        }

        const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const itemsDetailsJson = JSON.stringify(cartItems.map(item => ({
            productId: item.product_id, productName: item.name, quantity: item.quantity, price: item.price, image: item.images?.[0]
        })));

        const orderSql = `INSERT INTO orders (user_id, total_amount, status, payment_status, shipping_address_id, items_details, payment_method)
                                  VALUES (?, ?, 'Processing', 'Pending (COD)', ?, ?, 'COD')`;
        const orderValues = [
            Number(userId), totalAmount, deliveryAddressId, itemsDetailsJson
        ];

        const [orderResult] = await connection.query(orderSql, orderValues);
        const orderId = orderResult.insertId;

        await connection.query('DELETE FROM cart_items WHERE user_id = ?', [Number(userId)]);
        await connection.commit();

        res.status(201).json({
            message: 'Cash on Delivery order placed successfully!',
            orderId: orderId,
            totalAmount: totalAmount,
            paymentMethod: 'COD'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating Cash on Delivery order:', error);
        res.status(500).json({ message: error.message || 'Server error while placing COD order.' });
    } finally {
        connection.release();
    }
};

const getOrderStatus = async (req, res) => {
    const { userId, orderId } = req.params;
    try {
        const [orders] = await db.query(`
            SELECT
                o.id, o.user_id, o.total_amount AS totalAmount, o.status,
                o.payment_status AS paymentStatus, o.order_date AS orderDate,
                o.items_details AS itemsDetails, o.payment_method AS paymentMethod,
                sa.name AS shippingName, sa.mobile AS shippingMobile, sa.pincode AS shippingPincode,
                sa.locality AS shippingLocality, sa.address AS shippingAddress,
                sa.city AS shippingCity, sa.state AS shippingState, sa.address_type AS shippingAddressType
            FROM orders o
            LEFT JOIN addresses sa ON o.shipping_address_id = sa.id
            WHERE o.id = ? AND o.user_id = ?
        `, [orderId, Number(userId)]);

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const order = orders[0];

        try {
            order.items = typeof order.itemsDetails === 'string' ? JSON.parse(order.itemsDetails) : order.itemsDetails;
        } catch (e) {
            order.items = [];
            console.error(`Error parsing items_details for order ${order.id}:`, e);
        }
        delete order.itemsDetails;

        order.shippingDetails = {
            name: order.shippingName, mobile: order.shippingMobile, pincode: order.shippingPincode,
            locality: order.shippingLocality, address: order.shippingAddress, city: order.shippingCity,
            state: order.shippingState, address_type: order.shippingAddressType
        };
        Object.keys(order.shippingDetails).forEach(key => delete order[`shipping${key.charAt(0).toUpperCase() + key.slice(1)}`]);
        delete order.shippingAddressType;

        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Server error while fetching order status.' });
    }
};

// --- THIS FUNCTION IS NOW CORRECTED ---
const getMyOrders = async (req, res) => {
    try {
        if (!req.userData || !req.userData.userId) {
            console.error("Authentication error in getMyOrders: User data not found in request token.");
            return res.status(401).json({ message: "Authentication error: User data is missing." });
        }

        const userId = req.userData.userId;

        // Use db.query() directly for simple queries
        const [orders] = await db.query(
            `SELECT
                o.id, o.user_id, o.total_amount AS total, o.status,
                o.payment_status AS paymentStatus, o.order_date AS orderDate,
                o.items_details AS itemsDetails, o.payment_method AS paymentMethod,
                sa.name AS shippingName, sa.mobile AS shippingMobile, sa.pincode AS shippingPincode,
                sa.locality AS shippingLocality, sa.address AS shippingAddress,
                sa.city AS shippingCity, sa.state AS shippingState, sa.address_type AS shippingAddressType
             FROM orders o
             LEFT JOIN addresses sa ON o.shipping_address_id = sa.id
             WHERE o.user_id = ?
             ORDER BY o.order_date DESC`,
            [userId]
        );

        const formattedOrders = orders.map(order => {
            let parsedItems = [];
            try {
                if (order.itemsDetails && typeof order.itemsDetails === 'string') {
                    parsedItems = JSON.parse(order.itemsDetails);
                }
            } catch (e) {
                console.error(`Could not parse items_details for order ${order.id}:`, e);
            }

            let currentStatus = order.status;
            if ((order.paymentStatus === 'Successful' || order.paymentStatus === 'Paid') && order.status.toLowerCase() === 'paid') {
                currentStatus = 'Processing';
            }

            const finalOrder = {
                id: order.id,
                user_id: order.user_id,
                total: order.total,
                status: currentStatus,
                paymentStatus: order.paymentStatus,
                orderDate: order.orderDate,
                paymentMethod: order.paymentMethod,
                items: parsedItems,
                shippingDetails: {
                    name: order.shippingName || '',
                    mobile: order.shippingMobile || '',
                    pincode: order.shippingPincode || '',
                    locality: order.shippingLocality || '',
                    address: order.shippingAddress || '',
                    city: order.shippingCity || '',
                    state: order.shippingState || '',
                    address_type: order.shippingAddressType || ''
                }
            };
            return finalOrder;
        });

        res.status(200).json(formattedOrders);
    } catch (error) {
        console.error("CRITICAL Error in getMyOrders controller:", error);
        res.status(500).json({ message: "Internal server error while fetching user's orders." });
    }
};

const updateOrderStatus = async (req, res) => {
    console.log('--- UPDATE ORDER STATUS CONTROLLER HIT ---');
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'New status is required.' });
    }

    try {
        const sql = 'UPDATE orders SET status = ? WHERE id = ?';
        const values = [status, orderId];
        
        console.log(`[DATABASE LOG] Executing query: ${sql}`);
        console.log('[DATABASE LOG] With values:', values);

        const [result] = await db.query(sql, values);
        
        console.log('[DATABASE LOG] Raw result from DB:', JSON.stringify(result, null, 2));
        
        if (result.affectedRows === 0) {
            console.log('[DATABASE LOG] Query ran, but no rows were affected. Order ID might not exist.');
            return res.status(404).json({ message: 'Order not found.' });
        }

        console.log(`[DATABASE LOG] Successfully updated ${result.affectedRows} row(s).`);
        res.status(200).json({ message: 'Order status updated successfully.' });

    } catch (error) {
        console.error('[DATABASE LOG] CRITICAL ERROR during update:', error);
        res.status(500).json({ message: 'Server error while updating order status.' });
    }
};

const cancelOrderController = async (req, res) => {
    const { orderId } = req.params;
    const { userId } = req.userData;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [orders] = await connection.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?', 
            [orderId, userId]
        );

        if (orders.length === 0) {
            throw new Error('Order not found or you do not have permission to cancel it.');
        }

        const order = orders[0];
        const orderDate = new Date(order.order_date);
        const now = new Date();
        const hoursDifference = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

        if (hoursDifference > 4) {
            throw new Error('The 4-hour cancellation window has passed.');
        }

        if (order.status === 'Cancelled' || order.status === 'Delivered') {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }

        await connection.query(
            "UPDATE orders SET status = 'Cancelled' WHERE id = ?", 
            [orderId]
        );

        const items = JSON.parse(order.items_details);
        for (const item of items) {
            await connection.query(
                'UPDATE stock SET quantity = quantity + ? WHERE product_id = ?',
                [item.quantity, item.productId]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Order has been successfully cancelled.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: error.message || 'Failed to cancel order.' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllOrders,
    createPendingUpiOrder,
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus
};
