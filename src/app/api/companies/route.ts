import { companies } from "@/server/ingestion";
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 80);
  return Response.json(
    companies
      .filter(
        (c) => c.ticker.includes(query) || c.name.toUpperCase().includes(query),
      )
      .slice(0, 30),
  );
}
