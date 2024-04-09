pragma solidity ^0.8.19;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract RegisteredAccount is Ownable {

    receive() external payable {}
    fallback() external payable {}

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

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external view returns (bytes4) {
        return this.onERC721Received.selector;
    }
}