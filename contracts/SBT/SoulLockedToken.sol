pragma solidity ^0.8.19;
import {ERC5192} from "./ERC5192.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "../P256/WebAuthn.sol";
import "hardhat/console.sol";
contract SoulLockedToken is ERC5192, AccessControl, Ownable {

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

  modifier validSignature(bytes calldata signature, bytes memory credId) {
    require(
        keccak256(abi.decode(signature[7:], (Signature)).credId) == keccak256(abi.encodePacked(credId)),
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

  // only Used by web2auth roller when Auth is not valid anymore
  function burn(
    uint256 tokenId,
    bytes memory credId,
    bytes calldata signature,
    bytes32 messageHash
  )
  external
  onlyRole(WEB2AUTH_ROLE)
  validSignature(signature, credId)
  {

    require(!passKeyChecker(signature, messageHash), "SBTGuardWithPasskey : signature is not valid");
    delR1Signer(credId);
    delete passKeyAddress[tokenId][ownerOf(tokenId)];
  }

  // Anyone could check verification info here
  function authCheck(
    uint256 tokenId,
    address owner
  ) public view returns (AuthInfo memory) {
      return passKeyAddress[tokenId][owner];
  }

 // Check PassKey validity from here
  function passKeyChecker(
    bytes calldata signature,
    bytes32 messageHash
  ) public view returns (bool) {
    return _validateWebauthnSignature(signature, messageHash);
  }

  // Web2Auth rolller could update Auth when they wanted
  function updateAuth(
    bytes calldata signature,
    bytes32 messageHash,
    uint256 tokenId,
    bytes memory credId
  ) 
  public 
  onlyRole(WEB2AUTH_ROLE) 
  validSignature(signature, credId)
  {
    require(passKeyChecker(signature, messageHash), "SBTGuardWithPasskey : signature is not valid");
    passKeyAddress[tokenId][ownerOf(tokenId)].checkedAt = block.timestamp;
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC5192, AccessControl) returns (bool) {
    return ERC5192.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
  }

  //validate webauthn signature here
  function _validateWebauthnSignature(
      bytes calldata signature,
      bytes32 messageHash
    )
      internal
      view
      virtual
      returns (bool validationData)
    {
      uint256 sigLength = signature.length;
      if (sigLength == 0) return false;

      bytes memory challenge;
      uint8 version = uint8(signature[0]);
      if (sigLength >= 7) {
          uint48 validUntil = uint48(bytes6(signature[1:7]));
          signature = signature[7:];
          challenge = abi.encodePacked(version, validUntil, messageHash);
      } else {
          return false;
      }

      Signature memory sig = abi.decode(signature, (Signature)); //decode as an Signature struct
      uint256[2] memory signer = _r1Signers[sig.credId];

      return (WebAuthn.verifySignature({
          challenge: challenge,
          authenticatorData: sig.authenticatorData,
          requireUserVerification: false,
          clientDataJSON: sig.clientDataJSON,
          challengeLocation: sig.challengeLocation, // offset
          responseTypeLocation: sig.responseTypeLocation, // offset
          r: sig.r,
          s: sig.s,
          x: signer[0],
          y: signer[1]
      }));
    }

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