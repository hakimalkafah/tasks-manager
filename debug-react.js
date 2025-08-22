// Test React component logic
const testData = [
  {
    _creationTime: 1755808629983.1233,
    _id: 'jd724rb2n1p88wz24aynfc03b17p391b',
    clerkOrgId: 'org_31c1cqvgbwDSpnH6irS0j0Krw04',
    createdAt: 1755808629987,
    createdBy: 'user_31aGyPhd0RNGkm6dhPNPH8eT7aZ',
    imageUrl: 'https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zMWFHbFc4NmwycDcyTGVJOVVzdmhkTzMzVHgiLCJyaWQiOiJvcmdfMzFjMWNxdmdid0RTcG5INmlyUzBqMEtydzA0IiwiaW5pdGlhbHMiOiJRIn0',
    joinedAt: 1755808629987,
    name: 'Qamaria',
    role: 'admin',
    slug: 'qamaria',
    updatedAt: 1755808629987
  },
  {
    _creationTime: 1755813016506.7393,
    _id: 'jd7e3shm9q20azfm5w1qxm8jrh7p2tpn',
    clerkOrgId: 'org_31c95axwde3Nl2HuYgsIuDvtDAE',
    createdAt: 1755813016510,
    createdBy: 'user_31aGyPhd0RNGkm6dhPNPH8eT7aZ',
    imageUrl: 'https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zMWFHbFc4NmwycDcyTGVJOVVzdmhkTzMzVHgiLCJyaWQiOiJvcmdfMzFjOTVheHdkZTNObDJIdVlnc0l1RHZ0REFFIiwiaW5pdGlhbHMiOiJKIn0',
    joinedAt: 1755813016510,
    name: 'Jabal',
    role: 'admin',
    slug: 'jabal',
    updatedAt: 1755813016510
  }
];

console.log("=== TESTING REACT COMPONENT LOGIC ===");
console.log("userOrganizations:", testData);
console.log("userOrganizations.length:", testData.length);
console.log("Boolean check (userOrganizations && userOrganizations.length > 0):", testData && testData.length > 0);

// Test the conditional that determines if projects show
if (testData && testData.length > 0) {
  console.log("✅ SHOULD SHOW PROJECTS");
  testData.forEach((org, index) => {
    console.log(`Project ${index + 1}:`, {
      id: org._id,
      name: org.name,
      slug: org.slug,
      role: org.role
    });
  });
} else {
  console.log("❌ WOULD SHOW 'No Projects Yet'");
}
