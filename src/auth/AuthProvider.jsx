import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "../lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { api } from "../lib/api"; // usa el interceptor

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [usuarioId, setUsuarioId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setLoading(true);

      if (!u) {
        setUser(null);
        setRole(null);
        setUsuarioId(null);
        setLoading(false);
        return;
      }

      // datos básicos del usuario de Firebase
      setUser({
        uid: u.uid,
        email: u.email,
        name: u.displayName,
        photo: u.photoURL,
      });

      try {
        // 👇 aquí obtenemos y mostramos el token
        const token = await u.getIdToken(true);
        console.log("Firebase ID token:", token);

        // llamada al backend (usa interceptor que ya mete Authorization)
        const { data } = await api.get("/auth/me");
        console.log("Respuesta /auth/me:", data);

        setRole(data.role || null);
        setUsuarioId(data.id || null);
      } catch (err) {
        console.error("Error cargando rol:", err);
        setRole(null);
        setUsuarioId(null);
      }

      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      usuarioId,
      loading,
      signInWithGoogle: () => signInWithPopup(auth, googleProvider),
      signOut: () => signOut(auth),
    }),
    [user, role, usuarioId, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);