const mongoose = require('mongoose');
const ChapaTransaction = require('./models/ChapaTransaction');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/taxipay');
    const count = await ChapaTransaction.countDocuments();
    console.log("Count:", count);
    if (count > 0) {
        const last = await ChapaTransaction.findOne().sort({ createdAt: -1 });
        console.log("Last:", last);
    }
    process.exit(0);
}
check();
