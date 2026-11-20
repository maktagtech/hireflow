import { handler, json } from "@/lib/api";
import { listApplications } from "@/lib/applications";
import { requireUser } from "@/lib/auth";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ applications: await listApplications(user.id) });
});
