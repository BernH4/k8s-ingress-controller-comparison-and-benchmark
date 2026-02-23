import http from 'k6/http';

// CONFIGURATION
const BASE_URL = __ENV.TARGET_URL || 'http://web-app.localhost:8000';
const TARGET_RATE = __ENV.RATE ? parseInt(__ENV.RATE) : 5000;
const NUM_APPS = __ENV.NUM_APPS ? parseInt(__ENV.NUM_APPS) : 10;

export const options = {
  discardResponseBodies: true,
  insecureSkipTLSVerify: true,
  scenarios: {
    stress_test: {
      executor: 'constant-arrival-rate',
      
      rate: TARGET_RATE,
      duration: '5m',
      
      timeUnit: '1s',
      
      preAllocatedVUs: 1000, 
      maxVUs: 10000, 
    },
  },
};

export default function () {
  // 1. Generate a random integer between 1 and NUM_APPS
  const appId = Math.floor(Math.random() * NUM_APPS) + 1;

  const params = {
    headers: { 'Host': 'www.example.com' },
  };

  http.get(`${BASE_URL}/web-app-${appId}`, params);
}
