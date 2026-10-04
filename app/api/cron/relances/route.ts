import { NextResponse, type NextRequest } from "next/server";
import { ensurePaymentLink } from "@/lib/payments";
import { dueReminder, REMINDER_DAYS, reminderSms } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 200;

/**
 * Relances SMS des factures impayées (J+3, J+7).
 * Appelé une fois par jour par Vercel Cron (vercel.json), avec
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  // (relance 0 et signée avant J-3) OU (relance 1 et signée avant J-7)
  const dueFilter = REMINDER_DAYS.map((days, step) => {
    const before = new Date(now.getTime() - days * 86_400_000).toISOString();
    return `and(reminders_sent.eq.${step},signed_at.lte."${before}")`;
  }).join(",");

  const { data: candidates, error } = await admin
    .from("invoices")
    .select("id, user_id, invoice_number, total_cents, signed_at, reminders_sent, last_reminder_at, stripe_payment_link_url, client:clients(phone)")
    .eq("status", "signed")
    .or(dueFilter)
    .order("signed_at")
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (candidates ?? []).filter((inv) => dueReminder(inv, now) !== null);

  const userIds = [...new Set(due.map((inv) => inv.user_id))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, company_name").in("id", userIds)
    : { data: [] };
  const companyOf = new Map((profiles ?? []).map((p) => [p.id, p.company_name as string]));

  const result = { checked: candidates?.length ?? 0, sent: 0, failed: [] as string[] };

  for (const inv of due) {
    const step = inv.reminders_sent;
    const phone = (inv.client as unknown as { phone: string } | null)?.phone;
    if (!phone || !inv.invoice_number) continue;

    // Réservation atomique : si deux exécutions se chevauchent, une seule envoie.
    const { data: claimed } = await admin
      .from("invoices")
      .update({ reminders_sent: step + 1, last_reminder_at: now.toISOString() })
      .eq("id", inv.id)
      .eq("status", "signed")
      .eq("reminders_sent", step)
      .select("id");
    if (!claimed?.length) continue;

    try {
      const url = inv.stripe_payment_link_url ?? (await ensurePaymentLink(admin, inv.id));
      await sendSms(
        phone,
        reminderSms(step, {
          company: companyOf.get(inv.user_id) ?? "",
          number: inv.invoice_number,
          totalCents: inv.total_cents,
          url,
        }),
      );
      result.sent++;
    } catch (e) {
      // Échec : on libère la réservation, nouvel essai au prochain passage.
      await admin
        .from("invoices")
        .update({ reminders_sent: step, last_reminder_at: inv.last_reminder_at })
        .eq("id", inv.id)
        .eq("reminders_sent", step + 1);
      result.failed.push(`${inv.invoice_number}: ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  return NextResponse.json(result);
}
