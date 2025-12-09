
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getYear, startOfYear, endOfYear, format, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import * as webpush from "web-push";
import ModernImageModule from "./modules/modern-image-module";
import axios from "axios";
import { NotificationDispatcher } from "./modules/notification-dispatcher";

admin.initializeApp();

const firestore = admin.firestore();
const storage = admin.storage();
const notificationDispatcher = new NotificationDispatcher(
    firestore,
    webpush,
    functions.logger
);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT_EMAIL || "mailto:example@yourdomain.org",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

interface Activity {
    id: string;
    title: string;
    date: admin.firestore.Timestamp;
    description: string;
    time?: string;
    imageUrls?: string[];
    additionalText?: string;
    location?: string;
    context?: string;
    learning?: string;
}

interface Baptism {
    id: string;
    name: string;
    date: admin.firestore.Timestamp;
    source: "Manual" | "Automático";
}

interface AnnualReportAnswers {
    p1?: string;
    p2?: string;
    p3?: string;
    p4?: string;
    p5?: string;
    p6?: string;
}

interface Service {
    id: string;
    title: string;
    date: admin.firestore.Timestamp;
    time?: string;
}

interface Birthday {
    id: string;
    name: string;
    birthDate: admin.firestore.Timestamp;
}

interface Family {
    name: string;
    isUrgent: boolean;
    observation?: string;
}

interface Companionship {
    id: string;
    families: Family[];
}

interface ActivityDocImage {
    image: string;
    caption: string;
    title: string;
    date: string;
    order: number;
    description: string;
    location: string;
}

interface ActivityDocEntry {
    id: string;
    title: string;
    date: string;
    fullDate: string;
    time: string;
    description: string;
    additionalText: string;
    location: string;
    context: string;
    learning: string;
    hasImages: boolean;
    imageCount: number;
    primaryImage: ActivityDocImage | null;
    images: ActivityDocImage[];
}

interface ActivityGalleryEntry {
    titulo: string;
    fecha: string;
    descripcion: string;
    cantidad: number;
    imagen_principal: ActivityDocImage | null;
    imagenes: ActivityDocImage[];
}

const MAX_DOC_IMAGE_WIDTH = 450;
const MAX_DOC_IMAGE_HEIGHT = 300;

type ImageModuleInstance = ModernImageModule;

const slugify = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const createImageModuleFromUrls = async (urls: string[]): Promise<ImageModuleInstance> => {
    const buffers = await fetchImageBuffers(urls);

    return new ModernImageModule({
        centered: true,
        getImage: (tagValue: unknown) => {
            if (typeof tagValue !== "string" || !tagValue) {
                return Buffer.alloc(0);
            }
            return buffers.get(tagValue) ?? Buffer.alloc(0);
        },
        getSize: () => {
            return [MAX_DOC_IMAGE_WIDTH, MAX_DOC_IMAGE_HEIGHT];
        },
    });
};

const fetchImageBuffers = async (urls: string[]): Promise<Map<string, Buffer>> => {
    if (urls.length === 0) {
        return new Map();
    }

    const entries = await Promise.all(urls.map(async (url) => {
        try {
            const response = await axios.get<ArrayBuffer>(url, {
                responseType: "arraybuffer",
                headers: {
                    Accept: "image/*",
                },
            });
            return [url, Buffer.from(response.data)] as const;
        } catch (error) {
            functions.logger.error("Error downloading image for report", { url, error });
            return [url, Buffer.alloc(0)] as const;
        }
    }));

    return new Map(entries);
};

