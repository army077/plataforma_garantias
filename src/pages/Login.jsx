import { useAuth } from "../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const nav = useNavigate();

  const login = async () => {
    try { await signInWithGoogle(); nav("/"); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="max-w-sm mx-auto card">
      <div className="text-lg font-semibold mb-3">Iniciar sesión</div>
      <button className="btn btn-primary w-full" onClick={login}>
        Entrar con Google
      </button>
    </div>
  );
}