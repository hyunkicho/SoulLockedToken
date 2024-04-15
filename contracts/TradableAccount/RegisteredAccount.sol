pragma solidity ^0.8.19;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract RegisteredAccount is Ownable, ERC721Holder {

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
}