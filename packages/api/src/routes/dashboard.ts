import { Router, type Router as ExpressRouter } from "express";
import { requireUser, readOwnerId, personalReadOwnerId } from "../middleware/auth";
import { listAppointments, listClients } from "../services/database";
import { listReceivables, getReceivablesSummary } from "../services/receivables-db";
import { listSales } from "../services/sales-db";
import { listContracts } from "../services/contracts-db";
import { listBookingRequests } from "../services/booking-db";
import { listCatalogItems } from "../services/catalog-db";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

router.get("/kpis", (req, res) => {
  const shared = readOwnerId(req);
  const personal = personalReadOwnerId(req);
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

  const contracts = listContracts(shared);
  const contractsThisMonth = contracts.filter(
    (c) => new Date(c.created_at) >= startOfMonth
  );
  const contractsSigned = contractsThisMonth.filter(
    (c) => c.zapsign_status === "signed" || c.status === "completed"
  ).length;

  const typeCounts: Record<string, number> = {};
  for (const a of thisMonthAppts) {
    const t = a.type || "outro";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topTypeEntry = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

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
    contracts: {
      thisMonth: contractsThisMonth.length,
      signed: contractsSigned,
    },
    topType: topTypeEntry ? { type: topTypeEntry[0], count: topTypeEntry[1] } : null,
    upcoming,
  });
});

