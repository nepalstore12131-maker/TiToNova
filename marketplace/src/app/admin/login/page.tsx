import { LoginPage } from "@/components/login-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AdminLoginPage({ searchParams }: Props) {
  return <LoginPage role="admin" searchParams={searchParams} />;
}
