import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Card,
  notification,
  Badge,
  Descriptions,
  Image,
  Carousel,
  Button,
  Typography,
  Modal,
  Form,
  Input,
  Alert,
  Space,
  Popconfirm,
  InputNumber,
} from "antd";
import { NavLink } from "react-router-dom";

import Text from "antd/lib/typography/Text";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";
import JordanainDinarToken from "contracts/JordanainDinarToken.json";
import Escrow from "contracts/Escrow.json";
import DistContract from "contracts/Distributor.json";
import Distributor from "contracts/Distributor.json";
// Replace IPFS client configuration with Pinata setup
const projectId = 'f5a3409d86e8aba5b4f4';    
const projectSecret = '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d'; 

const saveFilePinata = async (file) => {
  if (!beforeUpload(file)) return;

  setLoading(true);
  try {
    const formData = new FormData();
    formData.append('file', file);

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
      // Handle the IPFS hash as needed
      // ...existing code...
    } else {
      throw new Error('Failed to get IPFS hash');
    }
  } catch (error) {
    console.error("Pinata upload error:", error);
    notification.error({
      message: "Error",
      description: "Failed to upload image: " + error.message
    });
  }
  setLoading(false);
};

// Add this utility function
const getEllipsisTxt = (str, n = 6) => {
  if (str) {
    return `${str.slice(0, n)}...${str.slice(str.length - n)}`;
  }
  return "";
};

// Add missing functions and state
const beforeUpload = (file) => {
  const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
  const isLt2M = file.size / 1024 / 1024 < 2;
  return isJpgOrPng && isLt2M;
};

const { Title } = Typography;

