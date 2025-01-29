import { ethers } from 'ethers';
import { Card, Form, notification } from "antd";
import { useMemo, useState, useEffect } from "react";
import Address from "components/Address/Address";
import { getEllipsisTxt } from "helpers/formatters";
import ContractMethods from "./ContractMethods";
import ContractResolver from "./ContractResolver";

export default function Contract() {
  const [responses, setResponses] = useState({});
  const [contract, setContract] = useState();
  const [events, setEvents] = useState([]);
  const [provider, setProvider] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
      }
    };
    initProvider();
  }, []);

  // Get current chain id
  const chainId = useMemo(() => {
    if (!provider) return null;
    return provider.network.chainId;
  }, [provider]);

  /** Automatically builds write and read components for interacting with contract*/
  const displayedContractFunctions = useMemo(() => {
    if (!contract?.abi) return [];
    return contract.abi.filter((method) => method["type"] === "function");
  }, [contract]);

  /** Returns true in case if contract is deployed to active chain in wallet */
  const isDeployedToActiveChain = useMemo(() => {
    if (!contract?.networks) return undefined;
    return [parseInt(chainId, 16)] in contract.networks;
  }, [contract, chainId]);

  const contractAddress = useMemo(() => {
    if (!isDeployedToActiveChain) return null;
    return contract.networks[parseInt(chainId, 16)]?.["address"] || null;
  }, [chainId, contract, isDeployedToActiveChain]);

  /** Default function for showing notifications*/
  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
    });
  };

  useEffect(() => {
    if (contract?.address && provider) {
      const ethersContract = new ethers.Contract(
        contract.address,
        contract.abi,
        provider
      );

      // Listen for events
      ethersContract.on("*", (event) => {
        setEvents(prev => [...prev, event]);
      });

      return () => {
        ethersContract.removeAllListeners();
      };
    }
  }, [contract, provider]);

  const executeContractFunction = async (options, isView = false) => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        options.contractAddress,
        options.abi,
        isView ? provider : signer
      );

      let result;
      if (isView) {
        result = await contract[options.functionName](...Object.values(options.params));
      } else {
        const tx = await contract[options.functionName](...Object.values(options.params));
        openNotification({
          message: "🔊 New Transaction",
          description: tx.hash,
        });
        await tx.wait();
        openNotification({
          message: "📃 New Receipt",
          description: tx.hash,
        });
      }
      
      setResponses({
        ...responses,
        [options.functionName]: { result, isLoading: false },
      });

    } catch (error) {
      console.error(error);
      setResponses({
        ...responses,
        [options.functionName]: { result: null, isLoading: false },
      });
    }
  };

  return (
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
            Current Contract: {contract?.contractName}
            <Address
              avatar="left"
              copyable
              address={contractAddress}
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
        <ContractResolver setContract={setContract} contract={contract} />

        {isDeployedToActiveChain === true && (
          <Form.Provider
            onFormFinish={async (name, { forms }) => {
              const params = forms[name].getFieldsValue();

              let isView = false;
              /*eslint no-unsafe-optional-chaining: "error"*/
              for (let method of contract?.abi ?? method) {
                if (method.name !== name) continue;
                console.log(method);
                if (method.stateMutability === "view") isView = true;
              }

              const options = {
                contractAddress,
                functionName: name,
                abi: contract?.abi,
                params,
              };

              await executeContractFunction(options, isView);
            }}
          >
            <ContractMethods
              displayedContractFunctions={displayedContractFunctions}
              responses={responses}
            />
          </Form.Provider>
        )}
        {isDeployedToActiveChain === false && (
          <>{`The contract is not deployed to the active ${chainId} chain. Switch your active chain or try agan later.`}</>
        )}
      </Card>
      <Card
        title={"Contract Events"}
        size="large"
        style={{
          width: "40%",
          boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
          border: "1px solid #e7eaf3",
          borderRadius: "0.5rem",
        }}
      >
        {data.map((event, key) => (
          <Card
            title={"Transfer event"}
            size="small"
            style={{ marginBottom: "20px" }}
            key={key}
          >
            {getEllipsisTxt(event.attributes.transaction_hash, 14)}
          </Card>
        ))}
      </Card>
    </div>
  );
}
