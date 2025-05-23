// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;
import "hardhat/console.sol";
/**
 * Helper library for external contracts to verify P256 signatures.
 **/
library P256 {
    //Should Changd this is P256 Verifier address
    address constant VERIFIER = 0x5FbDB2315678afecb367f032d93F642f64180aa3;

    function verifySignatureAllowMalleability(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        bytes memory args = abi.encode(message_hash, r, s, x, y);
        (bool success, bytes memory ret) = VERIFIER.staticcall(args);
        assert(success); // never reverts, always returns 0 or 1

        return abi.decode(ret, (uint256)) == 1;
    }

    /// P256 curve order n/2 for malleability check
    uint256 constant P256_N_DIV_2 =
        57896044605178124381348723474703786764998477612067880171211129530534256022184;

    function verifySignature(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }
        return verifySignatureAllowMalleability(message_hash, r, s, x, y);
    }
}
