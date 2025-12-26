"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifications = exports.onMissionaryAssignmentCreated = exports.onUrgentFamilyFlagged = exports.onActivityCreated = exports.generateReport = exports.generateCompleteReport = exports.cleanupProfilePictures = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const webpush = __importStar(require("web-push"));
const modern_image_module_1 = __importDefault(require("./modules/modern-image-module"));
const axios_1 = __importDefault(require("axios"));
const notification_dispatcher_1 = require("./modules/notification-dispatcher");
admin.initializeApp();
const firestore = admin.firestore();
const storage = admin.storage();
const notificationDispatcher = new notification_dispatcher_1.NotificationDispatcher(firestore, webpush, functions.logger);
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT_EMAIL || "mailto:example@yourdomain.org", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
const MAX_DOC_IMAGE_WIDTH = 450;
const MAX_DOC_IMAGE_HEIGHT = 300;
const slugify = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const createImageModuleFromUrls = async (urls) => {
    const buffers = await fetchImageBuffers(urls);
    return new modern_image_module_1.default({
        centered: true,
        getImage: (tagValue) => {
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
/**
 * Extrae la ruta del archivo de Storage desde una URL de Firebase Storage.
 * Soporta URLs con formato:
 * - https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?token=...
 * - gs://BUCKET/PATH
 */
const extractStoragePathFromUrl = (url) => {
    try {
        // Formato: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?...
        if (url.includes("firebasestorage.googleapis.com")) {
            const match = url.match(/\/o\/([^?]+)/);
            if (match) {
                // Decodificar la ruta (puede tener %2F en lugar de /)
                const encodedPath = match[1];
                const decodedPath = decodeURIComponent(encodedPath);
                functions.logger.debug("Extracted storage path", { url, encodedPath, decodedPath });
                return decodedPath;
            }
        }
        // Formato: gs://BUCKET/PATH
        if (url.startsWith("gs://")) {
            const parts = url.replace("gs://", "").split("/");
            parts.shift(); // Remover el bucket
            return parts.join("/");
        }
        return null;
    }
    catch (error) {
        functions.logger.error("Error extracting storage path", { url, error });
        return null;
    }
};
const fetchImageBuffers = async (urls) => {
    if (urls.length === 0) {
        return new Map();
    }
    const bucket = storage.bucket();
    const entries = await Promise.all(urls.map(async (url) => {
        try {
            // Intentar extraer la ruta del Storage desde la URL
            const storagePath = extractStoragePathFromUrl(url);
            if (storagePath) {
                // Descargar directamente usando Firebase Admin SDK (acceso privilegiado)
                const file = bucket.file(storagePath);
                const [exists] = await file.exists();
                if (exists) {
                    const [buffer] = await file.download();
                    functions.logger.info("Image downloaded via Admin SDK", { storagePath });
                    return [url, buffer];
                }
                else {
                    functions.logger.warn("File not found in Storage", { storagePath, url });
                }
            }
            // Fallback: usar axios para URLs externas o si no se pudo extraer la ruta
            const response = await axios_1.default.get(url, {
                responseType: "arraybuffer",
                headers: {
                    Accept: "image/*",
                },
                timeout: 30000, // 30 segundos de timeout
            });
            functions.logger.info("Image downloaded via HTTP", { url });
            return [url, Buffer.from(response.data)];
        }
        catch (error) {
            functions.logger.error("Error downloading image for report", { url, error });
            return [url, Buffer.alloc(0)];
        }
    }));
    return new Map(entries);
};
const prepareActivitiesDocData = async (activities) => {
    const uniqueImageUrls = new Set();
    const activitiesData = activities.map((activity) => {
        const activityDate = activity.date.toDate();
        const dateStr = (0, date_fns_1.format)(activityDate, "dd/MM/yyyy", { locale: locale_1.es });
        const fullDate = (0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es });
        const timeStr = activity.time ? ` ${activity.time}` : "";
        let fullDescription = activity.description;
        if (activity.additionalText) {
            fullDescription += `\n\nTexto Adicional: ${activity.additionalText}`;
        }
        const images = (activity.imageUrls ?? [])
            .filter((url) => !!url)
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
    const galleries = activitiesData
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
const prepareBaptismsDocData = async (baptisms) => {
    functions.logger.info("prepareBaptismsDocData called", {
        totalBaptisms: baptisms.length,
        sampleBaptism: baptisms[0] ? {
            name: baptisms[0].name,
            hasPhotoURL: !!baptisms[0].photoURL,
            photoURL: baptisms[0].photoURL,
            hasBaptismPhotos: !!baptisms[0].baptismPhotos,
            baptismPhotosLength: baptisms[0].baptismPhotos?.length || 0
        } : null
    });
    const baptismsData = baptisms.map((baptism) => {
        const baptismDate = baptism.date.toDate();
        const fullDate = (0, date_fns_1.format)(baptismDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es });
        const shortDate = (0, date_fns_1.format)(baptismDate, "dd/MM/yyyy", { locale: locale_1.es });
        const dayOfWeek = (0, date_fns_1.format)(baptismDate, "EEEE", { locale: locale_1.es });
        const month = (0, date_fns_1.format)(baptismDate, "MMMM", { locale: locale_1.es });
        // Combinar photoURL y baptismPhotos en un solo array de imágenes
        const allImageUrls = [];
        // Agregar foto de perfil primero si existe
        if (baptism.photoURL) {
            functions.logger.info("Adding photoURL for baptism", {
                name: baptism.name,
                photoURL: baptism.photoURL
            });
            allImageUrls.push(baptism.photoURL);
        }
        // Agregar fotos del bautismo
        if (baptism.baptismPhotos && baptism.baptismPhotos.length > 0) {
            functions.logger.info("Adding baptismPhotos for baptism", {
                name: baptism.name,
                count: baptism.baptismPhotos.length,
                photos: baptism.baptismPhotos
            });
            allImageUrls.push(...baptism.baptismPhotos.filter((url) => !!url));
        }
        const images = allImageUrls.map((url, index) => ({
            image: url,
            caption: `Bautismo de ${baptism.name} - ${fullDate}`,
            name: baptism.name,
            date: fullDate,
            order: index + 1,
        }));
        functions.logger.info("Processed baptism", {
            name: baptism.name,
            totalImages: images.length,
            hasImages: images.length > 0
        });
        return {
            id: baptism.id,
            nombre: baptism.name,
            fecha: fullDate,
            fecha_corta: shortDate,
            dia_semana: dayOfWeek,
            origen: baptism.source,
            mes: month,
            hasImages: images.length > 0,
            imageCount: images.length,
            photoURL: baptism.photoURL || "",
            images,
        };
    });
    const totalBaptismImages = baptismsData.reduce((sum, baptism) => sum + baptism.imageCount, 0);
    const baptismGalleries = baptismsData
        .filter((baptism) => baptism.hasImages)
        .map((baptism) => ({
        nombre: baptism.nombre,
        fecha: baptism.fecha,
        origen: baptism.origen,
        cantidad: baptism.imageCount,
        foto_perfil: baptism.photoURL,
        imagenes: baptism.images,
    }));
    return {
        baptismsData,
        totalBaptismImages,
        baptismGalleries,
        baptismsWithImages: baptismGalleries.length,
    };
};
exports.cleanupProfilePictures = functions.storage.object().onFinalize(async (object) => {
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
exports.generateCompleteReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const year = data.year || (0, date_fns_1.getYear)(new Date());
    const includeAllActivities = data.includeAllActivities || false;
    try {
        const start = (0, date_fns_1.startOfYear)(new Date(year, 0, 1));
        const end = (0, date_fns_1.endOfYear)(new Date(year, 11, 31));
        const startTimestamp = admin.firestore.Timestamp.fromDate(start);
        const endTimestamp = admin.firestore.Timestamp.fromDate(end);
        // Obtener todas las colecciones necesarias
        const [activitiesSnapshot, baptismsSnapshot, futureMembersSnapshot, convertsSnapshot, membersSnapshot, reportAnswersDoc] = await Promise.all([
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
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activitiesToProcess = includeAllActivities ? allActivities : allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);
        // Procesar bautismos con imágenes
        const baptisms = [
            ...futureMembersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "Sin nombre",
                    date: data.baptismDate,
                    source: "Futuro Miembro",
                    photoURL: data.photoURL,
                    baptismPhotos: data.baptismPhotos || []
                };
            }),
            ...convertsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "Sin nombre",
                    date: data.baptismDate,
                    source: "Nuevo Converso",
                    photoURL: data.photoURL,
                    baptismPhotos: data.baptismPhotos || []
                };
            }),
            ...baptismsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "Sin nombre",
                    date: data.date,
                    source: "Manual",
                    photoURL: data.photoURL,
                    baptismPhotos: data.baptismPhotos || []
                };
            }),
            ...membersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Sin nombre",
                    date: data.baptismDate,
                    source: "Automático",
                    photoURL: data.photoURL,
                    baptismPhotos: data.baptismPhotos || []
                };
            })
        ].filter(b => b.date).sort((a, b) => b.date.toMillis() - a.date.toMillis());
        const answers = (reportAnswersDoc.data() || {});
        // Calcular estadísticas generales
        const totalActivities = activitiesToProcess.length;
        const totalBaptisms = baptisms.length;
        const currentYearActivities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);
        const activitiesByMonth = activitiesToProcess.reduce((acc, activity) => {
            const month = (0, date_fns_1.format)(activity.date.toDate(), "MMMM yyyy", { locale: locale_1.es });
            if (!acc[month])
                acc[month] = [];
            acc[month].push(activity);
            return acc;
        }, {});
        const { activitiesData, totalImages, galleries, activitiesWithImages, } = await prepareActivitiesDocData(activitiesToProcess);
        const { baptismsData, totalBaptismImages, baptismGalleries, baptismsWithImages, } = await prepareBaptismsDocData(baptisms);
        // Combinar todas las URLs de imágenes para el módulo
        const allImageUrls = new Set();
        // Agregar imágenes de actividades
        activitiesData.forEach(activity => {
            activity.images.forEach(img => allImageUrls.add(img.image));
        });
        // Agregar imágenes de bautismos
        baptismsData.forEach(baptism => {
            if (baptism.photoURL)
                allImageUrls.add(baptism.photoURL);
            baptism.images.forEach(img => allImageUrls.add(img.image));
        });
        // Crear módulo de imágenes combinado
        const imageModule = await createImageModuleFromUrls(Array.from(allImageUrls));
        const activitiesDataMap = new Map(activitiesData.map(activity => [activity.id, activity]));
        const monthlyActivities = Object.entries(activitiesByMonth)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([month, activities]) => ({
            month,
            count: activities.length,
            activities: activities.map((activity) => {
                const docActivity = activitiesDataMap.get(activity.id);
                const activityDate = activity.date.toDate();
                return {
                    title: docActivity?.title ?? activity.title,
                    date: (0, date_fns_1.format)(activityDate, "dd 'de' MMMM", { locale: locale_1.es }),
                    fullDate: docActivity?.fullDate ?? (0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
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
                        caption: `${activity.title} - ${(0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es })}`,
                        title: activity.title,
                        date: (0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
                        order: index + 1,
                        description: activity.description,
                        location: activity.location || "",
                    })),
                };
            }),
        }));
        // Los bautismos ya están preparados con imágenes en baptismsData
        const baptismsText = baptismsData.map((b) => `${b.nombre} (${b.fecha})`).join("\n");
        // Obtener template
        const bucket = storage.bucket();
        const file = bucket.file("template/reporte.docx");
        const [templateBuffer] = await file.download();
        const zip = new pizzip_1.default(templateBuffer);
        const doc = new docxtemplater_1.default(zip, {
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
            periodo_cubierto: `${(0, date_fns_1.format)(start, "d 'de' MMMM", { locale: locale_1.es })} al ${(0, date_fns_1.format)(end, "d 'de' MMMM 'de' yyyy", { locale: locale_1.es })}`,
            meses_con_actividades: Object.keys(activitiesByMonth).length,
            distribucion_bautismos: baptisms.reduce((acc, b) => {
                if (!acc[b.source])
                    acc[b.source] = 0;
                acc[b.source]++;
                return acc;
            }, {})
        };
        // Renderizar documento completo
        doc.render({
            anho_reporte: year,
            fecha_reporte: (0, date_fns_1.format)(new Date(), "d 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
            fecha_generacion: (0, date_fns_1.format)(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: locale_1.es }),
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
            resumen_bautismos: baptismsData,
            galeria_actividades: galleries,
            galeria_bautismos: baptismGalleries,
            total_imagenes: totalImages,
            total_imagenes_bautismos: totalBaptismImages,
            total_imagenes_todas: totalImages + totalBaptismImages,
            actividades_con_imagenes: activitiesWithImages,
            bautismos_con_imagenes: baptismsWithImages,
            // Información adicional
            distribucion_bautismos_por_fuente: Object.entries(summary.distribucion_bautismos).map(([fuente, cantidad]) => ({
                fuente,
                cantidad
            })),
            // Datos para tablas
            tabla_actividades: activitiesToProcess.map(a => ({
                titulo: a.title,
                fecha: (0, date_fns_1.format)(a.date.toDate(), "dd/MM/yyyy", { locale: locale_1.es }),
                descripcion: a.description.substring(0, 100) + (a.description.length > 100 ? "..." : ""),
                tiene_imagenes: a.imageUrls && a.imageUrls.length > 0 ? "Sí" : "No",
                cantidad_imagenes: a.imageUrls ? a.imageUrls.length : 0,
            })),
            tabla_bautismos: baptismsData
        });
        const buffer = doc.getZip().generate({ type: "nodebuffer" });
        return {
            fileContents: buffer.toString("base64"),
        };
    }
    catch (error) {
        functions.logger.error("Error generating complete report:", error);
        throw new functions.https.HttpsError("internal", "Error generating complete report: " + error);
    }
});
exports.generateReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const year = data.year || (0, date_fns_1.getYear)(new Date());
    const includeAllActivities = data.includeAllActivities || false;
    try {
        const start = (0, date_fns_1.startOfYear)(new Date(year, 0, 1));
        const end = (0, date_fns_1.endOfYear)(new Date(year, 11, 31));
        const startTimestamp = admin.firestore.Timestamp.fromDate(start);
        const endTimestamp = admin.firestore.Timestamp.fromDate(end);
        const activitiesSnapshot = await firestore.collection("c_actividades").orderBy("date", "desc").get();
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const currentYearActivities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);
        const fmSnapshot = await firestore.collection("c_futuros_miembros")
            .where("baptismDate", ">=", startTimestamp)
            .where("baptismDate", "<=", endTimestamp)
            .get();
        const fromFutureMembers = fmSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || "Sin nombre",
                date: data.baptismDate,
                source: "Futuro Miembro",
                photoURL: data.photoURL,
                baptismPhotos: data.baptismPhotos || []
            };
        });
        const bSnapshot = await firestore.collection("c_bautismos")
            .where("date", ">=", startTimestamp)
            .where("date", "<=", endTimestamp)
            .get();
        const fromManual = bSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || "Sin nombre",
                date: data.date,
                source: "Manual",
                photoURL: data.photoURL,
                baptismPhotos: data.baptismPhotos || []
            };
        });
        const convertsSnapshot = await firestore.collection("c_nuevos_conversos")
            .where("baptismDate", ">=", startTimestamp)
            .where("baptismDate", "<=", endTimestamp)
            .get();
        const fromConverts = convertsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || "Sin nombre",
                date: data.baptismDate,
                source: "Nuevo Converso",
                photoURL: data.photoURL,
                baptismPhotos: data.baptismPhotos || []
            };
        });
        const baptisms = [...fromFutureMembers, ...fromManual, ...fromConverts]
            .filter(b => b.date)
            .sort((a, b) => b.date.toMillis() - a.date.toMillis());
        const reportAnswersDoc = await firestore.collection("c_reporte_anual").doc(String(year)).get();
        const answers = (reportAnswersDoc.data() || {});
        const activitiesToProcess = includeAllActivities ? allActivities : currentYearActivities;
        const { activitiesData, totalImages, galleries, activitiesWithImages, } = await prepareActivitiesDocData(activitiesToProcess);
        const { baptismsData, totalBaptismImages, baptismGalleries, baptismsWithImages, } = await prepareBaptismsDocData(baptisms);
        // Combinar todas las URLs de imágenes para el módulo
        const allImageUrls = new Set();
        // Agregar imágenes de actividades
        activitiesData.forEach(activity => {
            activity.images.forEach(img => allImageUrls.add(img.image));
        });
        // Agregar imágenes de bautismos
        baptismsData.forEach(baptism => {
            if (baptism.photoURL)
                allImageUrls.add(baptism.photoURL);
            baptism.images.forEach(img => allImageUrls.add(img.image));
        });
        // Crear módulo de imágenes combinado
        const imageModule = await createImageModuleFromUrls(Array.from(allImageUrls));
        const activitiesDataMap = new Map(activitiesData.map(activity => [activity.id, activity]));
        const baptismsText = baptismsData.map(b => `${b.nombre} (${b.fecha})`).join("\n");
        // Obtener estadísticas generales
        const totalActivities = activitiesToProcess.length;
        const totalBaptisms = baptisms.length;
        // Obtener actividades por mes
        const activitiesByMonth = activitiesToProcess.reduce((acc, activity) => {
            const month = (0, date_fns_1.format)(activity.date.toDate(), "MMMM yyyy", { locale: locale_1.es });
            if (!acc[month])
                acc[month] = [];
            acc[month].push(activity);
            return acc;
        }, {});
        // Preparar datos para el template
        const monthlyActivities = Object.entries(activitiesByMonth)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([month, activities]) => ({
            month,
            count: activities.length,
            activities: activities.map((activity) => {
                const docActivity = activitiesDataMap.get(activity.id);
                const activityDate = activity.date.toDate();
                return {
                    title: docActivity?.title ?? activity.title,
                    date: (0, date_fns_1.format)(activityDate, "dd/MM/yyyy", { locale: locale_1.es }),
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
                        caption: `${activity.title} - ${(0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es })}`,
                        title: activity.title,
                        date: (0, date_fns_1.format)(activityDate, "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
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
        const zip = new pizzip_1.default(templateBuffer);
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
        });
        doc.render({
            anho_reporte: year,
            fecha_reporte: (0, date_fns_1.format)(new Date(), "d MMMM yyyy", { locale: locale_1.es }),
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
            resumen_bautismos: baptismsData,
            galeria_actividades: galleries,
            galeria_bautismos: baptismGalleries,
            total_imagenes: totalImages,
            total_imagenes_bautismos: totalBaptismImages,
            total_imagenes_todas: totalImages + totalBaptismImages,
            actividades_con_imagenes: activitiesWithImages,
            bautismos_con_imagenes: baptismsWithImages,
            fecha_generacion: (0, date_fns_1.format)(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: locale_1.es })
        });
        const buffer = doc.getZip().generate({
            type: "nodebuffer",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        return { fileContents: buffer.toString("base64") };
    }
    catch (error) {
        functions.logger.error("Error generating report:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError("internal", error.message, error);
        }
        throw new functions.https.HttpsError("internal", "An unknown error occurred.");
    }
});
exports.onActivityCreated = functions.firestore
    .document("c_actividades/{activityId}")
    .onCreate(async (snapshot, context) => {
    try {
        const activity = snapshot.data();
        const activityId = context.params.activityId;
        const activityTitle = activity?.title?.trim() || "Nueva actividad";
        const activityDate = activity?.date && typeof activity.date.toDate === "function"
            ? activity.date.toDate()
            : null;
        const formattedDate = activityDate
            ? (0, date_fns_1.format)(activityDate, "EEEE d 'de' MMMM yyyy", { locale: locale_1.es })
            : null;
        const timeSegment = activity?.time ? ` a las ${activity.time}` : "";
        const details = [];
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
    }
    catch (error) {
        functions.logger.error("Failed to broadcast activity notification", {
            error,
            activityId: context.params.activityId,
        });
    }
});
exports.onUrgentFamilyFlagged = functions.firestore
    .document("c_ministracion/{companionshipId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!after?.families || after.families.length === 0) {
        return;
    }
    const previousStatus = new Map((before?.families ?? []).map((family) => [family.name, family.isUrgent]));
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
    await Promise.all(newlyUrgent.map(async (family) => {
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
        }
        catch (error) {
            functions.logger.error("Failed to broadcast urgent family notification", {
                error,
                companionshipId: context.params.companionshipId,
                family: familyName,
            });
        }
    }));
});
exports.onMissionaryAssignmentCreated = functions.firestore
    .document("c_obra_misional_asignaciones/{assignmentId}")
    .onCreate(async (snapshot, context) => {
    try {
        const assignment = snapshot.data();
        const assignmentId = context.params.assignmentId;
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
    }
    catch (error) {
        functions.logger.error("Failed to broadcast missionary assignment notification", {
            error,
            assignmentId: context.params.assignmentId,
        });
    }
});
exports.notifications = functions.pubsub.schedule("every day 09:00").onRun(async (context) => {
    functions.logger.log("Checking for notifications to send...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourteenDaysFromNow = (0, date_fns_1.addDays)(today, 14);
    const sevenDaysFromNow = (0, date_fns_1.addDays)(today, 7);
    const oneDayFromNow = (0, date_fns_1.addDays)(today, 1);
    const notificationsToSend = [];
    const servicesSnapshot = await firestore.collection("c_servicios").get();
    servicesSnapshot.forEach((doc) => {
        const service = doc.data();
        const serviceDate = service.date.toDate();
        const timeString = service.time ? ` a las ${service.time}` : "";
        if ((0, date_fns_1.isSameDay)(serviceDate, sevenDaysFromNow)) {
            notificationsToSend.push({
                title: "Recordatorio de Servicio",
                body: `El servicio "${service.title}" está programado para la próxima semana.`,
            });
        }
        if ((0, date_fns_1.isSameDay)(serviceDate, oneDayFromNow)) {
            notificationsToSend.push({
                title: "Recordatorio de Servicio",
                body: `¡El servicio "${service.title}" es mañana${timeString}!`,
            });
        }
    });
    const ministeringSnapshot = await firestore.collection("c_ministracion").get();
    ministeringSnapshot.forEach((doc) => {
        const companionship = doc.data();
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
        const birthday = doc.data();
        const birthDate = birthday.birthDate.toDate();
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if ((0, date_fns_1.isSameDay)(nextBirthday, fourteenDaysFromNow)) {
            notificationsToSend.push({
                title: "Próximo Cumpleaños",
                body: `En 2 semanas es el cumpleaños de ${birthday.name}.`
            });
        }
        if ((0, date_fns_1.isSameDay)(nextBirthday, today)) {
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
    const sendPromises = [];
    const notificationSavePromises = [];
    subscriptionsSnapshot.forEach((subDoc) => {
        const subData = subDoc.data();
        const subscription = subData.subscription;
        const userId = subData.userId;
        notificationsToSend.forEach((notification) => {
            const payload = JSON.stringify(notification);
            sendPromises.push(webpush.sendNotification(subscription, payload)
                .catch((err) => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    functions.logger.warn(`Subscription for user ${userId} is invalid. Consider removing it.`);
                }
                else {
                    functions.logger.error("Error sending notification", err);
                }
                return null;
            }));
            notificationSavePromises.push(firestore.collection("c_notifications").add({
                userId: userId,
                title: notification.title,
                body: notification.body,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isRead: false
            }));
        });
    });
    await Promise.all([...sendPromises, ...notificationSavePromises]);
    functions.logger.log(`Sent ${notificationsToSend.length} types of notifications to ${subscriptionsSnapshot.size} users.`);
    return null;
});
//# sourceMappingURL=index.js.map