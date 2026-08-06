import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminAuth } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

async function syncOrderToTrivi(orderId: string) {
  const appId = process.env.TRIVI_APP_ID;
  const appSecret = process.env.TRIVI_APP_SECRET;
  const isTestMode = (process.env.TRIVI_TEST_MODE ?? "true") === "true";
  const apiUrl = isTestMode ? "https://api-test.trivi.com/v2" : "https://api.trivi.com/v2";

  if (!appId || !appSecret) {
    return { success: false, error: "Trivi not configured" };
  }

  const order = await prisma.shopOrder.findFirst({
    where: { OR: [{ id: orderId }, { orderId }] },
    include: { invoices: true },
  });

  if (!order) return { success: false, error: "Order not found" };

  const vsMatch = order.orderId.match(/-(\d{10})-/);
  const variableSymbol = vsMatch ? vsMatch[1] : order.orderId.replace(/\D/g, "").slice(0, 10);

  const parsedItems = JSON.parse(JSON.stringify(order.items));
  const itemsArr = Array.isArray(parsedItems) ? parsedItems : [];
  const lineItems: Array<Record<string, number | string>> = [];
  for (const it of itemsArr) {
    const r = it as Record<string, number | string>;
    const qty = Math.max(1, Math.round((r.quantity as number) || 1));
    const unitPrice = Math.round((r.priceCzk as number) || 0);
    lineItems.push({
      name: String(r.name ?? "Produkt"),
      quantity: qty,
      unitPrice,
      totalPrice: qty * unitPrice,
      vatRate: 21,
    });
  }

  if (order.shippingCzk > 0) {
    lineItems.push({ name: "Doprava", quantity: 1, unitPrice: order.shippingCzk, totalPrice: order.shippingCzk, vatRate: 21 });
  }

  const triviPayload = {
    documentType: "invoice",
    invoiceNumber: order.invoices[0]?.invoiceNumber ?? "ZION-ESHOP-" + new Date().getFullYear() + "/" + variableSymbol,
    variableSymbol,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: [order.addressStreet, order.addressCity, order.addressZip].filter(Boolean).join(", "),
    },
    items: lineItems,
    totalAmount: order.totalCzk,
    currency: "CZK",
    paymentMethod: order.payment === "card" ? "card" : order.payment === "crypto" ? "crypto" : "bank_transfer",
    note: order.note ?? "",
  };

  try {
    const authRes = await fetch(apiUrl + "/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, appSecret }),
    });
    if (!authRes.ok) return { success: false, error: "Trivi auth failed: " + authRes.status };
    const authData = await authRes.json();
    const accessToken = authData.accessToken ?? authData.access_token;

    const invRes = await fetch(apiUrl + "/documents/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify(triviPayload),
    });
    if (!invRes.ok) {
      const errText = await invRes.text();
      return { success: false, error: "Trivi API error: " + invRes.status + " " + errText };
    }
    const invData = await invRes.json();

    await prisma.shopSetting.upsert({
      where: { key: "trivi:" + order.orderId },
      update: { value: JSON.stringify({ synced: true, status: "success", triviId: invData.id ?? invData.documentId, documentNumber: invData.documentNumber, createdAt: new Date().toISOString() }) },
      create: { key: "trivi:" + order.orderId, value: JSON.stringify({ synced: true, status: "success", triviId: invData.id ?? invData.documentId, documentNumber: invData.documentNumber, createdAt: new Date().toISOString() }) },
    });

    return { success: true, trivi_id: invData.id ?? invData.documentId, document_number: invData.documentNumber };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.shopSetting.upsert({
      where: { key: "trivi:" + order.orderId },
      update: { value: JSON.stringify({ synced: true, status: "failed", error: errorMsg, createdAt: new Date().toISOString(), canRetry: true }) },
      create: { key: "trivi:" + order.orderId, value: JSON.stringify({ synced: true, status: "failed", error: errorMsg, createdAt: new Date().toISOString(), canRetry: true }) },
    });
    return { success: false, error: errorMsg };
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const { id } = context.params;
    const result = await syncOrderToTrivi(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Trivi sync failed:", error);
    return NextResponse.json({ success: false, error: "Trivi sync failed" }, { status: 500 });
  }
}
