import { LoginPage } from "@/components/login-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function FreelancerLoginPage({ searchParams }: Props) {
  return <LoginPage role="freelancer" searchParams={searchParams} />;
}
