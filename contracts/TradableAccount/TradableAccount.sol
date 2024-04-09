pragma solidity ^0.8.19;
import {ITradableAccount} from "./ITradableAccount.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TradableAccount is ITradableAccount, Ownable {
    bool private listed;
    uint256 private _price;
    receive() external payable {}
    fallback() external payable {}
    constructor() {
        listed = false;
    }
    /**
     * buy owner of the account
     */
    function buyOwner(address payable receiver) public payable {
        require(listed == true, "TradableAccount: Account is listed");
        require(msg.value == _price, "TradableAccount: Price is not correct");
        (bool sent, ) = receiver.call{value: msg.value}("");
        require(sent, "TradableAccount: Ether send has failed");
        _transferOwnership(receiver);
        emit OwnerSold(receiver, _price);
    }

    /**
     * set price of the account
     */
    function setPrice(uint256 newPrice) public onlyOwner {
        _price = newPrice;
        listed=true;
        emit PriceChanged(newPrice);
    }

    /**
     * execute a transaction
     */

    function call(address target, uint256 value, bytes memory data) public onlyOwner {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function getPrice() external view returns (uint256) {
        return _price;
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) public view override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}