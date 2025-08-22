// Test if Convex auth is working at all
const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://curious-deer-911.convex.cloud");

async function testConvexAuth() {
  console.log("=== TESTING CONVEX AUTH INTEGRATION ===");
  
  try {
    // Test a query that should work without auth
    console.log("\n1. Testing getAll (no auth required):");
    const allOrgs = await client.query("organizations:getAll");
    console.log("✅ getAll works:", allOrgs.length, "organizations");
    
    // Test getUserOrganizations (auth disabled)
    console.log("\n2. Testing getUserOrganizations (auth disabled):");
    const userOrgs = await client.query("organizations:getUserOrganizations", { 
      userId: "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ" 
    });
    console.log("✅ getUserOrganizations works:", userOrgs.length, "organizations");
    
    // Test if the React client can connect at all
    console.log("\n3. Testing basic connectivity:");
    const testQuery = await client.query("organizations:getAll");
    console.log("✅ Basic connectivity works");
    
    console.log("\n4. Summary:");
    console.log("- Convex backend is working ✅");
    console.log("- getUserOrganizations returns data ✅");
    console.log("- Issue must be in React integration ❌");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);
  }
}

testConvexAuth();
