import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import App from "./App";
import {
  apiRequest,
  ApiError,
  fetchBudget,
  serverPersistence,
  type AuthUser,
} from "./lib/api";
import type { BudgetPersistence } from "./lib/persistence";
import type { State } from "./lib/types";
import { loadState } from "./lib/storage";
import { monthOf, localDate } from "./lib/finance";
type Phase =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      user: AuthUser;
      persistence: BudgetPersistence;
      legacy: State | null;
    };
export default function Application() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" }),
    [attempt, setAttempt] = useState(0);
  function ready(
    user: AuthUser,
    initial: Awaited<ReturnType<typeof fetchBudget>>,
  ): Phase {
    const local = loadState(monthOf(localDate()));
    const hasLegacy =
      !local.error &&
      (local.state.entries.length > 0 ||
        local.state.settings.openingBalance !== 0);
    return {
      kind: "ready",
      user,
      persistence: serverPersistence(initial),
      legacy: hasLegacy ? local.state : null,
    };
  }
  useEffect(() => {
    let active = true;
    async function load() {
      setPhase({ kind: "loading" });
      try {
        const { user } = await apiRequest<{ user: AuthUser }>("/auth/me");
        const budget = await fetchBudget();
        if (active) setPhase(ready(user, budget));
      } catch (error) {
        if (!active) return;
        setPhase(
          error instanceof ApiError && error.status === 401
            ? { kind: "login" }
            : {
                kind: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível abrir seu controle.",
              },
        );
      }
    }
    void load();
    const expired = () => {
      if (active) setPhase({ kind: "login" });
    };
    window.addEventListener("controle-renda:session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("controle-renda:session-expired", expired);
    };
  }, [attempt]);
  async function login(email: string, password: string) {
    const { user } = await apiRequest<{ user: AuthUser }>(
      "/auth/login",
      "POST",
      { email, password },
    );
    try {
      setPhase(ready(user, await fetchBudget()));
    } catch (error) {
      setPhase({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar seu orçamento.",
      });
    }
  }
  async function logout() {
    await apiRequest("/auth/logout", "POST");
    setPhase({ kind: "login" });
  }
  if (phase.kind === "ready")
    return (
      <App
        key={phase.user.id}
        persistence={phase.persistence}
        account={{ user: phase.user, onLogout: logout }}
        legacyBudget={phase.legacy}
      />
    );
  if (phase.kind === "login") return <LoginForm onLogin={login} />;
  return (
    <div className="connection-screen">
      <div className="brand">
        <span className="brand-icon">
          <TrendingUp size={25} />
        </span>
        <span>
          controle<span className="brand-weight">renda</span>.
        </span>
      </div>
      {phase.kind === "loading" ? (
        <>
          <LoaderCircle className="spinning" size={28} />
          <h1>Abrindo seu controle…</h1>
          <p>Conectando aos seus dados com segurança.</p>
        </>
      ) : (
        <>
          <ShieldCheck size={32} />
          <h1>Vamos reconectar.</h1>
          <p role="alert">{phase.message}</p>
          <button
            className="button primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </>
      )}
    </div>
  );
}
function LoginForm({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <TrendingUp size={25} />
          </span>
          <span>
            controle<span className="brand-weight">renda</span>.
          </span>
        </div>
        <div className="auth-story-content">
          <span className="auth-eyebrow">
            <Leaf size={17} />
            MAIS CLAREZA. MENOS PREOCUPAÇÃO.
          </span>
          <h1>
            Seu dinheiro,
            <br />
            uma vida
            <br />
            <em>mais leve.</em>
          </h1>
          <p>
            Um lugar simples para organizar seus gastos e enxergar o que vem
            pela frente.
          </p>
          <div className="auth-features">
            <span>
              <CheckCircle2 size={18} />
              Seu mês e o próximo sob controle
            </span>
            <span>
              <CheckCircle2 size={18} />
              Cada compra com seu responsável
            </span>
            <span>
              <CheckCircle2 size={18} />
              Seu orçamento em qualquer aparelho
            </span>
          </div>
        </div>
        <footer>
          <ShieldCheck size={15} />
          Seus dados protegidos, do seu jeito.
        </footer>
      </section>
      <section className="auth-form-section">
        <form onSubmit={submit} className="auth-form">
          <span className="auth-lock">
            <LockKeyhole size={26} />
          </span>
          <p className="eyebrow">SEU ESPAÇO FINANCEIRO</p>
          <h2>Bem-vindo de volta.</h2>
          <p>Entre para cuidar do seu dinheiro com clareza.</p>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </label>
          <label>
            Senha
            <span className="password-input">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary auth-submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spinning" size={18} />
                Entrando…
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="auth-recovery">
            Esqueceu sua senha? Solicite a redefinição ao administrador.
          </p>
          <div className="auth-private">
            <ShieldCheck size={16} />
            <span>Acesso privado ao seu controle financeiro.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
