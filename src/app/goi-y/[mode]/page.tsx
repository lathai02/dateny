import { notFound } from "next/navigation";
import Home, { type Mode } from "@/app/page";

const validModes: Mode[] = ["solo", "couple", "friends"];

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;

  if (!validModes.includes(mode as Mode)) {
    notFound();
  }

  return <Home initialMode={mode as Mode} />;
}
