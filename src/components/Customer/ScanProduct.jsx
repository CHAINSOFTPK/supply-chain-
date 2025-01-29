import { Card, notification, Tag, Col, Row, Typography, Button, Alert, Modal, Input, Space, Image, Upload, Descriptions, Badge, Carousel, Table } from "antd";
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, FileTextOutlined, SmileOutlined, PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getEllipsisTxt } from "helpers/formatters";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";
import Distributor from "contracts/Distributor.json";

const { Title } = Typography;

// Replace IPFS client configuration with Pinata setup
const projectId = 'f5a3409d86e8aba5b4f4';    
const projectSecret = '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d'; 

const ipfs = create({ 
  host: 'api.pinata.cloud', 
  port: 443, 
  protocol: 'https',
  headers: {
    pinata_api_key: projectId,
    pinata_secret_api_key: projectSecret,
  }
});

export default function ScanProduct() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);
  const [productID, setProductID] = useState(null);
  const { order_id } = useParams();
  const [carPlateNumber, setCarPlateNumber] = useState();
  const [carrierName, setCarrierName] = useState();
  const [vehicleTemp, setVehicleTemp] = useState();
  const [vehicleTempImage, setVehicleTempImage] = useState();
  const [pickupDateImage, setPickupDateImage] = useState();
  const [deliveredAtImage, setDeliveredAtImage] = useState();
  const [damagesData, setDamagesData] = useState(null);
  const [caseDesc, setCaseDesc] = useState(null);
  const [action, setAction] = useState();
  const [notFound, setNotFound] = useState();
  const [visible, setVisible] = useState(false);
  const [imageHash, setImageHash] = useState();
  const [imageUrl, setImageUrl] = useState();
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showModal = () => setVisible(true);
  const handleCancel = () => setVisible(false);

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    const isLt2M = file.size / 1024 / 1024 < 2;

    if (!isJpgOrPng || !isLt2M) {
      notification.error({
        message: "Upload Error",
        description: !isJpgOrPng 
          ? "You can only upload JPG/PNG files"
          : "Image must be smaller than 2MB",
      });
      return false;
    }
    return true;
  };

  const handleChange = () => {
    if (imageHash) {
      setImageUrl(`https://ipfs.io/ipfs/${imageHash}`);
    }
    setLoading(false);
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

  // Update saveFileIPFS function to use Pinata
  const saveFileIPFS = async (file) => {
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
        setImageHash(data.IpfsHash);
        setImageUrl(`https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`);
        
        notification.success({
          message: "Success",
          description: "Image Successfully Uploaded",
        });
      } else {
        throw new Error('Failed to get IPFS hash');
      }
    } catch (error) {
      console.error("Pinata upload error:", error);
      notification.error({
        message: "Error",
        description: "Failed to upload image: " + error.message,
      });
    }
    setLoading(false);
  };

  const isExpired = (date) => {
    const now = new Date();

    if (now.getTime() > date.getTime()) return true;

    return false;
  };

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

  // Add state for network if using ethers.js v5
  const [network, setNetwork] = useState(null);

  useEffect(() => {
    const fetchNetwork = async () => {
      if (provider && provider.getNetwork) {
        try {
          const net = await provider.getNetwork();
          setNetwork(net);
        } catch (error) {
          console.error("Error fetching network:", error);
          setNetwork(null);
        }
      }
    };
    fetchNetwork();
  }, [provider]);

  /** Returns true in case if contract is deployed to active chain in wallet */
  const isDeployedToActiveChain = useMemo(() => {
    if (!contract?.networks || !network) return false;
    const chainId = network.chainId;
    return chainId in contract.networks;
  }, [contract, network]);

  const contractAddress = useMemo(() => {
    if (!isDeployedToActiveChain || !contract || !network) return null;
    return contract.networks[network.chainId]?.["address"] || null;
  }, [network, contract, isDeployedToActiveChain]);

  /** Default function for showing notifications*/
  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      icon: "🧑",
    });
  };

  const reportDamages = async () => {
    if (!responses || !imageHash || !caseDesc) {
      notification.error({
        message: "Error",
        description: "Please provide all required information",
      });
      return;
    }

    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const tx = await contract.reportDamages(productID, caseDesc, imageHash);
      
      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`,
      });

      await tx.wait();
      
      notification.success({
        message: "Success",
        description: "Report case has been filed successfully!",
      });
      
      fetchOrderData(productID);
      setVisible(false);
    } catch (error) {
      console.error("Error reporting damages:", error);
      notification.error({
        message: "Error",
        description: error.message,
      });
    }
  };

  const fetchOrderData = async (harvestID = order_id) => {
    if (!harvestID) {
      setResponses(undefined);
      return;
    }
  
    try {
      console.log("Fetching harvest data for ID:", harvestID);
  
      const signer = provider.getSigner();
      
      // Initialize farmerContract first since we're querying harvest data
      const farmerContract = new ethers.Contract(
        FarmerContract.networks[provider.network.chainId].address,
        FarmerContract.abi,
        signer
      );
  
      // Convert harvestID to the expected type if necessary
      let parsedHarvestID;
      try {
        parsedHarvestID = ethers.BigNumber.isBigNumber(harvestID)
          ? harvestID
          : ethers.BigNumber.from(harvestID);
        console.log("Parsed Harvest ID:", parsedHarvestID.toString());
      } catch (parseError) {
        console.error("Error parsing harvest ID:", parseError);
        notification.error({
          message: "Error",
          description: "Invalid Harvest ID format.",
        });
        return;
      }
  
      // Fetch harvest data directly
      let harvestData;
      try {
        harvestData = await farmerContract.harvestMapping(parsedHarvestID);
        console.log("Harvest Data:", harvestData);
  
        if (!harvestData || !harvestData.farmerAddress) {
          setNotFound(true);
          setResponses(undefined);
          return;
        }
  
        // Get catalogue item and farmer profile
        const [catalogueItem, farmerProfile] = await Promise.all([
          farmerContract.getCatalogueItemAtIndex(
            harvestData.catalogueProductID,
            harvestData.farmerAddress
          ),
          farmerContract.farmerProfiles(harvestData.farmerAddress)
        ]);
  
        console.log("Catalogue Item:", catalogueItem);
        console.log("Farmer Profile:", farmerProfile);
  
        // Format the response with proper number conversion
        const formattedResponse = {
          harvestID: parsedHarvestID.toNumber(),
          productName: catalogueItem[0],
          volume: parseInt(catalogueItem[1]),
          catImageUrl: `https://ipfs.io/ipfs/${catalogueItem[2]}`,
          harvestPhotoUrl: `https://ipfs.io/ipfs/${harvestData.photoHash}`,
          ECLevel: parseInt(harvestData.ECLevel) / 1000,
          PHLevel: parseInt(harvestData.PHLevel) / 1000,
          waterLevel: parseInt(harvestData.waterLevel) / 1000,
          qty: harvestData.quantity.toNumber(),
          minOrderQty: harvestData.minOrderQty.toNumber(),
          pricePerKG: ethers.utils.formatEther(harvestData.pricePerKG),
          harvestCaptureDate: new Date(harvestData.harvestCaptureDate.toNumber() * 1000).toLocaleString(),
          expiryDate: new Date(harvestData.expiryDate.toNumber() * 1000).toLocaleString(),
          farmerName: farmerProfile.farmerName,
          farmerPhysicalAddress: farmerProfile.farmerPhysicalAddress,
          farmerAddress: harvestData.farmerAddress
        };
  
        setResponses(formattedResponse);
  
      } catch (error) {
        console.error("Error fetching harvest data:", error);
        notification.error({
          message: "Error",
          description: "Failed to retrieve harvest data.",
        });
        setNotFound(true);
        return;
      }
  
    } catch (error) {
      console.error("Unexpected error:", error);
      notification.error({
        message: "Error",
        description: error.message || "An unexpected error occurred.",
      });
      setNotFound(true);
    }
    setLoading(false);
  };
  

  useEffect(() => {
    if (provider && isAuthenticated) {
      fetchOrderData();
    }
  }, [provider, isAuthenticated]);

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JOD",
  });

  return (
    <div>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}

      {isDeployedToActiveChain === true && isAuthenticated === true && (
        <div>
          <Modal
            title="File Damage Case"
            visible={visible}
            onCancel={handleCancel}
            footer={null}
            header={null}
          >
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
                    onClick={(e) => reportDamages()}
                    loading={loading}
                  >
                    Submit
                  </Button>
                </center>
              </Space>
            </>
          </Modal>

          {!order_id && (
            <div>
              <center>
                <Title>Scan Product</Title>
              </center>
              <Card
                style={{
                  marginBottom: "10px",
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
                    <b>Search Product </b>
                  </div>
                }
                size="large"
              >
                <center>
                  {(order_id !== undefined || responses !== undefined) && (
                    <div className="verifed" style={{ textAlign: "center" }}>
                      <center>
                        <img src="/verified.png" />
                        <Title level={3} style={{ padding: "10px" }}>
                          Verified Product! ✔️
                        </Title>
                      </center>
                    </div>
                  )}
                  {responses == undefined && notFound === true && (
                    <div className="verifed" style={{ textAlign: "center" }}>
                      <center>
                        <img src="/unverified.png" />
                        <Title level={3} style={{ padding: "10px" }}>
                          We're unable to vertify this product! ❌
                        </Title>
                      </center>
                    </div>
                  )}

                  <Space align="center">

                    <Input
                      onChange={(e) => setProductID(e.target.value)}
                      value={productID}
                      placeholder="Enter Product ID"
                      required="true"
                    />
                    <Button onClick={(e) => fetchOrderData(productID)}>
                      Search
                    </Button>
                    <Button onClick={(e) => showModal()} disabled={notFound == true && responses == undefined ? true : false}>
                      Report Damages
                    </Button>
                  </Space>
                </center>
              </Card>
            </div>
          )}

          {(order_id !== undefined || responses !== undefined) && (
            <div>
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
                    <b>Product Deatils </b> {order_id}
                  </div>
                }
                size="large"
              >
                <Row>
                  <Col span={24}>
                    {" "}
                    <Col span={24}>
                      <Descriptions
                        style={{
                          boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                          border: "1px solid #e7eaf3",
                          borderRadius: "0.5rem",
                        }}
                        bordered
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
                            {responses.productName} HB-ID [{responses.harvestID}
                            ]
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
                              src={responses.catImageUrl}
                            />
                            <Image
                              width={100}
                              style={{ padding: "2px" }}
                              src={responses.harvestPhotoUrl}
                            />
                          </Descriptions.Item>
                        </Descriptions.Item>
                        <Descriptions.Item label="Farmer Address">
                          <Address
                            size="8"
                            avatar="left"
                            copyable
                            address={responses.farmerAddress}
                          />
                        </Descriptions.Item>
                        <Descriptions.Item label="Est. Monthly Volume">
                          {responses.volume} KG
                        </Descriptions.Item>
                        <Descriptions.Item label="Product Availability">
                          <Badge status="processing" text="In Stock" />
                        </Descriptions.Item>
                        <Descriptions.Item label="Harvest Date">
                          {responses.harvestCaptureDate}
                        </Descriptions.Item>
                        <Descriptions.Item label="Expiry Date" span={1}>
                          {responses.expiryDate}
                        </Descriptions.Item>

                        <Descriptions.Item label="Price Per KG">
                          {formatter.format(responses.pricePerKG)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Minimum Ordering Qty">
                          {responses.minOrderQty} KG
                        </Descriptions.Item>
                        <Descriptions.Item label="Available Quantity">
                          {responses.qty} KG
                        </Descriptions.Item>
                        <Descriptions.Item label="PH Levels">
                          {responses.PHLevel} pH
                        </Descriptions.Item>
                        <Descriptions.Item label="EC Levels">
                          {responses.ECLevel} mS/m
                        </Descriptions.Item>
                        <Descriptions.Item label="Water Levels">
                          {responses.waterLevel} kPa
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
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
                        {responses.carPlateNumber !== 0 &&
                          responses.carPlateNumber}
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
                      title="🧑‍🌾 Farmer Information"
                      size="large"
                      style={{
                        boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                        border: "1px solid #e7eaf3",
                        borderRadius: "0.5rem",
                        minHeight: "341px",
                      }}
                    >
                      <h3>
                        <b>Farmer Name:</b> {responses.farmerName}
                      </h3>
                      <h3>
                        <b>Farm Address</b>: {responses.farmerPhysicalAddress}
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
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
