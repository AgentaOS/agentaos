// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AgentaTest — minimal contract to test threshold wallet + Forge integration
contract AgentaTest {
    address public immutable deployer;
    string public greeting;

    constructor(string memory _greeting) {
        deployer = msg.sender;
        greeting = _greeting;
    }

    function setGreeting(string calldata _greeting) external {
        greeting = _greeting;
    }
}
