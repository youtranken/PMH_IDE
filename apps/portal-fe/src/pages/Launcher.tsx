import { ArrowRightOutlined } from "@ant-design/icons";
import { Avatar, Card, Col, Empty, Row, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { initials } from "../ui";

const { Title, Text } = Typography;

interface AppItem {
  client_id: string;
  name: string;
  app_url: string;
  env: string;
}

/** Launcher (E6-S1, FR-09): lưới app user được vào; bấm mở tab mới theo app_url. */
export default function Launcher({ greeting }: { greeting?: string }) {
  const [apps, setApps] = useState<AppItem[] | null>(null);

  useEffect(() => {
    api<AppItem[]>("/api/me/apps").then(setApps).catch(() => setApps([]));
  }, []);

  const firstName = greeting?.trim().split(/\s+/).pop() ?? "";

  return (
    <>
      <Title level={3} style={{ marginBottom: 2 }}>
        Chào {firstName} 👋
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {apps === null
          ? "Đang tải ứng dụng…"
          : apps.length > 0
            ? "Chọn một ứng dụng để mở."
            : ""}
      </Text>

      {apps === null ? (
        <Spin />
      ) : apps.length === 0 ? (
        <Empty
          description={
            <span>
              Bạn chưa được cấp quyền vào ứng dụng nào.
              <br />
              Liên hệ quản trị để được thêm vào nhóm phù hợp.
            </span>
          }
          style={{ marginTop: 48 }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map((a) => (
            <Col key={a.client_id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                styles={{ body: { padding: 18 } }}
                onClick={() => window.open(a.app_url, "_blank", "noopener")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar
                    shape="square"
                    size={44}
                    style={{ background: "#e8f1fb", color: "#1560a8", fontWeight: 700, borderRadius: 10 }}
                  >
                    {initials(a.name)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.name}
                    </div>
                    <Tag
                      color={a.env === "prod" ? "green" : "blue"}
                      style={{ marginTop: 4, marginInlineEnd: 0 }}
                    >
                      {a.env}
                    </Tag>
                  </div>
                  <ArrowRightOutlined style={{ color: "#9aa5b1" }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
