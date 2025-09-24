import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import SoulLockedTokenABI from './SoulLockedToken.json';
import { decode } from 'cbor';
import config from './config';

// --- Helper Functions ---
const arrayBufferToHex = (buffer) => {
    if (!buffer || buffer.byteLength === 0) return '0x';
    return '0x' + Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

function PasskeyFullTest() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [finalStatus, setFinalStatus] = useState(null);
    const [passkeyStatus, setPasskeyStatus] = useState('Not Checked');
    const [userAddress, setUserAddress] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [testPhase, setTestPhase] = useState('registration'); // 'registration' or 'verification'
    const [allLogs, setAllLogs] = useState([]);

    const addLog = (message, status = 'info') => {
        setLogs(prev => [...prev, { message, status }]);
        setAllLogs(prev => [...prev, { message, status }]);
    };

    // Connect wallet and check NFT count
    useEffect(() => {
        const connectWallet = async () => {
            if (window.ethereum) {
                try {
                    const provider = new BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    const address = await signer.getAddress();
                    setUserAddress(address);
                    
                    addLog(`Wallet connected: ${address}`, 'success');
                } catch (error) {
                    addLog(`Wallet connection failed: ${error.message}`, 'error');
                }
            } else {
                addLog('MetaMask is not installed.', 'error');
            }
        };
        
        connectWallet();
    }, []);

    const handleFullTest = async () => {
        setIsLoading(true);
        setLogs([]);
        setAllLogs([]);
        setFinalStatus(null);
        setPasskeyStatus('Not Checked');
        setTestPhase('registration');
        setCurrentPage(1);

        try {
            addLog('Connecting to wallet...');
            const provider = new BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const userAddress = await signer.getAddress();
            addLog(`Wallet connected: ${userAddress}`, 'success');

            const contractAddress = config.CONTRACT_ADDRESS;
            const contract = new Contract(contractAddress, SoulLockedTokenABI.abi, signer);

            // 1. REGISTRATION
            addLog('Step 1: Registering Passkey & Extracting Public Key...');
            const regChallenge = window.crypto.getRandomValues(new Uint8Array(32));
            const regOptions = { 
                challenge: regChallenge, 
                rp: { name: 'Final DApp', id: window.location.hostname }, 
                user: { id: window.crypto.getRandomValues(new Uint8Array(16)), name: 'testuser@localhost', displayName: 'Test User' }, 
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' }, // ES256
                    { alg: -257, type: 'public-key' } // RS256
                ], 
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, 
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
            const contractOwnerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
            const mintTx = await contract.safeMint(contractOwnerAddress, tokenId, new Uint8Array(newCredId), [pubKeyX, pubKeyY]);
            addLog(`Minting transaction sent... waiting for confirmation...`, 'info');
            await mintTx.wait();
            addLog(`Minting successful! Token ID: ${tokenId}`, 'success');

            // 3. AUTHENTICATION
            addLog('Step 3: Requesting signature...', 'info');
            const authChallenge = window.crypto.getRandomValues(new Uint8Array(32));
            const authOptions = { 
                challenge: authChallenge, 
                allowCredentials: [{ id: newCredId, type: 'public-key', transports: ['internal'] }], 
                userVerification: 'required', 
                rpId: window.location.hostname 
            };
            const authCredential = await navigator.credentials.get({ publicKey: authOptions });
            const authResponse = authCredential.response;
            if (!authResponse.signature || authResponse.signature.byteLength === 0) throw new Error('Did not produce a signature.');
            addLog('Signature received!', 'success');

            // 4. AUTH CHECK
            addLog('Step 4: Checking authentication status...', 'info');
            const authInfo = await contract.authCheck(tokenId, contractOwnerAddress);
            addLog(`Auth status - Checked: ${authInfo.checked}, CheckedAt: ${authInfo.checkedAt}`, 'success');
            addLog('✅ Authentication status verified successfully!', 'success');
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
                        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>4. AUTH CHECK</div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button 
                            onClick={handleFullTest} 
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '15px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                backgroundColor: isLoading ? '#cccccc' : '#000000',
                                color: '#ffffff',
                                border: '2px solid #000000',
                                cursor: isLoading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isLoading ? 'EXECUTING FULL TEST...' : 'EXECUTE FULL TEST'}
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
                        <strong>PASSKEY STATUS:</strong><br/>
                        <span style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold'
                        }}>
                            {passkeyStatus === 'Verified' ? 'VERIFIED' : 'NOT CHECKED'}
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
}

export default PasskeyFullTest;