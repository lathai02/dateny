import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dateny — Hôm nay mình đi đâu thế?",
  description: "Cùng Dateny tìm một địa điểm thật hợp cho buổi hẹn tiếp theo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased" data-ui="dateny">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