const prepareActivitiesDocData = async (activities: Activity[]): Promise<{
    activitiesData: ActivityDocEntry[];
    imageModule: ImageModuleInstance;
    totalImages: number;
    galleries: ActivityGalleryEntry[];
    activitiesWithImages: number;
}> => {
    const uniqueImageUrls = new Set<string>();

    const activitiesData: ActivityDocEntry[] = activities.map((activity) => {
        const activityDate = activity.date.toDate();
        const dateStr = format(activityDate, "dd/MM/yyyy", { locale: es });
        const fullDate = format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es });
        const timeStr = activity.time ? ` ${activity.time}` : "";

        let fullDescription = activity.description;
        if (activity.additionalText) {
            fullDescription += `\n\nTexto Adicional: ${activity.additionalText}`;
        }

        const images: ActivityDocImage[] = (activity.imageUrls ?? [])
            .filter((url): url is string => !!url)
            .map((url, index) => {
                uniqueImageUrls.add(url);
                return {
                    image: url,
                    caption: `${activity.title} - ${fullDate}`,
                    title: activity.title,
                    date: fullDate,
                    order: index + 1,
                    description: fullDescription,
                    location: activity.location || "",
                };
            });

        const primaryImage = images[0] ?? null;

        return {
            id: activity.id,
            title: activity.title,
            date: `${dateStr}${timeStr}`,
            fullDate,
            time: activity.time || "",
            description: fullDescription,
            additionalText: activity.additionalText || "",
            location: activity.location || "",
            context: activity.context || "",
            learning: activity.learning || "",
            hasImages: images.length > 0,
            imageCount: images.length,
            primaryImage,
            images,
        };
    });

    const totalImages = activitiesData.reduce((sum, activity) => sum + activity.imageCount, 0);
    const galleries: ActivityGalleryEntry[] = activitiesData
        .filter((activity) => activity.hasImages)
        .map((activity) => ({
            titulo: activity.title,
            fecha: activity.fullDate,
            descripcion: activity.description,
            cantidad: activity.imageCount,
            imagen_principal: activity.primaryImage,
            imagenes: activity.images,
        }));

    const imageModule = await createImageModuleFromUrls(Array.from(uniqueImageUrls));

    return {
        activitiesData,
        imageModule,
        totalImages,
        galleries,
        activitiesWithImages: galleries.length,
    };
};

export const cleanupProfilePictures = functions.storage.object().onFinalize(async (object: any) => {
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType?.startsWith("image/") || !filePath?.startsWith("profile_pictures/users/")) {
        functions.logger.log("Not a profile picture, skipping cleanup.");
        return null;
    }

    const parts = filePath.split("/");
    const userId = parts[2];
    const bucket = admin.storage().bucket(object.bucket);
    const directory = `profile_pictures/users/${userId}`;

    const [files] = await bucket.getFiles({ prefix: directory });

    const deletePromises = files.map(file => {
        if (file.name !== filePath) {
            functions.logger.log(`Deleting old profile picture: ${file.name}`);
            return file.delete();
        }
        return null;
    });

    await Promise.all(deletePromises);
    return null;
});

