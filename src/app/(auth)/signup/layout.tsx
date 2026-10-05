import { pageMetadata } from "@/lib/marketing";

export const metadata = pageMetadata({
  title: "Sign up free: build your own app | TapAndLaunch",
  description:
    "Create your TapAndLaunch account and start a 30-day free trial. No card and no code needed: build an app for your business in minutes.",
  path: "/signup",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
