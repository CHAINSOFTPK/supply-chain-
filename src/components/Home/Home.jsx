import { Card, Timeline, Typography, Row, Col, Carousel } from "antd";
import React from "react";
import Banner0 from "./Banner0";
import Content0 from "./Content0";
import { enquireScreen } from "enquire-js";

const { Text, Title } = Typography;

let isMobile;
enquireScreen((b) => {
  isMobile = b;
});

const styles = {
  title: {
    fontSize: "20px",
    fontWeight: "700",
  },
  text: {
    fontSize: "16px",
  },
  card: {
    boxShadow: "0 0.5rem 1.2rem rgb(189 197 209 / 20%)",
    border: "1px solid #e7eaf3",
    borderRadius: "0.5rem",
  },
  timeline: {
    marginBottom: "-45px",
  },
};

const Banner01DataSource = {
  wrapper: { className: "banner0" },
  textWrapper: { className: "banner0-text-wrapper" },
  title: {
    className: "banner0-title",
    children: "Daliah Blockchain",
  },
  content: {
    className: "banner0-content",
    children:
      "We help small farmers to become proftiable in Jordan. Sign up now and start earning extra money!",
  },
  button: { className: "banner0-button", children: "Browse Marketplace" },
};

export const Content00DataSource = {
  wrapper: { className: "home-page-wrapper content0-wrapper" },
  page: { className: "home-page content0" },
  OverPack: { playScale: 0.3, className: "" },
  titleWrapper: {
    className: "title-wrapper",
    children: [{ name: "title", children: "Our Features" }],
  },
  childWrapper: {
    className: "content0-block-wrapper",
    children: [
      {
        name: "block0",
        className: "content0-block",
        md: 8,
        xs: 24,
        children: {
          className: "content0-block-item",
          children: [
            {
              name: "image",
              className: "content0-block-icon",
              children:
                "https://zos.alipayobjects.com/rmsportal/WBnVOjtIlGWbzyQivuyq.png",
            },
            {
              name: "title",
              className: "content0-block-title",
              children: "一站式业务接入",
            },
            { name: "content", children: "支付、结算、核算接入产品效率翻四倍" },
          ],
        },
      },
      {
        name: "block1",
        className: "content0-block",
        md: 8,
        xs: 24,
        children: {
          className: "content0-block-item",
          children: [
            {
              name: "image",
              className: "content0-block-icon",
              children:
                "https://zos.alipayobjects.com/rmsportal/YPMsLQuCEXtuEkmXTTdk.png",
            },
            {
              name: "title",
              className: "content0-block-title",
              children: "一站式事中风险监控",
            },
            {
              name: "content",
              children: "在所有需求配置环节事前风险控制和质量控制能力",
            },
          ],
        },
      },
      {
        name: "block2",
        className: "content0-block",
        md: 8,
        xs: 24,
        children: {
          className: "content0-block-item",
          children: [
            {
              name: "image",
              className: "content0-block-icon",
              children:
                "https://zos.alipayobjects.com/rmsportal/EkXWVvAaFJKCzhMmQYiX.png",
            },
            {
              name: "title",
              className: "content0-block-title",
              children: "一站式数据运营",
            },
            {
              name: "content",
              children: "沉淀产品接入效率和运营小二工作效率数据",
            },
          ],
        },
      },
    ],
  },
};

import "components/static/antMotionStyle.less";

const contentStyle = {
  height: "160px",
  color: "#fff",
  lineHeight: "160px",
  textAlign: "center",
  background: "#364d79",
};

export default function Home() {
  return (
    <>
      <div className="home-wrapper" style={{ margin: "-100px -200px" }}>
        <Banner0
          id="Banner0_1"
          key="Banner0_1"
          dataSource={Banner01DataSource}
          isMobile={isMobile}
        />
      </div>
    </>
  );
}
