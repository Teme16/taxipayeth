const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Driver = require('../models/Driver');

// REGISTER DRIVER & GENERATE STATIONARY QR CODE
router.post('/register', async (req, res) => {
    try {
        const { fullName, licenseNumber, targaNo, mobileNumber, payoutAccount } = req.body;

        // Create new driver document instance
        const newDriver = new Driver({
            fullName,
            licenseNumber,
            targaNo,
            mobileNumber,
            payoutAccount
        });

        // Construct the payload text embedded inside the QR code sticker
        // Pointing this directly to your passenger web payment flow
        const paymentPortalUrl = `https://taxipaycity.com/scan/${newDriver._id}`;
        
        // Generate a base64 DataURI string representation of the QR code
        const qrCodeBase64 = await QRCode.toDataURL(paymentPortalUrl);
        newDriver.qrCodeString = qrCodeBase64;

        await newDriver.save();

        return res.status(201).json({
            success: true,
            message: "Driver profile fully built and QR generated.",
            driver: {
                id: newDriver._id,
                fullName: newDriver.fullName,
                targaNo: newDriver.targaNo,
                qrCode: newDriver.qrCodeString // Ready to display or print directly from React browser
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;