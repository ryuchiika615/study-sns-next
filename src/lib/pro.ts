export type ProSource = "admin" | "paid" | "campaign" | "other";

export type ProGrant = {
  id: string;
  source: ProSource;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export function isActiveProGrant(grant: ProGrant, now = new Date()) {
  return !grant.revoked_at && new Date(grant.starts_at) <= now && (!grant.expires_at || new Date(grant.expires_at) > now);
}

export function getProStatus(grants: ProGrant[], now = new Date()) {
  const active = grants.filter((grant) => isActiveProGrant(grant, now));
  const paid = active.find((grant) => grant.source === "paid");
  const primary = paid || active[0] || null;
  return {
    isPro: Boolean(primary),
    source: primary?.source || null,
    expiresAt: primary?.expires_at || null,
    grant: primary,
  };
}
