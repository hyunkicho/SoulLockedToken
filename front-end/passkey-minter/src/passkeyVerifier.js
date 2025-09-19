import React, { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { BrowserProvider, Contract, keccak256, toUtf8Bytes, AbiCoder, Signature } from 'ethers';
import SoulLockedTokenABI from './SoulLockedToken.json';

// Helper functions (arrayBufferToHex, hexToUint8Array) remain the same...
const arrayBufferToHex = (buffer) => {
    if (!buffer || typeof buffer.byteLength !== 'number' || buffer.byteLength === 0) {
        return '0x';
    }
    return '0x' + Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const hexToUint8Array = (hex) => {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
};


function PasskeyVerifier() {
    const [credId, setCredId] = useState('');
    const [message, setMessage] = useState('');
    const [verificationResult, setVerificationResult] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // buildContractSignature function remains the same...
    const buildContractSignature = (authResponse, credIdBytes, challengeBase64URL) => {
        const authenticatorData = hexToUint8Array(authResponse.authenticatorData);
        const sig = Signature.from(authResponse.signature);
        const r = sig.r;
        const s = sig.s;
        const challengeLocation = authResponse.clientDataJSON.indexOf(challengeBase64URL);
        const responseTypeLocation = authResponse.clientDataJSON.indexOf("webauthn.get");
        const signatureStruct = { authenticatorData, clientDataJSON: authResponse.clientDataJSON, challengeLocation, responseTypeLocation, r, s, credId: credIdBytes };
        const encodedStruct = AbiCoder.defaultAbiCoder().encode(['bytes', 'string', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'], [signatureStruct.authenticatorData, signatureStruct.clientDataJSON, signatureStruct.challengeLocation, signatureStruct.responseTypeLocation, signatureStruct.r, signatureStruct.s, signatureStruct.credId]);
        const version = '0x00';
        const validUntil = 'ffffffffffff';
        return version + validUntil + encodedStruct.slice(2);
    };

    const handleVerify = async () => {
        if (!credId || !message) {
            setError('Please provide both a Credential ID and a message.');
            return;
        }

        setIsLoading(true);
        setError('');
        setVerificationResult(null);

        try {
            const provider = new BrowserProvider(window.ethereum);
            const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; // ⚠️ Replace with your contract address
            const contract = new Contract(contractAddress, SoulLockedTokenABI.abi, provider);

            const messageHash = keccak256(toUtf8Bytes(message));

            const challenge = window.btoa(String.fromCharCode.apply(null, window.crypto.getRandomValues(new Uint8Array(32))))
                .replace(/\+/g, '-').replace(/_/g, '_').replace(/=+$/, '');

            // ✅ FIX: Wrap the options in a request options JSON object
            const authenticationResponse = await startAuthentication({
                challenge: challenge,
                allowCredentials: [{
                    id: credId.trim(),
                    type: 'public-key',
                }],
                userVerification: 'required',
            });

            if (!authenticationResponse.response.signature || authenticationResponse.response.signature.byteLength === 0) {
                throw new Error('Browser did not return a signature. Please double-check the Credential ID.');
            }

            const credIdBytes = hexToUint8Array(authenticationResponse.rawId);
            const fullSignature = buildContractSignature(
                {
                    authenticatorData: arrayBufferToHex(authenticationResponse.response.authenticatorData),
                    clientDataJSON: authenticationResponse.response.clientDataJSON,
                    signature: arrayBufferToHex(authenticationResponse.response.signature),
                },
                credIdBytes,
                challenge,
            );

            const isValid = await contract.passKeyChecker(fullSignature, messageHash);

            setVerificationResult(isValid);
        } catch (err) {
            console.error(err);
            setError('Verification failed: ' + (err.reason || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    // return statement remains the same...
    return (
        <div>
            <hr />
            <h2>3. Verify Passkey Signature</h2>
            <p>Enter the Credential ID of the NFT you want to verify ownership of.</p>

            <textarea
                placeholder="Credential ID (Base64URL) from minting"
                onChange={(e) => setCredId(e.target.value)}
                rows={2}
                style={{width: '100%', marginBottom: '10px'}}
            />

            <textarea
                placeholder="Enter a message to sign (e.g., 'Hello World')"
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                style={{width: '100%', marginBottom: '10px'}}
            />

            <button onClick={handleVerify} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Sign with Passkey and Verify'}
            </button>

            {verificationResult !== null && (
                <div style={{marginTop: '20px'}}>
                    <h3>Verification Result:
                        <span style={{color: verificationResult ? 'green' : 'red'}}>
              {verificationResult ? ' SUCCESS' : ' FAILED'}
            </span>
                    </h3>
                </div>
            )}

            {error && <p style={{color: 'red'}}>{error}</p>}
        </div>
    );
}

export default PasskeyVerifier;