router.get("/analytics", (req, res) => {
  const shared = readOwnerId(req);
  const personal = personalReadOwnerId(req);

  const rangeParam = (req.query.range as string) || "this_month";
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let prevStart: Date;
  let prevEnd: Date;

  switch (rangeParam) {
    case "last_month": {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
      break;
    }
    case "last_3_months": {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59);
      break;
    }
    case "custom": {
      const from = req.query.from as string;
      const to = req.query.to as string;
      startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = to ? new Date(to + "T23:59:59") : now;
      const diff = endDate.getTime() - startDate.getTime();
      prevEnd = new Date(startDate.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diff);
      break;
    }
    default: {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
  }

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const prevStartStr = prevStart.toISOString().slice(0, 10);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);

  const inRange = (d: string) => d >= startStr && d <= endStr;
  const inPrev = (d: string) => d >= prevStartStr && d <= prevEndStr;

  // --- Financial ---
  const allReceivables = listReceivables(shared);
  const periodReceivables = allReceivables.filter((r) => inRange(r.due_date));
  const prevReceivables = allReceivables.filter((r) => inPrev(r.due_date));

  const revenueRealized = periodReceivables
    .filter((r) => r.status === "pago")
    .reduce((s, r) => s + r.amount_cents, 0);
  const revenueProjected = periodReceivables.reduce((s, r) => s + r.amount_cents, 0);
  const prevRevenue = prevReceivables
    .filter((r) => r.status === "pago")
    .reduce((s, r) => s + r.amount_cents, 0);

  const overdueReceivables = allReceivables.filter(
    (r) => r.status === "pendente" && r.due_date < startStr
  );
  const overdueTotal = overdueReceivables.reduce((s, r) => s + r.amount_cents, 0);
  const delinquencyRate = revenueProjected > 0
    ? Math.round((overdueTotal / revenueProjected) * 100)
    : 0;

  const sales = listSales(shared);
  const periodSales = sales.filter((s) => inRange(s.sale_date));
  const avgTicket = periodSales.length > 0
    ? Math.round(periodSales.reduce((s, x) => s + x.amount_cents, 0) / periodSales.length)
    : 0;

  const revenueByMonth: Record<string, number> = {};
  periodReceivables.filter((r) => r.status === "pago").forEach((r) => {
    const m = (r.paid_at || r.due_date).slice(0, 7);
    revenueByMonth[m] = (revenueByMonth[m] || 0) + r.amount_cents;
  });

  // --- Operational ---
  const allAppts = listAppointments(personal, {});
  const periodAppts = allAppts.filter((a) => inRange(a.start_time.slice(0, 10)));
  const prevAppts = allAppts.filter((a) => inPrev(a.start_time.slice(0, 10)));

  const completed = periodAppts.filter((a) => a.status === "concluido").length;
  const cancelled = periodAppts.filter((a) => a.status === "cancelado").length;
  const noShow = periodAppts.filter((a) => a.status === "faltou").length;
  const totalAppts = periodAppts.length;
  const prevTotal = prevAppts.length;

  const catalog = listCatalogItems(shared);
  const serviceCatalog = catalog.filter((c) => c.kind === "servico" && c.duration_minutes);
  const totalSlotMinutes = serviceCatalog.reduce((s, c) => s + (c.duration_minutes || 0), 0);
  const avgSessionMin = totalSlotMinutes > 0 ? Math.round(totalSlotMinutes / serviceCatalog.length) : 60;

  const workdaysInPeriod = Math.max(1, Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) * 5 / 7
  ));
  const slotsPerDay = Math.floor(480 / avgSessionMin);
  const totalSlots = workdaysInPeriod * slotsPerDay;
  const occupancyRate = totalSlots > 0
    ? Math.min(100, Math.round((totalAppts / totalSlots) * 100))
    : 0;

  const apptsByMonth: Record<string, { completed: number; cancelled: number; total: number }> = {};
  periodAppts.forEach((a) => {
    const m = a.start_time.slice(0, 7);
    if (!apptsByMonth[m]) apptsByMonth[m] = { completed: 0, cancelled: 0, total: 0 };
    apptsByMonth[m].total++;
    if (a.status === "concluido") apptsByMonth[m].completed++;
    if (a.status === "cancelado") apptsByMonth[m].cancelled++;
  });

  // --- Sales ---
  const bookingRequests = listBookingRequests(shared);
  const periodBookings = bookingRequests.filter((b) => inRange(b.created_at.slice(0, 10)));
  const approvedBookings = periodBookings.filter((b) => b.status === "approved").length;
  const bookingConversion = periodBookings.length > 0
    ? Math.round((approvedBookings / periodBookings.length) * 100)
    : 0;

  const contracts = listContracts(shared);
  const periodContracts = contracts.filter((c) => inRange(c.created_at.slice(0, 10)));
  const signedContracts = periodContracts.filter(
    (c) => c.zapsign_status === "signed" || c.status === "completed"
  ).length;

  const clients = listClients(shared);
  const newClients = clients.filter((c) => inRange(c.created_at.slice(0, 10))).length;
  const prevNewClients = clients.filter((c) => inPrev(c.created_at.slice(0, 10))).length;

  res.json({
    range: { start: startStr, end: endStr },
    financial: {
      revenueRealized,
      revenueProjected,
      prevRevenue,
      revenueTrend: prevRevenue > 0
        ? Math.round(((revenueRealized - prevRevenue) / prevRevenue) * 100)
        : revenueRealized > 0 ? 100 : 0,
      overdueTotal,
      overdueCount: overdueReceivables.length,
      delinquencyRate,
      avgTicket,
      revenueByMonth,
    },
    operational: {
      totalAppointments: totalAppts,
      completed,
      cancelled,
      noShow,
      occupancyRate,
      prevTotalAppointments: prevTotal,
      trend: prevTotal > 0
        ? Math.round(((totalAppts - prevTotal) / prevTotal) * 100)
        : totalAppts > 0 ? 100 : 0,
      apptsByMonth,
    },
    sales: {
      totalBookingRequests: periodBookings.length,
      approvedBookings,
      bookingConversion,
      contractsGenerated: periodContracts.length,
      contractsSigned: signedContracts,
      newClients,
      prevNewClients,
      clientsTrend: prevNewClients > 0
        ? Math.round(((newClients - prevNewClients) / prevNewClients) * 100)
        : newClients > 0 ? 100 : 0,
      totalSales: periodSales.length,
      salesRevenue: periodSales.reduce((s, x) => s + x.amount_cents, 0),
    },
  });
});

export { router as dashboardRouter };
