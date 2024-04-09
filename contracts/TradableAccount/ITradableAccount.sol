pragma solidity ^0.8.19;
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface ITradableAccount is IERC721Receiver {

  event PriceChanged(uint256 price);

  event OwnerSold(address buyer, uint256 price);

  function buyOwner(address payable receiver) external payable;

  function setPrice(uint256 newPrice) external;

  function call(address target, uint256 value, bytes memory data) external;

  function getPrice() external view returns (uint256);
}