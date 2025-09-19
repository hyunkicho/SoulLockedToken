const express = require('express');
const cors = require('cors');
const { cborDecode } = require('@simplewebauthn/server/helpers');

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

// 프론트엔드로부터 요청을 받을 엔드포인트
app.post('/parse-attestation', (req, res) => {
    try {
        const { attestationObject } = req.body;

        if (!attestationObject) {
            return res.status(400).json({ error: 'attestationObject is missing' });
        }

        // Base64로 인코딩된 attestationObject를 Buffer로 디코딩
        const attestationObjectBuffer = Buffer.from(attestationObject, 'base64');

        // CBOR 디코딩
        const decodedAttestationObject = cborDecode(attestationObjectBuffer);
        const { authData } = decodedAttestationObject;

        // authData에서 공개키 정보 추출 (Node.js Buffer 사용)
        const flags = authData.readUInt8(32);
        if (!(flags & 0x40)) {
            throw new Error('Attested Credential Data not available.');
        }

        const credIdLen = authData.readUInt16BE(53);
        const publicKeyOffset = 55 + credIdLen;
        const publicKeyBytes = authData.slice(publicKeyOffset);

        const cosePublicKey = cborDecode(publicKeyBytes);
        const x = cosePublicKey.get(-2);
        const y = cosePublicKey.get(-3);

        if (!x || !y) {
            throw new Error('Could not extract public key coordinates.');
        }

        // 성공적으로 추출된 좌표를 프론트엔드로 전송
        res.json({
            pubKeyCoordinates: ['0x' + x.toString('hex'), '0x' + y.toString('hex')],
        });

    } catch (error) {
        console.error('Error during parsing:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`✅ Passkey parsing server listening on http://localhost:${port}`);
});