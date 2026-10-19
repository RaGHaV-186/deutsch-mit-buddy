import { CardsApp } from "@/components/cards/CardsApp";
import { requireAal2 } from "@/lib/auth/guard";
import { getProfile } from "@/lib/profile";

// A thin shell: the cards themselves come from this device's storage (and sync), so the page also opens offline.
export default async function CardsPage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  return <CardsApp userId={userId} isAdmin={profile?.role === "admin"} />;
}
