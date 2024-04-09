pragma solidity ^0.8.19;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFT is ERC721 {
  constructor(string memory _name, string memory _symbol)
    ERC721(_name, _symbol){}
  function safeMint(address to, uint256 tokenId) external {
    _safeMint(to, tokenId);
  }
}