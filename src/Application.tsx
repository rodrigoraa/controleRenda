import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  Loader,
  PasswordInput,
  TextInput,
} from "@mantine/core";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
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
import { ValidatedForm } from "./ui/ValidatedForm";
import "./ui/auth.css";
type Phase =
  | { kind: "loading" }
  | { kind: "login"; message?: string }
  | { kind: "error"; message: string; refreshPage?: boolean }
  | {
      kind: "ready";
      user: AuthUser;
      persistence: BudgetPersistence;
      legacy: State | null;
    };
export default function Application() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" }),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (phase.kind !== "ready")
      document.title =
        phase.kind === "login" ? "Entrar · Controle Renda" : "Controle Renda";
  }, [phase.kind]);
  const phaseRef = useRef(phase);
  const generation = useRef(0);
  phaseRef.current = phase;
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
      persistence: serverPersistence(initial, user.id),
      legacy: hasLegacy ? local.state : null,
    };
  }
  useEffect(() => {
    let active = true;
    const loadGeneration = ++generation.current;
    let verification: Phase | null = null;
    const currentLoad = () => active && generation.current === loadGeneration;
    async function load() {
      setPhase({ kind: "loading" });
      try {
        const { user } = await apiRequest<{ user: AuthUser }>("/auth/me");
        if (!currentLoad()) return;
        const budget = await fetchBudget(user.id);
        if (currentLoad()) setPhase(ready(user, budget));
      } catch (error) {
        if (!currentLoad()) return;
        setPhase(
          error instanceof ApiError && error.status === 401
            ? { kind: "login" }
            : {
                kind: "error",
                refreshPage: error instanceof ApiError && error.status === 428,
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível abrir seu controle.",
              },
        );
      }
    }
    void load();
    const expired = async () => {
      const displayed = phaseRef.current;
      if (!active || displayed.kind !== "ready" || verification === displayed)
        return;
      verification = displayed;
      const checkGeneration = generation.current;
      const currentCheck = () =>
        active &&
        generation.current === checkGeneration &&
        phaseRef.current === displayed;
      function requireLogin(message: string) {
        if (!currentCheck()) return;
        generation.current += 1;
        setPhase({ kind: "login", message });
      }
      try {
        // A delayed 401 may belong to the session that preceded this login.
        const { user } = await apiRequest<{ user: AuthUser }>("/auth/me");
        if (user.id !== displayed.user.id)
          requireLogin("Sua conta mudou em outra aba. Entre novamente.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          requireLogin("Sua sessão expirou. Entre novamente.");
      } finally {
        if (verification === displayed) verification = null;
      }
    };
    window.addEventListener("controle-renda:session-expired", expired);
    return () => {
      active = false;
      generation.current += 1;
      window.removeEventListener("controle-renda:session-expired", expired);
    };
  }, [attempt]);
  async function login(email: string, password: string) {
    const loginGeneration = ++generation.current;
    const { user } = await apiRequest<{ user: AuthUser }>(
      "/auth/login",
      "POST",
      { email, password },
    );
    if (generation.current !== loginGeneration) return;
    try {
      const budget = await fetchBudget(user.id);
      if (generation.current === loginGeneration) setPhase(ready(user, budget));
    } catch (error) {
      if (generation.current !== loginGeneration) return;
      setPhase(
        error instanceof ApiError && error.status === 401
          ? { kind: "login" }
          : {
              kind: "error",
              refreshPage: error instanceof ApiError && error.status === 428,
              message:
                error instanceof Error
                  ? error.message
                  : "Não foi possível carregar seu orçamento.",
            },
      );
    }
  }
  async function logout() {
    const displayed = phaseRef.current;
    if (displayed.kind !== "ready") return;
    const logoutGeneration = ++generation.current;
    await apiRequest("/auth/logout", "POST", undefined, displayed.user.id);
    if (generation.current === logoutGeneration) setPhase({ kind: "login" });
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
  if (phase.kind === "login")
    return <LoginForm onLogin={login} message={phase.message} />;
  return (
    <main
      className="cr-auth cr-connection"
      aria-busy={phase.kind === "loading"}
    >
      <AuthBrand />
      <Card withBorder className="cr-connection-card">
        {phase.kind === "loading" ? (
          <>
            <Loader size={30} aria-hidden="true" />
            <h1>Abrindo seu controle…</h1>
            <p>Conectando aos seus dados com segurança.</p>
          </>
        ) : (
          <>
            <span className="cr-auth-icon" aria-hidden="true">
              <RefreshCw size={23} />
            </span>
            <h1>Vamos reconectar.</h1>
            <Alert color="red" className="cr-auth-feedback" role="alert">
              {phase.message}
            </Alert>
            <Button
              leftSection={<RefreshCw size={16} />}
              onClick={() =>
                phase.refreshPage
                  ? window.location.reload()
                  : setAttempt((n) => n + 1)
              }
            >
              {phase.refreshPage ? "Atualizar página" : "Tentar novamente"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
function AuthBrand() {
  return (
    <div className="cr-auth-brand" aria-label="Controle Renda">
      <span className="cr-auth-brand-icon" aria-hidden="true">
        <TrendingUp size={23} />
      </span>
      <span>
        controle<strong>renda</strong>.
      </span>
    </div>
  );
}
function LoginForm({
  onLogin,
  message,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  message?: string;
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
    <main className="cr-auth">
      <header className="cr-auth-header">
        <AuthBrand />
        <span className="cr-auth-access">
          <LockKeyhole size={14} aria-hidden="true" /> Acesso à conta
        </span>
      </header>
      <div className="cr-auth-content">
        <Card withBorder className="cr-auth-card">
          <div className="cr-auth-heading">
            <span className="cr-auth-icon" aria-hidden="true">
              <LockKeyhole size={23} />
            </span>
            <h1>Bem-vindo de volta.</h1>
            <p>Entre para acompanhar seu orçamento.</p>
          </div>
          <ValidatedForm
            onSubmit={submit}
            className="cr-auth-form"
            aria-busy={busy}
          >
            {message && (
              <Alert color="blue" role="status" className="cr-auth-feedback">
                {message}
              </Alert>
            )}
            <TextInput
              className="cr-field"
              label="E-mail"
              type="email"
              autoComplete="username"
              required
              withAsterisk={false}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <PasswordInput
              className="cr-field cr-password-input"
              label="Senha"
              autoComplete="current-password"
              required
              withAsterisk={false}
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              visible={show}
              onVisibilityChange={setShow}
              visibilityToggleFocusable
              rightSectionWidth={48}
              visibilityToggleButtonProps={{
                "aria-label": show ? "Ocultar senha" : "Mostrar senha",
                "aria-pressed": show,
              }}
              visibilityToggleIcon={({ reveal }) =>
                reveal ? <EyeOff size={18} /> : <Eye size={18} />
              }
            />
            {error && (
              <Alert color="red" role="alert" className="cr-auth-feedback">
                {error}
              </Alert>
            )}
            <Button
              type="submit"
              fullWidth
              loading={busy}
              aria-label={busy ? "Entrando…" : "Entrar"}
              rightSection={<ArrowRight size={18} />}
              className="cr-auth-submit"
            >
              Entrar
            </Button>
          </ValidatedForm>
          <div className="cr-auth-private">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Acesso privado ao seu controle financeiro.</span>
          </div>
        </Card>
        <aside className="cr-auth-help" aria-label="Ajuda para acessar">
          <section>
            <h2>Seu orçamento, em qualquer aparelho.</h2>
            <p>
              Entre com sua conta para consultar saldos, organizar lançamentos e
              planejar os próximos meses.
            </p>
          </section>
          <section>
            <h2>Esqueceu sua senha?</h2>
            <p>Solicite a redefinição ao administrador.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
