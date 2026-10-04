import { OfflineBanner } from "@/components/offline-banner";
import { OutboxSync } from "@/components/outbox-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      <OutboxSync />
      {children}
    </>
  );
}
