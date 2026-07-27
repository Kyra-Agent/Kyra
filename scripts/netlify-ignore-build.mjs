const context = (process.env.CONTEXT ?? "").trim().toLowerCase();
const branch = (process.env.BRANCH ?? "").trim().toLowerCase();

const isDeployPreview = context === "deploy-preview";
const isAutomatedDependencyBranch = /^(dependabot|renovate)\//.test(branch);

if (isDeployPreview || isAutomatedDependencyBranch) {
  console.log(`Skipping non-production Netlify build for ${context || branch}.`);
  process.exit(0);
}

// Netlify continues a build when the ignore command exits with status 1.
process.exit(1);
