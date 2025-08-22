// Test Convex React integration directly
const { ConvexHttpClient } = require("convex/browser");
const { ConvexReactClient } = require("convex/react");

console.log("=== TESTING CONVEX REACT CLIENT ===");

// Test HTTP client (what we used before)
const httpClient = new ConvexHttpClient("https://curious-deer-911.convex.cloud");

// Test React client (what the app uses)
const reactClient = new ConvexReactClient("https://curious-deer-911.convex.cloud");

async function testBothClients() {
  const testUserId = "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ";
  
  try {
    console.log("\n1. Testing HTTP Client (working):");
    const httpResult = await httpClient.query("organizations:getUserOrganizations", { userId: testUserId });
    console.log("HTTP Client result:", httpResult?.length || 0, "organizations");
    
    console.log("\n2. Testing React Client:");
    const reactResult = await reactClient.query("organizations:getUserOrganizations", { userId: testUserId });
    console.log("React Client result:", reactResult?.length || 0, "organizations");
    
    console.log("\n3. Comparing results:");
    console.log("HTTP === React:", JSON.stringify(httpResult) === JSON.stringify(reactResult));
    
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Full error:", error);
  }
}

testBothClients();
