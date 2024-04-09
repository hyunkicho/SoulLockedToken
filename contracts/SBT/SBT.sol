pragma solidity ^0.8.19;
import {ERC5192} from "./ERC5192.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SBT is ERC5192, Ownable {
  bool private isLocked;
  constructor(string memory _name, string memory _symbol, bool _isLocked)
    ERC5192(_name, _symbol, _isLocked)
  {
    isLocked = _isLocked;
  }
  function safeMint(address to, uint256 tokenId)
  external
  onlyOwner
  {
    _safeMint(to, tokenId);
    if (isLocked) emit Locked(tokenId);
  }
}