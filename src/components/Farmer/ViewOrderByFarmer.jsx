import { Card, notification, Badge, Descriptions, Image, Space, Table, Tag, Col, Row, Typography, Button, Alert } from "antd";
import { NavLink } from "react-router-dom";
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getEllipsisTxt } from "helpers/formatters";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";
import Distributor from "contracts/Distributor.json";

const { Title } = Typography;

const safeBigNumber = (value) => {
  try {
    if (!value) return ethers.BigNumber.from(0);
    return ethers.BigNumber.from(value);
  } catch (error) {
    console.warn('Error converting to BigNumber:', error);
    return ethers.BigNumber.from(0);
  }
};

const safeDate = (timestamp) => {
  try {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp.toNumber() * 1000);
    return date.toLocaleString();
  } catch (error) {
    console.warn('Error converting timestamp:', error);
    return 'Unknown';
  }
};

const safeContractCall = async (contract, method, ...args) => {
  try {
    return await contract[method](...args);
  } catch (error) {
    console.warn(`Error calling ${method}:`, error);
    return null;
  }
};

// Add timestamp and price formatting helpers
const formatTimestamp = (timestamp) => {
  try {
    if (!timestamp || timestamp.toNumber() === 0) return null;
    return new Date(timestamp.toNumber() * 1000).toLocaleString();
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return null;
  }
};

const formatPrice = (price) => {
  try {
    if (!price) return '0';
    return ethers.utils.formatEther(price);
  } catch (error) {
    console.warn('Error formatting price:', error);
    return '0';
  }
};

const getCarrierStatus = (orderData) => {
  try {
    if (!orderData.carrierAddress ||
        orderData.carrierAddress === ethers.constants.AddressZero) {
      return "CARRIER NOT INVITED";
    }

    // Check if carrier details exist
    if (!orderData.carrier?.carrierName) {
      return "WAITING ACCEPTANCE";
    }

    // Check delivered status first
    if (orderData.carrier.deliveredAt?.toString() !== "0") {
      return "DELIVERED";
    }

    // Check pickup status
    if (orderData.carrier.pickupDate?.toString() !== "0") {
      return "ON THE WAY";
    }

    // If carrier is assigned but hasn't picked up
    return "WAITING PICKUP";
  } catch (error) {
    console.warn("Error getting carrier status:", error);
    return "UNKNOWN";
  }
};

