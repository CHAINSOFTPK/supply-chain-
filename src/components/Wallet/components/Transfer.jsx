import { ethers } from 'ethers';
import { CreditCardOutlined } from "@ant-design/icons";
import { Button, Input, notification } from "antd";
import Text from "antd/lib/typography/Text";
import { useEffect, useState } from "react";
import AddressInput from "../../AddressInput";
import AssetSelector from "./AssetSelector";

const styles = {
  card: {
    alignItems: "center",
    width: "100%",
  },
  header: {
    textAlign: "center",
  },
  input: {
    width: "100%",
    outline: "none",
    fontSize: "16px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textverflow: "ellipsis",
    appearance: "textfield",
    color: "#041836",
    fontWeight: "700",
    border: "none",
    backgroundColor: "transparent",
  },
  select: {
    marginTop: "20px",
    display: "flex",
    alignItems: "center",
  },
  textWrapper: { maxWidth: "80px", width: "100%" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexDirection: "row",
  },
};

function Transfer() {
  const [receiver, setReceiver] = useState();
  const [asset, setAsset] = useState();
  const [tx, setTx] = useState();
  const [amount, setAmount] = useState();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    asset && amount && receiver ? setTx({ amount, receiver, asset }) : setTx();
  }, [asset, amount, receiver]);

  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      onClick: () => {
        console.log("Notification Clicked!");
      },
    });
  };

  async function transfer() {
    const { amount, receiver, asset } = tx;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    try {
      setIsPending(true);
      let transaction;

      if (asset.token_address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        // Native ETH transfer
        transaction = await signer.sendTransaction({
          to: receiver,
          value: ethers.utils.parseEther(amount),
        });
      } else {
        // ERC20 token transfer
        const contract = new ethers.Contract(
          asset.token_address,
          ['function transfer(address to, uint256 amount)'],
          signer
        );
        
        transaction = await contract.transfer(
          receiver,
          ethers.utils.parseUnits(amount, asset.decimals)
        );
      }

      openNotification({
        message: "🔊 New Transaction",
        description: `${transaction.hash}`,
      });

      const receipt = await transaction.wait();
      
      openNotification({
        message: "📃 New Receipt",
        description: `${receipt.transactionHash}`,
      });
      
      setIsPending(false);
    } catch (error) {
      openNotification({
        message: "📃 Error",
        description: error.message,
      });
      console.error(error);
      setIsPending(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.tranfer}>
        <div style={styles.header}>
          <h3>Transfer Assets</h3>
        </div>
        <div style={styles.select}>
          <div style={styles.textWrapper}>
            <Text strong>Address:</Text>
          </div>
          <AddressInput autoFocus onChange={setReceiver} />
        </div>
        <div style={styles.select}>
          <div style={styles.textWrapper}>
            <Text strong>Amount:</Text>
          </div>
          <Input
            size="large"
            prefix={<CreditCardOutlined />}
            onChange={(e) => {
              setAmount(`${e.target.value}`);
            }}
          />
        </div>
        <div style={styles.select}>
          <div style={styles.textWrapper}>
            <Text strong>Asset:</Text>
          </div>
          <AssetSelector setAsset={setAsset} style={{ width: "100%" }} />
        </div>
        <Button
          type="primary"
          size="large"
          loading={isPending}
          style={{ width: "100%", marginTop: "25px" }}
          onClick={() => transfer()}
          disabled={!tx}
        >
          Transfer💸
        </Button>
      </div>
    </div>
  );
}

export default Transfer;
