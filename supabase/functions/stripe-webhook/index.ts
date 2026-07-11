// Kabacal — Stripe webhook (Phase 4). THE single writer of billing_* and accounts.plan/status.
// verify_jwt = false (supabase/config.toml): Stripe authenticates via the signature header.
// Secrets (Edge Function secrets, never in the repo): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// STRIPE_PRICES = {"price_xxx":"starter","price_yyy":"workshop","price_zzz":"pro"}.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Events handled (configure exactly these in the Stripe webhook endpoint):
//   checkout.session.completed            → map customer ↔ account (billing_customers)
//   customer.subscription.created/updated → mirror row + derive accounts.plan/status
//   customer.subscription.deleted         → plan falls back to 'beta'
//   invoice.payment_failed                → no-op here (Stripe retries; subscription.updated
//                                           carries past_due/unpaid and drives suspension)

import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const PRICE_PLANS: Record<string, string> = JSON.parse(Deno.env.get("STRIPE_PRICES") ?? "{}");

function planFor(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price?.id;
  return (price && PRICE_PLANS[price]) || null;
}

async function accountIdFor(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.account_id) return sub.metadata.account_id;
  const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!cust) return null;
  const { data } = await admin.from("billing_customers").select("account_id").eq("stripe_customer_id", cust).maybeSingle();
  return data?.account_id ?? null;
}

async function mirrorSubscription(sub: Stripe.Subscription) {
  const accountId = await accountIdFor(sub);
  if (!accountId) { console.error("no account for subscription", sub.id); return; }
  const plan = planFor(sub);
  await admin.from("billing_subscriptions").upsert({
    id: sub.id,
    account_id: accountId,
    status: sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    plan,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    raw: sub as unknown as Record<string, unknown>,
  });
  // derive the account's plan/status — the ONLY writer of these columns
  if (sub.status === "active" || sub.status === "trialing") {
    await admin.from("accounts").update({ plan: plan ?? "beta", status: "active" }).eq("id", accountId);
  } else if (sub.status === "unpaid") {
    await admin.from("accounts").update({ status: "suspended" }).eq("id", accountId);
  } else if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    await admin.from("accounts").update({ plan: "beta", status: "active" }).eq("id", accountId);
  }
  // past_due: grace — Stripe keeps retrying; no account change until unpaid/canceled.
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(), sig, Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    );
  } catch (e) {
    console.error("signature verification failed", e);
    return new Response("bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const accountId = s.metadata?.account_id;
        const cust = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (accountId && cust) {
          await admin.from("billing_customers").upsert({ account_id: accountId, stripe_customer_id: cust });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await mirrorSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        break; // see header note
      default:
        break; // ignore anything not subscribed
    }
  } catch (e) {
    console.error("handler error", event.type, e);
    return new Response("handler error", { status: 500 }); // Stripe retries
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
