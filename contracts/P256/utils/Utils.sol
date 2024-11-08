// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {Base64URL} from "../WebAuthn.sol";

struct Signature {
    bytes authenticatorData;
    string clientDataJSON;
    uint256 challengeLocation;
    uint256 responseTypeLocation;
    uint256 r;
    uint256 s;
    bytes credId; // TODO: unique (for example, hash of pubkey?)
}

contract Utils {
    function rawSignatureToSignature(
        bytes memory challenge,
        uint256 r,
        uint256 s,
        bytes memory credId,
        bytes memory authenticatorData
    ) public pure returns (bytes memory) {
        string memory challengeb64url = Base64URL.encode(challenge);
        string memory clientDataJSON = string(
            abi.encodePacked(
                '{"type":"webauthn.get","challenge":"',
                challengeb64url,
                '","origin":"http://localhost:3000","crossOrigin":false}'
            )
        );

        uint256 challengeLocation = 23;
        uint256 responseTypeLocation = 1;

        // hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

        uint8 version = 1;
        uint48 validUntil = 0;

        return
            abi.encodePacked(
                version,
                validUntil,
                abi.encode(
                    Signature({
                        authenticatorData: authenticatorData,
                        clientDataJSON: clientDataJSON,
                        challengeLocation: challengeLocation,
                        responseTypeLocation: responseTypeLocation,
                        r: r,
                        s: s,
                        credId: credId
                    })
                )
            );
    }
}
