import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { Web3Provider } from "./contexts/Web3Context";
import "./index.css";

const Application = () => {
  return (
    <Web3Provider>
      <App />
    </Web3Provider>
  );
};

ReactDOM.render(
  <Application />,
  document.getElementById("root")
);
