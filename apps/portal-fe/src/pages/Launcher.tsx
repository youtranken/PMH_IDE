import { ArrowRightOutlined } from "@ant-design/icons";
import { Avatar, Card, Col, Empty, Row, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { BRAND, initials } from "../ui";

const { Title, Text } = Typography;

interface AppItem {
  client_id: string;
  name: string;
  app_url: string;
  env: string;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Launcher (E6-S1, FR-09): lưới app user được vào; bấm mở tab mới theo app_url. */
export default function Launcher({ greeting }: { greeting?: string }) {
  const [apps, setApps] = useState<AppItem[] | null>(null);

  useEffect(() => {
    api<AppItem[]>("/api/me/apps").then(setApps).catch(() => setApps([]));
  }, []);

  const firstName = greeting?.trim().split(/\s+/).pop() ?? "";

  return (
    <>
      <style>{`.pmh-app-card{transition:transform .18s ease, box-shadow .18s ease;}
        .pmh-app-card:hover{transform:translateY(-3px);}
        .pmh-app-card .pmh-arrow{transition:transform .18s ease, color .18s ease;}
        .pmh-app-card:hover .pmh-arrow{transform:translateX(3px);color:${BRAND.green};}`}</style>

      <Title level={3} style={{ marginBottom: 2 }}>
        Chào {firstName} 👋
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        {apps === null
          ? "Đang tải ứng dụng…"
          : apps.length > 0
            ? `Bạn có quyền vào ${apps.length} ứng dụng. Bấm để mở.`
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
                className="pmh-app-card"
                styles={{ body: { padding: 18 } }}
                onClick={() => window.open(a.app_url, "_blank", "noopener")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar
                    shape="square"
                    size={46}
                    style={{ background: "#e8f0ed", color: BRAND.green, fontWeight: 700, borderRadius: 12, flex: "0 0 auto" }}
                  >
                    {initials(a.name)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{ fontWeight: 600, fontSize: 15, color: BRAND.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {a.name}
                      </span>
                      <Tag
                        color={a.env === "prod" ? "green" : "default"}
                        style={{ marginInlineEnd: 0, flex: "0 0 auto", textTransform: "uppercase", fontSize: 11 }}
                      >
                        {a.env}
                      </Tag>
                    </div>
                    <div
                      style={{ color: BRAND.muted, fontSize: 13, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {hostOf(a.app_url)}
                    </div>
                  </div>
                  <ArrowRightOutlined className="pmh-arrow" style={{ color: "#c0c9c5", flex: "0 0 auto" }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
