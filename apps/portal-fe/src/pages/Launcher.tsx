import { ExportOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Row, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";

const { Title, Text } = Typography;

interface AppItem {
  client_id: string;
  name: string;
  app_url: string;
  env: string;
}

/** Launcher (E6-S1, FR-09): lưới app user được vào; bấm mở tab mới theo app_url. */
export default function Launcher() {
  const [apps, setApps] = useState<AppItem[] | null>(null);

  useEffect(() => {
    api<AppItem[]>("/api/me/apps").then(setApps).catch(() => setApps([]));
  }, []);

  if (!apps) return <Spin />;

  return (
    <>
      <Title level={3}>Ứng dụng của bạn</Title>
      {apps.length === 0 ? (
        <Empty description="Bạn chưa được cấp quyền vào ứng dụng nào" />
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map((a) => (
            <Col key={a.client_id} xs={24} sm={12} md={8}>
              <Card
                hoverable
                onClick={() => window.open(a.app_url, "_blank", "noopener")}
                title={a.name}
                extra={<ExportOutlined />}
              >
                <Text type="secondary" style={{ display: "block", wordBreak: "break-all" }}>
                  {a.app_url}
                </Text>
                <Tag style={{ marginTop: 8 }} color={a.env === "prod" ? "red" : "blue"}>
                  {a.env}
                </Tag>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
