import { useEffect, useState } from "react";
import { useWeb3 } from "../../contexts/Web3Context";
import makeBlockie from 'ethereum-blockies-base64';

const styles = {
  blockie: {
    borderRadius: "50%",
    width: "100%",
    height: "100%",
  },
};

function Blockie({ currentWallet = false, scale = 3 }) {
  const { account } = useWeb3();
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    if (!account) return;
    try {
      const src = makeBlockie(account);
      setImgSrc(src);
    } catch (error) {
      console.error("Error generating blockie:", error);
    }
  }, [account]);

  if (!account || !imgSrc) return null;

  return (
    <img
      src={imgSrc}
      width={scale * 8}
      height={scale * 8}
      style={styles.blockie}
      alt="account blockie"
    />
  );
}

export default Blockie;
