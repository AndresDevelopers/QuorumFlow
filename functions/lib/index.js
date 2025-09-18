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
exports.notifications = exports.generateReport = exports.generateCompleteReport = exports.cleanupProfilePictures = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const webpush = __importStar(require("web-push"));
const docxtemplater_image_module_free_1 = __importDefault(require("docxtemplater-image-module-free"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const firestore = admin.firestore();
const storage = admin.storage();
if (functions.config().vapid) {
    webpush.setVapidDetails("mailto:example@yourdomain.org", functions.config().vapid.public_key, functions.config().vapid.private_key);
}
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
        ].sort((a, b) => b.date.toMillis() - a.date.toMillis());
        const answers = (reportAnswersDoc.data() || {});
        // Calcular estadísticas generales
        const totalActivities = activitiesToProcess.length;
        const totalBaptisms = baptisms.length;
        const currentYearActivities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);
        // Agrupar actividades por tipo de información
        const activitiesByMonth = activitiesToProcess.reduce((acc, activity) => {
            const month = (0, date_fns_1.format)(activity.date.toDate(), "MMMM yyyy", { locale: locale_1.es });
            if (!acc[month])
                acc[month] = [];
            acc[month].push(activity);
            return acc;
        }, {});
        const monthlyActivities = Object.entries(activitiesByMonth)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([month, activities]) => ({
            month,
            count: activities.length,
            activities: activities.map((a) => ({
                title: a.title,
                date: (0, date_fns_1.format)(a.date.toDate(), "dd 'de' MMMM", { locale: locale_1.es }),
                fullDate: (0, date_fns_1.format)(a.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
                time: a.time || "",
                description: a.description,
                additionalText: a.additionalText || "",
                hasImages: !!(a.imageUrls && a.imageUrls.length > 0),
                imageCount: a.imageUrls ? a.imageUrls.length : 0
            }))
        }));
        // Preparar bautismos con formato detallado
        const detailedBaptisms = baptisms.map((b) => ({
            nombre: b.name,
            fecha: (0, date_fns_1.format)(b.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
            fecha_corta: (0, date_fns_1.format)(b.date.toDate(), "dd/MM/yyyy", { locale: locale_1.es }),
            dia_semana: (0, date_fns_1.format)(b.date.toDate(), "EEEE", { locale: locale_1.es }),
            origen: b.source,
            mes: (0, date_fns_1.format)(b.date.toDate(), "MMMM", { locale: locale_1.es })
        }));
        // Preparar actividades para el formato de lista
        const activitiesData = await Promise.all(activitiesToProcess.map(async (a) => {
            const dateStr = (0, date_fns_1.format)(a.date.toDate(), "dd/MM/yyyy", { locale: locale_1.es });
            const timeStr = a.time ? ` ${a.time}` : "";
            let fullDescription = a.description;
            if (a.additionalText) {
                fullDescription += `\n\nTexto Adicional: ${a.additionalText}`;
            }
            const images = a.imageUrls ? a.imageUrls.map(url => ({ image: url })) : [];
            return {
                title: a.title,
                date: `${dateStr}${timeStr}`,
                fullDate: (0, date_fns_1.format)(a.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
                description: fullDescription,
                images: images,
            };
        }));
        const baptismsText = detailedBaptisms.map((b) => `${b.nombre} (${b.fecha})`).join("\n");
        // Obtener template
        const bucket = storage.bucket();
        const file = bucket.file("template/reporte.docx");
        const [templateBuffer] = await file.download();
        const imageModule = new docxtemplater_image_module_free_1.default({
            centered: true,
            getImage: async (tagValue, tagName) => {
                try {
                    // Si es una URL de Firebase Storage o cualquier URL externa
                    if (tagValue.startsWith('http://') || tagValue.startsWith('https://')) {
                        const response = await axios_1.default.get(tagValue, {
                            responseType: "arraybuffer",
                            headers: {
                                'Accept': 'image/*'
                            }
                        });
                        return Buffer.from(response.data);
                    }
                    // Si no es una URL, retornar buffer vacío
                    return Buffer.alloc(0);
                }
                catch (error) {
                    functions.logger.error(`Error downloading image from ${tagValue}:`, error);
                    // Retornar un buffer vacío en caso de error para no romper el documento
                    return Buffer.alloc(0);
                }
            },
            getSize: (img, tagValue, tagName) => {
                // Tamaño fijo para las imágenes en el documento
                // Ancho máximo de 450px, alto proporcional máximo de 300px
                return [450, 300];
            },
        });
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
            resumen_bautismos: detailedBaptisms,
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
                tiene_imagenes: a.imageUrls && a.imageUrls.length > 0 ? "Sí" : "No"
            })),
            tabla_bautismos: detailedBaptisms
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
            return { id: doc.id, name: data.name, date: data.baptismDate, source: "Automático" };
        });
        const bSnapshot = await firestore.collection("c_bautismos")
            .where("date", ">=", startTimestamp)
            .where("date", "<=", endTimestamp)
            .get();
        const fromManual = bSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, date: data.date, source: "Manual" };
        });
        const baptisms = [...fromFutureMembers, ...fromManual].sort((a, b) => b.date.toMillis() - a.date.toMillis());
        const reportAnswersDoc = await firestore.collection("c_reporte_anual").doc(String(year)).get();
        const answers = (reportAnswersDoc.data() || {});
        const bucket = storage.bucket();
        const file = bucket.file("template/reporte.docx");
        const [templateBuffer] = await file.download();
        const imageModule = new docxtemplater_image_module_free_1.default({
            centered: true,
            getImage: async (tagValue, tagName) => {
                try {
                    // Si es una URL de Firebase Storage o cualquier URL externa
                    if (tagValue.startsWith('http://') || tagValue.startsWith('https://')) {
                        const response = await axios_1.default.get(tagValue, {
                            responseType: "arraybuffer",
                            headers: {
                                'Accept': 'image/*'
                            }
                        });
                        return Buffer.from(response.data);
                    }
                    // Si no es una URL, retornar buffer vacío
                    return Buffer.alloc(0);
                }
                catch (error) {
                    functions.logger.error(`Error downloading image from ${tagValue}:`, error);
                    // Retornar un buffer vacío en caso de error para no romper el documento
                    return Buffer.alloc(0);
                }
            },
            getSize: (img, tagValue, tagName) => {
                // Tamaño fijo para las imágenes en el documento
                // Ancho máximo de 450px, alto proporcional máximo de 300px
                return [450, 300];
            },
        });
        const zip = new pizzip_1.default(templateBuffer);
        const doc = new docxtemplater_1.default(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
        });
        const activitiesToProcess = includeAllActivities ? allActivities : currentYearActivities;
        const activitiesData = await Promise.all(activitiesToProcess.map(async (a) => {
            const dateStr = (0, date_fns_1.format)(a.date.toDate(), "dd/MM/yyyy", { locale: locale_1.es });
            const timeStr = a.time ? ` ${a.time}` : "";
            let fullDescription = a.description;
            if (a.additionalText) {
                fullDescription += `\n\nTexto Adicional: ${a.additionalText}`;
            }
            const images = a.imageUrls ? a.imageUrls.map(url => ({ image: url })) : [];
            return {
                title: a.title,
                date: `${dateStr}${timeStr}`,
                description: fullDescription,
                images: images,
            };
        }));
        const baptismsText = baptisms.map(b => `${b.name} (${(0, date_fns_1.format)(b.date.toDate(), "P", { locale: locale_1.es })})`).join("\n");
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
        const monthlyActivities = Object.entries(activitiesByMonth).map(([month, activities]) => ({
            month,
            activities: activities.map((a) => ({
                title: a.title,
                date: (0, date_fns_1.format)(a.date.toDate(), "dd/MM/yyyy", { locale: locale_1.es }),
                time: a.time || "",
                description: a.description,
                additionalText: a.additionalText || ""
            }))
        }));
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
            resumen_bautismos: baptisms.map(b => ({
                nombre: b.name,
                fecha: (0, date_fns_1.format)(b.date.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: locale_1.es }),
                origen: b.source
            })),
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