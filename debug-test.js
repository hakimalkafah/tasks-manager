// Debug script to test Convex queries directly
const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://curious-deer-911.convex.cloud");

async function testQueries() {
  console.log("=== DEBUGGING CONVEX QUERIES ===");
  
  try {
    // Test 1: Check if organizations exist in database
    console.log("\n1. Testing if organizations exist...");
    const allOrgs = await client.query("organizations:getAll");
    console.log("All organizations:", allOrgs);
    
    // Test 2: Check if memberships exist
    console.log("\n2. Testing if memberships exist...");
    const allMemberships = await client.query("organizations:getAllMemberships");
    console.log("All memberships:", allMemberships);
    
    // Test 3: Test getUserOrganizations with specific user ID
    const testUserId = "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ";
    console.log(`\n3. Testing getUserOrganizations for user: ${testUserId}`);
    const userOrgs = await client.query("organizations:getUserOrganizations", { userId: testUserId });
    console.log("User organizations:", userOrgs);
    
    // Test 4: Check organizations by createdBy
    console.log(`\n4. Testing organizations created by user: ${testUserId}`);
    const createdOrgs = await client.query("organizations:getByCreatedBy", { userId: testUserId });
    console.log("Organizations created by user:", createdOrgs);
    
  } catch (error) {
    console.error("Error testing queries:", error);
  }
}

testQueries();
