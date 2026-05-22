#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create .env file for root directory
const rootEnvContent = `# Hardhat Configuration
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key_here

# Contract Addresses (Update these after deployment)
SOUL_LOCKED_TOKEN_ADDRESS=0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0
P256_VERIFIER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# Network Configuration
DEFAULT_NETWORK=hardhat
`;

// Create .env file for front-end
const frontendEnvContent = `# Front-end Environment Variables
REACT_APP_CONTRACT_ADDRESS=0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0
REACT_APP_P256_VERIFIER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REACT_APP_DEFAULT_NETWORK=hardhat
REACT_APP_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key_here
`;

// Create .env files
try {
    // Root .env
    fs.writeFileSync(path.join(__dirname, '.env'), rootEnvContent);
    console.log('✅ Created .env file in root directory');
    
    // Front-end .env
    const frontendEnvPath = path.join(__dirname, 'front-end', 'passkey-minter', '.env');
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);
    console.log('✅ Created .env file in front-end directory');
    
    console.log('\n📝 Next steps:');
    console.log('1. Update the PRIVATE_KEY in both .env files with your actual private key');
    console.log('2. Update the SEPOLIA_RPC_URL with your Infura or Alchemy URL');
    console.log('3. Update contract addresses after deployment if needed');
    console.log('\n🚀 You can now run: npm run start:frontend');
    
} catch (error) {
    console.error('❌ Error creating .env files:', error.message);
    process.exit(1);
}
