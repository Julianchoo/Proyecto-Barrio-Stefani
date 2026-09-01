import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { isErrorResponse, requireApiAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { pagos } from "@/lib/schema";
import { deleteFile, upload } from "@/lib/storage";

const COMPROBANTE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_COMPROBANTE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const pagoId = Number(id);
  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const comprobanteValue = formData?.get("comprobante");
  const comprobante = comprobanteValue instanceof File ? comprobanteValue : null;
  if (!comprobante || comprobante.size === 0) {
    return NextResponse.json({ error: "Selecciona un comprobante" }, { status: 400 });
  }
  if (!COMPROBANTE_TYPES.has(comprobante.type) || comprobante.size > MAX_COMPROBANTE_SIZE) {
    return NextResponse.json(
      { error: "El comprobante debe ser PDF, JPG, PNG o WEBP y pesar hasta 5 MB" },
      { status: 400 },
    );
  }

  let uploadedUrl: string | null = null;
  const result = await db
    .transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM pagos WHERE id = ${pagoId} FOR UPDATE`);

      const [current] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
      if (!current) return { error: "Pago no encontrado", status: 404 as const };
      if (current.comprobanteUrl) {
        return { error: "El pago ya tiene un comprobante adjunto", status: 409 as const };
      }

      const uploaded = await upload(
        Buffer.from(await comprobante.arrayBuffer()),
        `${Date.now()}-${comprobante.name}`,
        `comprobantes/pagos/contrato-${current.contratoId}`,
        { maxSize: MAX_COMPROBANTE_SIZE },
      );
      uploadedUrl = uploaded.url;

      const [updated] = await tx
        .update(pagos)
        .set({
          comprobanteUrl: uploaded.url,
          comprobantePathname: uploaded.pathname,
          comprobanteNombre: comprobante.name,
        })
        .where(and(eq(pagos.id, pagoId), isNull(pagos.comprobanteUrl)))
        .returning();
      if (!updated) {
        return { error: "El pago ya tiene un comprobante adjunto", status: 409 as const };
      }
      return { pago: updated };
    })
    .catch(async (error) => {
      if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
      throw error;
    });

  if ("error" in result) {
    if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  return NextResponse.json(result.pago);
}
