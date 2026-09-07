const axios = require('axios');
const { nanoid } = require('nanoid');

const key = "CHASECK_TEST-7832X8dig0MXDcVeCjcPPgGuqtVzcrc4";

async function testChapa() {
    try {
        const payload = {
            amount: 100,
            currency: "ETB",
            email: "passenger@taxipay.com",
            first_name: "TaxiPay",
            last_name: "User",
            tx_ref: `TXP-${nanoid(10)}`,
            return_url: `http://localhost:5173/payment-success`,
            customization: {
                title: "TaxiPay Wallet",
                description: "Wallet Top-up"
            }
        };
        const response = await axios.post("https://api.chapa.co/v1/transaction/initialize", payload, {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("SUCCESS:");
        console.log(response.data);
    } catch (e) {
        console.log("ERROR:");
        console.log(e.response ? e.response.data : e.message);
    }
}
testChapa();
