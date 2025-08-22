// Test if the issue is auth-related
const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://curious-deer-911.convex.cloud");

async function testAuthScenarios() {
  console.log("=== TESTING AUTH SCENARIOS ===");
  
  const testUserId = "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ";
  
  try {
    // Test 1: Query with auth disabled (current state)
    console.log("\n1. Testing getUserOrganizations (auth disabled):");
    const result1 = await client.query("organizations:getUserOrganizations", { userId: testUserId });
    console.log("Result:", result1?.length || 0, "organizations");
    
    // Test 2: Try with wrong user ID
    console.log("\n2. Testing with wrong user ID:");
    const result2 = await client.query("organizations:getUserOrganizations", { userId: "wrong_user_id" });
    console.log("Result:", result2?.length || 0, "organizations");
    
    // Test 3: Try with no user ID
    console.log("\n3. Testing with null user ID:");
    try {
      const result3 = await client.query("organizations:getUserOrganizations", { userId: null });
      console.log("Result:", result3?.length || 0, "organizations");
    } catch (error) {
      console.log("Error with null userId:", error.message);
    }
    
    // Test 4: Try with undefined user ID
    console.log("\n4. Testing with undefined user ID:");
    try {
      const result4 = await client.query("organizations:getUserOrganizations", { userId: undefined });
      console.log("Result:", result4?.length || 0, "organizations");
    } catch (error) {
      console.log("Error with undefined userId:", error.message);
    }
    
  } catch (error) {
    console.error("Error in auth tests:", error);
  }
}

testAuthScenarios();
