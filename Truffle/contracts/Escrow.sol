pragma solidity ^0.8.1;
// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable {
  uint256 public fee;
  uint256 collectedFee;
  IERC20 token;

  enum PaymentStatus {
    PAID,
    APPROVED_BY_CUSTOMER,
    COMPLETED,
    REFUNDED,
    CANCELLED
  }

  function getPaymentStatus(PaymentStatus _paymentStatus)
    external
    pure
    returns (string memory)
  {
    if (PaymentStatus.PAID == _paymentStatus) return "PAID";
    if (PaymentStatus.APPROVED_BY_CUSTOMER == _paymentStatus)
      return "APPROVED_BY_CUSTOMER";
    if (PaymentStatus.COMPLETED == _paymentStatus) return "COMPLETED";
    if (PaymentStatus.REFUNDED == _paymentStatus) return "REFUNDED";
    if (PaymentStatus.CANCELLED == _paymentStatus) return "CANCELLED";
    return "NOT FOUND";
  }

  event Deposited(address indexed customer, uint256 amount);
  event Withdrawn(address indexed farmer, uint256 amount);

  struct Payment {
    address payable customer;
    address payable farmer;
    uint256 amount;
    PaymentStatus status;
    bool refundApproved;
    bool isCancelled;
  }

  mapping(uint256 => Payment) public payments;

  function getPayment(uint256 _paymentID)
    external
    view
    returns (Payment memory)
  {
    return payments[_paymentID];
  }

  constructor(IERC20 _token, uint256 _fee) {
    token = _token;
    fee = _fee;
  }

  modifier requiresFee() {
    require(msg.value >= fee, "Not enough value.");
    _;
  }

  function transferFee() public onlyOwner {
    token.approve(owner(), collectedFee);
    token.transfer(owner(), collectedFee);
    collectedFee = 0;
  }

  function approveOrderDelivery(uint256 _orderId) external {
    require(
      payments[_orderId].status == PaymentStatus.PAID,
      "Order must be paid"
    );

    payments[_orderId].status = PaymentStatus.APPROVED_BY_CUSTOMER;
  }

  function setOrderCancelled(uint256 _orderId) external {
    require(payments[_orderId].status == PaymentStatus.PAID);

    payments[_orderId].status = PaymentStatus.CANCELLED;
    payments[_orderId].isCancelled = true;
  }

  function deposit(
    uint256 _orderId,
    address payable _customer,
    address payable _farmer,
    uint256 _amount
  ) external payable {
    token.transferFrom(_customer, address(this), _amount + fee);

    payments[_orderId] = Payment(
      _customer,
      _farmer,
      _amount,
      PaymentStatus.PAID,
      false,
      false
    );

    collectedFee += fee;
    emit Deposited(msg.sender, _amount);
  }

  function approveRefund(uint256 _orderId) external {
    require(payments[_orderId].status == PaymentStatus.PAID);

    payments[_orderId].refundApproved = true;
  }

  function refund(uint256 _orderId) external {
    require(
      payments[_orderId].refundApproved || payments[_orderId].isCancelled
    );
    token.transfer(payments[_orderId].customer, payments[_orderId].amount);
    payments[_orderId].status = PaymentStatus.REFUNDED;
  }

  function withdraw(uint256 _orderId) external {
    require(
      payments[_orderId].status == PaymentStatus.APPROVED_BY_CUSTOMER,
      "The payment is still in escrow."
    );
    uint256 payment = payments[_orderId].amount;
    token.transfer(payments[_orderId].farmer, payment);
    payments[_orderId].status = PaymentStatus.COMPLETED;
    emit Withdrawn(payments[_orderId].farmer, payment);
  }
}
