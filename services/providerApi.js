const axios = require('axios');

/**
 * Generic SMM API Wrapper
 */
class ProviderAPI {
    constructor(provider) {
        this.apiUrl = provider.apiUrl;
        this.apiKey = provider.apiKey;
    }

    async sendRequest(params) {
        try {
            const data = new URLSearchParams({ key: this.apiKey, ...params }).toString();
            const config = {
                method: 'post',
                url: this.apiUrl,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: data
            };
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error('Provider API Error:', error.message);
            throw error;
        }
    }

    async placeOrder(serviceId, link, quantity) {
        return this.sendRequest({ action: 'add', service: serviceId, link, quantity });
    }

    async getOrderStatus(providerOrderId) {
        return this.sendRequest({ action: 'status', order: providerOrderId });
    }

    async getMultiStatus(providerOrderIdsArray) {
        return this.sendRequest({ action: 'status', orders: providerOrderIdsArray.join(',') });
    }

    async getBalance() {
        return this.sendRequest({ action: 'balance' });
    }

    async getServices() {
        return this.sendRequest({ action: 'services' });
    }
}

module.exports = ProviderAPI;