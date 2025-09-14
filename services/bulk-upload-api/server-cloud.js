// Cloud Run compatible version of the bulk upload server
// This wrapper handles Redis dependency for Cloud Run deployment

const originalServer = './server-enterprise-v2.js';

// Mock Redis client for Cloud Run (when DISABLE_REDIS=true)
if (process.env.DISABLE_REDIS === 'true') {
    console.log('[Cloud Run] Redis disabled - using in-memory mock');

    // Create a mock Redis module
    const mockRedis = {
        createClient: () => ({
            connect: async () => console.log('[Mock Redis] Connected'),
            disconnect: async () => console.log('[Mock Redis] Disconnected'),
            get: async (key) => null,
            set: async (key, value) => 'OK',
            del: async (key) => 1,
            exists: async (key) => 0,
            expire: async (key, seconds) => 1,
            on: (event, handler) => {},
            quit: async () => {}
        })
    };

    // Create a mock Bull module (queue processing)
    const mockBull = function(name, options) {
        return {
            add: async (data) => ({ id: Math.random().toString(36) }),
            process: (handler) => {},
            on: (event, handler) => {},
            close: async () => {},
            empty: async () => {},
            clean: async () => {}
        };
    };

    // Override the require cache before loading the server
    require.cache[require.resolve('redis')] = {
        exports: mockRedis
    };
    require.cache[require.resolve('bull')] = {
        exports: mockBull
    };
}

// Load and start the original server
require(originalServer);