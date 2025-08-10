import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    errors: ['rate<0.05'],                           // Error rate under 5%
    success: ['rate>0.95'],                          // Success rate over 95%
  },
  ext: {
    loadimpact: {
      projectID: 'mangalm-sales-assistant',
      name: 'Load Test',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3007';
let authToken = null;

// Setup - run once per VU
export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username: 'admin',
    password: 'admin123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== null,
  });

  return { token: loginRes.json('token') };
}

// Main test scenarios
export default function (data) {
  authToken = data.token;

  // Scenario weights
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - Browse stores
    browseStores();
  } else if (scenario < 0.6) {
    // 30% - Generate predictions
    generatePredictions();
  } else if (scenario < 0.8) {
    // 20% - View dashboard
    viewDashboard();
  } else if (scenario < 0.95) {
    // 15% - Create orders
    createOrder();
  } else {
    // 5% - Heavy operations
    heavyOperations();
  }

  sleep(Math.random() * 3 + 1); // Random think time 1-4 seconds
}

// Test Scenarios
function browseStores() {
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // Get stores list
  const storesRes = http.get(`${BASE_URL}/api/stores`, params);
  
  const storesCheck = check(storesRes, {
    'stores list status 200': (r) => r.status === 200,
    'stores list has data': (r) => r.json('data') !== null,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!storesCheck);
  successRate.add(storesCheck);

  if (storesRes.status === 200 && storesRes.json('data').length > 0) {
    // Get random store details
    const stores = storesRes.json('data');
    const randomStore = stores[Math.floor(Math.random() * stores.length)];
    
    const storeDetailRes = http.get(`${BASE_URL}/api/stores/${randomStore.id}`, params);
    
    check(storeDetailRes, {
      'store detail status 200': (r) => r.status === 200,
      'store detail has data': (r) => r.json('data') !== null,
    });
  }
}

function generatePredictions() {
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // First get a store
  const storesRes = http.get(`${BASE_URL}/api/stores?limit=10`, params);
  
  if (storesRes.status === 200 && storesRes.json('data').length > 0) {
    const stores = storesRes.json('data');
    const randomStore = stores[Math.floor(Math.random() * stores.length)];
    
    // Generate prediction for the store
    const predictionRes = http.post(
      `${BASE_URL}/api/predictions/generate`,
      JSON.stringify({ storeId: randomStore.id }),
      params
    );
    
    const predictionCheck = check(predictionRes, {
      'prediction status 200': (r) => r.status === 200,
      'prediction has data': (r) => r.json('data') !== null,
      'prediction response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!predictionCheck);
    successRate.add(predictionCheck);
  }
}

function viewDashboard() {
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // Dashboard typically loads multiple endpoints
  const requests = [
    ['GET', `${BASE_URL}/api/dashboard/summary`],
    ['GET', `${BASE_URL}/api/dashboard/metrics`],
    ['GET', `${BASE_URL}/api/stores?limit=5`],
    ['GET', `${BASE_URL}/api/predictions/recent`],
  ];

  requests.forEach(([method, url]) => {
    const res = http.request(method, url, null, params);
    
    const dashboardCheck = check(res, {
      'dashboard endpoint status 200': (r) => r.status === 200,
      'dashboard response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!dashboardCheck);
    successRate.add(dashboardCheck);
  });
}

function createOrder() {
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // Get stores and products first
  const storesRes = http.get(`${BASE_URL}/api/stores?limit=10`, params);
  const productsRes = http.get(`${BASE_URL}/api/products?limit=20`, params);
  
  if (storesRes.status === 200 && productsRes.status === 200) {
    const stores = storesRes.json('data');
    const products = productsRes.json('data');
    
    if (stores.length > 0 && products.length > 0) {
      const randomStore = stores[Math.floor(Math.random() * stores.length)];
      
      // Create order items
      const numItems = Math.floor(Math.random() * 5) + 1;
      const orderItems = [];
      
      for (let i = 0; i < numItems; i++) {
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        orderItems.push({
          productId: randomProduct.id,
          quantity: Math.floor(Math.random() * 10) + 1,
          price: randomProduct.price,
        });
      }
      
      // Create order
      const orderRes = http.post(
        `${BASE_URL}/api/orders`,
        JSON.stringify({
          storeId: randomStore.id,
          items: orderItems,
          orderDate: new Date().toISOString(),
        }),
        params
      );
      
      const orderCheck = check(orderRes, {
        'order creation status 201': (r) => r.status === 201 || r.status === 200,
        'order has ID': (r) => r.json('data.id') !== null,
        'order creation time < 1500ms': (r) => r.timings.duration < 1500,
      });

      errorRate.add(!orderCheck);
      successRate.add(orderCheck);
    }
  }
}

function heavyOperations() {
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  // Batch prediction (heavy operation)
  const storesRes = http.get(`${BASE_URL}/api/stores?limit=20`, params);
  
  if (storesRes.status === 200) {
    const stores = storesRes.json('data');
    const storeIds = stores.map(s => s.id).slice(0, 10);
    
    const batchRes = http.post(
      `${BASE_URL}/api/predictions/batch`,
      JSON.stringify({ storeIds }),
      params
    );
    
    const batchCheck = check(batchRes, {
      'batch prediction status 200': (r) => r.status === 200,
      'batch prediction has results': (r) => r.json('data') !== null,
      'batch prediction time < 5000ms': (r) => r.timings.duration < 5000,
    });

    errorRate.add(!batchCheck);
    successRate.add(batchCheck);
  }

  // Export data (heavy operation)
  const exportRes = http.get(
    `${BASE_URL}/api/export/orders?format=csv&startDate=2024-01-01&endDate=2024-12-31`,
    params
  );
  
  check(exportRes, {
    'export status 200': (r) => r.status === 200,
    'export time < 10000ms': (r) => r.timings.duration < 10000,
  });
}

// Teardown - run once after all iterations
export function teardown(data) {
  // Logout
  http.post(`${BASE_URL}/auth/logout`, null, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
}