export default function ViewOrderByFarmer() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);
  const { order_id } = useParams();
  const [damagesData, setDamagesData] = useState(null);

  const reportsCols = [
    {
      title: 'Case #',
      dataIndex: 'case',
      key: 'case',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Proof Image',
      dataIndex: 'image',
      key: 'image',
      render: (image) => <center><Image width={100} src={image} /></center>,
    },
  ];

  const fetchOrderData = async () => {
    try {
      if (!provider || !order_id) {
        throw new Error("Provider or order ID not available");
      }

      const signer = provider.getSigner();
      const chainId = provider.network.chainId;

      // Initialize contracts with error handling
      const marketplaceContract = new ethers.Contract(
        DaliahMarketplace.networks[chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const farmerContract = new ethers.Contract(
        FarmerContract.networks[chainId].address,
        FarmerContract.abi,
        signer
      );

      const distributorContract = new ethers.Contract(
        Distributor.networks[chainId].address,
        Distributor.abi,
        signer
      );

      // Get all data with proper error handling
      const orderData = await safeContractCall(marketplaceContract, 'ordersMapping', order_id);
      if (!orderData) throw new Error("Order not found");

      // Get harvest data with error handling
      const harvestData = await safeContractCall(farmerContract, 'harvestMapping', orderData.productID);
      if (!harvestData) throw new Error("Harvest data not found");

      // Get payment data and damages
      const [paymentData, damages] = await Promise.all([
        safeContractCall(marketplaceContract, 'getOrderPaymentDeatils', order_id),
        safeContractCall(marketplaceContract, 'getDamages', order_id)
      ]);

      // Format damages data
      if (damages && damages.length > 0) {
        const formattedDamages = damages.map((damage, index) => ({
          key: index,
          case: index,
          description: damage[0] || "",
          image: damage[1] ? `https://gateway.pinata.cloud/ipfs/${damage[1]}` : ""
        }));
        setDamagesData(formattedDamages);
      }

      // Get product details
      let productName = "Unknown Product";
      if (harvestData.catalogueProductID) {
        try {
          const catalogueItem = await safeContractCall(
            farmerContract,
            'getCatalogueItemAtIndex',
            harvestData.catalogueProductID,
            harvestData.farmerAddress
          );
          if (catalogueItem && catalogueItem[0]) {
            productName = catalogueItem[0];
          }
        } catch (error) {
          console.warn("Error getting catalogue item:", error);
        }
      }

      // Get distributor profile
      let distProfile = { name: "", physicalAddress: "" };
      if (orderData.distributorAddress !== ethers.constants.AddressZero) {
        try {
          distProfile = await safeContractCall(
            distributorContract,
            'distProfiles',
            orderData.distributorAddress
          );
        } catch (error) {
          console.warn("Error getting distributor profile:", error);
        }
      }

      // Format the final data
      const formattedData = {
        harvestID: orderData.productID?.toNumber() || 0,
        productName,
        harvestCaptureDate: harvestData.harvestCaptureDate ? 
          new Date(harvestData.harvestCaptureDate.toNumber() * 1000).toLocaleString() : "",
        expiryDate: harvestData.expiryDate ? 
          new Date(harvestData.expiryDate.toNumber() * 1000).toLocaleString() : "",
        orderStatus: orderData.isAccepted?.toNumber() || 0,
        harvestPhotoUrl: harvestData.photoHash ? 
          `https://gateway.pinata.cloud/ipfs/${harvestData.photoHash}` : "",
        distAddress: orderData.distributorAddress || ethers.constants.AddressZero,
        distName: distProfile?.name || "",
        distShippiingAddress: distProfile?.physicalAddress || "",
        carrierAddress: orderData.carrierAddress || ethers.constants.AddressZero,
        carrierName: orderData.carrier?.carrierName || "",
        carPlateNumber: orderData.carrier?.carPlateNumber?.toNumber() || 0,
        vehicleTemp: orderData.carrier?.vehicleTemp?.toNumber() || 0,
        vehicleTempImage: orderData.carrier?.vehicleTempImage ? 
          `https://gateway.pinata.cloud/ipfs/${orderData.carrier.vehicleTempImage}` : "",
        pickupDate: orderData.carrier?.pickupDate ? formatTimestamp(orderData.carrier.pickupDate) : null,
        deliveredAt: orderData.carrier?.deliveredAt ? formatTimestamp(orderData.carrier.deliveredAt) : null,
        pricePerKG: formatPrice(orderData.pricePerKG),
        qty: orderData.quantity?.toNumber() || 0,
        totalAmount: formatPrice(paymentData[2]),
        paymentStatus: paymentData?.[3] || "",
        isRefundRequested: orderData.isRefundRequested || false,
        isRefundApproved: orderData.isRefundApproved || false
      };

      setResponses(formattedData);

    } catch (error) {
      console.error("Error fetching order data:", error);
      notification.error({
        message: "Error",
        description: error.message || "Failed to fetch order data"
      });
    } finally {
      setLoading(false);
    }
  };

  const approveOrder = async () => {
    try {
      const signer = provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const tx = await marketplaceContract.changeOrderStatus(
        order_id,
        1, // approve status
        "None" // reason
      );

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Order has been accepted!"
      });

      fetchOrderData();
    } catch (error) {
      console.error("Error approving order:", error);
      notification.error({
        message: "Error",
        description: error.message
      });
    }
  };

  const rejectOrder = async () => {
    try {
      const signer = provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const tx = await marketplaceContract.changeOrderStatus(
        order_id,
        2, // reject status
        "Quantity is not available, sorry!" // reason
      );

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Order has been rejected successfully!"
      });

      fetchOrderData();
    } catch (error) {
      console.error("Error rejecting order:", error);
      notification.error({
        message: "Error",
        description: error.message
      });
    }
  };

  const withdrawMoney = async () => {
    try {
      const signer = provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const tx = await marketplaceContract.withdrawMoney(order_id);

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Your money has been released to your wallet!"
      });

      fetchOrderData();
    } catch (error) {
      console.error("Error withdrawing money:", error);
      notification.error({
        message: "Error",
        description: error.message
      });
    }
  };

  const approveRefund = async () => {
    try {
      const signer = provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const tx = await marketplaceContract.approveRefund(order_id);

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Refund has been approved!"
      });

      fetchOrderData();
    } catch (error) {
      console.error("Error approving refund:", error);
      notification.error({
        message: "Error",
        description: error.message
      });
    }
  };

  useEffect(() => {
    if (provider && isAuthenticated) {
      setLoading(true);
      fetchOrderData();
    }
  }, [provider, isAuthenticated]);

  return (
    <div>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}

      {isAuthenticated === true && (
        <>
          <center>
            <Title>Order #{order_id}</Title>
          </center>
          <NavLink to="/farmer/orders">
            <Button style={{ margin: "10px" }} type="primary">
              {"< "}Back
            </Button>
          </NavLink>
          <Card
            style={{
              boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
              border: "1px solid #e7eaf3",
              borderRadius: "0.5rem", minWidth: "850px"
            }}
            title={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "F2F2F2",
                }}
              >
                <b>Order ID: </b> {order_id}
              </div>
            }
            size="large"
          >
            <Row>
              <Col span={24}>
                {responses.isRefundRequested && !responses.isRefundApproved && (
                  <>
                    <Alert
                      style={{ margin: "10px 10px" }}
                      showIcon
                      message="The distributor requested a refund for this order! Please check damage cases and contact the distributor in order to make things right!"
                      type="warning"
                    />
                  </>
                )}
                <Card
                  title="📦🌱 Order Deatils"
                  size="large"
                  style={{
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem",
                  }}
                >
                  <Row>
                    <Col span={12}>
                      <h3>
                        <b>Harvest Batch ID:</b> {responses.harvestID}
                      </h3>
                      <h3>
                        <b>Harvest Type:</b> {responses.productName}
                      </h3>
                      <h3>
                        <b>Harvest Capture Date:</b>
                        {responses.harvestCaptureDate}
                      </h3>
                      <h3>
                        <b>Expiry Date:</b> {responses.expiryDate}
                      </h3>
                    </Col>
                    <Col span={12}>
                      <h3 style={{ display: "flex" }}>
                        <b>Status</b>:{" "}
                        <div style={{ marginLeft: "5px" }}>
                          {responses.orderStatus == 0 && (
                            <>
                              <Tag icon={<SyncOutlined spin />} color="warning">
                                WAITING YOUR APPROVAL
                              </Tag>
                            </>
                          )}
                          {responses.orderStatus == 1 && (
                            <>
                              <Tag
                                icon={<CheckCircleOutlined />}
                                color="success"
                              >
                                APPROVED BY YOU
                              </Tag>
                            </>
                          )}
                          {responses.orderStatus == 2 && (
                            <>
                              <Tag icon={<CloseCircleOutlined />} color="error">
                                REJECTED
                              </Tag>
                            </>
                          )}
                        </div>
                      </h3>
                      <h3>
                        <b>Harvest Image:</b>{" "}
                        <a
                          href={responses.harvestPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Image
                        </a>
                      </h3>
                      <h3>
                        <b>Distributor profile</b>:{" "}
                        <a href="#" target="_blank" rel="noreferrer">
                          View Profile
                        </a>
                      </h3>
                      <h3 style={{ display: "flex" }}>
                        <b>Distributor Address</b>:{"  "}
                        <Address
                          avatar={null}
                          copyable
                          address={responses.distAddress}
                          size={8}
                          style={{ height: "28px", marginLeft: "5px" }}
                        />
                      </h3>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row style={{ marginTop: "10px" }}>
              <Col span={12}>
                {" "}
                <Card
                  title="🚐 Shipping Information"
                  size="large"
                  style={{
                    marginRight: "5px",
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem", minHeight: "341px",
                  }}
                >
                  <h3>
                    <b>Full Name:</b> {responses.distName}
                  </h3>
                  <h3>
                    <b>Shipping Address</b>: {responses.distShippingAddress}
                  </h3>
                  <h3 style={{ display: "-webkit-inline-box" }}>
                    <b>Carrier Address</b>:{"  "}
                    {responses.carrierAddress ==
                      "0x0000000000000000000000000000000000000000" && (
                        <>
                          <Tag icon={<SyncOutlined spin />} color="volcano">
                            Carrier Not Invited Yet
                          </Tag>
                        </>
                      )}
                    {responses.carrierAddress !=
                      "0x0000000000000000000000000000000000000000" && (
                        <>
                          <Address
                            avatar={null}
                            copyable
                            address={responses.carrierAddress}
                            size={8}
                            style={{ height: "28px", marginLeft: "5px" }}
                          />
                        </>
                      )}
                  </h3>
                  <h3>
                    <b>Carrier Name:</b>{" "}
                    {responses.carrierName && responses.carrierName}
                    {!responses.carrierName && (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                  <h3>
                    <b>Car Plate Number:</b>{" "}
                    {responses.carPlateNumber !== 0 && responses.carPlateNumber}
                    {!responses.carPlateNumber && (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                  <h3>
                    <b>Car Temperature:</b>{" "}
                    {responses.vehicleTemp !== 0 && (
                      <>
                        {responses.vehicleTemp}{" "}
                        <a
                          href={responses.vehicleTempImage}
                          target="_blank"
                          rel="noreferrer"
                        >
                          (Proof Image)
                        </a>
                      </>
                    )}
                    {!responses.vehicleTemp && (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                  <h3>
                    <b>Pickup Time:</b>{" "}
                    {responses.pickupDate !== 0 && (
                      <>
                        {responses.pickupDate}{" "}
                        <a
                          href={responses.pickupDateImage}
                          target="_blank"
                          rel="noreferrer"
                        >
                          (Proof Image)
                        </a>
                      </>
                    )}
                    {!responses.pickupDate && (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                  <h3>
                    <b>Delivered At:</b>{" "}
                    {responses.deliveredAt !== 0 && (
                      <>
                        {responses.deliveredAt}{" "}
                        <a
                          href={responses.deliveredAtImage}
                          target="_blank"
                          rel="noreferrer"
                        >
                          (Proof Image)
                        </a>
                      </>
                    )}
                    {!responses.deliveredAt && (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                </Card>
              </Col>
              <Col span={12}>
                {" "}
                <Card
                  title="💰 Payment Information"
                  size="large"
                  style={{
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem", minHeight: "341px"
                  }}
                >
                  <h3 style={{ display: "flex" }}>
                    <b>Status</b>:{" "}
                    <div style={{ marginLeft: "5px" }}>
                      {responses.paymentStatus == "PAID" && (
                        <>
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            PAID
                          </Tag>
                          <Tag icon={<SyncOutlined spin />} color="processing">
                            MONEY IN ESCROW
                          </Tag>
                        </>
                      )}
                      {responses.paymentStatus == "APPROVED_BY_CUSTOMER" && (
                        <>
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            APPROVED DELIVERY
                          </Tag>
                          <Tag icon={<SyncOutlined spin />} color="processing">
                            WAITING WITHDRAW BY YOU
                          </Tag>
                        </>
                      )}
                      {responses.paymentStatus == "CANCELLED" && (
                        <>
                          <Tag icon={<SyncOutlined spin />} color="volcano">
                            PENDING REFUND BY DISTRIBUTOR
                          </Tag>
                        </>
                      )}
                      {responses.paymentStatus == "REFUNDED" && (
                        <>
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            REFUNDED
                          </Tag>
                        </>
                      )}
                      {responses.paymentStatus == "COMPLETED" && (
                        <>
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            COMPLETED
                          </Tag>
                        </>
                      )}
                      {responses.isRefundApproved &&
                        responses.isRefundRequested && (
                          <>
                            <Tag icon={<CheckCircleOutlined />} color="success">
                              REFUND APPROVED
                            </Tag>
                          </>
                        )}
                      {responses.isRefundApproved == false &&
                        responses.isRefundRequested && (
                          <>
                            <Tag icon={<CheckCircleOutlined />} color="volcano">
                              REFUND NOT APPROVED YET
                            </Tag>
                          </>
                        )}
                      {responses.isRefundApproved == true &&
                        responses.isRefundRequested && (
                          <>
                            <Tag icon={<CheckCircleOutlined />} color="volcano">
                              REFUND APPROVED BY YOU
                            </Tag>
                          </>
                        )}
                    </div>
                  </h3>
                  <h3>
                    <b>Price:</b> {responses.pricePerKG} JODT/KG
                  </h3>
                  <h3>
                    <b>Quantity</b>: {responses.qty} KG
                  </h3>
                  <h3>
                    <b>Marketplace Fee's</b>: 25 JODT (Paid by Distributor)
                  </h3>
                  <h3>
                    <b>Total Amount</b>: {responses.totalAmount + 25} JODT
                  </h3>
                  <h3>
                    <b>Total Net Amount</b>: {responses.totalAmount} JODT
                  </h3>
                </Card>
              </Col>
            </Row>
            <Row style={{ marginTop: "10px" }}>
              <Col span={24}>
                <Card
                  title="🗄️ Cases and Damages"
                  size="large"
                  style={{
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem",
                  }}
                >
                  <Table columns={reportsCols} dataSource={damagesData} />
                </Card>
              </Col>
            </Row>
            <Row style={{ marginTop: "10px" }}>
              <Col span={24}>
                <Card
                  title="💡 Actions"
                  size="large"
                  style={{
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem",
                  }}
                >
                  <Alert
                    style={{ margin: "10px 10px" }}
                    showIcon
                    message="You will be able to withdraw money once the distributor mark order as completed."
                    type="info"
                  />
                  <Alert
                    style={{ margin: "10px 10px" }}
                    showIcon
                    message="Once you set the order status, you will not able to change it again."
                    type="info"
                  />
                  <center>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => approveOrder()}
                      disabled={
                        responses.orderStatus == 0 && !responses.isCancelled
                          ? ""
                          : true
                      }
                    >
                      Approve Order
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      danger
                      onClick={() => rejectOrder()}
                      disabled={
                        responses.orderStatus == 0 && !responses.isCancelled
                          ? ""
                          : true
                      }
                    >
                      Reject Order
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      danger
                      onClick={() => approveRefund()}
                      disabled={
                        responses.isRefundRequested &&
                          responses.isRefundApproved == false
                          ? ""
                          : true
                      }
                    >
                      Approve Refund Request
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px", background: "#52c41a", borderColor: "#52c41a" }}
                      danger
                      onClick={() => withdrawMoney()}
                      disabled={
                        responses.paymentStatus == "APPROVED_BY_CUSTOMER"
                          ? ""
                          : true
                      }
                    >
                      Withdraw
                    </Button>
                  </center>
                </Card>
              </Col>
            </Row>
          </Card>
        </>
      )
      }
    </div >
  );
}
