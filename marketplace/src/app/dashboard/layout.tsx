import { DashboardLiveRefresh } from "@/components/dashboard-live-refresh";
import { privateMetadata } from "@/lib/seo";
export const metadata = privateMetadata;
export default function Layout({ children }: { children: React.ReactNode }) { return <><DashboardLiveRefresh />{children}</>; }
