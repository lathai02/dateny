import { notFound } from "next/navigation";
import DiscoveryScreen from "@/features/discovery/discovery-screen";
import type { Mode } from "@/features/discovery/config";

const validModes: Mode[] = ["solo", "couple", "friends"];

export function generateStaticParams() {
  return validModes.map((mode) => ({ mode }));
}

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;

  if (!validModes.includes(mode as Mode)) {
    notFound();
  }

  return <DiscoveryScreen initialMode={mode as Mode} />;
}
