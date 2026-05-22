import React, { useState, useEffect } from 'react';
import { AbiCoder, BrowserProvider, Contract, ContractFactory, solidityPacked } from 'ethers';
import SoulLockedTokenABI from './SoulLockedToken.json';
import SoulLockedTokenNewABI from './SoulLockedTokenNew.json';
import { decode } from 'cbor';
import config from './config';

// --- Helper Functions ---
const arrayBufferToHex = (buffer) => {
    if (!buffer || buffer.byteLength === 0) return '0x';
    return '0x' + Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hexToUint8Array = (hex) => {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Invalid hex string length.');
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
};

const P256_CURVE_N = window.BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const P256_CURVE_N_DIV_2 = P256_CURVE_N / 2n;
const CONTRACT_STORAGE_KEY = 'soulLockedToken.contractAddress.baseSepolia';
const LOCAL_P256_VERIFIER = '5fbdb2315678afecb367f032d93f642f64180aa3';
const RIP_7212_PRECOMPILE = '0000000000000000000000000000000000000100';

const bytesToBigInt = (bytes) => {
    const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return window.BigInt(`0x${hex || '0'}`);
};

const bigIntToFixedHex = (value, byteLength = 32) => {
    const hex = value.toString(16);
    const targetLength = byteLength * 2;
    if (hex.length > targetLength) {
        throw new Error('P-256 signature integer is larger than 32 bytes.');
    }

    return `0x${hex.padStart(targetLength, '0')}`;
};

const parseDERSignature = (signatureBuffer) => {
    const signatureBytes = new Uint8Array(signatureBuffer);
    if (signatureBytes[0] !== 0x30) {
        throw new Error('Passkey signature is not a DER sequence.');
    }

    let offset = 2;
    const readInteger = () => {
        if (signatureBytes[offset] !== 0x02) {
            throw new Error('Invalid DER signature integer.');
        }

        const length = signatureBytes[offset + 1];
        offset += 2;

        let value = signatureBytes.slice(offset, offset + length);
        offset += length;

        while (value.length > 0 && value[0] === 0) {
            value = value.slice(1);
        }

        if (value.length > 32) {
            throw new Error('DER signature integer is larger than P-256 size.');
        }

        return bytesToBigInt(value);
    };

    const r = readInteger();
    let s = readInteger();
    if (s > P256_CURVE_N_DIV_2) {
        s = P256_CURVE_N - s;
    }

    return {
        r: bigIntToFixedHex(r),
        s: bigIntToFixedHex(s),
    };
};

const getClientDataLocations = (clientDataJSON) => {
    const challengeLocation = clientDataJSON.indexOf('"challenge":"');
    const responseTypeLocation = clientDataJSON.indexOf('"type":"webauthn.get"');

    if (challengeLocation < 0) {
        throw new Error('clientDataJSON does not contain the challenge property.');
    }

    if (responseTypeLocation < 0) {
        throw new Error('clientDataJSON does not contain the webauthn.get response type.');
    }

    return { challengeLocation, responseTypeLocation };
};

const buildSignatureStruct = (authResponse, credIdHex) => {
    const clientDataJSON = new TextDecoder('utf-8').decode(authResponse.clientDataJSON);
    const { challengeLocation, responseTypeLocation } = getClientDataLocations(clientDataJSON);
    const { r, s } = parseDERSignature(authResponse.signature);

    return {
        authenticatorData: arrayBufferToHex(authResponse.authenticatorData),
        clientDataJSON,
        challengeLocation,
        responseTypeLocation,
        r,
        s,
        credId: credIdHex,
    };
};

const buildLegacyPackedSignature = (signatureStruct) => {
    const encodedSignature = AbiCoder.defaultAbiCoder().encode(
        ['tuple(bytes authenticatorData,string clientDataJSON,uint256 challengeLocation,uint256 responseTypeLocation,uint256 r,uint256 s,bytes credId)'],
        [signatureStruct]
    );

    return solidityPacked(
        ['uint8', 'uint48', 'bytes'],
        [1, 0, encodedSignature]
    );
};

const supportsNewSignatureInterface = async (contract) => {
    try {
        await contract.buildSignature.staticCall('0x', '', 0, 0, 0, 0, '0x');
        return true;
    } catch (_) {
        return false;
    }
};

const getCheckedAt = (authInfo) => {
    const value = authInfo?.checkedAt ?? authInfo?.[1] ?? 0;
    return Number(value.toString());
};

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const waitForPassKeyChecker = async (contract, signature, challenge, attempts = 6) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const isValid = await contract.passKeyChecker(signature, challenge);
        if (isValid) return true;
        if (attempt < attempts - 1) {
            await sleep(1000);
        }
    }

    return false;
};

