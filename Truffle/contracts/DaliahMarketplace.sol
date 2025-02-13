// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

import "./Farmer.sol";
import "./Distributor.sol";
import "./Escrow.sol";

contract DaliahMarketplace {
  Farmer public farmer;
  Distributor public dist;
  Escrow public escrow;

  constructor(
    Farmer _farmer,
    Distributor _dist,
    Escrow _escrow
  ) {
    farmer = _farmer;
    dist = _dist;
    escrow = _escrow;
  }

  struct Carrier {
    uint256 orderStatus; // 0 = Pending // 1 = On the way // 2 = Deliverd
    string carrierName;
    uint256 carPlateNumber;
    uint256 vehicleTemp;
    string vehicleTempImage;
    uint256 pickupDate;
    string pickupDateImage;
    uint256 deliveredAt;
    string deliveredAtImage;
  }

  //Creating the reference data for order
  struct Order {
    uint256 productID;
    uint256 quantity;
    uint256 totalPrice;
    //uint256 distributorID;
    address distributorAddress;
    address farmerAddress;
    address carrierAddress;
    Carrier carrier;
    bool isCompleted;
    uint256 isAccepted; // 0 = pending / 1 = accepted / 2 = rejected
    bool isCancelled;
    bool isRefundApproved;
    bool isRefundRequested;
    DamageCase[] damages;
  }

  function getDamages(uint256 _orderID)
    public
    view
    returns (DamageCase[] memory)
  {
    return ordersMapping[_orderID].damages;
  }

  mapping(uint256 => Order) public ordersMapping;
  uint256 public orderCounter;

  // Placing order by the distributor
  function placeOrder(
    uint256 _productID,
    uint256 _quantity,
    address _farmerAddress
  ) public {
    require(
      dist.hasProfile(),  // Fixed negation
      "You should have a profile in order to place an order"
    );
    // set order isCompleted to false by defualt,
    //where there will be another function to mark order as completed from both parties farmer and distributor

    escrow.deposit(
      orderCounter,
      payable(msg.sender),
      payable(_farmerAddress),
      getOrderTotalPrice(_productID, _quantity)
    );
    //ordersMapping[orderCounter].orderID = orderCounter;
    ordersMapping[orderCounter].productID = _productID;
    ordersMapping[orderCounter].quantity = _quantity;
    ordersMapping[orderCounter].totalPrice = getOrderTotalPrice(
      _productID,
      _quantity
    );
    ordersMapping[orderCounter].distributorAddress = msg.sender;
    ordersMapping[orderCounter].farmerAddress = _farmerAddress;

    emit newOrderEvent(orderCounter);
    orderCounter++;
  }

  function getOrderPaymentDeatils(uint256 _orderID)
    public
    view
    returns (
      address payable,
      address payable,
      uint256,
      string memory,
      bool,
      bool
    )
  {
    return (
      escrow.getPayment(_orderID).customer,
      escrow.getPayment(_orderID).farmer,
      escrow.getPayment(_orderID).amount,
      escrow.getPaymentStatus(escrow.getPayment(_orderID).status),
      escrow.getPayment(_orderID).refundApproved,
      escrow.getPayment(_orderID).isCancelled
    );
  }

  function getOrderTotalPrice(uint256 _harvestID, uint256 _qty)
    public
    view
    returns (uint256)
  {
    require(
      farmer.getHarvestData(_harvestID).minOrderQty <= _qty,
      "The requested Qty is less than the minimum ordering qty"
    );

    return farmer.getHarvestData(_harvestID).pricePerKG * _qty * 1 ether;
  }

  function requestRefund(uint256 _orderID) public {
    require(
      ordersMapping[_orderID].distributorAddress == msg.sender,
      "You are not authorized to request a refund"
    );
    require(
      ordersMapping[_orderID].isAccepted != 0,
      "Farmer didn't accept your order, you can cancel it and get a refund"
    );

    ordersMapping[_orderID].isRefundRequested = true;
  }

  function approveRefund(uint256 _orderID) public {
    require(
      msg.sender == ordersMapping[_orderID].farmerAddress,
      "You are not authroized to approve refunds"
    );
    escrow.approveRefund(_orderID);
    ordersMapping[_orderID].isRefundApproved = true;
  }

  function withdrawRefund(uint256 _orderID) public {
    escrow.refund(_orderID);
  }

  // Function foir the disturbutor to able to cancel the order before it get accepted by the farmer while it's pending
  function cancelOrder(uint256 _orderID) public {
    require(
      ordersMapping[_orderID].distributorAddress == msg.sender,
      "You are not authorized to adjust order"
    );

    require(
      ordersMapping[_orderID].isAccepted == 0,
      "You can't cancel accepted orders, Contact your farmer"
    );

    ordersMapping[_orderID].isCancelled = true;
    ordersMapping[_orderID].isRefundApproved = true;
    ordersMapping[_orderID].isRefundRequested = true;

    escrow.setOrderCancelled(_orderID);
  }

  // Set order as complete by distributor and check if the transaction came from distributor address
  function setOrderCompleted(uint256 _orderID) public {
    require(
      msg.sender == ordersMapping[_orderID].distributorAddress,
      "You are not authorized to set order as completed"
    );
    require(
      ordersMapping[_orderID].isAccepted == 1,
      "You can't adjust orders that are not accepted or cancelled, Contact your farmer"
    );
    require(
      !ordersMapping[_orderID].isCancelled,
      "You can't set order completed, Your order is cancelled"
    );
    escrow.approveOrderDelivery(_orderID);
    ordersMapping[_orderID].isCompleted = true;
    emit orderCompetedEvent(_orderID);
  }

  function withdrawMoney(uint256 _orderID) public {
    escrow.withdraw(_orderID);
  }

  // Set order as accepted by farmer and check if the transaction came from farmer address
  function changeOrderStatus(
    uint256 _orderID,
    uint256 status,
    string memory reason
  ) public {
    require(
      msg.sender == ordersMapping[_orderID].farmerAddress,
      "You are not authorized to set order as accepted"
    );
    require(
      ordersMapping[_orderID].isAccepted == 0,
      "You can't change the status of the order after getting marked accepted or rejected"
    );
    ordersMapping[_orderID].isAccepted = status;
    emit orderAcceptedEvent(_orderID, status, reason);
  }

  function inviteCarrier(uint256 _orderID, address _carrierAdress) public {
    require(
      msg.sender == ordersMapping[_orderID].distributorAddress,
      "You are not authorized to invite carriers"
    );
    require(
      ordersMapping[_orderID].carrierAddress == address(0),
      "Carrier Invitation Already"
    );

    ordersMapping[_orderID].carrierAddress = _carrierAdress;

    emit carrierInvitation(_orderID, _carrierAdress);
  }

  function acceptCarrierInvitation(
    uint256 _orderID,
    string memory _carrierName,
    uint256 _carPlateNumber
  ) public {
    require(
      ordersMapping[_orderID].carrierAddress == msg.sender,
      "You can't accept this invitation, You do not have any active invitations"
    );
    require(
      ordersMapping[_orderID].carrier.carPlateNumber == 0,
      "You already accepted the invitation"
    );

    ordersMapping[_orderID].carrier.carrierName = _carrierName;
    ordersMapping[_orderID].carrier.carPlateNumber = _carPlateNumber;
    ordersMapping[_orderID].carrier.orderStatus = 0;

    emit orderShippingStatusUpdated(
      _orderID,
      "Carrier accepted the order and should be picked up soon!"
    );
    emit carrierInvitationAccepted(_orderID, msg.sender);
  }

  function updateOrderPickupTime(uint256 _orderID, string memory _imageHash)
    public
  {
    require(
      msg.sender == ordersMapping[_orderID].carrierAddress,
      "You are not authorized to update order status!"
    );
    require(
      ordersMapping[_orderID].carrier.pickupDate == 0,
      "Order Already Picked up!"
    );

    ordersMapping[_orderID].carrier.pickupDate = block.timestamp;
    ordersMapping[_orderID].carrier.pickupDateImage = _imageHash;
    ordersMapping[_orderID].carrier.orderStatus = 1;

    emit orderShippingStatusUpdated(
      _orderID,
      "Order has been picked up and on the way to the distributor!"
    );
  }

  function setVehicleTemp(
    uint256 _orderID,
    uint256 _temp,
    string memory _imageHash
  ) public {
    require(
      msg.sender == ordersMapping[_orderID].carrierAddress,
      "You are not authorized to update order status"
    );
    require(
      ordersMapping[_orderID].carrier.deliveredAt == 0,
      "Order Already deliverd"
    );

    ordersMapping[_orderID].carrier.vehicleTemp = _temp;
    ordersMapping[_orderID].carrier.vehicleTempImage = _imageHash;
  }

  function markOrderAsDelivered(uint256 _orderID, string memory _imageHash)
    public
  {
    require(
      msg.sender == ordersMapping[_orderID].carrierAddress,
      "You are not authorized to update order status"
    );
    require(
      ordersMapping[_orderID].carrier.deliveredAt == 0,
      "Order Already deliverd"
    );

    ordersMapping[_orderID].carrier.deliveredAt = block.timestamp;
    ordersMapping[_orderID].carrier.deliveredAtImage = _imageHash;
    ordersMapping[_orderID].carrier.orderStatus = 2;

    emit orderShippingStatusUpdated(
      _orderID,
      "Order has been deliverd to the distributor!"
    );
  }

  // Check the number of orders in ordersMapping
  function noOrders() public view returns (uint256) {
    return orderCounter;
  }

  struct DamageCase {
    string _imageHash;
    string caseDesc;
  }

  function reportDamages(
    uint256 _orderID,
    string memory _caseDesc,
    string memory _imageHash
  ) public {
    ordersMapping[_orderID].damages.push(DamageCase(_caseDesc, _imageHash));

    emit damageCase(_orderID, _caseDesc, _imageHash);
  }

  event newOrderEvent(uint256 indexed _orderID);

  event damageCase(
    uint256 indexed _orderID,
    string _caseDesc,
    string _imageHash
  );

  event orderAcceptedEvent(
    uint256 indexed _orderID,
    uint256 orderStatus,
    string notes
  );

  event orderCompetedEvent(uint256 indexed _orderID);

  event carrierInvitation(uint256 indexed _orderID, address carrierAddress);

  event carrierInvitationAccepted(
    uint256 indexed _orderID,
    address carrierAddress
  );

  event orderShippingStatusUpdated(
    uint256 indexed _orderID,
    string _orderStatus
  );
}
