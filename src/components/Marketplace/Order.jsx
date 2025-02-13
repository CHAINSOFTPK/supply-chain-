import {
  Card,
  notification,
  Badge,
  Descriptions,
  Image,
  Space,
  Table,
  Tag,
  Col,
  Row,
  Typography,
  Button,
  Alert,
  Modal,
  Input,
  Form,
  Upload,
} from "antd";
import { NavLink } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  CarOutlined,
  PlusOutlined,
  LoadingOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
const { Title } = Typography;
import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getEllipsisTxt } from "helpers/formatters";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from "ethers";
import { create } from "ipfs-http-client";
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";
import Distributor from "contracts/Distributor.json";

// Replace IPFS configuration with Pinata setup
const projectId = 'f5a3409d86e8aba5b4f4';    
const projectSecret = '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d';

// Add these utility functions at the top of the file
const safeFormatEther = (value) => {
  try {
    return value ? ethers.utils.formatEther(value) : '0';
  } catch (error) {
    console.warn('Error formatting ether value:', error);
    return '0';
  }
};

const safeToNumber = (value) => {
  try {
    return value ? value.toNumber() : 0;
  } catch (error) {
    console.warn('Error converting to number:', error);
    return 0;
  }
};

// Add this utility function for contract initialization
const initializeContracts = async (provider, chainId) => {
  try {
    const signer = provider.getSigner();
    const marketplace = new ethers.Contract(
      DaliahMarketplace.networks[chainId].address,
      DaliahMarketplace.abi,
      signer
    );
    return { marketplace };
  } catch (error) {
    console.error("Error initializing contracts:", error);
    return null;
  }
};

