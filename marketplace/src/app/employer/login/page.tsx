import { LoginPage } from "@/components/login-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function EmployerLoginPage({ searchParams }: Props) {
  return <LoginPage role="employer" searchParams={searchParams} />;
}
