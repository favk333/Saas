import { OfflineBanner } from "@/components/offline-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      {children}
    </>
  );
}
