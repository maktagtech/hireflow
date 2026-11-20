import { handler } from "@/lib/api";
import { exportAccount } from "@/lib/account";
import { requireUser } from "@/lib/auth";

/** Download everything HireFlow stores about the user, as JSON. */
export const GET = handler(async () => {
  const user = await requireUser();
  const data = await exportAccount(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="hireflow-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
});
