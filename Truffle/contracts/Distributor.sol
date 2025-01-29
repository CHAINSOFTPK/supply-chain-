// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

contract Distributor {
  struct Profile {
    string name;
    string physicalAddress;
    address distAddress;
  }

  mapping(address => Profile) public distProfiles;

  function register(string memory _name, string memory _physicalAddress)
    public
  {
    require(bytes(_name).length > 0, "Name is required");
    require(bytes(_physicalAddress).length > 0, "Physical address is required");
    require(distProfiles[msg.sender].distAddress == address(0), "Profile already exists");

    distProfiles[msg.sender].name = _name;
    distProfiles[msg.sender].physicalAddress = _physicalAddress;
    distProfiles[msg.sender].distAddress = msg.sender;

    emit newDistRegisterd(msg.sender, _name);
  }

  function hasProfile() public view returns(bool) {
    return address(distProfiles[msg.sender].distAddress) != address(0);
  }

  function getProfile(address _address) public view returns (Profile memory) {
    return distProfiles[_address];
  }

  event newDistRegisterd(address indexed distAddress, string distName);
}
