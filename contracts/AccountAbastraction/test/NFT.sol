// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TERC721 is ERC721("Test ERC721", "TERC721") {
    constructor(address receiver) {
        _mint(receiver, 0);
    }
}
