import { Card, Form, notification, Button, Input, Upload, DatePicker, Select, InputNumber, Typography } from "antd";
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import ProductContract from "contracts/Farmer.json";

const { Title } = Typography;
const { Text } = Typography;

// Replace the IPFS configuration with Pinata setup
const projectId = 'f5a3409d86e8aba5b4f4';    
const projectSecret = '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d'; 

export default function RegisterHarvest() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState();
  const [imageHash, setImageHash] = useState("");
  const [products, setProducts] = useState([]);
  const contract = ProductContract;

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    const isLt2M = file.size / 1024 / 1024 < 2;

    if (!isJpgOrPng || !isLt2M) {
      notification.error({
        message: "Upload Error",
        description: !isJpgOrPng 
          ? "You can only upload JPG/PNG files"
          : "Image must be smaller than 2MB"
      });
      return false;
    }
    return true;
  };

  // Update the saveFileIPFS function
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

  const fetchCatalogueItems = async () => {
    try {
      setLoading(true);
      const signer = provider.getSigner();
      const farmerContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const data = await farmerContract.getCatalogueItems(account);
      const dropdownData = data.map((item, index) => ({
        key: index,
        productName: item[0],
        volume: `${item[1].toString()} KG`,
        image: `https://ipfs.io/ipfs/${item[2]}`
      }));

      setProducts(dropdownData);
    } catch (error) {
      console.error("Error fetching catalogue:", error);
      notification.error({
        message: "Error",
        description: "Failed to fetch catalogue items"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider && isAuthenticated) {
      fetchCatalogueItems();
    }
  }, [provider, isAuthenticated]);

  const handleRegisterHarvest = async (values) => {
    if (!imageHash) {
      notification.error({
        message: "Error",
        description: "Please upload a valid picture"
      });
      return;
    }

    try {
      setLoading(true);
      const signer = provider.getSigner();
      const farmerContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      // Debug log
      console.log('Submitting with values:', {
        imageHash,
        harvestDate: Math.floor(new Date(values._harvestCaptureDate).getTime() / 1000),
        catalogueProductID: Number(values._catalogueProductID),
        PHLevel: Math.floor(values._PHLevel * 1000),
        ECLevel: Math.floor(values._ECLevel * 1000),
        waterLevel: Math.floor(values._waterLevel * 1000),
        quantity: values._quantity,
        minOrderQty: values._minOrderQty,
        pricePerKG: values._pricePerKG,
        expiryDate: Math.floor(new Date(values._expiryDate).getTime() / 1000)
      });

      // Call contract with parameters in CORRECT ORDER matching the smart contract
      const tx = await farmerContract.registerHarvest(
        imageHash,  // 1st: photo hash as string
        Math.floor(new Date(values._harvestCaptureDate).getTime() / 1000),  // 2nd: harvest date
        Number(values._catalogueProductID),  // 3rd: catalogue ID
        Math.floor(values._PHLevel * 1000),  // 4th: PH level
        Math.floor(values._ECLevel * 1000),  // 5th: EC level
        Math.floor(values._waterLevel * 1000),  // 6th: water level
        values._quantity,  // 7th: quantity
        values._minOrderQty,  // 8th: min order qty
        values._pricePerKG,  // 9th: price per kg
        Math.floor(new Date(values._expiryDate).getTime() / 1000)  // 10th: expiry date
      );

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();

      notification.success({
        message: "Success",
        description: "Harvest registered successfully!"
      });

    } catch (error) {
      console.error("Full contract error:", error);
      notification.error({
        message: "Error",
        description: `Contract Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        margin: "auto",
        display: "contents",
        gap: "20px",
        marginTop: "25",
        width: "70vw",
      }}
    >
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}
      {isAuthenticated === true && (
        <>
          {" "}
          <center>
            <Title>Register Harvest</Title>
          </center>
          <Card
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Your contract: {contract?.contractName}
                <Address
                  avatar="left"
                  copyable
                  address={contract.networks[provider.network.chainId].address}
                  size={8}
                />
              </div>
            }
            size="large"
            style={{
              boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
              border: "1px solid #e7eaf3",
              borderRadius: "0.5rem",
            }}
          >
            <Form.Provider
              onFormFinish={async (name, { forms }) => {
                const values = forms[name].getFieldsValue();
                await handleRegisterHarvest(values);
              }}
            >
              <Card
                title="Register Harvest:"
                size="medium"
                style={{ marginBottom: "20px" }}
              >
                <Form layout="vertical" name="registerHarvest">
                  <Form.Item
                    label="Harvest Photo"
                    name="_photoHash"
                    required
                    style={{ marginBottom: "15px" }}
                    rules={[
                      {
                        required: true,
                        message: "Please Upload a Valid Harvest Photo",
                      },
                    ]}
                  >
                    <Upload
                      name="avatar"
                      listType="picture-card"
                      className="avatar-uploader"
                      showUploadList={false}
                      beforeUpload={beforeUpload}
                      customRequest={({ file }) => saveFileIPFS(file)}
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
                      )}
                    </Upload>
                  </Form.Item>

                  <Form.Item
                    label="Harvest Capture Time"
                    name="_harvestCaptureDate"
                    required
                    style={{ marginBottom: "15px" }}
                    rules={[
                      {
                        required: true,
                        message: "Please Choose Product From Catalogue!",
                      },
                    ]}
                  >
                    <DatePicker style={{ width: 200 }} format="YYYY-MM-DD" />
                  </Form.Item>
                  <Form.Item
                    label="Choose Product From Catalogue"
                    name="_catalogueProductID"
                    required
                    style={{ marginBottom: "15px" }}
                  >
                    <Select style={{ width: 200 }}>
                      {products.map((product) => (
                        <Select.Option key={product.key} value={product.key}>
                          {product.productName}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    label="PH Level"
                    name="_PHLevel"
                    rules={[
                      {
                        required: true,
                        message: "Please input your PH Level!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      min={1}
                      max={14}
                      placeholder="PH Level"
                      style={{ width: 200 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="EC Level"
                    name="_ECLevel"
                    rules={[
                      {
                        required: true,
                        message: "Please input your EC Level!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      min={1}
                      max={10}
                      placeholder="EC Level"
                      style={{ width: 200 }}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Water Level"
                    name="_waterLevel"
                    rules={[
                      {
                        required: true,
                        message: "Please input your Water Level!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      style={{ width: 200 }}
                      placeholder="Water Level"
                      min={1}
                      max={10}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Avaliable Quantity"
                    name="_quantity"
                    rules={[
                      {
                        required: true,
                        message: "Please input your Avaliable Quantity!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      placeholder="Avaliable Quantity (KG)"
                      min={1}
                      max={1000}
                      style={{ width: 200 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Minimum Ordering Quantity"
                    name="_minOrderQty"
                    rules={[
                      {
                        required: true,
                        message:
                          "Please input your Minimum Ordering Quantity!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      min={1}
                      max={1000}
                      style={{ width: 200 }}
                      placeholder="Minimum Ordering Quantity"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Price Per KG"
                    type="number"
                    name="_pricePerKG"
                    rules={[
                      {
                        required: true,
                        message:
                          "Please input Price Per KG in Jordanian Dinar (JOD)",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <InputNumber
                      min={1}
                      max={1000}
                      style={{ width: 200 }}
                      placeholder="Price Per KG in Jordanian Dinar (JOD)"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Harvest Expiry Date"
                    name="_expiryDate"
                    rules={[
                      {
                        required: true,
                        message: "Please input Harvest Expiry Date!",
                      },
                    ]}
                    style={{ marginBottom: "15px" }}
                  >
                    <DatePicker style={{ width: 200 }} format="YYYY-MM-DD" />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: "5px" }}>
                    <Text style={{ display: "block" }}>
                      {responses.result &&
                        `Response: ${JSON.stringify(responses.result)}`}
                    </Text>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={responses.isLoading}
                    >
                      Add Harvest
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Form.Provider>
          </Card>
        </>
      )}
    </div>
  );
}