const assertMetaMask = () => {
    if (!window.ethereum) {
        throw new Error('MetaMask is not installed.');
    }
};

const normalizeAddress = (address) => (address || '').toLowerCase();

const getInitialContractAddress = () => {
    try {
        return window.localStorage?.getItem(CONTRACT_STORAGE_KEY) || config.CONTRACT_ADDRESS || '';
    } catch (_) {
        return config.CONTRACT_ADDRESS || '';
    }
};

const persistContractAddress = (address) => {
    try {
        window.localStorage?.setItem(CONTRACT_STORAGE_KEY, address);
    } catch (_) {
        // localStorage can be disabled in some browser privacy modes. Runtime state still works.
    }
};

const patchP256VerifierBytecode = (bytecode) => {
    const lowerBytecode = bytecode.toLowerCase();
    const occurrences = lowerBytecode.split(LOCAL_P256_VERIFIER).length - 1;
    if (occurrences !== 1) {
        throw new Error(`Expected exactly one local P256 verifier address in bytecode, found ${occurrences}.`);
    }

    return bytecode.replace(new RegExp(LOCAL_P256_VERIFIER, 'i'), RIP_7212_PRECOMPILE);
};

const ensureConfiguredNetwork = async () => {
    if (!window.ethereum?.request || !config.CHAIN_ID) {
        return;
    }

    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId?.toLowerCase() === config.CHAIN_ID.toLowerCase()) {
        return;
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: config.CHAIN_ID }],
        });
    } catch (error) {
        if (error?.code !== 4902) {
            throw error;
        }

        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: config.CHAIN_ID,
                chainName: config.CHAIN_NAME,
                rpcUrls: [config.RPC_URL],
                blockExplorerUrls: [config.BLOCK_EXPLORER_URL],
                nativeCurrency: {
                    name: config.NATIVE_CURRENCY_SYMBOL,
                    symbol: config.NATIVE_CURRENCY_SYMBOL,
                    decimals: 18,
                },
            }],
        });
    }
};

const getConnectedAccount = async () => {
    assertMetaMask();
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts?.[0] || '';
};

const requestWalletConnection = async () => {
    assertMetaMask();
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await ensureConfiguredNetwork();
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { provider, signer, address };
};

const getConnectedSigner = async () => {
    const account = await getConnectedAccount();
    if (!account) {
        return null;
    }

    await ensureConfiguredNetwork();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { provider, signer, address };
};

const getConfiguredContract = async (signer, selectedContractAddress) => {
    const contractAddress = selectedContractAddress || config.CONTRACT_ADDRESS;
    if (!contractAddress) {
        throw new Error('Contract address is not set. Deploy a Base Sepolia contract first.');
    }

    const legacyContract = new Contract(contractAddress, SoulLockedTokenABI.abi, signer);
    const newContract = new Contract(contractAddress, SoulLockedTokenNewABI.abi, signer);
    const usesNewSignatureInterface = await supportsNewSignatureInterface(newContract);

    return {
        contract: usesNewSignatureInterface ? newContract : legacyContract,
        usesNewSignatureInterface,
    };
};

const getContractOwner = async (contract) => {
    if (typeof contract.owner !== 'function') {
        return '';
    }

    return contract.owner();
};

