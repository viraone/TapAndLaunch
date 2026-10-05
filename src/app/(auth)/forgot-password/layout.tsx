import { pageMetadata } from "@/lib/marketing";

export const metadata = pageMetadata({
  title: "Reset your TapAndLaunch password",
  description:
    "Forgot your TapAndLaunch password? Enter your email and we will send you a link to set a new one, on any device.",
  path: "/forgot-password",
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
