pragma solidity ^0.8.19;
import {ERC5192} from "./ERC5192.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
contract SBTAAGaurdWithWeb2 is ERC5192, AccessControl, Ownable {
  bool private isLocked;
  mapping(address => bool) public web2WhitelistAddress;
  bytes32 public constant WEB2AUTH_ROLE = keccak256("WEB2AUTH_ROLE");

  constructor(string memory _name, string memory _symbol, bool _isLocked)
    ERC5192(_name, _symbol, _isLocked)
  {
    isLocked = _isLocked;
    _grantRole(DEFAULT_ADMIN_ROLE, owner());
    _grantRole(WEB2AUTH_ROLE, owner());
  }
  function safeMint(address to, uint256 tokenId)
  external
  onlyOwner
  {
    require(!caChecker(to), "SBTAAGaurdWithWeb2 : to address is contract account");
    require(web2WhitelistAddress[to], "SBTAAGaurdWithWeb2 : to address is not web2 whitelisted");
    _safeMint(to, tokenId);
    if (isLocked) emit Locked(tokenId);
  }

  function caChecker(address account) internal view returns (bool) {
      uint32 size;
      assembly {
          size := extcodesize(account)
      }
      return size > 0;
  }

  function addWeb2Whitelist(address account)
  external
  onlyRole(WEB2AUTH_ROLE)
  {
    web2WhitelistAddress[account]=true;
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC5192, AccessControl) returns (bool) {
    return ERC5192.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
  }
}