export const generateCompleteReport = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const year = data.year || getYear(new Date());
    const includeAllActivities = data.includeAllActivities || false;

    try {
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));
        const startTimestamp = admin.firestore.Timestamp.fromDate(start);
        const endTimestamp = admin.firestore.Timestamp.fromDate(end);

        // Obtener todas las colecciones necesarias
        const [
            activitiesSnapshot,
            baptismsSnapshot,
            futureMembersSnapshot,
            convertsSnapshot,
            membersSnapshot,
            reportAnswersDoc
        ] = await Promise.all([
            firestore.collection("c_actividades").orderBy("date", "desc").get(),
            firestore.collection("c_bautismos")
                .where("date", ">=", startTimestamp)
                .where("date", "<=", endTimestamp)
                .get(),
            firestore.collection("c_futuros_miembros")
                .where("baptismDate", ">=", startTimestamp)
                .where("baptismDate", "<=", endTimestamp)
                .get(),
            firestore.collection("c_nuevos_conversos")
                .where("baptismDate", ">=", startTimestamp)
                .where("baptismDate", "<=", endTimestamp)
                .get(),
            firestore.collection("c_miembros")
                .where("baptismDate", ">=", startTimestamp)
                .where("baptismDate", "<=", endTimestamp)
                .get(),
            firestore.collection("c_reporte_anual").doc(String(year)).get()
        ]);

        // Procesar datos
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        const activitiesToProcess = includeAllActivities ? allActivities : allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);

        // Procesar bautismos
        const baptisms = [
            ...futureMembersSnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: data.name, date: data.baptismDate, source: "Futuro Miembro" };
            }),
            ...convertsSnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: data.name, date: data.baptismDate, source: "Nuevo Converso" };
            }),
            ...baptismsSnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: data.name, date: data.date, source: "Manual" };
            }),
            ...membersSnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: `${data.firstName} ${data.lastName}`, date: data.baptismDate, source: "Automático" };
            })
        ].sort((a, b) => b.date.toMillis() - a.date.toMillis()) as any;

        const answers = (reportAnswersDoc.data() || {}) as AnnualReportAnswers;

        // Calcular estadísticas generales
        const totalActivities = activitiesToProcess.length;
        const totalBaptisms = baptisms.length;
        const currentYearActivities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);

        const activitiesByMonth = activitiesToProcess.reduce((acc: Record<string, Activity[]>, activity) => {
            const month = format(activity.date.toDate(), "MMMM yyyy", { locale: es });
            if (!acc[month]) acc[month] = [];
            acc[month].push(activity);
            return acc;
        }, {} as Record<string, Activity[]>);

        const {
            activitiesData,
            imageModule,
            totalImages,
            galleries,
            activitiesWithImages,
        } = await prepareActivitiesDocData(activitiesToProcess);

        const activitiesDataMap = new Map(activitiesData.map(activity => [activity.id, activity]));

        const monthlyActivities = Object.entries(activitiesByMonth)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([month, activities]) => ({
                month,
                count: activities.length,
                activities: activities.map((activity: Activity) => {
                    const docActivity = activitiesDataMap.get(activity.id);
                    const activityDate = activity.date.toDate();
                    return {
                        title: docActivity?.title ?? activity.title,
                        date: format(activityDate, "dd 'de' MMMM", { locale: es }),
                        fullDate: docActivity?.fullDate ?? format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es }),
                        time: docActivity?.time ?? activity.time ?? "",
                        description: docActivity?.description ?? activity.description,
                        additionalText: docActivity?.additionalText ?? activity.additionalText ?? "",
                        location: docActivity?.location ?? activity.location ?? "",
                        context: docActivity?.context ?? activity.context ?? "",
                        learning: docActivity?.learning ?? activity.learning ?? "",
                        hasImages: docActivity?.hasImages ?? (activity.imageUrls ? activity.imageUrls.length > 0 : false),
                        imageCount: docActivity?.imageCount ?? (activity.imageUrls ? activity.imageUrls.length : 0),
                        images: docActivity?.images ?? (activity.imageUrls ?? []).map((url, index) => ({
                            image: url,
                            caption: `${activity.title} - ${format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
                            title: activity.title,
                            date: format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es }),
                            order: index + 1,
                            description: activity.description,
                            location: activity.location || "",
                        })),
                    };
                }),
            }));

        // Preparar bautismos con formato detallado
        const detailedBaptisms = baptisms.map((b: any) => ({
            nombre: b.name,
            fecha: format(b.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
            fecha_corta: format(b.date.toDate(), "dd/MM/yyyy", { locale: es }),
            dia_semana: format(b.date.toDate(), "EEEE", { locale: es }),
            origen: b.source,
            mes: format(b.date.toDate(), "MMMM", { locale: es })
        }));

        const baptismsText = detailedBaptisms.map((b: any) => `${b.nombre} (${b.fecha})`).join("\n");

        // Obtener template
        const bucket = storage.bucket();
        const file = bucket.file("template/reporte.docx");
        const [templateBuffer] = await file.download();

        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
        });

        // Preparar resumen ejecutivo
        const summary = {
            total_actividades_ano: currentYearActivities.length,
            total_bautismos_ano: baptisms.length,
            total_actividades_registradas: allActivities.length,
            actividades_incluidas: activitiesToProcess.length,
            periodo_cubierto: `${format(start, "d 'de' MMMM", { locale: es })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`,
            meses_con_actividades: Object.keys(activitiesByMonth).length,
            distribucion_bautismos: baptisms.reduce((acc: any, b: any) => {
                if (!acc[b.source]) acc[b.source] = 0;
                acc[b.source]++;
                return acc;
            }, {})
        };

        // Renderizar documento completo
        doc.render({
            anho_reporte: year,
            fecha_reporte: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
            fecha_generacion: format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es }),
            periodo_informe: summary.periodo_cubierto,
            
            // Resumen ejecutivo
            resumen_ejecutivo: summary,
            
            // Respuestas del informe anual
            respuesta_p1: answers.p1 || "",
            respuesta_p2: answers.p2 || "",
            respuesta_p3: answers.p3 || "",
            respuesta_p4: answers.p4 || "",
            respuesta_p5: answers.p5 || "",
            respuesta_p6: answers.p6 || "",
            
            // Listados completos
            lista_actividades: activitiesData,
            lista_bautismos: baptismsText,
            
            // Estadísticas
            total_actividades: totalActivities,
            total_bautismos: totalBaptisms,
            total_actividades_ano_actual: currentYearActivities.length,
            total_actividades_totales: allActivities.length,
            incluye_todas_actividades: includeAllActivities ? "Sí" : "No (solo del año actual)",

            // Datos agrupados
            actividades_por_mes: monthlyActivities,
            resumen_bautismos: detailedBaptisms,
            galeria_actividades: galleries,
            total_imagenes: totalImages,
            actividades_con_imagenes: activitiesWithImages,

            // Información adicional
            distribucion_bautismos_por_fuente: Object.entries(summary.distribucion_bautismos).map(([fuente, cantidad]) => ({
                fuente,
                cantidad
            })),
            
            // Datos para tablas
            tabla_actividades: activitiesToProcess.map(a => ({
                titulo: a.title,
                fecha: format(a.date.toDate(), "dd/MM/yyyy", { locale: es }),
                descripcion: a.description.substring(0, 100) + (a.description.length > 100 ? "..." : ""),
                tiene_imagenes: a.imageUrls && a.imageUrls.length > 0 ? "Sí" : "No",
                cantidad_imagenes: a.imageUrls ? a.imageUrls.length : 0,
            })),
            
            tabla_bautismos: detailedBaptisms
        });

        const buffer = doc.getZip().generate({ type: "nodebuffer" });

        return {
            fileContents: buffer.toString("base64"),
        };
    } catch (error) {
        functions.logger.error("Error generating complete report:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Error generating complete report: " + error
        );
    }
});

export const generateReport = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const year = data.year || getYear(new Date());
    const includeAllActivities = data.includeAllActivities || false;

    try {
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));
        const startTimestamp = admin.firestore.Timestamp.fromDate(start);
        const endTimestamp = admin.firestore.Timestamp.fromDate(end);

        const activitiesSnapshot = await firestore.collection("c_actividades").orderBy("date", "desc").get();
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        
        const currentYearActivities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);

        const fmSnapshot = await firestore.collection("c_futuros_miembros")
            .where("baptismDate", ">=", startTimestamp)
            .where("baptismDate", "<=", endTimestamp)
            .get();
        const fromFutureMembers = fmSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, date: data.baptismDate, source: "Automático" } as Baptism;
        });

        const bSnapshot = await firestore.collection("c_bautismos")
            .where("date", ">=", startTimestamp)
            .where("date", "<=", endTimestamp)
            .get();
        const fromManual = bSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, date: data.date, source: "Manual" } as Baptism;
        });
        const baptisms = [...fromFutureMembers, ...fromManual].sort((a, b) => b.date.toMillis() - a.date.toMillis());

        const reportAnswersDoc = await firestore.collection("c_reporte_anual").doc(String(year)).get();
        const answers = (reportAnswersDoc.data() || {}) as AnnualReportAnswers;

        const activitiesToProcess = includeAllActivities ? allActivities : currentYearActivities;
        const {
            activitiesData,
            imageModule,
            totalImages,
            galleries,
            activitiesWithImages,
        } = await prepareActivitiesDocData(activitiesToProcess);

        const activitiesDataMap = new Map(activitiesData.map(activity => [activity.id, activity]));

        const baptismsText = baptisms.map(b => `${b.name} (${format(b.date.toDate(), "P", { locale: es })})`).join("\n");

        // Obtener estadísticas generales
        const totalActivities = activitiesToProcess.length;
        const totalBaptisms = baptisms.length;

        // Obtener actividades por mes
        const activitiesByMonth = activitiesToProcess.reduce((acc: Record<string, Activity[]>, activity) => {
            const month = format(activity.date.toDate(), "MMMM yyyy", { locale: es });
            if (!acc[month]) acc[month] = [];
            acc[month].push(activity);
            return acc;
        }, {} as Record<string, Activity[]>);

        // Preparar datos para el template
        const monthlyActivities = Object.entries(activitiesByMonth)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([month, activities]) => ({
                month,
                count: activities.length,
                activities: activities.map((activity: Activity) => {
                    const docActivity = activitiesDataMap.get(activity.id);
                    const activityDate = activity.date.toDate();
                    return {
                        title: docActivity?.title ?? activity.title,
                        date: format(activityDate, "dd/MM/yyyy", { locale: es }),
                    time: docActivity?.time ?? activity.time ?? "",
                    description: docActivity?.description ?? activity.description,
                    additionalText: docActivity?.additionalText ?? activity.additionalText ?? "",
                    location: docActivity?.location ?? activity.location ?? "",
                    context: docActivity?.context ?? activity.context ?? "",
                    learning: docActivity?.learning ?? activity.learning ?? "",
                    hasImages: docActivity?.hasImages ?? (activity.imageUrls ? activity.imageUrls.length > 0 : false),
                    imageCount: docActivity?.imageCount ?? (activity.imageUrls ? activity.imageUrls.length : 0),
                    images: docActivity?.images ?? (activity.imageUrls ?? []).map((url, index) => ({
                        image: url,
                        caption: `${activity.title} - ${format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
                        title: activity.title,
                        date: format(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: es }),
                        order: index + 1,
                        description: activity.description,
                        location: activity.location || "",
                    })),
                };
            }),
        }));

        const bucket = storage.bucket();
        const file = bucket.file("template/reporte.docx");
        const [templateBuffer] = await file.download();

        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
        });

        doc.render({
            anho_reporte: year,
            fecha_reporte: format(new Date(), "d MMMM yyyy", { locale: es }),
            respuesta_p1: answers.p1 || "",
            respuesta_p2: answers.p2 || "",
            respuesta_p3: answers.p3 || "",
            respuesta_p4: answers.p4 || "",
            respuesta_p5: answers.p5 || "",
            respuesta_p6: answers.p6 || "",
            lista_actividades: activitiesData,
            lista_bautismos: baptismsText,
            total_actividades: totalActivities,
            total_bautismos: totalBaptisms,
            actividades_por_mes: monthlyActivities,
            resumen_bautismos: baptisms.map(b => ({
                nombre: b.name,
                fecha: format(b.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
                origen: b.source
            })),
            galeria_actividades: galleries,
            total_imagenes: totalImages,
            actividades_con_imagenes: activitiesWithImages,
            fecha_generacion: format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
        });

        const buffer = doc.getZip().generate({
            type: "nodebuffer",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        return { fileContents: buffer.toString("base64") };
    } catch (error) {
        functions.logger.error("Error generating report:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError("internal", error.message, error);
        }
        throw new functions.https.HttpsError("internal", "An unknown error occurred.");
    }
});

