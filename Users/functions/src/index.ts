
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getYear, startOfYear, endOfYear, format, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import * as webpush from "web-push";
import ImageModule from 'docxtemplater-image-module-free';
import imageSize from 'image-size';
import https from 'https';

admin.initializeApp();

const firestore = admin.firestore();
const storage = admin.storage();

if (functions.config().vapid) {
    webpush.setVapidDetails(
        "mailto:example@yourdomain.org",
        functions.config().vapid.public_key,
        functions.config().vapid.private_key
    );
}

interface Activity {
    id: string;
    title: string;
    date: admin.firestore.Timestamp;
    description: string;
    time?: string;
    imageUrls?: string[];
    location?: string;
    context?: string;
    learning?: string;
    additionalText?: string;
}

interface Baptism {
    id: string;
    name: string;
    date: admin.firestore.Timestamp;
    source: "Manual" | "Automático";
    photoUrls?: string[];
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
}

interface Companionship {
    id: string;
    families: Family[];
}

// Helper function to fetch image buffer from URL
function getImageBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, (response: any) => {
            const chunks: any[] = [];
            response.on('data', (chunk: any) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

export const cleanupProfilePictures = functions.storage.object().onFinalize(async (object: any) => {
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType?.startsWith("image/") || !filePath?.startsWith("profile_pictures/users/")) {
        functions.logger.log("Not a profile picture, skipping cleanup.");
        return null;
    }

    const parts = filePath.split("/");
    const userId = parts[2];
    const fileName = parts[3];
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

export const generateReport = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const year = data.year || getYear(new Date());

    try {
        // 1. Fetch Data
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 11, 31));
        const startTimestamp = admin.firestore.Timestamp.fromDate(start);
        const endTimestamp = admin.firestore.Timestamp.fromDate(end);

        const activitiesSnapshot = await firestore.collection("c_actividades").orderBy("date", "desc").get();
        const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        const activities = allActivities.filter(a => a.date.toDate() >= start && a.date.toDate() <= end);

        const fmSnapshot = await firestore.collection("c_futuros_miembros")
            .where("baptismDate", ">=", startTimestamp)
            .where("baptismDate", "<=", endTimestamp)
            .get();
        const fromFutureMembers = fmSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, date: data.baptismDate, source: "Automático", photoUrls: data.baptismPhotos || [] } as Baptism;
        });

        const bSnapshot = await firestore.collection("c_bautismos")
            .where("date", ">=", startTimestamp)
            .where("date", "<=", endTimestamp)
            .get();
        const fromManual = bSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, name: data.name, date: data.date, source: "Manual", photoUrls: data.photoUrls || [] } as Baptism;
        });
        const baptisms = [...fromFutureMembers, ...fromManual].sort((a, b) => b.date.toMillis() - a.date.toMillis());

        const reportAnswersDoc = await firestore.collection("c_reporte_anual").doc(String(year)).get();
        const answers = (reportAnswersDoc.data() || {}) as AnnualReportAnswers;

        // 2. Fetch Template
        const bucket = storage.bucket();
        const file = bucket.file("template/reporte_v2.docx");
        const [templateBuffer] = await file.download();

        // 3. Process Template data
        const baptismsData = await Promise.all(baptisms.map(async (b) => {
            let images: any[] = [];
             if (b.photoUrls && b.photoUrls.length > 0) {
                try {
                    const imageBuffers = await Promise.all(b.photoUrls.map(url => getImageBuffer(url)));
                    images = imageBuffers.map(buffer => {
                         const dimensions = imageSize(buffer);
                         const aspectRatio = dimensions.width! / dimensions.height!;
                         const width = Math.min(450, dimensions.width!); // Max width 450px
                         return { image: buffer, width, height: width / aspectRatio };
                    });
                } catch (imgError) {
                    functions.logger.error("Error processing images for baptism", { baptismId: b.id, error: imgError });
                }
            }
            return {
                name: `${b.name} (${format(b.date.toDate(), "P", { locale: es })})`,
                images,
            }
        }));
        
        const activitiesData = await Promise.all(activities.map(async a => {
            const dateStr = format(a.date.toDate(), "P", { locale: es });
            const timeStr = a.time ? `, ${a.time}` : '';
            
            let fullDescription = a.description;
            if (a.additionalText) {
                fullDescription += `\n\nTexto Adicional: ${a.additionalText}`;
            }
             if (a.location) {
                fullDescription += `\nLugar: ${a.location}`;
            }
            if (a.context) {
                fullDescription += `\nContexto: ${a.context}`;
            }
            if (a.learning) {
                fullDescription += `\nAprendizaje: ${a.learning}`;
            }

            let images: any[] = [];
            if (a.imageUrls && a.imageUrls.length > 0) {
                try {
                    const imageBuffers = await Promise.all(a.imageUrls.map(url => getImageBuffer(url)));
                    images = imageBuffers.map(buffer => {
                         const dimensions = imageSize(buffer);
                         const aspectRatio = dimensions.width! / dimensions.height!;
                         const width = Math.min(450, dimensions.width!); // Max width 450px
                         return { image: buffer, width, height: width / aspectRatio };
                    });
                } catch (imgError) {
                    functions.logger.error("Error processing images for activity", { activityId: a.id, error: imgError });
                }
            }

            return {
                title: a.title,
                date: `${dateStr}${timeStr}`,
                description: fullDescription,
                images
            };
        }));
        
        const imageOpts = {
            centered: true,
            getImage: (tag: any) => tag.image,
            getSize: (img: any, tagValue: any, tagName: string) => [tagValue.width, tagValue.height],
        };

        const imageModule = new ImageModule(imageOpts);
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
        });

        doc.render({
            fecha_reporte: format(new Date(), "d MMMM yyyy", { locale: es }),
            respuesta_p1: answers.p1 || "",
            respuesta_p2: answers.p2 || "",
            respuesta_p3: answers.p3 || "",
            respuesta_p4: answers.p4 || "",
            respuesta_p5: answers.p5 || "",
            respuesta_p6: answers.p6 || "",
            lista_actividades: activitiesData,
            lista_bautismos: baptismsData,
        });

        const out = doc.getZip().generate({
            type: "nodebuffer",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // 4. Return file as Base64
        return { fileContents: out.toString("base64") };
    } catch (error) {
        functions.logger.error("Error generating report:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError("internal", error.message, error);
        }
        throw new functions.https.HttpsError("internal", "An unknown error occurred.");
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

    // 1. Check for upcoming services
    const servicesSnapshot = await firestore.collection("c_servicios").get();
    servicesSnapshot.forEach((doc) => {
        const service = doc.data() as Service;
        const serviceDate = service.date.toDate();
        const timeString = service.time ? ` a las ${service.time}` : '';

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

    // 2. Check for urgent families
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

    // 3. Check for upcoming birthdays
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

    // 4. Fetch all subscriptions and send notifications
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
            
            // Send push notification
            sendPromises.push(
                webpush.sendNotification(subscription, payload)
                    .catch((err) => {
                        // If subscription is expired or invalid, log it.
                        // Consider removing it from the database.
                        if (err.statusCode === 404 || err.statusCode === 410) {
                             functions.logger.warn(`Subscription for user ${userId} is invalid. Consider removing it.`);
                        } else {
                            functions.logger.error("Error sending notification", err);
                        }
                    })
            );

            // Save notification to Firestore
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
