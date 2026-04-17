import { ManagerPortal } from "@/components/manager-portal";
import { fetchEvents } from "@/lib/events-store";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const initialData = await fetchEvents("manager");
  return <ManagerPortal initialData={initialData} />;
}
