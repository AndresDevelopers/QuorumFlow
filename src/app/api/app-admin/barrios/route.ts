import { NextResponse } from "next/server";
import { firestoreAdmin } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AuthHttpError, getErrorStatus, requireAuth } from "@/lib/api-auth";
import { requireAppAdmin } from "@/lib/app-admin";
import logger from "@/lib/logger";

export type BarrioEntry = {
  id: string;
  name: string;
};

/**
 * GET /api/app-admin/barrios
 * Lista todos los barrios registrados en c_barrios.
 */
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "api");
  if (limited) return limited;

  try {
    const { uid } = await requireAuth(request);
    await requireAppAdmin(uid);

    const snap = await firestoreAdmin.collection("c_barrios").get();
    const barrios: BarrioEntry[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      barrios.push({
        id: doc.id,
        name: typeof data.name === "string" ? data.name : doc.id,
      });
    });

    barrios.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ barrios });
  } catch (error) {
    const status = getErrorStatus(error, 500);
    if (error instanceof AuthHttpError) {
      return NextResponse.json({ error: error.message }, { status });
    }
    logger.error({ error, message: "[app-admin/barrios] unexpected error" });
    return NextResponse.json(
      { error: "No se pudieron cargar los barrios." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/app-admin/barrios
 * Agrega un nuevo barrio. Body: { name: string }
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "api");
  if (limited) return limited;

  try {
    const { uid } = await requireAuth(request);
    await requireAppAdmin(uid);

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del barrio es requerido." },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: "El nombre debe tener al menos 2 caracteres." },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "El nombre no debe exceder 100 caracteres." },
        { status: 400 }
      );
    }

    // ID = nombre normalizado (minúsculas, sin acentos, espacios → guiones)
    const id = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!id) {
      return NextResponse.json(
        { error: "El nombre no genera un identificador válido." },
        { status: 400 }
      );
    }

    // Verificar si ya existe por ID
    const existingDoc = await firestoreAdmin
      .collection("c_barrios")
      .doc(id)
      .get();
    if (existingDoc.exists) {
      return NextResponse.json(
        { error: "Ya existe un barrio con ese nombre." },
        { status: 409 }
      );
    }

    await firestoreAdmin.collection("c_barrios").doc(id).set({
      name,
      createdAt: new Date(),
    });

    logger.info({ name, id, message: "[app-admin/barrios] barrio creado" });

    return NextResponse.json({ barrio: { id, name } }, { status: 201 });
  } catch (error) {
    const status = getErrorStatus(error, 500);
    if (error instanceof AuthHttpError) {
      return NextResponse.json({ error: error.message }, { status });
    }
    logger.error({ error, message: "[app-admin/barrios] unexpected error on POST" });
    return NextResponse.json(
      { error: "No se pudo crear el barrio." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/app-admin/barrios
 * Elimina un barrio. Body: { id: string }
 */
export async function DELETE(request: Request) {
  const limited = await enforceRateLimit(request, "api");
  if (limited) return limited;

  try {
    const { uid } = await requireAuth(request);
    await requireAppAdmin(uid);

    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json(
        { error: "El ID del barrio es requerido." },
        { status: 400 }
      );
    }

    const docRef = firestoreAdmin.collection("c_barrios").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { error: "El barrio no existe." },
        { status: 404 }
      );
    }

    const data = existing.data();
    const name = typeof data?.name === "string" ? data.name : id;

    await docRef.delete();

    logger.info({ name, id, message: "[app-admin/barrios] barrio eliminado" });

    return NextResponse.json({ deleted: { id, name } });
  } catch (error) {
    const status = getErrorStatus(error, 500);
    if (error instanceof AuthHttpError) {
      return NextResponse.json({ error: error.message }, { status });
    }
    logger.error({ error, message: "[app-admin/barrios] unexpected error on DELETE" });
    return NextResponse.json(
      { error: "No se pudo eliminar el barrio." },
      { status: 500 }
    );
  }
}
