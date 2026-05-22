import React, { useState } from 'react';
// We still need the 'cbor' library for the final parsing step.
import { decode } from 'cbor';

function PasskeyRegistrar() {
  const [passkeyInfo, setPasskeyInfo] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper to convert ArrayBuffer to a Hex string (0x...)
  const arrayBufferToHex = (buffer) => {
    return '0x' + Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
  };

  // Helper to convert a string to an ArrayBuffer
  const stringToArrayBuffer = (str) => {
    return Uint8Array.from(str, c => c.charCodeAt(0)).buffer;
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setError('');
    setPasskeyInfo(null);

    try {
      // Step 1: Create options for the native WebAuthn API.
      // The challenge and user.id MUST be ArrayBuffers for the native API.
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const userId = window.crypto.getRandomValues(new Uint8Array(16));

      const publicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'My SoulLockedToken DApp',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: `user@${window.location.hostname}`,
          displayName: 'New User',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'direct',
      };

      // Step 2: Call the native browser API
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      // Step 3: Parse the response from the native API
      const { response, rawId } = credential;
      const attestationObject = decode(response.attestationObject);
      const { authData } = attestationObject;

      const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);

      const flags = view.getUint8(32);
      if (!(flags & 0x40)) {
        throw new Error('Attested Credential Data not available.');
      }

      const credIdLen = view.getUint16(53);
      const publicKeyOffset = 55 + credIdLen;
      const publicKeyBytes = authData.slice(publicKeyOffset);

      const cosePublicKey = decode(publicKeyBytes);
      const x = cosePublicKey.get(-2);
      const y = cosePublicKey.get(-3);

      if (!x || !y) {
        throw new Error('Public key coordinates (x, y) could not be extracted.');
      }

      // We need to convert the rawId (an ArrayBuffer) to a Base64URL string for display
      const credIdBase64URL = btoa(String.fromCharCode.apply(null, new Uint8Array(rawId)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      setPasskeyInfo({
        credId: credIdBase64URL,
        pubKeyCoordinates: [arrayBufferToHex(x), arrayBufferToHex(y)],
      });

    } catch (err) {
      console.error('Final attempt failed:', err);
      setError('Failed to register passkey: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <div>
        <h2>1. Register Passkey</h2>
        <button onClick={handleRegister} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Register Passkey & Get Coordinates'}
        </button>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        {passkeyInfo && (
            <div>
              <h3>✅ Success! All info ready for minting.</h3>
              <p><strong>Credential ID (Base64URL):</strong></p>
              <textarea readOnly value={passkeyInfo.credId} rows={2} style={{width: '100%'}} />

              <p><strong>Public Key X:</strong></p>
              <textarea readOnly value={passkeyInfo.pubKeyCoordinates[0]} rows={3} style={{width: '100%'}} />

              <p><strong>Public Key Y:</strong></p>
              <textarea readOnly value={passkeyInfo.pubKeyCoordinates[1]} rows={3} style={{width: '100%'}} />
            </div>
        )}
      </div>
  );
}

export default PasskeyRegistrar;