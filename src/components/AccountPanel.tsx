import { useState, type FormEvent } from "react";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { apiRequest, type AuthUser } from "../lib/api";
import { Modal } from "./Modal";
export function AccountPanel({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirmation) {
      setError("As novas senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(
        "/auth/password",
        "POST",
        { currentPassword: current, newPassword: next },
        user.id,
      );
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirmation("");
      setMessage("Senha alterada. As outras sessões foram encerradas.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await onLogout();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível sair. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <span className="settings-icon">
        <UserRound size={24} />
      </span>
      <h2>Minha conta</h2>
      <dl>
        <div>
          <dt>Nome</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd className="account-email">{user.email}</dd>
        </div>
      </dl>
      <div className="backup-actions">
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          disabled={busy}
        >
          <KeyRound size={16} />
          Alterar senha
        </button>
        <button className="button secondary" onClick={logout} disabled={busy}>
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && !open && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Modal
          title="Alterar minha senha"
          subtitle="As outras sessões serão encerradas após a troca."
          onClose={() => {
            if (!busy) {
              setOpen(false);
              setCurrent("");
              setNext("");
              setConfirmation("");
            }
          }}
        >
          <form className="form-content" onSubmit={submit}>
            <label>
              Senha atual
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label>
              Confirme a nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <p className="field-note">Use pelo menos 12 caracteres.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <footer className="form-footer">
              <button className="button primary" disabled={busy}>
                {busy ? "Salvando…" : "Confirmar nova senha"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
