import React, { useState } from 'react';
import { BrowserProvider, Contract, keccak256 } from 'ethers'; // Simplified imports
import SoulLockedTokenABI from './SoulLockedTokenNew.json';
import { decode } from 'cbor';

// --- Helper Functions ---
const arrayBufferToHex = (buffer) => {
    if (!buffer || buffer.byteLength === 0) return '0x';
    return '0x' + Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};
const hexToUint8Array = (hex) => {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
};
const parseDERSignature = (signature) => {
    const signatureBytes = hexToUint8Array(signature);
    const rLength = signatureBytes[3];
    const rOffset = 4;
    let r = signatureBytes.slice(rOffset, rOffset + rLength);
    const sLength = signatureBytes[rOffset + rLength + 1];
    const sOffset = rOffset + rLength + 2;
    let s = signatureBytes.slice(sOffset, sOffset + sLength);
    if (r[0] === 0) r = r.slice(1);
    if (s[0] === 0) s = s.slice(1);
    return {
        r: '0x' + Buffer.from(r).toString('hex'),
        s: '0x' + Buffer.from(s).toString('hex'),
    };
};
const arrayBufferToBase64Url = (buffer) => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function PasskeyFullTest() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [finalStatus, setFinalStatus] = useState(null);

    const addLog = (message, status = 'info') => {
        setLogs(prev => [...prev, { message, status }]);
    };

    const handleFullTest = async () => {
        setIsLoading(true);
        setLogs([]);
        setFinalStatus(null);

        try {
            addLog('Connecting to wallet...');
            const provider = new BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const ownerAddress = await signer.getAddress();
            addLog(`Wallet connected: ${ownerAddress}`, 'success');

            const contractAddress = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";
            const contract = new Contract(contractAddress, SoulLockedTokenABI.abi, signer);

            // 1. REGISTRATION
            addLog('Step 1: Registering Passkey & Extracting Public Key...');
            const regChallenge = window.crypto.getRandomValues(new Uint8Array(32));
            const regOptions = { challenge: regChallenge, rp: { name: 'Final DApp', id: window.location.hostname }, user: { id: window.crypto.getRandomValues(new Uint8Array(16)), name: 'testuser@localhost', displayName: 'Test User' }, pubKeyCredParams: [{ alg: -7, type: 'public-key' }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, attestation: 'direct' };
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
            const mintTx = await contract.safeMint(ownerAddress, tokenId, new Uint8Array(newCredId), [pubKeyX, pubKeyY]);
            addLog(`Minting transaction sent... waiting for confirmation...`, 'info');
            await mintTx.wait();
            addLog(`Minting successful! Token ID: ${tokenId}`, 'success');

            // 3. AUTHENTICATION
            addLog('Step 3: Requesting signature...', 'info');
            const authChallenge = window.crypto.getRandomValues(new Uint8Array(32));
            const authOptions = { challenge: authChallenge, allowCredentials: [{ id: newCredId, type: 'public-key', transports: ['internal'] }], userVerification: 'required', rpId: window.location.hostname };
            const authCredential = await navigator.credentials.get({ publicKey: authOptions });
            const authResponse = authCredential.response;
            if (!authResponse.signature || authResponse.signature.byteLength === 0) throw new Error('Did not produce a signature.');
            addLog('Signature received!', 'success');

            // 4. ON-CHAIN VERIFICATION
            addLog('Step 4: Verifying signature...', 'info');

            const clientDataJSONStr = new TextDecoder('utf-8').decode(authResponse.clientDataJSON);
            const challengeBase64URL = arrayBufferToBase64Url(authChallenge);
            const { r, s } = parseDERSignature(arrayBufferToHex(authResponse.signature));

            // ✅ CHANGED: Call the buildSignature view function on the contract first.
            // This is a great way to test if the data is being formatted correctly before sending a state-changing transaction.
            addLog('Calling buildSignature to construct the struct on-chain...', 'info');
            const signatureStruct = await contract.buildSignature(
                new Uint8Array(authResponse.authenticatorData),
                clientDataJSONStr,
                clientDataJSONStr.indexOf(challengeBase64URL),
                clientDataJSONStr.indexOf("webauthn.get"),
                r,
                s,
                new Uint8Array(newCredential.rawId)
            );
            console.log("signatureStruct : ", signatureStruct);
            addLog('Signature struct built successfully on-chain!', 'success');

            // ✅ FIX: Convert the read-only Ethers Result object into a plain JS object.
            // This creates a mutable copy that can be safely passed as an argument.
            const mutableSignatureStruct = {
                authenticatorData: signatureStruct.authenticatorData,
                clientDataJSON: signatureStruct.clientDataJSON,
                challengeLocation: signatureStruct.challengeLocation,
                responseTypeLocation: signatureStruct.responseTypeLocation,
                r: signatureStruct.r,
                s: signatureStruct.s,
                credId: signatureStruct.credId
            };
            // ✅ CHANGED: Call passKeyChecker with the struct we just built and the ORIGINAL challenge.
            addLog('Calling passKeyChecker on contract with the built struct...', 'info');
            // IMPORTANT: The WebAuthn library in your contract needs the original, unhashed challenge bytes.
            const isValid = await contract.passKeyChecker(mutableSignatureStruct, authChallenge);

            if (isValid) {
                addLog('✅✅✅ FINAL SUCCESS: On-chain verification SUCCEEDED! ✅✅✅', 'success');
                setFinalStatus('SUCCESS');
            } else {
                addLog('❌ On-chain verification FAILED!', 'error');
                setFinalStatus('FAILED');
            }

        } catch (err) {
            console.error(err);
            addLog(`Test FAILED: ${err.message}`, 'error');
            setFinalStatus('FAILED');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2>Passkey Full Lifecycle Test</h2>
            <p>This button will register a key, mint an NFT with it, and then verify a signature.</p>
            <button onClick={handleFullTest} disabled={isLoading}>
                {isLoading ? 'Running Full Test...' : 'Run Full End-to-End Test'}
            </button>
            <div style={{ marginTop: '20px', border: '1px solid grey', padding: '10px', height: '400px', overflowY: 'auto', textAlign: 'left' }}>
                <strong>Logs:</strong>
                {logs.map((log, i) => (
                    <p key={i} style={{ color: log.status === 'success' ? 'lightgreen' : log.status === 'error' ? 'red' : 'white', margin: '5px' }}>
                        {log.message}
                    </p>
                ))}
            </div>
            {finalStatus && (
                <div style={{
                    marginTop: '20px', padding: '15px', borderRadius: '4px', fontWeight: 'bold',
                    backgroundColor: finalStatus === 'SUCCESS' ? 'rgba(42, 157, 143, 0.3)' : 'rgba(231, 111, 81, 0.3)',
                    border: `1px solid ${finalStatus === 'SUCCESS' ? '#2a9d8f' : '#e76f51'}`,
                    color: finalStatus === 'SUCCESS' ? '#2a9d8f' : '#e76f51',
                }}>
                    FINAL RESULT: {finalStatus}
                </div>
            )}
        </div>
    );
}

export default PasskeyFullTest;