const Marketplace = () => {
  const { provider, account, chainId, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(FarmerContract);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState();
  const [fullName, setFullName] = useState();
  const [businessAddress, setBusinessAddress] = useState();
  const [qty, setQty] = useState();
  const [orderResponse, setOrderResponse] = useState(false);

  // Add new ref for the form
  const formRef = useRef(null);

  const showModal = (harvestID) => {
    setOrderResponse(false);
    setIsModalVisible(true);
    const currentHarvest = responses.find(
      (harvest) => harvest.harvestID === harvestID,
    );
    console.log(currentHarvest);
    getUserData();
    setCurrentOrder(currentHarvest);
    setContract(DaliahMarketplace);
  };

  const getUserData = async () => {
    // First try to get profile from localStorage
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setFullName(profile.name);
      setBusinessAddress(profile.address);
      return;
    }

    // Fallback to contract calls if localStorage is empty
    if (!provider || !account) return;
    
    try {
      const signer = provider.getSigner();
      const chainId = provider.network.chainId;
      
      console.log("Checking profile for account:", account);

      // Try Distributor contract first since we're in marketplace
      const distContract = new ethers.Contract(
        DistContract.networks[chainId].address,
        DistContract.abi,
        signer
      );

      try {
        const profile = await distContract.distProfiles(account);
        
        if (profile && typeof profile === 'object') {
          const profileData = {
            type: 'distributor',
            name: profile.name || profile[0],
            address: profile.physicalAddress || profile[1]
          };
          
          // Store in localStorage for future use
          localStorage.setItem('userProfile', JSON.stringify(profileData));
          
          setFullName(profileData.name);
          setBusinessAddress(profileData.address);
          return;
        }
      } catch (error) {
        console.log("Error checking distributor profile:", error);
      }

      // Only try farmer if distributor check fails
      const farmerContract = new ethers.Contract(
        FarmerContract.networks[chainId].address,
        FarmerContract.abi,
        signer
      );

      try {
        const profile = await farmerContract.farmerProfiles(account);
        console.log("Found farmer profile:", profile);

        if (profile && typeof profile === 'object') {
          setFullName(profile.farmerName || profile[0]);
          setBusinessAddress(profile.farmerPhysicalAddress || profile[1]);
          return;
        }
      } catch (error) {
        console.log("Error checking farmer profile:", error);
      }

      notification.warning({
        message: "Profile Not Found",
        description: "Please register as a farmer or distributor first"
      });

    } catch (error) {
      console.error("Error fetching user data:", error);
      notification.error({
        message: "Error",
        description: error.message || "Failed to fetch user profile"
      });
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

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

  const fetchMarketplaceData = async () => {
    try {
      const signer = provider.getSigner();
      const farmerContract = new ethers.Contract(
        FarmerContract.networks[provider.network.chainId].address,
        FarmerContract.abi,
        signer
      );

      const harvestCount = await farmerContract.harvestCounter();
      let harvests = [];

      for (let i = 0; i < harvestCount; i++) {
        const harvestData = await farmerContract.harvestMapping(i);
        const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
          harvestData.catalogueProductID,
          harvestData.farmerAddress
        );
        const farmerProfile = await farmerContract.farmerProfiles(harvestData.farmerAddress);

        harvests.push({
          harvestID: i,
          productName: catalogueItem[0],
          volume: catalogueItem[1].toNumber(),
          catImageUrl: `https://ipfs.io/ipfs/${catalogueItem[2]}`,
          ECLevel: harvestData.ECLevel.toNumber() / 1000,
          PHLevel: harvestData.PHLevel.toNumber() / 1000,
          waterLevel: harvestData.waterLevel.toNumber() / 1000,
          expiryDate: new Date(harvestData.expiryDate.toNumber() * 1000),
          farmerAddress: harvestData.farmerAddress,
          harvestCaptureDate: new Date(harvestData.harvestCaptureDate.toNumber() * 1000),
          minOrderQty: harvestData.minOrderQty.toNumber(),
          harvestPhotoUrl: `https://ipfs.io/ipfs/${harvestData.photoHash}`,
          pricePerKG: ethers.utils.formatEther(harvestData.pricePerKG),
          qty: harvestData.quantity.toNumber(),
          farmerName: farmerProfile.farmerName,
          farmerPhysicalAddress: farmerProfile.farmerPhysicalAddress
        });
      }
      setResponses(harvests);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching marketplace data:", error);
      notification.error({
        message: "Error",
        description: "Failed to fetch marketplace data"
      });
    }
  };

const placeOrder = async (params) => {
  try {
    if (!params._quantity || params._quantity < currentOrder.minOrderQty) {
      notification.error({
        message: "Invalid Quantity",
        description: `Minimum order quantity is ${currentOrder.minOrderQty} KG`
      });
      return;
    }

    setLoading(true);
    const signer = provider.getSigner();

    // First get the marketplace contract
    const marketplaceContract = new ethers.Contract(
      DaliahMarketplace.networks[provider.network.chainId].address,
      DaliahMarketplace.abi,
      signer
    );

    // Get total price from contract
    const productTotal = await marketplaceContract.getOrderTotalPrice(
      params._productID,
      params._quantity
    );

    // Add fee of 25 JOD (in wei) to the computed total
    const marketplaceFee = ethers.utils.parseEther('25');
    const totalAmount = productTotal.add(marketplaceFee);

    console.log('Total Amount needed:', ethers.utils.formatEther(totalAmount), 'JOD');

    // Get token contract instance
    const tokenContract = new ethers.Contract(
      JordanainDinarToken.networks[provider.network.chainId].address,
      JordanainDinarToken.abi,
      signer
    );

    // Compute total approval amount
    const totalApproval = totalAmount;
    console.log("Approving tokens (wei):", totalApproval.toString());
    console.log("Approving tokens (formatted):", ethers.utils.formatEther(totalApproval));

    // Approve for marketplace contract
    const approveTx1 = await tokenContract.approve(
      DaliahMarketplace.networks[provider.network.chainId].address,
      totalApproval
    );
    await approveTx1.wait();

    // Also approve for the escrow/ additional contract
    const additionalApprovalAddress = "0x7220DCb301c2ADCeEb01bA6ada4A567838A6B195";
    console.log("Approving tokens for additional contract:", additionalApprovalAddress);
    const approveTx2 = await tokenContract.approve(
      additionalApprovalAddress,
      totalApproval
    );
    await approveTx2.wait();

    // Now place the order
    notification.info({
      message: "Placing Order",
      description: "Please confirm the transaction"
    });

    const orderTx = await marketplaceContract.placeOrder(
      params._productID,
      params._quantity,
      params._farmerAddress,
      { 
        gasLimit: 500000 // Add manual gas limit for order placement
      }
    );

    await orderTx.wait();

    notification.success({
      message: "Success",
      description: "Order placed successfully!"
    });
    
    setOrderResponse(true);

  } catch (error) {
    console.error("Transaction failed:", error);
    notification.error({
      message: "Transaction Failed",
      description: error.data?.message || error.message || "Failed to process order"
    });
  } finally {
    setLoading(false);
  }
};

  // Update the quantity change handler
  const handleQuantityChange = (value) => {
    const numValue = parseInt(value, 10);
    setQty(numValue);
    
    // Update form field value
    if (formRef.current) {
      formRef.current.setFieldsValue({ _quantity: numValue });
    }
  };

  // Update the form submission handler with strict validation
  const handleFormSubmit = async (formData) => {
    try {
      const quantity = parseInt(formData._quantity);
      
      if (!quantity || isNaN(quantity)) {
        notification.error({
          message: "Invalid Quantity",
          description: "Please enter a valid number"
        });
        return;
      }

      if (quantity < currentOrder.minOrderQty) {
        notification.error({
          message: "Invalid Quantity",
          description: `Minimum order quantity is ${currentOrder.minOrderQty} KG`
        });
        return;
      }

      if (quantity > currentOrder.qty) {
        notification.error({
          message: "Invalid Quantity",
          description: `Maximum available quantity is ${currentOrder.qty} KG`
        });
        return;
      }

      // Only proceed if validation passes
      await placeOrder({
        _quantity: quantity,
        _productID: currentOrder.harvestID,
        _farmerAddress: currentOrder.farmerAddress
      });
    } catch (error) {
      console.error("Form submission error:", error);
      notification.error({
        message: "Error",
        description: error.message || "Failed to submit order"
      });
    }
  };

  useEffect(() => {
    if (provider && isAuthenticated) {  // Changed from isWeb3Enabled to provider check
      setLoading(true);
      fetchMarketplaceData();
    }
  }, [provider, isAuthenticated]);  // Updated dependencies

  const isExpired = (date) => {
    const now = new Date();

    if (now.getTime() > date.getTime()) return true;

    return false;
  };

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JOD",

    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
  });

  return (
    <div>
      {!isAuthenticated && (
        <center>Please authenticate to access this page.</center>
      )}
      
      {isDeployedToActiveChain && isAuthenticated && (
        <>
          <Modal
            title="Order Summary"
            visible={isModalVisible}
            onCancel={handleCancel}
            footer={null}
            header={null}
          >
            <Form
              ref={formRef}
              layout="vertical"
              name="placeOrder"
              onFinish={handleFormSubmit}
              initialValues={{
                _quantity: currentOrder?.minOrderQty || 0
              }}
            >
              {orderResponse && (
                <center>
                  <img src="/payment-successful.png" />
                  <Title level={3} style={{ padding: "10px" }}>
                    Order Placed Successfully!
                  </Title>
                  <NavLink to="/orders">
                    {" "}
                    <Button>Manage orders</Button>
                  </NavLink>
                </center>
              )}
              {!orderResponse && (
                <>
                  {" "}
                  {/* <center>
                    <Title level={3}>Order Summary</Title>
                  </center> */}
                  {currentOrder && (
                    <>
                      <Card
                        style={{
                          marginBottom: "15px",
                          marginTop: "10px",
                          boxShadow:
                            "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                          border: "1px solid #e7eaf3",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <center>
                          <Title level={5}>Shipping Infomation</Title>
                        </center>
                        <h3>
                          <b>Full Name:</b> {fullName}
                        </h3>
                        <h3>
                          <b>Shipping Address</b>: {businessAddress}
                        </h3>
                        <h3>
                          <b>Account Address</b>:{" "}
                          {getEllipsisTxt(account, 6)}
                        </h3>
                      </Card>
                      <Card
                        style={{
                          marginBottom: "15px",
                          marginTop: "10px",
                          boxShadow:
                            "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                          border: "1px solid #e7eaf3",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <center>
                          <Title level={5}>Order Infomation</Title>
                        </center>
                        <h3>
                          <b>Farmer Name:</b> {currentOrder.farmerName}
                        </h3>
                        <h3>
                          <b>Farm Address:</b>{" "}
                          {currentOrder.farmerPhysicalAddress}
                        </h3>
                        <h3>
                          <b>Harvest Batch ID:</b> {currentOrder.harvestID}
                        </h3>

                        <h3>
                          <b>Harvest Type:</b> {currentOrder.productName}
                        </h3>
                        <h3>
                          <b>Expiry Date:</b>{" "}
                          {!isExpired(currentOrder.expiryDate) && (
                            <Badge status="success" text="Valid" />
                          )}{" "}
                          ({currentOrder.expiryDate.toLocaleString()})
                        </h3>
                        <h3>
                          <b>Available Qty:</b> {currentOrder.qty} KG (
                          <strong style={{ fontWeight: 900 }}>
                            Minimum Order: {currentOrder.minOrderQty} KG
                          </strong>
                          )
                        </h3>
                      </Card>
                    </>
                  )}
                  {qty && (
                    <>
                      <Card
                        style={{
                          marginTop: "10px",
                          boxShadow:
                            "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                          border: "1px solid #e7eaf3",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <center>
                          <h2>
                            <b>Total: </b>{" "}
                            {formatter.format(
                              qty * currentOrder.pricePerKG + 25,
                            )}{" "}
                          </h2>
                          <h4>(JOD 25 Marketplace fees)</h4>
                        </center>
                      </Card>
                    </>
                  )}
                  <Card
                    style={{
                      marginTop: "10px",
                      boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                      border: "1px solid #e7eaf3",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <center>
                      <Form.Item
                        style={{ textAlign: "center" }}
                        name="_quantity"
                        rules={[
                          { required: true, message: "Please input quantity" },
                          () => ({
                            validator(_, value) {
                              const numValue = parseInt(value);
                              if (!value || isNaN(numValue)) {
                                return Promise.reject(new Error('Please enter a valid number'));
                              }
                              if (numValue < currentOrder?.minOrderQty) {
                                return Promise.reject(new Error(`Minimum order quantity is ${currentOrder?.minOrderQty} KG`));
                              }
                              if (numValue > currentOrder?.qty) {
                                return Promise.reject(new Error(`Maximum available quantity is ${currentOrder?.qty} KG`));
                              }
                              return Promise.resolve();
                            }
                          })
                        ]}
                      >
                        <InputNumber
                          placeholder="Quantity"
                          addonAfter="KG"
                          style={{ width: 150 }}
                          min={currentOrder?.minOrderQty}
                          max={currentOrder?.qty}
                          precision={0}
                          onChange={handleQuantityChange}
                        />
                      </Form.Item>

                      <Alert
                        showIcon
                        message="By placing an order, The total amount will be moved into Escrow smart contract to prevent fraud."
                        type="info"
                      />
                      <br />
                      <Form.Item style={{ marginBottom: "5px" }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                        >
                          Confirm Order and Pay
                        </Button>
                        <Button
                          type="warning"
                          style={{ marginLeft: "5px" }}
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                      </Form.Item>
                    </center>
                  </Card>
                </>
              )}
            </Form>
          </Modal>

          <center>
            <Title>Marketplace</Title>
          </center>

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
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                You're interacting with: {contract?.contractName} contract
                <Address
                  avatar="left"
                  copyable
                  address={contractAddress}
                  size={8}
                />
              </div>
            }
            size="large"
            loading={loading}
          >
            {responses.map((harvest, key) => (
              <Descriptions
                style={{
                  boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                  border: "1px solid #e7eaf3",
                  borderRadius: "0.5rem",
                  margin: "10px",
                }}
                bordered
                key={key}
                title={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "15px",
                      paddingLeft: "20px",
                    }}
                  >
                    {harvest.productName} HB-ID [{harvest.harvestID}]
                    <div className="left">
                      {" "}
                      <Button type="link">View Farmer Profile</Button>
                    </div>
                  </div>
                }
              >
                <Descriptions.Item label="Product Images">
                  <Descriptions.Item label="Harvest Photos">
                    <Carousel autoplay></Carousel>
                    <Image
                      width={100}
                      style={{ padding: "2px" }}
                      src={harvest.catImageUrl}
                    />
                    <Image
                      width={100}
                      style={{ padding: "2px" }}
                      src={harvest.harvestPhotoUrl}
                    />
                  </Descriptions.Item>
                </Descriptions.Item>
                <Descriptions.Item label="Farmer Address">
                  <Address
                    size="8"
                    avatar="left"
                    copyable
                    address={harvest.farmerAddress}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Est. Monthly Volume">
                  {harvest.volume} KG
                </Descriptions.Item>
                <Descriptions.Item label="Product Availability">
                  <Badge status="processing" text="In Stock" />
                </Descriptions.Item>
                <Descriptions.Item label="Harvest Date">
                  {harvest.harvestCaptureDate.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Expiry Date" span={1}>
                  {harvest.expiryDate.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Status" span={3}>
                  {!isExpired(harvest.expiryDate) && (
                    <Badge status="success" text="Valid" />
                  )}
                  {isExpired(harvest.expiryDate) && (
                    <Badge status="error" text="Expired" />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Price Per KG">
                  {formatter.format(harvest.pricePerKG)}
                </Descriptions.Item>
                <Descriptions.Item label="Minimum Ordering Qty">
                  {harvest.minOrderQty} KG
                </Descriptions.Item>
                <Descriptions.Item label="Available Quantity">
                  {harvest.qty} KG
                </Descriptions.Item>
                <Descriptions.Item label="PH Levels">
                  {harvest.PHLevel} pH
                </Descriptions.Item>
                <Descriptions.Item label="EC Levels">
                  {harvest.ECLevel} mS/m
                </Descriptions.Item>
                <Descriptions.Item label="Water Levels">
                  {harvest.waterLevel} kPa
                </Descriptions.Item>
                <Descriptions.Item label="Actions" bordered>
                  <Button
                    type="primary"
                    onClick={(e) => showModal(harvest.harvestID)}
                  >
                    Place An Order
                  </Button>
                </Descriptions.Item>
              </Descriptions>
            ))}
          </Card>
        </>
      )}
    </div>
  );
};

export default Marketplace;
