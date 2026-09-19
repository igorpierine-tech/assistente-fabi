import { Router, type Router as ExpressRouter } from "express";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { listAppointments } from "../services/database";
import { getReceivablesSummary } from "../services/receivables-db";
import { listSales } from "../services/sales-db";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

router.get("/kpis", (req, res) => {
  const shared = sharedOwnerId(req);
  const personal = req.session.googleUser!.id;
  const now = new Date();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const allAppts = listAppointments(personal, {});
  const thisMonthAppts = allAppts.filter(
    (a) => new Date(a.start_time) >= startOfMonth
  );
  const lastMonthAppts = allAppts.filter(
    (a) =>
      new Date(a.start_time) >= startOfLastMonth &&
      new Date(a.start_time) <= endOfLastMonth
  );
  const weekAppts = allAppts.filter(
    (a) =>
      new Date(a.start_time) >= startOfWeek &&
      new Date(a.start_time) < endOfWeek
  );
  const todayStr = now.toISOString().slice(0, 10);
  const todayAppts = allAppts.filter(
    (a) => a.start_time.slice(0, 10) === todayStr
  );

  const completed = thisMonthAppts.filter((a) => a.status === "concluido").length;
  const cancelled = thisMonthAppts.filter((a) => a.status === "cancelado").length;
  const total = thisMonthAppts.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const receivables = getReceivablesSummary(shared);

  const sales = listSales(shared);
  const salesThisMonth = sales.filter(
    (s) => new Date(s.created_at) >= startOfMonth
  );
  const salesLastMonth = sales.filter(
    (s) =>
      new Date(s.created_at) >= startOfLastMonth &&
      new Date(s.created_at) <= endOfLastMonth
  );
  const salesRevenue = salesThisMonth.reduce((sum, s) => sum + s.amount_cents, 0);
  const salesRevenueLastMonth = salesLastMonth.reduce((sum, s) => sum + s.amount_cents, 0);

  const upcoming = allAppts
    .filter((a) => new Date(a.start_time) > now && a.status !== "cancelado")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.title,
      clientName: a.client_name,
      startTime: a.start_time,
      endTime: a.end_time,
      type: a.type,
      status: a.status,
    }));

  res.json({
    today: { count: todayAppts.length },
    week: { count: weekAppts.length },
    month: {
      appointments: total,
      completed,
      cancelled,
      completionRate,
      lastMonthAppointments: lastMonthAppts.length,
    },
    revenue: {
      thisMonth: salesRevenue,
      lastMonth: salesRevenueLastMonth,
      trend: salesRevenueLastMonth > 0
        ? Math.round(((salesRevenue - salesRevenueLastMonth) / salesRevenueLastMonth) * 100)
        : salesRevenue > 0 ? 100 : 0,
    },
    receivables: {
      pending: receivables.a_receber_cents,
      pendingCount: receivables.a_receber_count,
      received: receivables.recebido_mes_cents,
      overdue: receivables.em_atraso_cents,
      overdueCount: receivables.em_atraso_count,
    },
    upcoming,
  });
});

export { router as dashboardRouter };
