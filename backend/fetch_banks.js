const axios = require('axios');

async function getBanks() {
    try {
        const response = await axios.get('https://api.chapa.co/v1/banks', {
            headers: {
                Authorization: `Bearer CHASECK_TEST-7832X8dig0MXDcVeCjcPPgGuqtVzcrc4`
            }
        });
        console.log(JSON.stringify(response.data.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}

getBanks();
