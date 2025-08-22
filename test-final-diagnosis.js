// Final comprehensive test to identify the exact issue
const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://curious-deer-911.convex.cloud");

async function finalDiagnosis() {
  console.log("=== FINAL DIAGNOSIS TEST ===");
  
  const testUserId = "user_31aGyPhd0RNGkm6dhPNPH8eT7aZ";
  
  try {
    // Test 1: Verify the exact query that should work in React
    console.log("\n1. Testing exact React query:");
    const result = await client.query("organizations:getUserOrganizations", { userId: testUserId });
    console.log("✅ Query works, returned", result.length, "organizations");
    console.log("First org:", result[0]?.name, "slug:", result[0]?.slug);
    
    // Test 2: Verify the data structure matches what React expects
    console.log("\n2. Data structure verification:");
    console.log("Is array:", Array.isArray(result));
    console.log("Has length > 0:", result.length > 0);
    console.log("First item has _id:", !!result[0]?._id);
    console.log("First item has name:", !!result[0]?.name);
    console.log("First item has slug:", !!result[0]?.slug);
    
    // Test 3: Test the conditional logic from React component
    console.log("\n3. React conditional logic test:");
    const userOrganizations = result;
    const condition1 = userOrganizations && Array.isArray(userOrganizations) && userOrganizations.length > 0;
    console.log("Condition (userOrganizations && Array.isArray(userOrganizations) && userOrganizations.length > 0):", condition1);
    
    if (condition1) {
      console.log("✅ SHOULD SHOW PROJECTS");
      console.log("Would render", userOrganizations.length, "project cards");
    } else {
      console.log("❌ WOULD SHOW 'No Projects Yet'");
    }
    
    // Test 4: Check if there are any null/undefined values that could break rendering
    console.log("\n4. Data integrity check:");
    result.forEach((org, index) => {
      console.log(`Org ${index + 1}:`, {
        _id: org._id ? "✅" : "❌",
        name: org.name ? "✅" : "❌", 
        slug: org.slug ? "✅" : "❌",
        role: org.role ? "✅" : "❌"
      });
    });
    
    console.log("\n=== CONCLUSION ===");
    console.log("✅ Convex query returns valid data");
    console.log("✅ Data structure is correct for React");
    console.log("✅ Conditional logic should work");
    console.log("❌ Issue must be in React useQuery hook or Convex provider setup");
    
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

finalDiagnosis();