// Add these helper functions at the top
const formatTimestamp = (timestamp) => {
  try {
    if (!timestamp || timestamp.toNumber() === 0) return null;
    const date = new Date(timestamp.toNumber() * 1000);
    // Check if date is epoch (1970) or invalid
    if (date.getFullYear() <= 1970 || isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString();
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return null;
  }
};

// Update the formatPrice helper function to handle 12 decimals
const formatPrice = (price) => {
  try {
    if (!price) return '0';
    // Format with 12 decimal places
    return ethers.utils.formatUnits(price, 12);
  } catch (error) {
    console.warn('Error formatting price:', error);
    return '0';
  }
};

// Add this debug helper
const debugData = (label, data) => {
  console.log(`${label}:`, {
    raw: data?.toString(),
    type: typeof data,
    value: data
  });
};

// Add this helper function for safe BigNumber conversion
const safeBigNumber = (value) => {
  try {
    if (!value) return ethers.BigNumber.from(0);
    return ethers.BigNumber.isBigNumber(value) ? value : ethers.BigNumber.from(value);
  } catch (error) {
    console.warn('Error converting to BigNumber:', error);
    return ethers.BigNumber.from(0);
  }
};

export default function Order() {
  // Update Web3Context usage to include chainId
  const { provider, account, chainId, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);
  const { order_id } = useParams();
  const [fullName, setFullName] = useState();
  const [businessAddress, setBusinessAddress] = useState();
  const [carrierAddress, setCarrierAddress] = useState(null);
  const [proofImage, setProofImage] = useState(null);
  const [caseDesc, setCaseDesc] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [action, setAction] = useState();
  const [imageHash, setImageHash] = useState();
  const [imageUrl, setImageUrl] = useState();
  const [damagesData, setDamagesData] = useState(null);

  // Add the reportsCols definition
  const reportsCols = [
    {
      title: 'Case #',
      dataIndex: 'case',
      key: 'case',
      render: text => <>{text + 1}</>,
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
      render: (text) => (
        <a href={text} target="_blank" rel="noreferrer">
          View Image
        </a>
      ),
    },
  ];

  /** Returns true in case if contract is deployed to active chain in wallet */
  const isDeployedToActiveChain = useMemo(() => {
    if (!contract?.networks || !chainId) return undefined;
    return [chainId] in contract.networks;
  }, [contract, chainId]);

  const contractAddress = useMemo(() => {
    if (!isDeployedToActiveChain || !chainId) return null;
    return contract.networks[chainId]?.["address"] || null;
  }, [chainId, contract, isDeployedToActiveChain]);

  /** Default function for showing notifications*/
  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      icon: "🧑",
    });
  };

  const beforeUpload = (file) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
  if (!isJpgOrPng) {
    notification.error({
      message: "Error",
      description: "You can only upload JPG/PNG file",
    });
    return false;
  }

  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    notification.error({
      message: "Error",
      description: "Image must smaller than 2MB",
    });
    return false;
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

  const showModal = (action) => {
    setAction(action);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  // Add this helper function for safe number conversion
  const safeNumberConversion = (value, defaultValue = 0) => {
    try {
      return value ? value.toNumber() : defaultValue;
    } catch (error) {
      console.warn('Error converting number:', error);
      return defaultValue;
    }
  };

  // Update the fetchOrderData function to properly load order details
const fetchOrderData = async (orderID = order_id) => {
  try {
    if (!provider || !chainId || !contractAddress) {
      throw new Error("Web3 not initialized");
    }

    const signer = provider.getSigner();
    
    // Initialize contracts
    const marketplace = new ethers.Contract(
      DaliahMarketplace.networks[chainId].address,
      DaliahMarketplace.abi,
      signer
    );

    const farmer = new ethers.Contract(
      FarmerContract.networks[chainId].address,
      FarmerContract.abi,
      signer
    );

    // Get order data with safety checks
    const orderData = await marketplace.ordersMapping(orderID);
    console.log("Raw order data:", orderData);
    
    if (!orderData || !orderData.productID) {
      throw new Error("Order not found");
    }

    // Safely get related data
    const [paymentData, damages] = await Promise.all([
      marketplace.getOrderPaymentDeatils(orderID).catch(() => [0, 0, 0, 'UNKNOWN']),
      marketplace.getDamages(orderID).catch(() => [])
    ]);

    // Format damages safely
    const formattedDamages = Array.isArray(damages) ? damages.map((damage, index) => ({
      case: index,
      description: damage[0] || '',
      image: damage[1] ? `https://gateway.pinata.cloud/ipfs/${damage[1]}` : ''
    })) : [];
    
    setDamagesData(formattedDamages);

    // Format order data with safe conversions
    const formattedOrder = {
      harvestID: safeBigNumber(orderData.productID).toNumber(),
      customerAddress: orderData.customerAddress || ethers.constants.AddressZero,
      qty: safeBigNumber(orderData.quantity).toNumber(),
      pricePerKG: ethers.utils.formatUnits(safeBigNumber(orderData.pricePerKG), 12),
      totalAmount: ethers.utils.formatUnits(safeBigNumber(paymentData[2]), 12),
      orderStatus: safeBigNumber(orderData.isAccepted).toNumber(),
      paymentStatus: paymentData[3] || 'UNKNOWN',
      isRefundRequested: orderData.isRefundRequested || false,
      isRefundApproved: orderData.isRefundApproved || false,
      
      // Carrier related fields - consolidated to avoid duplicates
      carrierAddress: orderData.carrierAddress || ethers.constants.AddressZero,
      carrierName: orderData.carrier?.carrierName || '',
      carPlateNumber: safeNumberConversion(orderData.carrier?.carPlateNumber),
      vehicleTemp: safeNumberConversion(orderData.carrier?.vehicleTemp),
      vehicleTempImage: orderData.carrier?.vehicleTempImage ? 
        `https://gateway.pinata.cloud/ipfs/${orderData.carrier.vehicleTempImage}` : '',
      pickupDate: orderData.carrier?.pickupDate ? 
        new Date(orderData.carrier.pickupDate.toNumber() * 1000).toLocaleString() : null,
      deliveredAt: orderData.carrier?.deliveredAt ? 
        new Date(orderData.carrier.deliveredAt.toNumber() * 1000).toLocaleString() : null,
      
      // Additional metadata
      distributorAddress: orderData.distributorAddress,
      carrier: orderData.carrier || {} // Keep carrier object for reference if needed
    };

    // Try to get harvest data
    try {
      const harvestData = await farmer.harvestMapping(orderData.productID);
      if (harvestData) {
        formattedOrder.farmerAddress = harvestData.farmerAddress;
        formattedOrder.harvestPhotoUrl = harvestData.photoHash ? 
          `https://gateway.pinata.cloud/ipfs/${harvestData.photoHash}` : '';
        formattedOrder.harvestCaptureDate = new Date(safeBigNumber(harvestData.harvestCaptureDate).toNumber() * 1000);
        formattedOrder.expiryDate = new Date(safeBigNumber(harvestData.expiryDate).toNumber() * 1000);
      }
    } catch (error) {
      console.warn("Could not load harvest data:", error);
    }

    console.log("Formatted order:", formattedOrder);
    setResponses(formattedOrder);

  } catch (error) {
    console.error("Error in fetchOrderData:", error);
    notification.error({
      message: "Error",
      description: error.message || "Failed to load order details"
    });
  } finally {
    setLoading(false);
  }
};

  // Add this helper function to safely get harvest type
  const getHarvestType = async (farmerContract, catalogueProductID, farmerAddress) => {
    try {
      if (farmerAddress === ethers.constants.AddressZero) {
        return "Unknown Product";
      }

      const catalogueCount = await farmerContract.getCatalogueItemsCount(farmerAddress);
      if (catalogueProductID.toNumber() >= catalogueCount) {
        return "Unknown Product";
      }

      const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
        catalogueProductID,
        farmerAddress
      );
      return catalogueItem[0];
    } catch (error) {
      console.error("Error getting harvest type:", error);
      return "Unknown Product";
    }
  };

  // Add this function to safely call contract methods
  const safeContractCall = async (contractMethod, ...args) => {
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, DaliahMarketplace.abi, signer);
      
      const tx = await contract[contractMethod](...args);
      notification.info({
        message: "Transaction Sent",
        description: `TX Hash: ${tx.hash}`
      });
      
      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Transaction completed successfully"
      });
      
      return true;
    } catch (error) {
      console.error(`Error in ${contractMethod}:`, error);
      notification.error({
        message: "Error",
        description: error.data?.message || error.message
      });
      return false;
    }
  };

  // Contract interaction methods
  const orderActions = {
    setOrderCompleted: async () => await safeContractCall('setOrderCompleted', order_id),
    inviteCarrier: async () => await safeContractCall('inviteCarrier', order_id, carrierAddress),
    reportDamages: async () => await safeContractCall('reportDamages', order_id, caseDesc, imageHash),
    requestRefund: async () => await safeContractCall('requestRefund', order_id),
    withdrawRefund: async () => await safeContractCall('withdrawRefund', order_id),
    cancelOrder: async () => await safeContractCall('cancelOrder', order_id),
  };

  const handleReportDamages = async () => {
    if (!caseDesc || !imageHash) {
      notification.error({
        message: "Error",
        description: "Please provide both description and image"
      });
      return;
    }
    
    const success = await orderActions.reportDamages();
    if (success) {
      setCaseDesc(null);
      setImageHash(null);
      setImageUrl(null);
      setIsModalVisible(false);
      fetchOrderData(); // Refresh data
    }
  };

  const getUserData = async () => {
    // Try to get profile from localStorage
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setFullName(profile.name);
      setBusinessAddress(profile.address);
      return;
    }

    // If no stored profile, show warning
    notification.warning({
      message: "Profile Not Found",
      description: "Please make sure you are registered and logged in"
    });
  };

  useEffect(() => {
    if (provider && isAuthenticated && contractAddress) {
      setLoading(true);
      fetchOrderData();
      getUserData();
    }
  }, [provider, isAuthenticated, contractAddress]);

  // Add this useEffect to log responses when they change
  useEffect(() => {
    if (responses?.harvestCaptureDate || responses?.expiryDate) {
      console.log("Updated responses:", {
        harvestCaptureDate: responses.harvestCaptureDate?.toLocaleString(),
        expiryDate: responses.expiryDate?.toLocaleString(),
        farmerAddress: responses.farmerAddress
      });
    }
  }, [responses]);

  // Add these contract interaction functions before the return statement
  const inviteCarrier = async () => {
    if (!carrierAddress) {
      notification.error({
        message: "Error",
        description: "Please input a carrier address!"
      });
      return;
    }
  
    try {
      const signer = provider.getSigner();
      const marketplace = new ethers.Contract(
        DaliahMarketplace.networks[chainId].address,
        DaliahMarketplace.abi,
        signer
      );
  
      // Get order data to verify ownership
      const orderData = await marketplace.ordersMapping(order_id);
      
      // Verify order owner
      if (orderData.distributorAddress?.toLowerCase() !== account?.toLowerCase()) {
        throw new Error("Only the order owner can invite carriers");
      }
  
      // Validate carrier address
      if (!ethers.utils.isAddress(carrierAddress)) {
        throw new Error("Invalid carrier address");
      }
  
      // Check if carrier already assigned
      if (orderData.carrierAddress !== ethers.constants.AddressZero) {
        throw new Error("A carrier has already been assigned");
      }
  
      // Format parameters like Moralis example
      let params = {
        _orderID: order_id,
        _carrierAdress: carrierAddress
      };
  
      // Submit transaction
      const tx = await marketplace.inviteCarrier(params._orderID, params._carrierAdress);
      
      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });
  
      await tx.wait();
  
      notification.success({
        message: "Success",
        description: "Carrier has been assigned successfully!"
      });
  
      setIsModalVisible(false);
      await fetchOrderData(); // Refresh data
  
    } catch (error) {
      console.error("Error inviting carrier:", error);
      notification.error({
        message: "Error",
        description: error.data?.message || error.message
      });
    }
  };
  
  const setOrderCompleted = async () => {
    await orderActions.setOrderCompleted();
    fetchOrderData();
  };
  
  const requestRefund = async () => {
    await orderActions.requestRefund();
    fetchOrderData();
  };
  
  const withdrawRefund = async () => {
    await orderActions.withdrawRefund();
    fetchOrderData();
  };
  
  const cancelOrder = async () => {
    await orderActions.cancelOrder();
    fetchOrderData();
  };

  return (
    <div>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}
      {isDeployedToActiveChain === true && isAuthenticated === true && (
        <>
          <>
            <Modal
              title={"Order #" + order_id}
              visible={isModalVisible}
              onCancel={handleCancel}
              footer={null}
              header={null}
            >
              {action == "INVITE" && (
                <>
                  <Input
                    size="large"
                    placeholder="Please Insert Carrier Address"
                    prefix={<CarOutlined />}
                    value={carrierAddress}
                    onChange={(e) => setCarrierAddress(e.target.value)}
                    required="true"
                  />
                  <center>
                    <Button
                      type="primary"
                      style={{ margin: "10px 0px" }}
                      onClick={(e) => inviteCarrier()}
                    >
                      Invite Carrier
                    </Button>
                  </center>
                </>
              )}
              {action == "REPORT" && (
                <>
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ display: "flex" }}
                  >
                    Please describe your case and upload proof image:
                    <Input
                      size="large"
                      placeholder="case description "
                      prefix={<FileTextOutlined />}
                      value={caseDesc}
                      onChange={(e) => setCaseDesc(e.target.value)}
                      required="true"
                    />
                    <Upload
                      name="avatar"
                      listType="picture-card"
                      className="avatar-uploader"
                      showUploadList={false}
                      beforeUpload={beforeUpload}
                      onChange={handleChange}
                      action={(f) => saveFileIPFS(f)}
                    >
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
                        onClick={handleReportDamages}
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
            <div className="qr-code">
              <QRCode
                size={150}
                value={"http://localhost:3000/scanproduct/" + order_id}
              />
            </div>
          </center>
          <NavLink to="/orders">
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
                <Card
                  title="📦🌱 Order Details"
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
                    
                      
                    </Col>
                    <Col span={12}>
                      <h3 style={{ display: "flex" }}>
                        <b>Status</b>:{" "}
                        <div style={{ marginLeft: "5px" }}>
                          {responses.orderStatus == 0 && (
                            <>
                              <Tag icon={<SyncOutlined spin />} color="warning">
                                WAITING FARMER APPROVAL
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
                                REJECTED (REQUEST A REFUND)
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
                        <b>Farmer profile</b>:{" "}
                        <a href="#" target="_blank" rel="noreferrer">
                          View Profile
                        </a>
                      </h3>
                      <h3 style={{ display: "flex" }}>
                        <b>Farmer Address</b>:{"  "}
                        <Address
                          avatar={null}
                          copyable
                          address={responses.farmerAddress || "0x0000000000000000000000000000000000000000"}
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
                    borderRadius: "0.5rem",
                    minHeight: "341px",
                  }}
                >
                  <h3>
                    <b>Full Name:</b> {responses.distName}
                  </h3>
                  <h3>
                    <b>Shipping Address</b>: {responses.distShippiingAddress}
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
                    {responses.pickupDate ? (
                      <>
                        {responses.pickupDate}
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
                        {responses.deliveredAt}
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
                    borderRadius: "0.5rem",
                    minHeight: "341px",
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
                            WAITING WITHDRAW BY FARMER
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
                      {responses.paymentStatus == "CANCELLED" && (
                        <>
                          <Tag icon={<SyncOutlined spin />} color="volcano">
                            PENDING REFUND (REQUEST A REFUND)
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
                      {responses.isRefundApproved &&
                        responses.isRefundRequested && (
                          <>
                            <Tag icon={<CheckCircleOutlined />} color="success">
                              REFUND APPROVED
                            </Tag>
                          </>
                        )}
                      {!responses.isRefundApproved &&
                        responses.isRefundRequested && (
                          <>
                            <Tag icon={<CheckCircleOutlined />} color="volcano">
                              REFUND NOT APPROVED YET
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
                    <b>Marketplace Fee's</b>: 25 JODT (Non-refundable)
                  </h3>
                  <h3>
                    <b>Total Amount</b>: {Number(responses.totalAmount || 0) + 25} JODT
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
                  {responses.isRefundRequested &&
                    !responses.isCancelled &&
                    !responses.isRefundApproved && (
                      <>
                        <Alert
                          style={{ margin: "10px 10px" }}
                          showIcon
                          message="You have requested a refund. Farmer need to approve your request in order to be able to withdraw refund amount"
                          type="info"
                        />
                      </>
                    )}
                  <center>
                    <Button
                      danger
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => setOrderCompleted()}
                      disabled={
                        responses.isCancelled ||
                        responses.isRefundApproved ||
                        responses.paymentStatus === "COMPLETED" || // Add this condition
                        !responses.deliveredAt || // Add this condition
                        responses.paymentStatus !== "PAID" // Change this condition
                      }
                    >
                      Mark As Completed
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={(e) => showModal("INVITE")}
                      disabled={
                        responses.isCancelled ||
                        responses.isRefundApproved ||
                        responses.paymentStatus == "APPROVED_BY_CUSTOMER" ||
                        responses.carrierAddress !==
                          "0x0000000000000000000000000000000000000000"
                          ? true
                          : ""
                      }
                    >
                      Invite Carrier
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => showModal("REPORT")}
                    >
                      Report Damages
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => requestRefund()}
                      disabled={
                        !responses.isRefundRequested &&
                        responses.orderStatus != 0 &&
                        responses.paymentStatus == "APPROVED_BY_CUSTOMER"
                          ? ""
                          : true
                      }
                    >
                      Request Refund
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginRight: "5px" }}
                      onClick={() => withdrawRefund()}
                      disabled={
                        (responses.isCancelled &&
                          responses.paymentStatus !== "REFUNDED") ||
                        (responses.isRefundApproved &&
                          responses.paymentStatus !== "REFUNDED")
                          ? ""
                          : true
                      }
                    >
                      Withdraw Refund Amount
                    </Button>
                    <Button
                      type="primary"
                      danger
                      onClick={() => cancelOrder()}
                      disabled={
                        !responses.isCancelled && responses.orderStatus == 0
                          ? ""
                          : true
                      }
                    >
                      Cancel Order
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
