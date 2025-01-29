import { useState } from "react";
import { getEllipsisTxt } from "../../helpers/formatters";
import Blockie from "../Blockie";
import { Card, Modal } from "antd";
import { SelectOutlined, CopyOutlined } from "@ant-design/icons";
import { getExplorer } from "../../helpers/networks";
import { useWeb3 } from "../../contexts/Web3Context";

const styles = {
  account: {
    height: "42px",
    padding: "0 15px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "fit-content",
    borderRadius: "12px",
    backgroundColor: "rgb(244, 244, 244)",
  },
};

function Address({ avatar, size, copyable, explorable, style }) {
  const { account, chainId } = useWeb3();
  const [isModalVisible, setIsModalVisible] = useState(false);

  if (!account) return null;

  return (
    <>
      <div style={{ ...styles.account, ...style }}>
        {avatar === "left" && <Blockie address={account} size={7} />}
        <p style={{ marginLeft: "5px", ...style }}>{getEllipsisTxt(account, 6)}</p>
        {avatar === "right" && <Blockie address={account} size={7} />}
        {copyable && (
          <CopyOutlined
            onClick={() => navigator.clipboard.writeText(account)}
            style={{ cursor: "pointer", marginLeft: "10px" }}
          />
        )}
        {explorable && (
          <SelectOutlined onClick={() => setIsModalVisible(true)} />
        )}
      </div>
      <Modal
        visible={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
        bodyStyle={{
          padding: "15px",
          fontSize: "17px",
          fontWeight: "500",
        }}
        style={{ fontSize: "16px", fontWeight: "500" }}
      >
        Account
        <Card
          style={{
            marginTop: "10px",
            borderRadius: "1rem",
          }}
          bodyStyle={{ padding: "15px" }}
        >
          <Address avatar="left" copyable style={{ fontSize: "20px" }} />
          <div style={{ marginTop: "10px", padding: "0 10px" }}>
            <a
              href={`${getExplorer(chainId)}/address/${account}`}
              target="_blank"
              rel="noreferrer"
            >
              <SelectOutlined style={{ marginRight: "5px" }} />
              View on Explorer
            </a>
          </div>
        </Card>
      </Modal>
    </>
  );
}

export default Address;
