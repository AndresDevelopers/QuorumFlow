
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { usersCollection } from "@/lib/collections";
import { normalizeRole, type UserRole } from "@/lib/roles";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  initials: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  userRole: UserRole | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatUser = (user: FirebaseUser): User => ({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    initials: user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : '?'),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(formatUser(currentUser));
        setFirebaseUser(currentUser);
      } else {
        setUser(null);
        setFirebaseUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!firebaseUser) {
        return;
      }

      try {
        const userDocRef = doc(usersCollection, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          setUserRole(normalizeRole(undefined));
          return;
        }

        const data = userDoc.data();
        setUserRole(normalizeRole(data.role));
      } catch {
        setUserRole(normalizeRole(undefined));
      }
    };

    fetchUserRole();
  }, [firebaseUser]);
  
  const refreshAuth = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        await currentUser.reload();
        const freshUser = auth.currentUser;
        if (freshUser) {
            setUser(formatUser(freshUser));
            setFirebaseUser(freshUser);
        }
    }
  }, []);

  const value = { user, loading, firebaseUser, userRole, refreshAuth };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
