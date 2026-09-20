const axios = require('axios');
const { nanoid } = require('nanoid');
const ChapaTransaction = require('../models/ChapaTransaction');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const CHAPA_URL = "https://api.chapa.co/v1/transaction/initialize";
const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify/";

// 1. Initialize Payment
exports.initializePayment = async (req, res) => {
    try {
        const { amount, email, firstName, lastName } = req.body;
        
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userId = req.user._id;

        // Generate a unique transaction reference
        const tx_ref = `TXP-${nanoid(10)}`;

        // Create pending transaction in DB
        await ChapaTransaction.create({
            tx_ref,
            user: userId,
            amount,
            status: 'pending'
        });

        // Where Chapa redirects the user after successful payment
        const clientUrl = req.headers.origin || 'https://taxipayeth.onrender.com';

        const payload = {
            amount: amount,
            currency: "ETB",
            email: email || "passenger@taxipay.com",
            first_name: firstName || "TaxiPay",
            last_name: lastName || "User",
            tx_ref: tx_ref,
            return_url: `${clientUrl}/?tx_ref=${tx_ref}`,
            customization: {
                title: "TaxiPay Wallet",
                description: "Wallet Top-up"
            }
        };

        const response = await axios.post(CHAPA_URL, payload, {
            headers: {
                Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                "Content-Type": "application/json"
            }
        });

        // Send the Chapa checkout URL back to the frontend
        if (response.data.status === "success") {
            return res.status(200).json({
                success: true,
                checkout_url: response.data.data.checkout_url
            });
        }
        
        return res.status(400).json({ success: false, message: "Payment initialization failed" });

    } catch (error) {
        console.error('Chapa init error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Server error initializing Chapa" });
    }
};

// 2. Verify Payment
exports.verifyPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;

        // 1. Check our DB for this tx_ref
        const chapaTx = await ChapaTransaction.findOne({ tx_ref });
        if (!chapaTx) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (chapaTx.status === 'success') {
            return res.status(200).json({ success: true, message: "Already processed" });
        }

        // Call Chapa to verify the exact status of the transaction
        const response = await axios.get(`${CHAPA_VERIFY_URL}${tx_ref}`, {
            headers: {
                Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });

        if (response.data.status === "success" && response.data.data.status === "success") {
            // PAYMENT SUCCESSFUL!
            const amountPaid = response.data.data.amount;

            // Increment user balance
            await User.findByIdAndUpdate(
                chapaTx.user,
                { $inc: { balance: amountPaid } }
            );

            // Update Chapa Transaction record
            chapaTx.status = 'success';
            await chapaTx.save();

            // Optionally create a general Transaction log
            await Transaction.create({
                user: chapaTx.user,
                driver: chapaTx.user, // Self-deposit
                amount: amountPaid,
                type: 'deposit',
                status: 'completed',
                transactionId: tx_ref,
                idempotencyKey: `chapa-${tx_ref}`,
                passengerSnapshot: {
                    name: 'TaxiPay Wallet Top-Up',
                    phone: '+251000000000'
                },
                seats: [0], // Meaningless for deposit but required by schema
                completedAt: new Date()
            });
            
            return res.status(200).json({
                success: true,
                message: "Payment verified successfully",
                data: response.data.data
            });
        }

        // If not successful, mark as failed
        chapaTx.status = 'failed';
        await chapaTx.save();
        return res.status(400).json({ success: false, message: "Payment not completed or failed." });

    } catch (error) {
        console.error('Chapa verify error:', error.response?.data || error.message);
        
        // If the error came from Chapa (e.g. 404 Transaction Not Found for unpaid transactions)
        if (error.response && error.response.status >= 400) {
            try {
                await ChapaTransaction.findOneAndUpdate(
                    { tx_ref: req.params.tx_ref },
                    { status: 'failed' }
                );
            } catch (dbErr) {
                console.error('Failed to update ChapaTransaction status:', dbErr);
            }
            // Return 200 so the frontend can display the failed state gracefully
            return res.status(200).json({ 
                success: false, 
                message: error.response?.data?.message || "Payment was not completed or failed." 
            });
        }

        return res.status(500).json({ success: false, message: "Server error verifying Chapa payment" });
    }
};

// 3. Withdraw / Payout
exports.withdraw = async (req, res) => {
    try {
        const { amount, account_name, account_number, bank_code } = req.body;
        
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userId = req.user._id;

        if (!amount || !account_name || !account_number || !bank_code) {
            return res.status(400).json({ success: false, message: 'Missing required withdrawal details' });
        }

        // 1. Check User Balance
        const user = await User.findById(userId);
        if (!user || user.balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // 2. Initialize Chapa Transfer
        const tx_ref = `WTH-${nanoid(10)}`;

        const payload = {
            account_name,
            account_number,
            amount,
            currency: "ETB",
            reference: tx_ref,
            bank_code
        };

        const response = await axios.post('https://api.chapa.co/v1/transfers', payload, {
            headers: {
                Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (response.data.status === "success") {
            // Deduct balance
            user.balance -= amount;
            await user.save();

            // Create Transaction record
            await Transaction.create({
                user: userId,
                driver: userId, // self
                amount,
                type: 'payout',
                status: 'completed',
                transactionId: tx_ref,
                idempotencyKey: `chapa-wth-${tx_ref}`,
                seats: [1],
                passengerSnapshot: {
                    name: user.name || 'Wallet Withdraw',
                    phone: user.phone || '+251900000000'
                },
                completedAt: new Date()
            });

            return res.status(200).json({
                success: true,
                message: "Withdrawal successful",
                user,
                data: response.data.data
            });
        }

        return res.status(400).json({ success: false, message: "Withdrawal failed via Chapa" });

    } catch (error) {
        console.error('Chapa withdraw error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: error.response?.data?.message || error.message || "Server error processing withdrawal" });
    }
};

// 4. Get Banks List
exports.getBanks = async (req, res) => {
    try {
        const response = await axios.get('https://api.chapa.co/v1/banks', {
            headers: {
                Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });
        return res.status(200).json(response.data);
    } catch (error) {
        console.error('Chapa banks error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch banks" });
    }
};
