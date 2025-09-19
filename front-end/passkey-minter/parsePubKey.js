// parsePubKey.js
const { decode } = require('cbor');

// 이 스크립트는 터미널에서 Base64 문자열을 인자로 받습니다.
const rawAttestationBase64 = process.argv[2];

if (!rawAttestationBase64) {
    console.error("Error: Please provide the Base64 attestation object as an argument.");
    console.error("Usage: node parsePubKey.js <base64_string>");
    process.exit(1);
}

try {
    // Base64를 Node.js Buffer로 변환
    const attestationObjectBuffer = Buffer.from(rawAttestationBase64, 'base64');

    // CBOR 디코딩
    const attestationObject = decode(attestationObjectBuffer);
    const { authData } = attestationObject; // authData는 이제 Buffer 입니다.

    // Node.js Buffer의 내장 함수를 사용하여 안전하게 파싱
    const flags = authData.readUInt8(32);
    if (!(flags & 0x40)) {
        throw new Error('Attested Credential Data not available.');
    }

    const credIdLen = authData.readUInt16BE(53);
    const publicKeyOffset = 55 + credIdLen;
    const publicKeyBytes = authData.slice(publicKeyOffset);

    const cosePublicKey = decode(publicKeyBytes);

    const x = cosePublicKey.get(-2);
    const y = cosePublicKey.get(-3);

    if (!x || !y) {
        throw new Error('Public key coordinates (x, y) could not be extracted.');
    }

    console.log("✅ Success! Use these values to mint:");
    console.log("Public Key X:", '0x' + x.toString('hex'));
    console.log("Public Key Y:", '0x' + y.toString('hex'));

} catch (error) {
    console.error("❌ Failed to parse:", error.message);
}