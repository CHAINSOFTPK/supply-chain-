import {
  Card,
  Form,
  notification,
  Button,
  Input,
  Upload,
  InputNumber,
  Typography,
  Table,
  Image,
} from "antd";
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import FarmerContract from "contracts/Farmer.json";

const { Title } = Typography;

// Replace the IPFS configuration with Pinata
const ipfs = create({
  url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
  headers: {
    pinata_api_key: 'f5a3409d86e8aba5b4f4',
    pinata_secret_api_key: '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d'
  }
});

export default function RegisterCatalogue() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState();
  const [imageHash, setImageHash] = useState("");
  const [tableDataSource, setTableDataSource] = useState([]);
  const contract = FarmerContract;

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
          'pinata_api_key': 'f5a3409d86e8aba5b4f4',
          'pinata_secret_api_key': '6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d',
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
      const tableData = data.map((item, index) => ({
        key: index,
        productName: item[0],
        volume: `${item[1].toString()} KG`,
        image: `https://ipfs.io/ipfs/${item[2]}`
      }));

      setTableDataSource(tableData);
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

  const handleRegisterCatalogue = async (values) => {
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

      // Pass imageHash as string
      const tx = await farmerContract.registerCatalogue(
        values._productName,
        values._monthlyVolume,
        imageHash.toString() // Convert to string explicitly
      );

      notification.info({
        message: "Transaction Pending",
        description: `TX: ${tx.hash}`
      });

      await tx.wait();

      notification.success({
        message: "Success",
        description: "Catalogue registered successfully!"
      });

      fetchCatalogueItems();
    } catch (error) {
      console.error("Error registering catalogue:", error);
      notification.error({
        message: "Error",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Product Name",
      dataIndex: "productName",
      key: "productName",
    },
    {
      title: "Monthly Volume",
      dataIndex: "volume",
      key: "volume",
    },
    {
      title: "Product Image",
      dataIndex: "image",
      key: "image",
      render: (image) => <Image width={100} src={image} />,
    },
  ];

  return (
    <>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try again later.`}</center>
        </>
      )}
      {isAuthenticated === true && (
        <>
          <center>
            <Title>Register Catalogue</Title>
          </center>
          <div
            style={{
              margin: "auto",
              display: "flex",
              gap: "20px",
              marginTop: "25",
              width: "70vw",
            }}
          >
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
                width: "60%",
                boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                border: "1px solid #e7eaf3",
                borderRadius: "0.5rem",
              }}
            >
              <Form.Provider
                onFormFinish={async (name, { forms }) => {
                  const values = forms[name].getFieldsValue();
                  await handleRegisterCatalogue(values);
                }}
              >
                <Card
                  title="Register Catalogue:"
                  size="medium"
                  style={{ marginBottom: "20px" }}
                >
                  <Form layout="vertical" name="registerCatalogue">
                    <Form.Item
                      label="Product Name"
                      name="_productName"
                      required
                      style={{ marginBottom: "15px" }}
                      rules={[
                        {
                          required: true,
                          message: "Please Input Product Name",
                        },
                      ]}
                    >
                      <Input
                        placeholder="I.E Apples or Mangos"
                        style={{ width: 200 }}
                      />
                    </Form.Item>

                    <Form.Item
                      label="Estimated Monthly Volume"
                      name="_monthlyVolume"
                      required
                      style={{ marginBottom: "15px" }}
                      rules={[
                        {
                          required: true,
                          message: "Please Input Estimated Monthly Volume",
                        },
                      ]}
                    >
                      <InputNumber
                        min={1}
                        max={10000}
                        type="number"
                        placeholder="Monthly Volume (KG)"
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="Product Photo"
                      name="_photoHash"
                      required
                      style={{ marginBottom: "15px" }}
                      rules={[
                        {
                          required: true,
                          message: "Please Upload a Valid Catalogue Photo",
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
                    <Form.Item style={{ marginBottom: "5px" }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                      >
                        Add Product
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Form.Provider>
            </Card>
            <Card
              title={"Current Catalogue Products"}
              size="large"
              style={{
                width: "40%",
                boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
                border: "1px solid #e7eaf3",
                borderRadius: "0.5rem",
              }}
            >
              <Table
                dataSource={tableDataSource}
                columns={columns}
                loading={loading}
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
