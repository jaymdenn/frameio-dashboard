import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin - Frame.io Upload Portal",
  description: "Manage Frame.io upload destinations",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
