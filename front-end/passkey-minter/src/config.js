// Configuration file for environment variables
// React automatically loads .env files, so no need to import dotenv

const config = {
    // Contract addresses - Original SoulLockedToken
    CONTRACT_ADDRESS: process.env.REACT_APP_CONTRACT_ADDRESS || "0x1B08172763934002FB65E4b6208C114BC10EdAB7",
    P256_VERIFIER_ADDRESS: process.env.REACT_APP_P256_VERIFIER_ADDRESS || "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    
    // Network configuration - Base Sepolia
    DEFAULT_NETWORK: process.env.REACT_APP_DEFAULT_NETWORK || "baseSepolia",
    CHAIN_ID: process.env.REACT_APP_CHAIN_ID || "0x14a34",
    CHAIN_NAME: process.env.REACT_APP_CHAIN_NAME || "Base Sepolia",
    RPC_URL: process.env.REACT_APP_RPC_URL || "https://sepolia.base.org",
    BLOCK_EXPLORER_URL: process.env.REACT_APP_BLOCK_EXPLORER_URL || "https://sepolia.basescan.org",
    NATIVE_CURRENCY_SYMBOL: "ETH",
    
    // Development settings
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

export default config;