export const onActivityCreated = functions.firestore
    .document("c_actividades/{activityId}")
    .onCreate(async (snapshot, context) => {
        try {
            const activity = snapshot.data() as Activity;
            const activityId = context.params.activityId as string;

            const activityTitle = activity?.title?.trim() || "Nueva actividad";
            const activityDate = activity?.date && typeof activity.date.toDate === "function"
                ? activity.date.toDate()
                : null;
            const formattedDate = activityDate
                ? format(activityDate, "EEEE d 'de' MMMM yyyy", { locale: es })
                : null;
            const timeSegment = activity?.time ? ` a las ${activity.time}` : "";
            const details: string[] = [];

            if (formattedDate) {
                details.push(`para el ${formattedDate}${timeSegment}`);
            }

            if (activity?.location) {
                details.push(`en ${activity.location}`);
            }

            const detailText = details.length > 0 ? ` ${details.join(" ")}` : "";
            const body = `Se programó la actividad "${activityTitle}"${detailText}.`;

            await notificationDispatcher.broadcast({
                title: "Nueva Actividad Programada",
                body,
                url: "/reports",
                tag: `activity-${activityId}`,
                actions: [
                    {
                        action: "open",
                        title: "Ver actividades",
                        url: "/reports",
                    },
                ],
                context: {
                    contextType: "activity",
                    contextId: activityId,
                    actionUrl: "/reports",
                    actionType: "navigate",
                },
            });
        } catch (error) {
            functions.logger.error("Failed to broadcast activity notification", {
                error,
                activityId: context.params.activityId,
            });
        }
    });

