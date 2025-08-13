// dataConsistencyScript.js

// --- 1. Import Mongoose and your models ---
const mongoose = require('mongoose');
// Adjusted paths assuming this script is in the 'backend' directory
const Product = require('./api/models/product.model');
const Stock = require('./api/models/stock.model');

// --- 2. Configure your MongoDB connection string ---
// Replace with your actual MongoDB URI
const mongoURI = "mongodb+srv://aqil:P8QpVCoZkuRA4pRY@cluster0.lmaka.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// --- 3. Define the main function to check and fix stock ---
async function ensureAllProductStock() {
    try {
        console.log('Connecting to MongoDB...');
        // The useNewUrlParser and useUnifiedTopology options are deprecated and can be removed
        await mongoose.connect(mongoURI, {
            // useNewUrlParser: true, // Removed: no longer needed in Mongoose 6.x+
            // useUnifiedTopology: true, // Removed: no longer needed in Mongoose 6.x+
        });
        console.log('MongoDB connected successfully.');

        // Removed transaction-related code as it requires a replica set
        // let session;
        // session = await mongoose.startSession();
        // session.startTransaction();
        // console.log('Transaction started.'); // This log will no longer appear

        // Fetch all products
        const products = await Product.find({}); // Removed .session(session)
        console.log(`Found ${products.length} products.`);

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            // Check if a stock entry exists for this product
            let stockEntry = await Stock.findOne({ productId: product._id }); // Removed .session(session)

            if (!stockEntry) {
                // If no stock entry, create one
                stockEntry = new Stock({
                    productId: product._id,
                    productName: product.name,
                    quantity: 50, // Default quantity: you can set any reasonable default
                });
                await stockEntry.save(); // Removed { session }
                // Link the stock ID back to the product (important for `populate('stockId')` to work)
                product.stockId = stockEntry._id;
                await product.save(); // Removed { session }
                createdCount++;
                console.log(`  ➕ Created stock for product: ${product.name} (ID: ${product._id}) with quantity ${stockEntry.quantity}`);
            } else {
                // Optional: Update stock quantity if it's too low or if productName needs fixing
                if (stockEntry.quantity === 0 || stockEntry.productName !== product.name) {
                    stockEntry.quantity = Math.max(stockEntry.quantity, 50); // Ensure at least 50
                    stockEntry.productName = product.name; // Keep name consistent
                    await stockEntry.save(); // Removed { session }
                    updatedCount++;
                    console.log(`  🔄 Updated stock for product: ${product.name} (ID: ${product._id}) to quantity ${stockEntry.quantity}`);
                } else {
                    skippedCount++;
                    // console.log(`  ✅ Stock already exists and is sufficient for: ${product.name}`);
                }
            }
        }

        // Removed transaction commit
        // await session.commitTransaction();
        console.log('Data consistency check completed successfully (without transactions).');
        console.log(`\n--- Stock Consistency Report ---`);
        console.log(`New stock entries created: ${createdCount}`);
        console.log(`Existing stock entries updated: ${updatedCount}`);
        console.log(`Stock entries already consistent: ${skippedCount}`);
        console.log(`----------------------------------`);

    } catch (error) {
        // Removed transaction abort
        // if (session) {
        //     await session.abortTransaction();
        //     console.error('Transaction aborted due to error.');
        // }
        console.error('Error during stock consistency check:', error);
        process.exit(1); // Exit with an error code
    } finally {
        // Removed session end
        // if (session) {
        //     session.endSession();
        // }
        await mongoose.disconnect();
        console.log('MongoDB connection closed.');
    }
}

// --- 4. Run the script ---
ensureAllProductStock();
