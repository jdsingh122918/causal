// Script to fix Risk Analysis by clearing old configuration and triggering migration
// Run this in the browser console to immediately fix the Risk analysis issue

console.log('🔧 Fixing Risk Analysis configuration...');

// Clear the NET project's intelligence configuration to trigger migration
const netProjectKey = 'causal-project-intelligence-NET';
const oldConfig = localStorage.getItem(netProjectKey);

if (oldConfig) {
  console.log('📋 Old configuration found:', JSON.parse(oldConfig));
  localStorage.removeItem(netProjectKey);
  console.log('🗑️ Old configuration cleared');
} else {
  console.log('ℹ️ No old configuration found');
}

// Refresh the page to trigger migration and load new default config
console.log('🔄 Refreshing page to apply changes...');
setTimeout(() => {
  window.location.reload();
}, 1000);