export const onUrgentFamilyFlagged = functions.firestore
    .document("c_ministracion/{companionshipId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data() as Companionship | undefined;
        const after = change.after.data() as Companionship | undefined;

        if (!after?.families || after.families.length === 0) {
            return;
        }

        const previousStatus = new Map(
            (before?.families ?? []).map((family) => [family.name, family.isUrgent])
        );

        const newlyUrgent = after.families.filter((family) => {
            if (!family.isUrgent) {
                return false;
            }
            const wasUrgent = previousStatus.get(family.name);
            return wasUrgent !== true;
        });

        if (newlyUrgent.length === 0) {
            return;
        }

        await Promise.all(
            newlyUrgent.map(async (family) => {
                const familyName = family.name || "Familia";
                const familySlug = slugify(familyName) || "familia";
                try {
                    const normalizedObservation = family.observation?.trim();
                    const body = normalizedObservation
                        ? `La familia ${familyName} requiere ayuda: ${normalizedObservation}`
                        : `La familia ${familyName} ha sido marcada como urgente.`;

                    const contextId = `${context.params.companionshipId}:${familySlug}`;

                    await notificationDispatcher.broadcast({
                        title: "Nueva familia con necesidad urgente",
                        body,
                        url: "/ministering/urgent",
                        tag: `urgent-family-${context.params.companionshipId}-${familySlug}`,
                        actions: [
                            {
                                action: "open",
                                title: "Ver familias urgentes",
                                url: "/ministering/urgent",
                            },
                        ],
                        context: {
                            contextType: "urgent_family",
                            contextId,
                            actionUrl: "/ministering/urgent",
                            actionType: "navigate",
                        },
                    });
                } catch (error) {
                    functions.logger.error("Failed to broadcast urgent family notification", {
                        error,
                        companionshipId: context.params.companionshipId,
                        family: familyName,
                    });
                }
            })
        );
    });

