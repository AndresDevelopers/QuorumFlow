import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Configuración de Firebase (usando variables de entorno)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializar Firebase si no está inicializado
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID de miembro requerido' },
        { status: 400 }
      );
    }

    // Obtener referencia al documento del miembro
    const memberRef = doc(db, 'c_miembros', id);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 }
      );
    }

    const memberData = memberSnap.data();
    
    // Convertir timestamps de Firestore a objetos Date
    const member = {
      id: memberSnap.id,
      ...memberData,
      birthDate: memberData.birthDate?.toDate() || null,
      baptismDate: memberData.baptismDate?.toDate() || null,
      confirmationDate: memberData.confirmationDate?.toDate() || null,
      createdAt: memberData.createdAt?.toDate() || null,
      updatedAt: memberData.updatedAt?.toDate() || null,
    };

    return NextResponse.json(member);
  } catch (error: any) {
    console.error('Error al obtener miembro:', error);
    
    // Manejar errores específicos de Firebase
    if (error.code === 'permission-denied') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para acceder a los datos' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al obtener los datos del miembro' },
      { status: 500 }
    );
  }
}