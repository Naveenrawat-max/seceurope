import { TabletGuard } from "@/components/tablet-guard";
import { fetchEvents } from "@/lib/events-store";

export const dynamic = "force-dynamic";

export default async function TabletPage() {
  const initialData = await fetchEvents("tablet");
  return <TabletGuard initialData={initialData} />;
}
