// Test minimal React component to isolate the issue
const React = require('react');
const { ConvexProvider, ConvexReactClient } = require('convex/react');

// Simulate the exact setup from your app
const client = new ConvexReactClient("https://curious-deer-911.convex.cloud");

console.log("=== TESTING REACT INTEGRATION ===");

// Test if ConvexReactClient can be created
console.log("1. ConvexReactClient created:", !!client);

// Test if the client has the expected methods
console.log("2. Client has query method:", typeof client.query === 'function');

// Test the client configuration
console.log("3. Client URL:", client._url || 'unknown');

// Check if WebSocket is available (this might be the issue)
console.log("4. WebSocket available:", typeof WebSocket !== 'undefined');
console.log("5. Global WebSocket:", typeof global.WebSocket !== 'undefined');

// Try to simulate the React hook behavior
try {
  console.log("6. Attempting direct query...");
  // This should fail in Node.js but will show us the error
  client.query("organizations:getUserOrganizations", { userId: "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ" })
    .then(result => console.log("Direct query result:", result))
    .catch(error => console.log("Expected error in Node.js:", error.message));
} catch (error) {
  console.log("Expected sync error:", error.message);
}

console.log("\n=== DIAGNOSIS ===");
console.log("The issue is likely that ConvexReactClient requires WebSocket in browser environment.");
console.log("In your React app, check if ConvexProviderWithClerk is properly wrapping the component.");
console.log("Also check if there are any console errors about WebSocket or authentication.");