const requestVerificationPayload = async ({ usesNewSignatureInterface, credentialId, credIdHex }) => {
    const messageHash = arrayBufferToHex(window.crypto.getRandomValues(new Uint8Array(32)));
    const legacyChallenge = solidityPacked(['uint8', 'uint48', 'bytes32'], [1, 0, messageHash]);
    const authChallenge = usesNewSignatureInterface
        ? window.crypto.getRandomValues(new Uint8Array(32))
        : hexToUint8Array(legacyChallenge);
    const credentialIdBytes = Uint8Array.from(credentialId);
    const authOptions = {
        challenge: authChallenge,
        allowCredentials: [{ id: credentialIdBytes.buffer, type: 'public-key', transports: ['internal'] }],
        userVerification: 'required',
        rpId: window.location.hostname
    };
    const authCredential = await navigator.credentials.get({ publicKey: authOptions });
    const authResponse = authCredential.response;
    if (!authResponse.signature || authResponse.signature.byteLength === 0) {
        throw new Error('Did not produce a signature.');
    }

    const signatureStruct = buildSignatureStruct(authResponse, credIdHex);

    return {
        signature: usesNewSignatureInterface ? signatureStruct : buildLegacyPackedSignature(signatureStruct),
        challenge: usesNewSignatureInterface ? arrayBufferToHex(authChallenge) : messageHash,
    };
};