export const onMissionaryAssignmentCreated = functions.firestore
    .document("c_obra_misional_asignaciones/{assignmentId}")
    .onCreate(async (snapshot, context) => {
        try {
            const assignment = snapshot.data() as { description?: string } | undefined;
            const assignmentId = context.params.assignmentId as string;
            const description = assignment?.description?.trim();
            const body = description && description.length > 0
                ? description
                : "Se registró una nueva asignación misional.";

            await notificationDispatcher.broadcast({
                title: "Nueva Asignación Misional",
                body,
                url: "/missionary-work",
                tag: `missionary-assignment-${assignmentId}`,
                actions: [
                    {
                        action: "open",
                        title: "Ver asignaciones",
                        url: "/missionary-work",
                    },
                ],
                context: {
                    contextType: "missionary_assignment",
                    contextId: assignmentId,
                    actionUrl: "/missionary-work",
                    actionType: "navigate",
                },
            });
        } catch (error) {
            functions.logger.error("Failed to broadcast missionary assignment notification", {
                error,
                assignmentId: context.params.assignmentId,
            });
        }
    });


export const notifications = functions.pubsub.schedule("every day 09:00").onRun(async (context: any) => {
    functions.logger.log("Checking for notifications to send...");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fourteenDaysFromNow = addDays(today, 14);
    const sevenDaysFromNow = addDays(today, 7);
    const oneDayFromNow = addDays(today, 1);

    const notificationsToSend: { title: string, body: string }[] = [];

    const servicesSnapshot = await firestore.collection("c_servicios").get();
    servicesSnapshot.forEach((doc) => {
        const service = doc.data() as Service;
        const serviceDate = service.date.toDate();
        const timeString = service.time ? ` a las ${service.time}` : "";

        if (isSameDay(serviceDate, sevenDaysFromNow)) {
            notificationsToSend.push({
                title: "Recordatorio de Servicio",
                body: `El servicio "${service.title}" está programado para la próxima semana.`,
            });
        }
        if (isSameDay(serviceDate, oneDayFromNow)) {
            notificationsToSend.push({
                title: "Recordatorio de Servicio",
                body: `¡El servicio "${service.title}" es mañana${timeString}!`,
            });
        }
    });

    const ministeringSnapshot = await firestore.collection("c_ministracion").get();
    ministeringSnapshot.forEach((doc) => {
        const companionship = doc.data() as Companionship;
        companionship.families.forEach((family) => {
            if (family.isUrgent) {
                notificationsToSend.push({
                    title: "Necesidad Urgente",
                    body: `Recordatorio: La familia ${family.name} tiene una necesidad urgente que requiere atención.`,
                });
            }
        });
    });

    const birthdaysSnapshot = await firestore.collection("c_cumpleanos").get();
    birthdaysSnapshot.forEach((doc) => {
        const birthday = doc.data() as Birthday;
        const birthDate = birthday.birthDate.toDate();
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        if (isSameDay(nextBirthday, fourteenDaysFromNow)) {
            notificationsToSend.push({
                title: "Próximo Cumpleaños",
                body: `En 2 semanas es el cumpleaños de ${birthday.name}.`
            });
        }
        if (isSameDay(nextBirthday, today)) {
             notificationsToSend.push({
                title: "¡Feliz Cumpleaños!",
                body: `Hoy es el cumpleaños de ${birthday.name}. ¡No olvides felicitarle!`
            });
        }
    });

    if (notificationsToSend.length === 0) {
        functions.logger.log("No notifications to send today.");
        return null;
    }

    const subscriptionsSnapshot = await firestore.collection("c_push_subscriptions").get();
    if (subscriptionsSnapshot.empty) {
        functions.logger.log("No users subscribed to notifications.");
        return null;
    }

    const sendPromises: Promise<any>[] = [];
    const notificationSavePromises: Promise<any>[] = [];

    subscriptionsSnapshot.forEach((subDoc) => {
        const subData = subDoc.data();
        const subscription = subData.subscription;
        const userId = subData.userId;

        notificationsToSend.forEach((notification) => {
            const payload = JSON.stringify(notification);
            
            sendPromises.push(
                webpush.sendNotification(subscription, payload)
                    .catch((err) => {
                        if (err.statusCode === 404 || err.statusCode === 410) {
                             functions.logger.warn(`Subscription for user ${userId} is invalid. Consider removing it.`);
                        } else {
                            functions.logger.error("Error sending notification", err);
                        }
                        return null;
                    })
            );

             notificationSavePromises.push(
                firestore.collection("c_notifications").add({
                    userId: userId,
                    title: notification.title,
                    body: notification.body,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isRead: false
                })
             );
        });
    });

    await Promise.all([...sendPromises, ...notificationSavePromises]);
    functions.logger.log(`Sent ${notificationsToSend.length} types of notifications to ${subscriptionsSnapshot.size} users.`);
    return null;
});
