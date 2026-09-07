const mongoose = require('mongoose');

const chapaTransactionSchema = new mongoose.Schema(
    {
        tx_ref: { type: String, required: true, unique: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ChapaTransaction', chapaTransactionSchema);
