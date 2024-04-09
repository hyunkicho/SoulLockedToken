// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.12;

import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";

// TODO: upgradeable
contract AccountFactory is SimpleAccountFactory {
    constructor(IEntryPoint _entryPoint) SimpleAccountFactory(_entryPoint){}

}
