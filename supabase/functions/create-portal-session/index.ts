// Kabacal — Stripe customer-portal session (Phase 4): manage/cancel the subscription.
// verify_jwt = true. Body: { account_id } → { url }. OWNER only. Secrets: STRIPE_SECRET_KEY, APP_URL.

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const APP_URL = Deno.env.get("APP_URL") ?? "https://spaceinvuk.github.io/kabacal/";
const CORS = {
  "Access-Control-Allow-Origin": new URL(APP_URL).origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { account_id } = await req.json().catch(() => ({}));
  if (!account_id) return json({ error: "account_id required" }, 400);

  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData?.user) return json({ error: "not signed in" }, 401);
  const { data: member } = await caller.from("account_members")
    .select("role").eq("account_id", account_id).eq("user_id", userData.user.id).maybeSingle();
  if (!member || member.role !== "owner") return json({ error: "owner only" }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: bc } = await admin.from("billing_customers")
    .select("stripe_customer_id").eq("account_id", account_id).maybeSingle();
  if (!bc) return json({ error: "no billing customer yet — subscribe first" }, 404);
  try { await stripe.customers.retrieve(bc.stripe_customer_id); }
  catch { return json({ error: "billing customer belongs to another Stripe environment — subscribe again" }, 404); }

  const session = await stripe.billingPortal.sessions.create({
    customer: bc.stripe_customer_id,
    return_url: `${APP_URL}?cloud=on`,
  });
  return json({ url: session.url });
});
