// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

contract Farmer {
  struct Profile {
    string farmerName;
    string farmerPhysicalAddress;
    address payable farmerAddress;
    farmerCatalogue[] catalogue;
  }

  struct farmerCatalogue {
    string productName;
    uint256 estimatedMonthlyVolume;
    string photoHash;
  }

  mapping(address => Profile) public farmerProfiles;

  function register(string memory _name, string memory _physicalAddress)
    public
  {
    require(
      farmerProfiles[msg.sender].farmerAddress == address(0),
      "You already have a profile"
    );

    farmerProfiles[msg.sender].farmerName = _name;
    farmerProfiles[msg.sender].farmerAddress = payable(msg.sender);
    farmerProfiles[msg.sender].farmerPhysicalAddress = _physicalAddress;

    emit newFarmerRegisterd(msg.sender, _name);
  }

  function hasProfile() public view returns (bool) {
    return
      bytes(farmerProfiles[msg.sender].farmerName).length == 0 ? false : true;
  }

  function registerCatalogue(
    string memory _productName,
    uint256 _monthlyVolume,
    string memory _photoHash
  ) public {
    require(
      farmerProfiles[msg.sender].farmerAddress != address(0),
      "You don't have a farmer profile"
    );

    farmerProfiles[msg.sender].catalogue.push(
      farmerCatalogue(_productName, _monthlyVolume, _photoHash)
    );
  }

  //Creating the reference data for chemical used in harvestProduce
  struct chemical {
    string chemical;
    uint256 chemicalsDate;
  }

  struct harvestProduce {
    address farmerAddress;
    string photoHash;
    uint256 harvestCaptureDate;
    uint256 catalogueProductID;
    uint256 PHLevel;
    uint256 ECLevel;
    uint256 waterLevel;
    uint256 quantity;
    uint256 minOrderQty;
    uint256 pricePerKG;
    uint256 expiryDate;
  }

  struct HravestData {
    harvestProduce harvest;
    chemical[] chemicals;
  }

  function getHarvestData(uint256 _harvestID)
    external
    view
    returns (harvestProduce memory)
  {
    return harvestMapping[_harvestID].harvest;
  }

  function getChemicalData(uint256 _harvestID)
    external
    view
    returns (chemical[] memory)
  {
    return harvestMapping[_harvestID].chemicals;
  }

  mapping(uint256 => HravestData) public harvestMapping;
  uint256 public harvestCounter;

  //Registering a harvest instance
  function registerHarvest(
    string memory _photoHash,
    uint256 _harvestCaptureDate,
    uint256 _catalogueProductID,
    uint256 _PHLevel,
    uint256 _ECLevel,
    uint256 _waterLevel,
    uint256 _quantity,
    uint256 _minOrderQty,
    uint256 _pricePerKG,
    uint256 _expiryDate
  ) public {
    harvestProduce memory tmp = harvestProduce(
      payable(msg.sender),
      _photoHash,
      _harvestCaptureDate,
      _catalogueProductID,
      _PHLevel,
      _ECLevel,
      _waterLevel,
      _quantity,
      _minOrderQty,
      _pricePerKG,
      _expiryDate
    );

    harvestMapping[harvestCounter].harvest = tmp;
    emit registeredHarvestEvent(harvestCounter, msg.sender);
    harvestCounter++;
  }

  function addUsedChimecals(
    uint256 _harvestID,
    string memory _chemicalName,
    uint256 _chemicalDate
  ) public {
    require(
      harvestMapping[_harvestID].harvest.farmerAddress == msg.sender,
      "Harvest doesn't exists, please add the harvest first"
    );
    harvestMapping[_harvestID].chemicals.push(
      chemical(_chemicalName, _chemicalDate)
    );
  }

  function getCatalogueItems(address _farmerAddress)
    public
    view
    returns (farmerCatalogue[] memory)
  {
    return farmerProfiles[_farmerAddress].catalogue;
  }

  function getCatalogueItemsCount(address _farmerAddress)
    public
    view
    returns (uint256)
  {
    return farmerProfiles[_farmerAddress].catalogue.length;
  }

  function getCatalogueItemAtIndex(uint256 _index, address _farmerAddress)
    public
    view
    returns (
      string memory,
      uint256,
      string memory
    )
  {
    return (
      farmerProfiles[_farmerAddress].catalogue[_index].productName,
      farmerProfiles[_farmerAddress].catalogue[_index].estimatedMonthlyVolume,
      farmerProfiles[_farmerAddress].catalogue[_index].photoHash
    );
  }

  //Checks the number of harvests in the harvestMapping
  function noHarvests() public view returns (uint256) {
    return harvestCounter;
  }

  event registeredHarvestEvent(
    uint256 indexed _harvestID,
    address _farmerAddress
  );

  event newFarmerRegisterd(address indexed farmerAddress, string farmerName);
}
