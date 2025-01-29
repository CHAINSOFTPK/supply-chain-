import { Card, notification, Tag, Col, Row, Typography, Button, Alert, Modal, Input, Space, Upload } from "antd";
import { NavLink } from "react-router-dom";
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getEllipsisTxt } from "helpers/formatters";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import DaliahMarketplace from "contracts/DaliahMarketplace.json";
import FarmerContract from "contracts/Farmer.json";
import Distributor from "contracts/Distributor.json";

const { Title } = Typography;

// Configure Pinata IPFS client
const projectId = "f5a3409d86e8aba5b4f4";
const projectSecret = "6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d";

// Add this utility function at the top of the file
const safeContractCall = async (contract, method, ...args) => {
  try {
    return await contract[method](...args);
  } catch (error) {
    console.warn(`Error calling ${method}:`, error);
    return null;
  }
};

// Add this helper function at the top
const fetchDistributorProfile = async (distributorContract, address) => {
  try {
    if (!address || address === ethers.constants.AddressZero) {
      return { name: "", physicalAddress: "" };
    }

    const profile = await distributorContract.distProfiles(address);
    return {
      name: profile?.name || "",
      physicalAddress: profile?.physicalAddress || ""
    };
  } catch (error) {
    console.warn("Error fetching distributor profile:", error);
    return { name: "", physicalAddress: "" };
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

export default function ViewOrderByCarrier() {
  // Replace Moralis hooks with Web3Context
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);
  const { order_id } = useParams();
  const [carPlateNumber, setCarPlateNumber] = useState();
  const [carrierName, setCarrierName] = useState();
  const [vehicleTemp, setVehicleTemp] = useState();
  const [vehicleTempImage, setVehicleTempImage] = useState();
  const [pickupDateImage, setPickupDateImage] = useState();
  const [deliveredAtImage, setDeliveredAtImage] = useState();
  const [action, setAction] = useState();

  const [visible, setVisible] = useState(false);
  const [imageHash, setImageHash] = useState();
  const [imageUrl, setImageUrl] = useState();

  const [confirmLoading, setConfirmLoading] = useState(false);

  const showModal = (action) => {
    setAction(action);
    setVisible(true);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";

    if (!isJpgOrPng) {
      openNotification({
        message: "Error",
        description: "You can only upload JPG/PNG file",
      });
      setLoading(false);
    }

    const isLt2M = file.size / 1024 / 1024 < 2;

    if (!isLt2M) {
      openNotification({
        message: "Error",
        description: "Image must smaller than 2MB",
      });
      setLoading(false);
    }

    return isJpgOrPng && isLt2M;
  };

  const handleChange = () => {
    if (!imageHash) {
      setLoading(false);
      return;
    }

    if (imageHash) {
      // Get this url from response in real world.

      setLoading(false);
      setImageUrl("https://ipfs.moralis.io:2053/ipfs/" + imageHash);
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div
        style={{
          marginTop: 8,
        }}
      >
        Upload
      </div>
    </div>
  );

  const saveFileIPFS = async (file) => {
    if (!beforeUpload(file)) return;
    
    setLoading(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload to Pinata
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': projectId,
          'pinata_secret_api_key': projectSecret,
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.IpfsHash) {
        setImageHash(data.IpfsHash);
        setImageUrl(`https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`);
        
        notification.success({
          message: "Success",
          description: "Image Successfully Uploaded"
        });
      } else {
        throw new Error('Failed to get IPFS hash');
      }
    } catch (error) {
      console.error("IPFS upload error:", error);
      notification.error({
        message: "Error",
        description: "Failed to upload image: " + error.message
      });
    }
    setLoading(false);
  };

  const uploadProps = {
    name: 'file',
    listType: "picture-card",
    className: "avatar-uploader",
    showUploadList: false,
    beforeUpload: beforeUpload,
    customRequest: ({ file }) => saveFileIPFS(file),
    onChange: handleChange
  };

  // Update the fetchOrderData function
  const fetchOrderData = async () => {
    console.log("fetching" + order_id);
    try {
      if (!provider || !order_id) {
        throw new Error("Provider or order ID not available");
      }

      const signer = provider.getSigner();
      const chainId = provider.network.chainId;

      // Validate contracts exist for current network
      if (!DaliahMarketplace.networks[chainId]?.address ||
          !FarmerContract.networks[chainId]?.address ||
          !Distributor.networks[chainId]?.address) {
        throw new Error("Contracts not deployed to current network");
      }

      // Initialize contracts
      const marketplaceContract = new ethers.Contract(
        DaliahMarketplace.networks[chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      // Fetch order data first
      const orderData = await marketplaceContract.ordersMapping(order_id);
      if (!orderData || !orderData.productID) {
        throw new Error("Invalid order data");
      }

      // Initialize other contracts and fetch data in parallel
      const [farmerContract, distributorContract] = await Promise.all([
        new ethers.Contract(
          FarmerContract.networks[chainId].address,
          FarmerContract.abi,
          signer
        ),
        new ethers.Contract(
          Distributor.networks[chainId].address,
          Distributor.abi,
          signer
        )
      ]);

      // Fetch all related data in parallel
      const [paymentData, harvestData, distProfile] = await Promise.all([
        marketplaceContract.getOrderPaymentDeatils(order_id).catch(err => {
          console.warn("Error fetching payment details:", err);
          return [0, 0, 0, "UNKNOWN"];
        }),
        farmerContract.harvestMapping(orderData.productID).catch(err => {
          console.warn("Error fetching harvest data:", err);
          return null;
        }),
        fetchDistributorProfile(distributorContract, orderData.distributorAddress)
      ]);

      if (!harvestData) {
        throw new Error("Failed to fetch harvest data");
      }

      // Initialize formatted data with safe defaults
      let formattedData = {
        harvestID: orderData.productID?.toNumber() || 0,
        productName: "Unknown Product",
        harvestCaptureDate: "",
        expiryDate: "",
        orderStatus: orderData.isAccepted?.toNumber() || 0,
        harvestPhotoUrl: "",
        distAddress: orderData.distributorAddress || ethers.constants.AddressZero,
        distName: distProfile.name,
        distShippiingAddress: distProfile.physicalAddress,
        carrierAddress: orderData.carrierAddress || ethers.constants.AddressZero,
        carrierName: orderData.carrier?.carrierName || "",
        carPlateNumber: orderData.carrier?.carPlateNumber?.toNumber() || 0,
        vehicleTemp: orderData.carrier?.vehicleTemp?.toNumber() || 0,
        vehicleTempImage: "",
        pickupDate: "",
        deliveredAt: "",
        pricePerKG: formatPrice(orderData.pricePerKG),
        qty: orderData.quantity?.toNumber() || 0,
        totalAmount: formatPrice(paymentData[2]),
        paymentStatus: paymentData[3] || "UNKNOWN",
        isRefundRequested: orderData.isRefundRequested || false,
        isRefundApproved: orderData.isRefundApproved || false,
        pickupDate: orderData.carrier?.pickupDate ? formatTimestamp(orderData.carrier.pickupDate) : null,
        deliveredAt: orderData.carrier?.deliveredAt ? formatTimestamp(orderData.carrier.deliveredAt) : null,
        canPickup: orderData.isAccepted?.toNumber() === 1 && !responses.pickupDate,
        canDeliver: responses.pickupDate && !responses.deliveredAt,
      };

      // Only try to get catalogue data if we have valid harvest data
      if (harvestData.farmerAddress && harvestData.catalogueProductID) {
        try {
          const catalogueCount = await farmerContract.getCatalogueItemsCount(
            harvestData.farmerAddress
          );

          if (catalogueCount?.gt(0) && 
              harvestData.catalogueProductID.lt(catalogueCount)) {
            const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
              harvestData.catalogueProductID,
              harvestData.farmerAddress
            );
            if (catalogueItem?.[0]) {
              formattedData.productName = catalogueItem[0];
            }
          }
        } catch (error) {
          console.warn("Error fetching catalogue data:", error);
        }
      }

      // Add timestamps if available
      if (harvestData.harvestCaptureDate) {
        formattedData.harvestCaptureDate = new Date(
          harvestData.harvestCaptureDate.toNumber() * 1000
        ).toLocaleString();
      }

      if (harvestData.expiryDate) {
        formattedData.expiryDate = new Date(
          harvestData.expiryDate.toNumber() * 1000
        ).toLocaleString();
      }

      // Add carrier related data
      if (orderData.carrier) {
        if (orderData.carrier.vehicleTempImage) {
          formattedData.vehicleTempImage = 
            `https://gateway.pinata.cloud/ipfs/${orderData.carrier.vehicleTempImage}`;
        }

        // Use the formatTimestamp function for pickupDate
        formattedData.pickupDate = formatTimestamp(orderData.carrier.pickupDate);

        // Use the formatTimestamp function for deliveredAt
        formattedData.deliveredAt = formatTimestamp(orderData.carrier.deliveredAt);
        formattedData.deliveredAtImage = orderData.carrier.deliveredAtImage;
      }

      if (orderData.carrier) {
        if (orderData.carrier.pickupDateImage) {
          formattedData.pickupDateImage =
            `https://gateway.pinata.cloud/ipfs/${orderData.carrier.pickupDateImage}`;
        }
        if (orderData.carrier.deliveredAtImage) {
          formattedData.deliveredAtImage =
            `https://gateway.pinata.cloud/ipfs/${orderData.carrier.deliveredAtImage}`;
        }
      }

      formattedData.canPickup = (orderData.isAccepted?.toNumber() === 1 && !formattedData.pickupDate);
      formattedData.canDeliver = (formattedData.pickupDate && !formattedData.deliveredAt);

      setResponses(formattedData);

    } catch (error) {
      console.error("Error fetching order data:", error);
      openNotification({
        message: "Error",
        description: error.message || "Failed to fetch order data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchOrderData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      icon: "🧑",
    });
  };

  const acceptInvitation = async () => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const tx = await contract.acceptCarrierInvitation(
        order_id,
        carrierName,
        carPlateNumber
      );

      openNotification({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`,
      });

      await tx.wait();
      
      openNotification({
        message: "Success",
        description: "Accepted Order Invitation!",
      });

      setVisible(false);
      fetchOrderData();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      openNotification({
        message: "Error",
        description: error.message,
      });
    }
    setLoading(false);
  };

  const updateTemp = async () => {
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const tx = await contract.setVehicleTemp(
        order_id,
        vehicleTemp,
        imageHash
      );

      openNotification({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`,
      });

      await tx.wait();
      
      openNotification({
        message: "Success",
        description: "Vehicle Temperature Updated!",
      });

      setVisible(false);
      fetchOrderData();
    } catch (error) {
      console.error("Error updating temperature:", error);
      openNotification({
        message: "Error",
        description: error.message,
      });
    }
    setLoading(false);
  };

  const markOrderAsDelivered = async () => {
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const tx = await contract.markOrderAsDelivered(
        order_id,
        imageHash
      );

      openNotification({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`,
      });

      await tx.wait();
      
      openNotification({
        message: "Success",
        description: "Order Marked As Delivered!",
      });

      setVisible(false);
      fetchOrderData();
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      openNotification({
        message: "Error",
        description: error.message,
      });
    }
    setLoading(false);
  };

  const updateOrderPickupTime = async () => {
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const tx = await contract.updateOrderPickupTime(
        order_id,
        imageHash
      );

      openNotification({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`,
      });

      await tx.wait();
      
      openNotification({
        message: "Success",
        description: "Order Marked As Picked Up!",
      });

      setVisible(false);
      fetchOrderData();
    } catch (error) {
      console.error("Error updating order pickup time:", error);
      openNotification({
        message: "Error",
        description: error.message,
      });
    }
    setLoading(false);
  };

  return (
    <div>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}

      {isAuthenticated === true && (
        <>
          <>
            <Modal
              title="Invite Carrier"
              visible={visible}
              onCancel={handleCancel}
              footer={null}
              header={null}
            >
              {action == "ACCEPT" && (
                <>
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ display: "flex" }}
                  >
                    <Input
                      size="large"
                      placeholder="Full Name"
                      value={carrierName}
                      onChange={(e) => setCarrierName(e.target.value)}
                      required="true"
                    />
                    <Input
                      size="large"
                      placeholder="Please Insert Your Car Plate Number"
                      value={carPlateNumber}
                      onChange={(e) => setCarPlateNumber(e.target.value)}
                      required="true"
                    />
                    <center>
                      <Button
                        type="primary"
                        style={{ margin: "10px 0px" }}
                        onClick={(e) => acceptInvitation()}
                        loading={loading}
                      >
                        Accept
                      </Button>
                    </center>
                  </Space>
                </>
              )}
              {action == "TEMP" && (
                <>
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ display: "flex" }}
                  >
                    <Input
                      size="large"
                      placeholder="Please Insert Car Temp"
                      value={vehicleTemp}
                      onChange={(e) => setVehicleTemp(e.target.value)}
                      required="true"
                    />
                    <Upload {...uploadProps}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="avatar"
                          style={{
                            width: "100%",
                          }}
                        />
                      ) : (
                        uploadButton
                      )}
                    </Upload>
                    <center>
                      <Button
                        type="primary"
                        style={{ margin: "10px 0px" }}
                        onClick={(e) => updateTemp()}
                        loading={loading}
                      >
                        Submit
                      </Button>
                    </center>
                  </Space>
                </>
              )}
              {action == "PICKUP" && (
                <>
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ display: "flex" }}
                  >
                    Upload Proof of Pickup
                    <Upload {...uploadProps}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="avatar"
                          style={{
                            width: "100%",
                          }}
                        />
                      ) : (
                        uploadButton
                      )}
                    </Upload>
                    <center>
                      <Button
                        type="primary"
                        style={{ margin: "10px 0px" }}
                        onClick={(e) => updateOrderPickupTime()}
                        loading={loading}
                      >
                        Submit
                      </Button>
                    </center>
                  </Space>
                </>
              )}
              {action == "DELIVERED" && (
                <>
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ display: "flex" }}
                  >
                    Upload Proof of Delivery
                    <Upload {...uploadProps}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="avatar"
                          style={{
                            width: "100%",
                          }}
                        />
                      ) : (
                        uploadButton
                      )}
                    </Upload>
                    <center>
                      <Button
                        type="primary"
                        style={{ margin: "10px 0px" }}
                        onClick={(e) => markOrderAsDelivered()}
                        loading={loading}
                      >
                        Submit
                      </Button>
                    </center>
                  </Space>
                </>
              )}
            </Modal>
          </>
          <center>
            <Title>Order #{order_id}</Title>
          </center>
          <NavLink to="/carrier/orders">
            <Button style={{ margin: "10px" }} type="primary">
              {"< "}Back
            </Button>
          </NavLink>
          <Card
            style={{
              boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
              border: "1px solid #e7eaf3",
              borderRadius: "0.5rem",
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
                <>
                  <Alert
                    style={{ margin: "10px 10px" }}
                    showIcon
                    message="The distributor invited you to deliver this order, please update the order as soon as you take an action!"
                    type="warning"
                  />
                </>

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
                                WAITING APPROVAL
                              </Tag>
                            </>
                          )}
                          {responses.orderStatus == 1 && (
                            <>
                              <Tag
                                icon={<CheckCircleOutlined />}
                                color="success"
                              >
                                APPROVED
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
                    minHeight: "341px",
                    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                    border: "1px solid #e7eaf3",
                    borderRadius: "0.5rem",
                  }}
                >
                  <h3>
                    <b>Distributor Name:</b> {responses.distName}
                  </h3>
                  <h3>
                    <b>Distributor Shipping Address</b>:{" "}
                    {responses.distShippiingAddress}
                  </h3>
                  <h3 style={{ display: "-webkit-inline-box" }}>
                    <b>Carrier Address (YOU)</b>:{"  "}
                    <Address
                      avatar={null}
                      copyable
                      address={responses.carrierAddress}
                      size={8}
                      style={{ height: "28px", marginLeft: "5px" }}
                    />
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
                    {responses.pickupDate ? (
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
                    ) : (
                      <Tag icon={<SyncOutlined spin />} color="processing">
                        NOT SET YET
                      </Tag>
                    )}
                  </h3>
                  <h3>
                    <b>Delivered At:</b>{" "}
                    {responses.deliveredAt ? (
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
                    ) : (
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
                  <h3>
                    <b>Price:</b> {responses.pricePerKG} JODT/KG
                  </h3>
                  <h3>
                    <b>Quantity</b>: {responses.qty} KG
                  </h3>
                  <h3>
                    <b>Total Amount</b>: {responses.totalAmount} JODT
                  </h3>
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
                </Card>
              </Col>
            </Row>
            <Row style={{ marginTop: "10px" }}>

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
                  {!responses.carrierName && (
                    <center>
                      {" "}
                      <Alert
                        style={{ margin: "10px 10px" }}
                        showIcon
                        message="Please accept the order to be able to update it inforamtion"
                        type="info"
                      />
                    </center>
                  )}

                  <center>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => showModal("ACCEPT")}
                      disabled={!responses.carrierName ? "" : true}
                    >
                      Accept Invitation
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => showModal("TEMP")}
                      disabled={!responses.vehicleTemp ? "" : true}
                    >
                      Update Vehicle Temperture
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => showModal("PICKUP")}
                      disabled={!responses.canPickup}
                    >
                      Mark As Picked up
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      danger
                      onClick={() => showModal("DELIVERED")}
                      disabled={!responses.canDeliver}
                    >
                      Mark As Delivered
                    </Button>
                  </center>
                </Card>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}