function PasskeyFullTest() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isReadVerifying, setIsReadVerifying] = useState(false);
    const [finalStatus, setFinalStatus] = useState(null);
    const [passkeyStatus, setPasskeyStatus] = useState('Not Checked');
    const [userAddress, setUserAddress] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [testPhase, setTestPhase] = useState('registration'); // 'registration' or 'verification'
    const [allLogs, setAllLogs] = useState([]);
    const [latestPasskeyContext, setLatestPasskeyContext] = useState(null);
    const [readVerifyResult, setReadVerifyResult] = useState(null);
    const [contractOwnerAddress, setContractOwnerAddress] = useState('');
    const [contractAddress, setContractAddress] = useState(getInitialContractAddress);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentTxHash, setDeploymentTxHash] = useState('');

    const addLog = (message, status = 'info') => {
        setLogs(prev => [...prev, { message, status }]);
        setAllLogs(prev => [...prev, { message, status }]);
    };

    // Connect wallet and check NFT count
    useEffect(() => {
        const connectWallet = async () => {
            if (window.ethereum) {
                try {
                    const address = await getConnectedAccount();
                    if (address) {
                        setUserAddress(address);
                        addLog(`Wallet connected: ${address}`, 'success');
                    } else {
                        addLog('MetaMask is not connected. Click CONNECT METAMASK first.', 'info');
                    }
                } catch (error) {
                    addLog(`Wallet connection failed: ${error.message}`, 'error');
                }
            } else {
                addLog('MetaMask is not installed.', 'error');
            }
        };
        
        connectWallet();
    }, []);

    const handleConnectWallet = async () => {
        try {
            addLog('Opening MetaMask wallet connection...');
            const { signer, address } = await requestWalletConnection();
            setUserAddress(address);
            addLog(`Wallet connected: ${address}`, 'success');

            if (contractAddress) {
                const { contract } = await getConfiguredContract(signer, contractAddress);
                const ownerAddress = await getContractOwner(contract);
                setContractOwnerAddress(ownerAddress);

                if (ownerAddress && normalizeAddress(address) !== normalizeAddress(ownerAddress)) {
                    addLog(`Connected wallet is not the contract owner. Switch MetaMask to ${ownerAddress} or deploy a new contract from this wallet.`, 'error');
                } else if (ownerAddress) {
                    addLog('Connected wallet matches the contract owner.', 'success');
                }
            } else {
                addLog('No contract selected. Deploy a contract before running the full test.', 'info');
            }
        } catch (err) {
            console.error(err);
            addLog(`MetaMask connection failed: ${err.message}`, 'error');
        }
    };

    const handleDeployContract = async () => {
        setIsDeploying(true);
        setFinalStatus(null);
        setLatestPasskeyContext(null);
        setReadVerifyResult(null);
        setPasskeyStatus('Not Checked');

        try {
            addLog('Preparing Base Sepolia deployment from connected wallet...');
            const { signer, address } = await requestWalletConnection();
            setUserAddress(address);
            addLog(`Wallet connected: ${address}`, 'success');

            const bytecode = patchP256VerifierBytecode(SoulLockedTokenNewABI.bytecode);
            const factory = new ContractFactory(SoulLockedTokenNewABI.abi, bytecode, signer);
            const deployedContract = await factory.deploy('SoulLockedToken', 'SLT', true);
            const txHash = deployedContract.deploymentTransaction()?.hash || '';
            setDeploymentTxHash(txHash);
            if (txHash) {
                addLog(`Contract deployment transaction sent: ${txHash}`, 'info');
            } else {
                addLog('Contract deployment transaction sent.', 'info');
            }

            await deployedContract.waitForDeployment();
            const deployedAddress = await deployedContract.getAddress();
            persistContractAddress(deployedAddress);
            setContractAddress(deployedAddress);
            setContractOwnerAddress(address);
            addLog(`Contract deployed: ${deployedAddress}`, 'success');
            addLog('Connected wallet is now the contract owner.', 'success');
        } catch (err) {
            console.error(err);
            addLog(`Contract deployment failed: ${err.reason || err.message}`, 'error');
        } finally {
            setIsDeploying(false);
        }
    };

    const handleFullTest = async () => {
        setIsLoading(true);
        setLogs([]);
        setAllLogs([]);
        setFinalStatus(null);
        setPasskeyStatus('Not Checked');
        setTestPhase('registration');
        setCurrentPage(1);
        setLatestPasskeyContext(null);
        setReadVerifyResult(null);

        try {
            addLog('Checking connected MetaMask wallet...');
            const connection = await getConnectedSigner();
            if (!connection) {
                throw new Error('MetaMask wallet is not connected. Click CONNECT METAMASK first, then run the full test.');
            }

            const { signer, address: userAddress } = connection;
            setUserAddress(userAddress);
            addLog(`Wallet connected: ${userAddress}`, 'success');

            const { contract, usesNewSignatureInterface } = await getConfiguredContract(signer, contractAddress);
            addLog(
                `Contract interface detected: ${usesNewSignatureInterface ? 'SoulLockedTokenNew' : 'SoulLockedToken'}`,
                'info'
            );
            const ownerAddress = await getContractOwner(contract);
            setContractOwnerAddress(ownerAddress);
            if (ownerAddress && normalizeAddress(userAddress) !== normalizeAddress(ownerAddress)) {
                throw new Error(`Connected wallet ${userAddress} is not the contract owner. Switch MetaMask to ${ownerAddress}, or deploy a new contract from this wallet.`);
            }

            // 1. REGISTRATION
            addLog('Step 1: Registering Passkey & Extracting Public Key...');
            const regChallenge = window.crypto.getRandomValues(new Uint8Array(32));
            const regOptions = { 
                challenge: regChallenge, 
                rp: { name: 'Final DApp', id: window.location.hostname }, 
                user: { id: window.crypto.getRandomValues(new Uint8Array(16)), name: 'testuser@localhost', displayName: 'Test User' }, 
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' } // ES256 / P-256
                ], 
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, 
                timeout: 60000,
                attestation: 'direct' 
            };
            const newCredential = await navigator.credentials.create({ publicKey: regOptions });
            const newCredId = newCredential.rawId;
            addLog('Registration successful!', 'success');

            // 2. MINT NFT
            addLog('Step 2: Minting NFT with public key...', 'info');
            const attestationObject = decode(newCredential.response.attestationObject);
            const { authData } = attestationObject;
            const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
            const credIdLen = view.getUint16(53);
            const publicKeyOffset = 55 + credIdLen;
            const cosePublicKey = decode(authData.slice(publicKeyOffset));
            const pubKeyX = arrayBufferToHex(cosePublicKey.get(-2));
            const pubKeyY = arrayBufferToHex(cosePublicKey.get(-3));

            const tokenId = Date.now();
            const contractOwnerAddress = userAddress;
            const credIdBytes = new Uint8Array(newCredId);
            const credIdHex = arrayBufferToHex(newCredId);
            const mintTx = await contract.safeMint(contractOwnerAddress, tokenId, credIdBytes, [pubKeyX, pubKeyY]);
            addLog(`Minting transaction sent... waiting for confirmation...`, 'info');
            await mintTx.wait();
            addLog(`Minting successful! Token ID: ${tokenId}`, 'success');

            // 3. AUTHENTICATION
            addLog('Step 3: Requesting signature...', 'info');
            const verificationPayload = await requestVerificationPayload({
                usesNewSignatureInterface,
                credentialId: Array.from(credIdBytes),
                credIdHex,
            });
            addLog('Signature received!', 'success');

            // 4. AUTH UPDATE
            addLog('Step 4: Updating authentication status on-chain...', 'info');
            const authInfoBefore = await contract.authCheck(tokenId, contractOwnerAddress);
            const isSignatureValid = await waitForPassKeyChecker(contract, verificationPayload.signature, verificationPayload.challenge);
            if (!isSignatureValid) {
                throw new Error('Passkey signature failed on-chain verification.');
            }

            const updateTx = await contract.updateAuth(
                verificationPayload.signature,
                verificationPayload.challenge,
                tokenId,
                credIdHex,
                { gasLimit: 1000000 }
            );
            addLog('Auth update transaction sent... waiting for confirmation...', 'info');
            await updateTx.wait();
            addLog('Auth update transaction confirmed!', 'success');

            const authInfoAfter = await contract.authCheck(tokenId, contractOwnerAddress);
            const checkedAtBefore = getCheckedAt(authInfoBefore);
            const checkedAtAfter = getCheckedAt(authInfoAfter);
            if (checkedAtAfter < checkedAtBefore) {
                throw new Error('Auth timestamp moved backwards after update.');
            }

            addLog(`Auth status - Checked: ${authInfoAfter.checked}, CheckedAt: ${checkedAtAfter.toString()}`, 'success');
            addLog('✅ Authentication status updated successfully!', 'success');
            setLatestPasskeyContext({
                tokenId,
                ownerAddress: contractOwnerAddress,
                credIdHex,
                credentialId: Array.from(credIdBytes),
                usesNewSignatureInterface,
            });
            setFinalStatus('SUCCESS');
            setPasskeyStatus('Verified');

        } catch (err) {
            console.error(err);
            addLog(`Test FAILED: ${err.message}`, 'error');
            setFinalStatus('FAILED');
            setPasskeyStatus('Not Verified');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReadVerify = async () => {
        if (!latestPasskeyContext) {
            addLog('Run the full test first so the page has a minted token and credential ID.', 'error');
            return;
        }

        setIsReadVerifying(true);
        setReadVerifyResult(null);
        setTestPhase('verification');
        setCurrentPage(2);

        try {
            addLog('Step 5: Running read-only passKeyChecker verification...', 'info');
            const connection = await getConnectedSigner();
            if (!connection) {
                throw new Error('MetaMask wallet is not connected. Click CONNECT METAMASK first.');
            }

            const { signer } = connection;
            const { contract } = await getConfiguredContract(signer, contractAddress);
            const verificationPayload = await requestVerificationPayload(latestPasskeyContext);
            const isValid = await waitForPassKeyChecker(contract, verificationPayload.signature, verificationPayload.challenge);
            const authInfo = await contract.authCheck(latestPasskeyContext.tokenId, latestPasskeyContext.ownerAddress);

            setReadVerifyResult(isValid);
            addLog(`Read-only verify result: ${isValid ? 'VALID' : 'INVALID'}`, isValid ? 'success' : 'error');
            addLog(`Auth read result - Checked: ${authInfo.checked}, CheckedAt: ${getCheckedAt(authInfo).toString()}`, 'info');
        } catch (err) {
            console.error(err);
            setReadVerifyResult(false);
            addLog(`Read-only verify failed: ${err.message}`, 'error');
        } finally {
            setIsReadVerifying(false);
        }
    };

    const showPage1 = () => {
        setTestPhase('registration');
        setCurrentPage(1);
        setLogs(allLogs.slice(0, 8)); // Registration phase logs
    };

    const showPage2 = () => {
        setTestPhase('verification');
        setCurrentPage(2);
        setLogs(allLogs.slice(8)); // Verification phase logs
    };

    return (
        <div style={{ 
            maxWidth: '1000px', 
            margin: '0 auto', 
            padding: '20px',
            fontFamily: 'Times New Roman, serif',
            backgroundColor: '#ffffff',
            border: '2px solid #000000'
        }}>
            <h1 style={{ 
                textAlign: 'center', 
                color: '#000000', 
                marginBottom: '30px',
                fontSize: '32px',
                fontWeight: 'bold',
                textDecoration: 'underline'
            }}>
                SoulLockedToken
            </h1>
            
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '20px'
            }}>
                {/* Left Panel - Controls */}
                <div style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '15px', 
                    border: '1px solid #000000'
                }}>
                    <h2 style={{ 
                        color: '#000000', 
                        marginBottom: '15px',
                        fontSize: '20px',
                        fontWeight: 'bold'
                    }}>
                        EXPERIMENTAL PROCEDURE
                    </h2>
                    <div style={{ 
                        color: '#000000', 
                        marginBottom: '15px',
                        lineHeight: '1.6',
                        fontSize: '16px'
                    }}>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>1. PASSKEY REGISTRATION</div>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>2. PUBLIC KEY EXTRACTION</div>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>3. NFT MINTING</div>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>4. AUTH UPDATE</div>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>5. VERIFY READ</div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button
                            onClick={handleConnectWallet}
                            disabled={isLoading || isReadVerifying || isDeploying}
                            style={{
                                flex: 1,
                                padding: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                backgroundColor: '#ffffff',
                                color: '#000000',
                                border: '2px solid #000000',
                                cursor: (isLoading || isReadVerifying || isDeploying) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            CONNECT METAMASK
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button
                            onClick={handleDeployContract}
                            disabled={isLoading || isReadVerifying || isDeploying}
                            style={{
                                flex: 1,
                                padding: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                backgroundColor: isDeploying ? '#cccccc' : '#ffffff',
                                color: '#000000',
                                border: '2px solid #000000',
                                cursor: (isLoading || isReadVerifying || isDeploying) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isDeploying ? 'DEPLOYING CONTRACT...' : 'DEPLOY NEW CONTRACT'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button 
                            onClick={handleFullTest} 
                            disabled={isLoading || isDeploying}
                            style={{
                                flex: 1,
                                padding: '15px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                backgroundColor: isLoading ? '#cccccc' : '#000000',
                                color: '#ffffff',
                                border: '2px solid #000000',
                                cursor: (isLoading || isDeploying) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isLoading ? 'EXECUTING FULL TEST...' : 'EXECUTE FULL TEST'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button
                            onClick={handleReadVerify}
                            disabled={!latestPasskeyContext || isLoading || isReadVerifying}
                            style={{
                                flex: 1,
                                padding: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                backgroundColor: (!latestPasskeyContext || isLoading || isReadVerifying) ? '#cccccc' : '#ffffff',
                                color: '#000000',
                                border: '2px solid #000000',
                                cursor: (!latestPasskeyContext || isLoading || isReadVerifying) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isReadVerifying ? 'RUNNING VERIFY READ...' : 'RUN VERIFY READ'}
                        </button>
                    </div>
                    
                    {allLogs.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <button 
                                onClick={showPage1}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: currentPage === 1 ? '#000000' : '#f0f0f0',
                                    color: currentPage === 1 ? '#ffffff' : '#000000',
                                    border: '2px solid #000000',
                                    cursor: 'pointer'
                                }}
                            >
                                VIEW PAGE 1: REGISTRATION
                            </button>
                            <button 
                                onClick={showPage2}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: currentPage === 2 ? '#000000' : '#f0f0f0',
                                    color: currentPage === 2 ? '#ffffff' : '#000000',
                                    border: '2px solid #000000',
                                    cursor: 'pointer'
                                }}
                            >
                                VIEW PAGE 2: VERIFICATION
                            </button>
                        </div>
                    )}
                    
                    {finalStatus && (
                        <div style={{
                            marginTop: '15px', 
                            padding: '10px', 
                            fontWeight: 'bold',
                            backgroundColor: finalStatus === 'SUCCESS' ? '#e8f5e8' : '#ffe8e8',
                            border: `2px solid ${finalStatus === 'SUCCESS' ? '#000000' : '#000000'}`,
                            color: '#000000',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            RESULT: {finalStatus}
                        </div>
                    )}
                </div>
                
                {/* Right Panel - Logs */}
                <div style={{ 
                    backgroundColor: '#ffffff', 
                    padding: '15px', 
                    border: '1px solid #000000'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ 
                            color: '#000000', 
                            fontSize: '20px',
                            fontWeight: 'bold',
                            margin: 0
                        }}>
                            EXECUTION LOG
                        </h3>
                        <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 'bold',
                            color: '#000000',
                            backgroundColor: '#f0f0f0',
                            padding: '5px 10px',
                            border: '1px solid #000000'
                        }}>
                            PAGE {currentPage} - {testPhase.toUpperCase()}
                        </div>
                    </div>
                    <div style={{ 
                        height: '300px', 
                        overflowY: 'auto', 
                        textAlign: 'left',
                        backgroundColor: '#f9f9f9',
                        padding: '10px',
                        border: '1px solid #000000',
                        fontFamily: 'Courier New, monospace'
                    }}>
                        {logs.length === 0 ? (
                            <p style={{ 
                                color: '#666666', 
                                fontStyle: 'italic',
                                textAlign: 'center',
                                marginTop: '50px',
                                fontSize: '12px'
                            }}>
                                Click "EXECUTE FULL TEST" to see execution logs...
                            </p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} style={{ 
                                    color: log.status === 'success' ? '#006600' : 
                                          log.status === 'error' ? '#cc0000' : '#000000', 
                                    margin: '5px 0',
                                    padding: '2px 0',
                                    borderBottom: '1px solid #cccccc',
                                    fontSize: '14px',
                                    lineHeight: '1.3'
                                }}>
                                    <span style={{ 
                                        color: '#666666',
                                        marginRight: '8px',
                                        fontSize: '10px'
                                    }}>
                                        [{i + 1}]
                                    </span>
                                    {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            
            {/* System Status */}
            <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '15px', 
                border: '1px solid #000000',
                marginTop: '15px'
            }}>
                <h3 style={{ 
                    color: '#000000', 
                    marginBottom: '10px',
                    fontSize: '18px',
                    fontWeight: 'bold'
                }}>
                    SYSTEM STATUS
                </h3>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '10px',
                    color: '#000000'
                }}>
                    <div style={{ 
                        padding: '8px', 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #000000'
                    }}>
                        <strong>WALLET:</strong><br/>
                        <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                            {userAddress || 'Not Connected'}
                        </span>
                    </div>
                    <div style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #000000'
                    }}>
                        <strong>CONTRACT:</strong><br/>
                        <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                            {contractAddress || 'Not Deployed'}
                        </span>
                    </div>
                    <div style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #000000'
                    }}>
                        <strong>DEPLOY TX:</strong><br/>
                        <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                            {deploymentTxHash || 'Not Run'}
                        </span>
                    </div>
                    <div style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #000000'
                    }}>
                        <strong>CONTRACT OWNER:</strong><br/>
                        <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                            {contractOwnerAddress || 'Not Checked'}
                        </span>
                    </div>
                    <div style={{ 
                        padding: '8px', 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #000000'
                    }}>
                        <strong>PASSKEY STATUS:</strong><br/>
                        <span style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold'
                        }}>
                            {passkeyStatus === 'Verified' ? 'VERIFIED' : 'NOT CHECKED'}
                        </span>
                    </div>
                    <div style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #000000'
                    }}>
                        <strong>VERIFY READ:</strong><br/>
                        <span style={{
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}>
                            {readVerifyResult === null ? 'NOT RUN' : readVerifyResult ? 'VALID' : 'INVALID'}
                        </span>
                    </div>
                    <div style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #000000'
                    }}>
                        <strong>TOKEN ID:</strong><br/>
                        <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                            {latestPasskeyContext?.tokenId || 'Not minted'}
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
}

export default PasskeyFullTest;
