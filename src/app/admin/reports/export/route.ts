import { getSession, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "../../_lib/csv";
import {
  revenueByDay,
  subscriberGrowthByMonth,
  churnByMonth,
  watchAggregates,
  topTitles,
  dauByDay,
  partnerPerformance,
} from "../data";

export const dynamic = "force-dynamic";

const REPORTS = [
  "revenue_by_day",
  "subscriber_growth",
  "churn",
  "watch_time",
  "top_titles",
  "dau",
  "partner_performance",
] as const;

type ReportKey = (typeof REPORTS)[number];

export async function GET(request: Request): Promise<Response> {
  // Admin guard — route handlers return 403 instead of redirecting.
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "";
  if (!REPORTS.includes(report as ReportKey)) {
    return new Response("Unknown report", { status: 400 });
  }

  const db = createAdminClient();
  let csv: string;

  switch (report as ReportKey) {
    case "revenue_by_day": {
      const rows = await revenueByDay(db, 30);
      csv = toCsv(["date", "revenue_mnt"], rows.map((r) => [r.label, r.value]));
      break;
    }
    case "subscriber_growth": {
      const rows = await subscriberGrowthByMonth(db, 12);
      csv = toCsv(["month", "new_subscriptions"], rows.map((r) => [r.label, r.value]));
      break;
    }
    case "churn": {
      const rows = await churnByMonth(db, 12);
      csv = toCsv(
        ["month", "new_subscriptions", "cancelled"],
        rows.map((r) => [r.month, r.newSubs, r.cancelled]),
      );
      break;
    }
    case "watch_time": {
      const agg = await watchAggregates(db);
      csv = toCsv(
        ["total_watch_seconds", "watching_users", "avg_seconds_per_user"],
        [[agg.totalSeconds, agg.userCount, agg.avgSecondsPerUser]],
      );
      break;
    }
    case "top_titles": {
      const rows = await topTitles(db, 20);
      csv = toCsv(
        ["rank", "title", "kind", "watch_seconds", "unique_viewers"],
        rows.map((r, i) => [i + 1, r.title, r.kind, r.seconds, r.viewers]),
      );
      break;
    }
    case "dau": {
      const rows = await dauByDay(db, 30);
      csv = toCsv(["date", "active_users"], rows.map((r) => [r.label, r.value]));
      break;
    }
    case "partner_performance": {
      const rows = await partnerPerformance(db);
      csv = toCsv(
        ["partner", "watch_seconds", "watch_share_percent", "attributed_revenue_mnt_30d", "revenue_share_percent", "partner_cut_mnt"],
        rows.map((r) => [
          r.partner,
          r.watchSeconds,
          (r.watchShare * 100).toFixed(2),
          r.attributedRevenue,
          r.sharePercent,
          r.partnerCut,
        ]),
      );
      break;
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }

  // Audit the export itself.
  await db.from("audit_logs").insert({
    actor_id: session.userId,
    action: "report.export_csv",
    entity_type: "report",
    entity_id: report,
    details: { report },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flimix-${report}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
