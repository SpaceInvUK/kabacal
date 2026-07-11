// Kabacal — create a Stripe Checkout session (Phase 4). Called by the app (signed-in OWNER only).
// verify_jwt = true (gateway rejects anonymous calls before we run).
// Body: { account_id: uuid, price_id: string } → { url } (redirect the browser there).
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICES (allowlist — arbitrary price ids are refused), APP_URL.

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const APP_URL = Deno.env.get("APP_URL") ?? "https://spaceinvuk.github.io/kabacal/";
const PRICE_PLANS: Record<string, string> = JSON.parse(Deno.env.get("STRIPE_PRICES") ?? "{}");
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

  const { account_id, price_id } = await req.json().catch(() => ({}));
  if (!account_id || !price_id) return json({ error: "account_id and price_id required" }, 400);
  if (!PRICE_PLANS[price_id]) return json({ error: "unknown price" }, 400);

  // caller-scoped client: RLS answers "is this user an OWNER of that account?"
  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "not signed in" }, 401);
  const { data: member } = await caller.from("account_members")
    .select("role").eq("account_id", account_id).eq("user_id", user.id).maybeSingle();
  if (!member || member.role !== "owner") return json({ error: "owner only" }, 403);

  // find-or-create the Stripe customer (service role writes the mapping)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: bc } = await admin.from("billing_customers")
    .select("stripe_customer_id").eq("account_id", account_id).maybeSingle();
  let customer = bc?.stripe_customer_id;
  if (customer) {
    // self-heal: a mapping saved under a different Stripe environment (key swap) is
    // invisible to the current key — verify and recreate instead of crashing forever
    try { await stripe.customers.retrieve(customer); } catch { customer = undefined; }
  }
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { account_id } });
    customer = c.id;
    await admin.from("billing_customers").upsert({ account_id, stripe_customer_id: customer });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: price_id, quantity: 1 }],
    subscription_data: { metadata: { account_id } },
    metadata: { account_id },
    success_url: `${APP_URL}?cloud=on&billing=success`,
    cancel_url: `${APP_URL}?cloud=on&billing=cancelled`,
  });
  return json({ url: session.url });
});
