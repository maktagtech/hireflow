/** Operator settings shown in legal pages and emails. Public (safe for the browser). */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "HireFlow",
  // Legal entity that operates the service, as it should appear in the policies.
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || "the HireFlow team",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  policyUpdated: "November 19, 2026",
};
