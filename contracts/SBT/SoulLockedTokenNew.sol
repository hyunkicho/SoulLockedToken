// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC5192} from "./ERC5192.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "../P256/WebAuthn.sol"; // Your WebAuthn library

contract SoulLockedTokenNew is ERC5192, AccessControl, Ownable {

    bool private isLocked;
    bytes32 public constant WEB2AUTH_ROLE = keccak256("WEB2AUTH_ROLE");

    struct Signature {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeLocation;
        uint256 responseTypeLocation;
        uint256 r;
        uint256 s;
        bytes credId;
    }

    struct AuthInfo {
        bool checked;
        uint256 checkedAt;
    }

    uint256 private _r1SignersCount;
    mapping(bytes => uint256[2]) private _r1Signers;
    mapping(uint256 => mapping(address => AuthInfo)) public passKeyAddress;

    // ✅ CHANGED: Modifier now accepts the Signature struct directly.
    modifier validSignature(Signature calldata sig, bytes calldata credId) {
        require(
            keccak256(sig.credId) == keccak256(abi.encodePacked(credId)),
            "SoulLockedToken: signature and credId do not match"
        );
        _;
    }

    constructor(string memory _name, string memory _symbol, bool _isLocked)
    ERC5192(_name, _symbol, _isLocked)
    {
        isLocked = _isLocked;
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        _grantRole(WEB2AUTH_ROLE, owner());
    }

    function safeMint(
        address to,
        uint256 tokenId,
        bytes memory credId,
        uint256[2] memory pubKeyCoordinates
    )
    external
    onlyOwner
    {
        addR1Signer(credId, pubKeyCoordinates);
        passKeyAddress[tokenId][to].checked = true;
        passKeyAddress[tokenId][to].checkedAt = block.timestamp;
        if (isLocked) emit Locked(tokenId);
        _safeMint(to, tokenId);
    }

    /**
     * @notice Creates a Signature struct in memory from its components.
     * @dev This is a helper function, useful for testing or for off-chain clients
     * to construct the signature object before calling other functions.
     * @param _authenticatorData The authenticator data from the WebAuthn response.
     * @param _clientDataJSON The client data JSON from the WebAuthn response.
     * @param _challengeLocation The starting position of the base64url-encoded challenge within the client data JSON.
     * @param _responseTypeLocation The starting position of the response type (e.g., "webauthn.get") within the client data JSON.
     * @param _r The r value of the ECDSA signature.
     * @param _s The s value of the ECDSA signature.
     * @param _credId The credential ID associated with the public key.
     * @return A Signature struct populated with the provided arguments.
     */
    function buildSignature(
        bytes calldata _authenticatorData,
        string calldata _clientDataJSON,
        uint256 _challengeLocation,
        uint256 _responseTypeLocation,
        uint256 _r,
        uint256 _s,
        bytes calldata _credId
    ) public pure returns (Signature memory) {
        return Signature({
            authenticatorData: _authenticatorData,
            clientDataJSON: _clientDataJSON,
            challengeLocation: _challengeLocation,
            responseTypeLocation: _responseTypeLocation,
            r: _r,
            s: _s,
            credId: _credId
        });
    }
    // ✅ CHANGED: Function signature refactored to accept the struct.
    function burn(
        Signature calldata sig,
        bytes calldata challenge, // The original challenge sent to the browser
        uint256 tokenId,
        bytes calldata credId
    )
    external
    onlyRole(WEB2AUTH_ROLE)
    validSignature(sig, credId)
    {
        require(!passKeyChecker(sig, challenge), "SBTGuardWithPasskey: signature is valid");
        delR1Signer(sig.credId); // Use sig.credId which is more secure
        delete passKeyAddress[tokenId][ownerOf(tokenId)];
        _burn(tokenId);
    }

    function authCheck(
        uint256 tokenId,
        address owner
    ) public view returns (AuthInfo memory) {
        return passKeyAddress[tokenId][owner];
    }

    // ✅ CHANGED: The main verification function is now clean and efficient.
    function passKeyChecker(
        Signature calldata sig,
        bytes calldata challenge // This is the original random challenge from the browser
    ) public view returns (bool) {
        uint256[2] memory signer = _r1Signers[sig.credId];

        // Check if the signer exists
        if (signer[0] == 0 && signer[1] == 0) {
            return false;
        }

        // Call the WebAuthn library with the correct parameters
        return WebAuthn.verifySignature(
            challenge,
            sig.authenticatorData,
            true, // Always require user verification for security
            sig.clientDataJSON,
            sig.challengeLocation,
            sig.responseTypeLocation,
            sig.r,
            sig.s,
            signer[0],
            signer[1]
        );
    }

    // ✅ CHANGED: Function signature refactored to accept the struct.
    function updateAuth(
        Signature calldata sig,
        bytes calldata challenge,
        uint256 tokenId,
        bytes calldata credId
    )
    public
    onlyRole(WEB2AUTH_ROLE)
    validSignature(sig, credId)
    {
        require(passKeyChecker(sig, challenge), "SBTGuardWithPasskey: signature is not valid");
        passKeyAddress[tokenId][ownerOf(tokenId)].checkedAt = block.timestamp;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC5192, AccessControl) returns (bool) {
        return ERC5192.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    // ❌ REMOVED: The old, memory-intensive _validateWebauthnSignature function is no longer needed.
    // The logic is now correctly placed inside passKeyChecker.

    function addR1Signer(
        bytes memory credId,
        uint256[2] memory pubKeyCoordinates
    ) internal {
        require(
            (_r1Signers[credId][0] == 0) && (_r1Signers[credId][1] == 0),
            "SBTGuardWithPasskey: signer already set"
        );
        _r1Signers[credId] = pubKeyCoordinates;
        _r1SignersCount++;
    }

    function delR1Signer(bytes memory credId) internal {
        require(
            (_r1Signers[credId][0] != 0) || (_r1Signers[credId][1] != 0),
            "SBTGuardWithPasskey: no signer"
        );
        delete _r1Signers[credId];
        _r1SignersCount--;
    }
}