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
    <div className="w-full max-w-sm mx-auto">
      <div className="card text-center">
        <img src="/logo_ar.png" alt="Asia Robótica" className="h-10 w-auto mx-auto mb-5" />
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Bienvenido</h1>
        <p className="text-sm text-slate-500 mb-6">Inicia sesión para continuar</p>
        <button className="btn btn-primary w-full" onClick={login}>
          Entrar con Google
        </button>
      </div>
    </div>
  );
}