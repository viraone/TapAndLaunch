import { pageMetadata } from "@/lib/marketing";

export const metadata = pageMetadata({
  title: "Log in to your TapAndLaunch account",
  description:
    "Log in to TapAndLaunch to build, publish and manage your apps, members, orders and notifications in one place.",
  path: "/login",
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
