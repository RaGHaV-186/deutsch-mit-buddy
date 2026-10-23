import { MeView } from "@/components/me/MeView";
import { requireAal2FromClaims } from "@/lib/auth/guard";
import { getProfile } from "@/lib/profile";

export default async function Page() {
  const { userId } = await requireAal2FromClaims();
  const profile = await getProfile(userId);
  return <MeView name={profile?.display_name ?? null} />;
}
