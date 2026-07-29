#!/usr/bin/env node
/**
 * seed-demo-barrio.mjs
 *
 * Crea un barrio demo completo en Firebase con:
 *  - Documento de barrio en c_barrios
 *  - Cuentas demo en Firebase Auth + c_users (president, counselor, secretary, user)
 *  - Miembros demo en c_miembros
 *  - Conversos demo en c_conversos
 *  - Actividades demo en c_actividades
 *  - Servicios demo en c_servicios
 *  - Investigadores demo en c_obra_misional_investigadores
 *  - Companierismos de ministracion en c_ministracion
 *  - Distritos de ministracion en c_ministracion_distritos
 *  - Anotaciones demo en c_anotaciones
 *  - Cumpleanos demo en c_cumpleanos
 *  - Preocupaciones de salud en c_observaciones_salud
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-barrio.mjs
 *   node --env-file=.env.local scripts/seed-demo-barrio.mjs --clean
 *
 * Cuentas demo creadas (password: Demo2024!):
 *   presidente@demo.sionflow.app
 *   consejero1@demo.sionflow.app
 *   consejero2@demo.sionflow.app
 *   secretario@demo.sionflow.app
 *   miembro1@demo.sionflow.app
 *   miembro2@demo.sionflow.app
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Configuracion del barrio demo
const DEMO_BARRIO = 'Barrio Demo Sionflow';
const DEMO_ORGANIZACION = 'Quorum de Elderes';
const DEMO_BARRIO_ORG = `${DEMO_BARRIO}|${DEMO_ORGANIZACION}`;
const DEMO_PASSWORD = 'Demo2024!';

// Timestamp helpers
const ts = (date) => Timestamp.fromDate(new Date(date));
const now = () => Timestamp.now();
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
};
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return Timestamp.fromDate(d);
};

// Inicializacion Firebase Admin
function initAdmin() {
  if (getApps().length) return getApps()[0];

  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!saKey) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definido en .env.local');
    process.exit(1);
  }

  let sa;
  try {
    const compact = saKey.trim().replace(/\s+/g, '');
    const raw = /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length % 4 === 0
      ? Buffer.from(compact, 'base64').toString('utf8')
      : saKey;
    sa = JSON.parse(raw);
  } catch {
    try {
      sa = JSON.parse(saKey);
    } catch {
      console.error('No se pudo parsear FIREBASE_SERVICE_ACCOUNT_KEY');
      process.exit(1);
    }
  }

  return initializeApp({
    credential: cert(sa),
    projectId: projectId || sa.project_id,
    storageBucket,
  });
}

const app = initAdmin();
const auth = getAuth(app);
const db = getFirestore(app);

// Clean helper
async function cleanDemoData() {
  console.log('\nLimpiando datos demo previos...');

  const demoEmails = [
    'presidente@demo.sionflow.app',
    'consejero1@demo.sionflow.app',
    'consejero2@demo.sionflow.app',
    'secretario@demo.sionflow.app',
    'miembro1@demo.sionflow.app',
    'miembro2@demo.sionflow.app',
  ];

  for (const email of demoEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      console.log(`  Auth eliminado: ${email}`);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') console.warn(`  Aviso ${email}: ${e.message}`);
    }
  }

  const collections = [
    'c_users', 'c_miembros', 'c_conversos', 'c_actividades', 'c_servicios',
    'c_obra_misional_investigadores', 'c_ministracion', 'c_ministracion_distritos',
    'c_anotaciones', 'c_cumpleanos', 'c_observaciones_salud', 'c_bautismos',
    'c_obra_misional_asignaciones', 'c_obra_misional_amigos_conversos',
  ];

  for (const col of collections) {
    const snap = await db.collection(col)
      .where('barrioOrg', '==', DEMO_BARRIO_ORG)
      .get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) {
      await batch.commit();
      console.log(`  ${col}: ${snap.size} documentos eliminados`);
    }
  }

  const barrioSnap = await db.collection('c_barrios')
    .where('barrioOrg', '==', DEMO_BARRIO_ORG).get();
  const b = db.batch();
  barrioSnap.docs.forEach((d) => b.delete(d.ref));
  if (!barrioSnap.empty) await b.commit();

  console.log('  Limpieza completada\n');
}

// Crear usuario en Auth + c_users
async function createDemoUser({ email, name, role, permission }) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { displayName: name, emailVerified: true, disabled: false });
    console.log(`  Ya existe, actualizado: ${email}`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        password: DEMO_PASSWORD,
        displayName: name,
        emailVerified: true,
        disabled: false,
      });
      uid = user.uid;
      console.log(`  Creado: ${email}  (uid: ${uid})`);
    } else {
      throw e;
    }
  }

  const mainPageMap = {
    president: '/dashboard',
    counselor: '/dashboard',
    secretary: '/admin/users',
    user: '/dashboard',
    other: '/dashboard',
  };

  await db.collection('c_users').doc(uid).set(
    {
      uid,
      email,
      name,
      displayName: name,
      role,
      permission,
      barrio: DEMO_BARRIO,
      organizacion: DEMO_ORGANIZACION,
      barrioOrg: DEMO_BARRIO_ORG,
      mainPage: mainPageMap[role] || '/dashboard',
      theme: 'system',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    { merge: true }
  );

  return uid;
}

// SEED PRINCIPAL
async function seed() {
  console.log('\nIniciando seed del Barrio Demo...');
  console.log(`  Barrio   : ${DEMO_BARRIO}`);
  console.log(`  Org      : ${DEMO_ORGANIZACION}`);
  console.log(`  barrioOrg: ${DEMO_BARRIO_ORG}`);

  // 1. Barrio en c_barrios
  console.log('\nCreando barrio...');
  const barrioRef = db.collection('c_barrios').doc();
  await barrioRef.set({
    nombre: DEMO_BARRIO,
    organizacion: DEMO_ORGANIZACION,
    barrioOrg: DEMO_BARRIO_ORG,
    ciudad: 'Ciudad Demo',
    pais: 'Colombia',
    isDemo: true,
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(`  Barrio creado: ${barrioRef.id}`);

  // 2. Cuentas de usuario demo
  console.log('\nCreando cuentas de usuario...');

  const presidenteUid = await createDemoUser({
    email: 'presidente@demo.sionflow.app',
    name: 'Carlos Presidente Demo',
    role: 'president',
    permission: 'all',
  });

  const consejero1Uid = await createDemoUser({
    email: 'consejero1@demo.sionflow.app',
    name: 'Andres Consejero Demo',
    role: 'counselor',
    permission: 'all',
  });

  const consejero2Uid = await createDemoUser({
    email: 'consejero2@demo.sionflow.app',
    name: 'Miguel Consejero Demo',
    role: 'counselor',
    permission: 'all',
  });

  const secretarioUid = await createDemoUser({
    email: 'secretario@demo.sionflow.app',
    name: 'Juan Secretario Demo',
    role: 'secretary',
    permission: 'all',
  });

  const miembro1Uid = await createDemoUser({
    email: 'miembro1@demo.sionflow.app',
    name: 'Pedro Miembro Demo',
    role: 'user',
    permission: 'read',
  });

  const miembro2Uid = await createDemoUser({
    email: 'miembro2@demo.sionflow.app',
    name: 'Luis Miembro Demo',
    role: 'user',
    permission: 'read',
  });

  // Suprimir advertencia de variable no usada (miembro2Uid puede usarse a futuro)
  void miembro1Uid;
  void miembro2Uid;

  // 3. Miembros demo
  console.log('\nCreando miembros...');

  const membersData = [
    {
      firstName: 'Carlos',
      lastName: 'Mendoza Lopez',
      status: 'active',
      birthDate: ts('1978-03-15'),
      baptismDate: ts('1995-06-20'),
      phoneNumber: '+57 300 1234567',
      email: 'carlos.mendoza@example.com',
      address: 'Calle 45 #23-10, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'elder_ordination', 'endowment', 'sealed_spouse'],
      hasLdsAccount: true,
      hasFamilySearchAccount: true,
      familySearchTreeStatus: 'complete',
      familySearchGenerations: 4,
    },
    {
      firstName: 'Maria',
      lastName: 'Garcia Torres',
      status: 'active',
      birthDate: ts('1985-07-22'),
      baptismDate: ts('2001-04-10'),
      phoneNumber: '+57 310 9876543',
      email: 'maria.garcia@example.com',
      address: 'Carrera 12 #56-78, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'endowment', 'sealed_spouse'],
      hasLdsAccount: true,
      hasFamilySearchAccount: false,
      needsFamilySearchHelp: true,
    },
    {
      firstName: 'Jose',
      lastName: 'Rodriguez Sanchez',
      status: 'less_active',
      birthDate: ts('1990-11-30'),
      baptismDate: ts('2008-09-14'),
      phoneNumber: '+57 315 5551234',
      address: 'Av. Principal #100-50, Ciudad Demo',
      ordinances: ['baptism', 'confirmation'],
      hasLdsAccount: false,
      lessActiveSince: daysAgo(120),
      lessActiveObservation: 'Ha tenido dificultades familiares. Se le visita mensualmente.',
    },
    {
      firstName: 'Ana',
      lastName: 'Martinez Ruiz',
      status: 'active',
      birthDate: ts('1972-01-08'),
      baptismDate: ts('1990-03-25'),
      phoneNumber: '+57 312 7778888',
      email: 'ana.martinez@example.com',
      address: 'Calle 89 #14-22, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'endowment', 'sealed_to_father', 'sealed_to_mother'],
      hasLdsAccount: true,
      hasFamilySearchAccount: true,
      familySearchTreeStatus: 'partial',
      familySearchGenerations: 3,
      familySearchPartialDetails: 'Faltan abuelos maternos',
      hasPatriarchalBlessing: true,
    },
    {
      firstName: 'Roberto',
      lastName: 'Perez Vargas',
      status: 'inactive',
      birthDate: ts('1988-05-14'),
      baptismDate: ts('2005-12-01'),
      address: 'Barrio Norte, Ciudad Demo',
      ordinances: ['baptism', 'confirmation'],
      inactiveSince: daysAgo(365),
      inactiveObservation: 'Se mudo del barrio hace un ano. Sin contacto.',
      isInCouncil: true,
    },
    {
      firstName: 'Laura',
      lastName: 'Gomez Herrera',
      status: 'active',
      birthDate: ts('1995-09-03'),
      baptismDate: ts('2015-08-20'),
      phoneNumber: '+57 316 4445555',
      email: 'laura.gomez@example.com',
      address: 'Calle 22 #8-45, Ciudad Demo',
      ordinances: ['baptism', 'confirmation'],
      hasLdsAccount: true,
    },
    {
      firstName: 'Diego',
      lastName: 'Torres Morales',
      status: 'active',
      birthDate: ts('2000-12-18'),
      baptismDate: ts('2015-01-10'),
      phoneNumber: '+57 300 3334444',
      address: 'Carrera 5 #30-60, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'aronico_ordination'],
      hasLdsAccount: false,
    },
    {
      firstName: 'Elena',
      lastName: 'Jimenez Castro',
      status: 'active',
      birthDate: ts('1960-02-28'),
      baptismDate: ts('1982-11-15'),
      phoneNumber: '+57 311 2223333',
      email: 'elena.jimenez@example.com',
      address: 'Calle 77 #19-33, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'endowment', 'sealed_spouse', 'high_priest_ordination'],
      hasLdsAccount: true,
      hasFamilySearchAccount: true,
      familySearchTreeStatus: 'complete',
      familySearchGenerations: 5,
      hasPatriarchalBlessing: true,
    },
    {
      firstName: 'Fernando',
      lastName: 'Lopez Diaz',
      status: 'less_active',
      birthDate: ts('1975-06-10'),
      baptismDate: ts('1999-02-28'),
      phoneNumber: '+57 314 6667777',
      address: 'Av. Sur #55-20, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'elder_ordination'],
      lessActiveSince: daysAgo(60),
      lessActiveObservation: 'Cambio de trabajo. Horarios dificiles. Se le llama regularmente.',
      isUrgent: true,
      urgentReason: 'Necesita apoyo espiritual urgente por situacion familiar dificil.',
    },
    {
      firstName: 'Patricia',
      lastName: 'Ramirez Vega',
      status: 'active',
      birthDate: ts('1982-04-05'),
      baptismDate: ts('2003-07-12'),
      phoneNumber: '+57 318 8889999',
      email: 'patricia.ramirez@example.com',
      address: 'Calle 33 #12-67, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'endowment'],
      hasLdsAccount: true,
      hasFamilySearchAccount: true,
      familySearchTreeStatus: 'partial',
      familySearchGenerations: 2,
    },
    {
      firstName: 'Santiago',
      lastName: 'Cruz Bernal',
      status: 'active',
      birthDate: ts('1998-08-25'),
      baptismDate: ts('2016-04-03'),
      phoneNumber: '+57 302 1112222',
      address: 'Barrio Centro, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'elder_ordination'],
      hasLdsAccount: true,
    },
    {
      firstName: 'Isabel',
      lastName: 'Flores Acosta',
      status: 'active',
      birthDate: ts('1969-10-11'),
      baptismDate: ts('1988-05-30'),
      phoneNumber: '+57 317 0001111',
      email: 'isabel.flores@example.com',
      address: 'Carrera 18 #44-22, Ciudad Demo',
      ordinances: ['baptism', 'confirmation', 'endowment', 'sealed_spouse'],
      hasLdsAccount: true,
      hasFamilySearchAccount: true,
      familySearchTreeStatus: 'complete',
      familySearchGenerations: 6,
      hasPatriarchalBlessing: true,
    },
  ];

  const memberIds = [];
  const memberNames = [];

  for (const m of membersData) {
    const ref = db.collection('c_miembros').doc();
    await ref.set({
      ...m,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
      updatedAt: now(),
      createdBy: presidenteUid,
    });
    memberIds.push(ref.id);
    memberNames.push(`${m.firstName} ${m.lastName}`);
    console.log(`  Miembro: ${m.firstName} ${m.lastName} [${m.status}]`);
  }

  // 4. Companierismos de ministracion
  console.log('\nCreando companierismos de ministracion...');

  const distrito1Ref = db.collection('c_ministracion_distritos').doc();
  const companionship1Ref = db.collection('c_ministracion').doc();
  const companionship2Ref = db.collection('c_ministracion').doc();

  await companionship1Ref.set({
    companions: [memberNames[0], memberNames[2]],
    families: [
      { name: memberNames[4], isUrgent: true, observation: 'Familia inactiva. Requiere visita urgente.' },
      { name: memberNames[8], isUrgent: false, observation: 'Se esta recuperando bien.' },
    ],
    districtId: distrito1Ref.id,
    barrioOrg: DEMO_BARRIO_ORG,
    updatedAt: now(),
  });

  await companionship2Ref.set({
    companions: [memberNames[5], memberNames[6]],
    families: [
      { name: memberNames[1], isUrgent: false, observation: '' },
      { name: memberNames[9], isUrgent: false, observation: 'Familia activa.' },
    ],
    districtId: distrito1Ref.id,
    barrioOrg: DEMO_BARRIO_ORG,
    updatedAt: now(),
  });

  await distrito1Ref.set({
    name: 'Distrito 1',
    companionshipIds: [companionship1Ref.id, companionship2Ref.id],
    leaderId: memberIds[0],
    leaderName: memberNames[0],
    isDefault: true,
    barrioOrg: DEMO_BARRIO_ORG,
    updatedAt: now(),
  });

  const distrito2Ref = db.collection('c_ministracion_distritos').doc();
  const companionship3Ref = db.collection('c_ministracion').doc();

  await companionship3Ref.set({
    companions: [memberNames[7], memberNames[10]],
    families: [
      { name: memberNames[3], isUrgent: false, observation: 'Familia activa y comprometida.' },
      { name: memberNames[11], isUrgent: false, observation: '' },
    ],
    districtId: distrito2Ref.id,
    barrioOrg: DEMO_BARRIO_ORG,
    updatedAt: now(),
  });

  await distrito2Ref.set({
    name: 'Distrito 2',
    companionshipIds: [companionship3Ref.id],
    leaderId: memberIds[7],
    leaderName: memberNames[7],
    barrioOrg: DEMO_BARRIO_ORG,
    updatedAt: now(),
  });

  console.log('  3 companierismos en 2 distritos creados');

  // 5. Conversos
  console.log('\nCreando conversos...');

  const convertsData = [
    {
      name: 'Valentina Rios',
      baptismDate: daysAgo(45),
      observation: 'Excelente integracion al barrio. Asiste regularmente.',
      missionaryReference: 'Elder Smith / Elder Garcia',
      councilCompleted: false,
    },
    {
      name: 'Tomas Guerrero',
      baptismDate: daysAgo(90),
      observation: 'Tiene preguntas sobre el templo. Se le esta ensenando.',
      missionaryReference: 'Elder Johnson / Elder Paz',
      councilCompleted: true,
      councilCompletedAt: daysAgo(30),
    },
    {
      name: 'Sofia Mendoza',
      baptismDate: daysAgo(15),
      observation: 'Recien bautizada. Necesita acompanamiento.',
      missionaryReference: 'Hermana Lopez / Hermana Reyes',
      councilCompleted: false,
    },
  ];

  for (const c of convertsData) {
    const ref = db.collection('c_conversos').doc();
    await ref.set({
      ...c,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
    });
    console.log(`  Converso: ${c.name}`);
  }

  // 6. Investigadores
  console.log('\nCreando investigadores (Obra Misional)...');

  const investigatorsData = [
    {
      name: 'Camilo Herrera',
      assignedMissionaries: 'Elder Smith / Elder Garcia',
      status: 'active',
      createdAt: daysAgo(20),
    },
    {
      name: 'Juliana Torres',
      assignedMissionaries: 'Hermana Lopez / Hermana Reyes',
      status: 'active',
      createdAt: daysAgo(35),
    },
    {
      name: 'Mateo Vargas',
      assignedMissionaries: 'Elder Johnson / Elder Paz',
      status: 'baptized',
      createdAt: daysAgo(60),
    },
  ];

  for (const inv of investigatorsData) {
    const ref = db.collection('c_obra_misional_investigadores').doc();
    await ref.set({
      ...inv,
      barrioOrg: DEMO_BARRIO_ORG,
    });
    console.log(`  Investigador: ${inv.name} [${inv.status}]`);
  }

  // 7. Actividades
  console.log('\nCreando actividades...');

  const activitiesData = [
    {
      title: 'Noche de hogar del barrio',
      date: daysAgo(14),
      description: 'Se realizo una tarde de juegos y hermandad con las familias del barrio. Participaron 35 personas.',
      time: '19:00',
      location: 'Capilla Barrio Demo',
      context: 'Actividad mensual de barrio para fortalecer la unidad familiar.',
      learning: 'La unidad familiar es esencial en el plan de Dios.',
    },
    {
      title: 'Servicio en albergue comunitario',
      date: daysAgo(7),
      description: 'Miembros del barrio sirvieron en el albergue local preparando alimentos para 80 personas necesitadas.',
      time: '08:00',
      location: 'Albergue San Jose, Ciudad Demo',
      context: 'Actividad de servicio mensual en alianza con el albergue.',
      learning: 'Cuando servimos a los demas, servimos a Dios.',
    },
    {
      title: 'Clase de preparacion para el templo',
      date: daysAgo(3),
      description: 'Se llevo a cabo la primera clase para miembros que se preparan para recibir sus investiduras.',
      time: '10:00',
      location: 'Salon del barrio',
      context: 'Preparacion para el templo para 3 miembros.',
      learning: 'El templo es la casa del Senor.',
    },
    {
      title: 'Actividad deportiva juvenil',
      date: daysFromNow(7),
      description: 'Torneo de futbol y baloncesto para los jovenes del barrio.',
      time: '14:00',
      location: 'Parque Central, Ciudad Demo',
    },
    {
      title: 'Conferencia de barrio',
      date: daysFromNow(21),
      description: 'Visita del Presidente de Estaca y reunion general del barrio.',
      time: '09:00',
      location: 'Capilla Barrio Demo',
    },
  ];

  for (const act of activitiesData) {
    const ref = db.collection('c_actividades').doc();
    await ref.set({
      ...act,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
      createdBy: presidenteUid,
    });
    console.log(`  Actividad: ${act.title}`);
  }

  // 8. Servicios
  console.log('\nCreando servicios...');

  const servicesData = [
    {
      title: 'Ayuda en mudanza familia Perez',
      date: daysAgo(10),
      description: '8 hermanos ayudaron a la familia Perez en su mudanza durante 4 horas.',
      time: '08:00',
      councilNotified: true,
    },
    {
      title: 'Limpieza del templete del barrio',
      date: daysAgo(21),
      description: 'Limpieza general con 15 participantes. Se pintaron paredes y se limpiaron jardines.',
      time: '07:00',
      councilNotified: false,
    },
    {
      title: 'Visita a hermana con problemas de salud',
      date: daysAgo(5),
      description: 'Grupo de 4 hermanas visito a la Hna. Elena Jimenez que esta recuperandose de una cirugia.',
      time: '15:00',
      councilNotified: true,
    },
  ];

  for (const srv of servicesData) {
    const ref = db.collection('c_servicios').doc();
    await ref.set({
      ...srv,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
      createdBy: consejero1Uid,
    });
    console.log(`  Servicio: ${srv.title}`);
  }

  // 9. Anotaciones de consejo
  console.log('\nCreando anotaciones del consejo...');

  const annotationsData = [
    {
      text: 'Visitar a la familia Rodriguez esta semana. Estan pasando por momentos dificiles y necesitan apoyo espiritual.',
      isCouncilAction: true,
      isResolved: false,
      source: 'council',
      memberId: memberIds[2],
    },
    {
      text: 'Hermano Fernando Lopez solicito apoyo para encontrar trabajo. Asignado al Hno. Carlos Mendoza para ayudarle.',
      isCouncilAction: true,
      isResolved: false,
      source: 'dashboard',
      memberId: memberIds[8],
    },
    {
      text: 'Hna. Maria Garcia necesita ayuda para crear cuenta de FamilySearch.',
      isCouncilAction: false,
      isResolved: false,
      source: 'family-search',
      memberId: memberIds[1],
      helpType: 'create_account',
    },
    {
      text: 'Conversa Valentina Rios integrada exitosamente. Tiene amigos en el barrio.',
      isCouncilAction: false,
      isResolved: true,
      source: 'missionary-work',
    },
    {
      text: 'Planificar actividad de servicio para el proximo mes en el albergue.',
      isCouncilAction: true,
      isResolved: false,
      source: 'council',
    },
  ];

  for (let i = 0; i < annotationsData.length; i++) {
    const ann = annotationsData[i];
    const ref = db.collection('c_anotaciones').doc();
    await ref.set({
      ...ann,
      barrioOrg: DEMO_BARRIO_ORG,
      userId: presidenteUid,
      createdAt: daysAgo(i * 2 + 1),
    });
    console.log(`  Anotacion: ${ann.text.substring(0, 50)}...`);
  }

  // 10. Cumpleanos
  console.log('\nCreando cumpleanos adicionales...');

  const birthdaysData = [
    { name: 'Hermana Lucia Gomez', birthDate: daysFromNow(3) },
    { name: 'Hermano Raul Torres', birthDate: daysFromNow(7) },
    { name: 'Nino Sebastian Cruz', birthDate: daysFromNow(12) },
  ];

  for (const bd of birthdaysData) {
    const ref = db.collection('c_cumpleanos').doc();
    await ref.set({
      ...bd,
      isMember: false,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
    });
    console.log(`  Cumpleanos: ${bd.name}`);
  }

  // 11. Preocupaciones de salud
  console.log('\nCreando preocupaciones de salud...');

  const healthData = [
    {
      firstName: 'Elena',
      lastName: 'Jimenez Castro',
      helperIds: [memberIds[0], memberIds[3]],
      helperNames: [memberNames[0], memberNames[3]],
      address: 'Calle 77 #19-33, Ciudad Demo',
      observation: 'Se recupera de cirugia de rodilla. Necesita ayuda con transporte a citas medicas durante 3 semanas mas.',
      memberId: memberIds[7],
    },
    {
      firstName: 'Roberto',
      lastName: 'Perez Vargas',
      helperIds: [memberIds[1]],
      helperNames: [memberNames[1]],
      address: 'Barrio Norte, Ciudad Demo',
      observation: 'Problemas de salud mental. Se le visita semanalmente con el apoyo del lider.',
      memberId: memberIds[4],
    },
  ];

  for (const h of healthData) {
    const ref = db.collection('c_observaciones_salud').doc();
    await ref.set({
      ...h,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: daysAgo(7),
      updatedAt: now(),
      createdBy: secretarioUid,
    });
    console.log(`  Salud: ${h.firstName} ${h.lastName}`);
  }

  // 12. Bautismos
  console.log('\nCreando registros de bautismos...');

  const baptismsData = [
    {
      name: 'Valentina Rios',
      date: daysAgo(45),
      source: 'Nuevo Converso',
      observation: 'Bautizada por el Elder Smith.',
    },
    {
      name: 'Tomas Guerrero',
      date: daysAgo(90),
      source: 'Nuevo Converso',
      observation: 'Bautizado en la capilla central.',
    },
    {
      name: 'Sofia Mendoza',
      date: daysAgo(15),
      source: 'Nuevo Converso',
      observation: 'Bautizada por su padre que fue reactivado hace 6 meses.',
    },
  ];

  for (const bap of baptismsData) {
    const ref = db.collection('c_bautismos').doc();
    await ref.set({
      ...bap,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: now(),
    });
    console.log(`  Bautismo: ${bap.name}`);
  }

  // 13. Asignaciones misioneras
  console.log('\nCreando asignaciones misioneras...');

  const missionaryAssignments = [
    {
      description: 'Visitar a la familia Herrera para invitarles a la reunion del proximo domingo.',
      isCompleted: false,
      userId: consejero1Uid,
    },
    {
      description: 'Coordinar con los misioneros la fecha del bautismo de Camilo Herrera.',
      isCompleted: false,
      userId: presidenteUid,
    },
    {
      description: 'Entregar materiales de estudio a Juliana Torres.',
      isCompleted: true,
      userId: consejero2Uid,
    },
  ];

  for (let i = 0; i < missionaryAssignments.length; i++) {
    const assign = missionaryAssignments[i];
    const ref = db.collection('c_obra_misional_asignaciones').doc();
    await ref.set({
      ...assign,
      barrioOrg: DEMO_BARRIO_ORG,
      createdAt: daysAgo(i + 1),
    });
    console.log(`  Asignacion: ${assign.description.substring(0, 50)}...`);
  }

  // Resumen final
  console.log('\n');
  console.log('=================================================================');
  console.log('  SEED COMPLETADO -- Barrio Demo Sionflow');
  console.log('=================================================================');
  console.log('');
  console.log('Barrio   : ' + DEMO_BARRIO);
  console.log('Org      : ' + DEMO_ORGANIZACION);
  console.log('Key      : ' + DEMO_BARRIO_ORG);
  console.log('');
  console.log('CUENTAS DEMO  (password: Demo2024!)');
  console.log('-----------------------------------------------------------------');
  console.log('  PRESIDENTE  -> presidente@demo.sionflow.app');
  console.log('  CONSEJERO 1 -> consejero1@demo.sionflow.app');
  console.log('  CONSEJERO 2 -> consejero2@demo.sionflow.app');
  console.log('  SECRETARIO  -> secretario@demo.sionflow.app');
  console.log('  MIEMBRO 1   -> miembro1@demo.sionflow.app');
  console.log('  MIEMBRO 2   -> miembro2@demo.sionflow.app');
  console.log('-----------------------------------------------------------------');
  console.log('');
  console.log('DATOS CREADOS:');
  console.log(`  - ${membersData.length} miembros (activos, menos activos, inactivos)`);
  console.log(`  - ${convertsData.length} conversos`);
  console.log(`  - ${investigatorsData.length} investigadores`);
  console.log(`  - ${activitiesData.length} actividades`);
  console.log(`  - ${servicesData.length} servicios`);
  console.log('  - 3 companierismos en 2 distritos de ministracion');
  console.log(`  - ${annotationsData.length} anotaciones del consejo`);
  console.log(`  - ${birthdaysData.length} cumpleanos adicionales`);
  console.log(`  - ${healthData.length} observaciones de salud`);
  console.log(`  - ${baptismsData.length} registros de bautismo`);
  console.log(`  - ${missionaryAssignments.length} asignaciones misioneras`);
  console.log('');
  console.log('Inicia sesion en: http://localhost:9001');
  console.log('=================================================================');
}

// Entry point
const args = process.argv.slice(2);
const shouldClean = args.includes('--clean');

(async () => {
  try {
    if (shouldClean) {
      await cleanDemoData();
    }
    await seed();
  } catch (err) {
    console.error('\nError durante el seed:', err);
    process.exit(1);
  }
})();
