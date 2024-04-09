pragma solidity ^0.8.19;
import {ERC5192} from "./ERC5192.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SBTAAGaurd is ERC5192, Ownable {
  bool private isLocked;
  mapping (bytes32 => bool) public allowList;
  constructor(string memory _name, string memory _symbol, bool _isLocked)
    ERC5192(_name, _symbol, _isLocked)
  {
    isLocked = _isLocked;
  }
  function safeMint(address to, uint256 tokenId)
  external
  onlyOwner
  {
    if(caChecker(to)) {
      require(bytecodeChecker(to), "SBTAAGaurd: to account is contract and not allowed");
      _safeMint(to, tokenId);
      if (isLocked) emit Locked(tokenId);
    } else {
      _safeMint(to, tokenId);
      if (isLocked) emit Locked(tokenId);
    }
  }

  function caChecker(address account) internal view returns (bool) {
      uint32 size;
      assembly {
          size := extcodesize(account)
      }
      return size > 0;
  }

  function bytecodeChecker(address contractAddress) public view returns (bool) {
    bytes32 hashedBytecode = keccak256(contractAddress.code);
    return allowList[hashedBytecode];
  }

  function registerBytecodeHash(bytes32 hashedBytecode) public {
    allowList[hashedBytecode] = true;
  }

}