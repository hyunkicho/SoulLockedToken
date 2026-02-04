// Configuration file for environment variables
// React automatically loads .env files, so no need to import dotenv

const config = {
    // Contract addresses - Original SoulLockedToken
    CONTRACT_ADDRESS: process.env.REACT_APP_CONTRACT_ADDRESS || "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    P256_VERIFIER_ADDRESS: process.env.REACT_APP_P256_VERIFIER_ADDRESS || "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    
    // Network configuration - Hardhat local network
    DEFAULT_NETWORK: "hardhat",
    RPC_URL: "http://127.0.0.1:8545",
    
    // Development settings
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

export default config;
