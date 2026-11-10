import { useState, type FormEvent } from "react";
import { Alert, Button, Card, PasswordInput } from "@mantine/core";
import { Eye, EyeOff, KeyRound, LogOut, UserRound } from "lucide-react";
import { apiRequest, type AuthUser } from "../lib/api";
import { ValidatedForm } from "../ui/ValidatedForm";
import { Modal } from "./Modal";
import "../ui/auth.css";
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
    [showCurrent, setShowCurrent] = useState(false),
    [showNext, setShowNext] = useState(false),
    [showConfirmation, setShowConfirmation] = useState(false),
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
    <Card component="section" withBorder className="cr-account">
      <div className="cr-account-heading">
        <span className="cr-auth-icon" aria-hidden="true">
          <UserRound size={23} />
        </span>
        <div>
          <h2>Minha conta</h2>
          <p>Gerencie seu acesso ao controle financeiro.</p>
        </div>
      </div>
      <dl className="cr-account-details">
        <div>
          <dt>Nome</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{user.email}</dd>
        </div>
      </dl>
      <div className="cr-account-actions">
        <Button
          variant="default"
          leftSection={<KeyRound size={16} />}
          onClick={() => {
            setError("");
            setShowCurrent(false);
            setShowNext(false);
            setShowConfirmation(false);
            setOpen(true);
          }}
          disabled={busy}
        >
          Alterar senha
        </Button>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<LogOut size={16} />}
          onClick={logout}
          disabled={busy}
          loading={busy && !open}
          aria-label={busy && !open ? "Saindo…" : "Sair da conta"}
        >
          Sair da conta
        </Button>
      </div>
      {message && (
        <Alert role="status" color="green">
          {message}
        </Alert>
      )}
      {error && !open && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
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
          <ValidatedForm
            className="cr-form cr-account-form"
            onSubmit={submit}
            aria-busy={busy}
          >
            <PasswordInput
              className="cr-field cr-password-input"
              label="Senha atual"
              autoComplete="current-password"
              required
              withAsterisk={false}
              maxLength={256}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              visible={showCurrent}
              onVisibilityChange={setShowCurrent}
              visibilityToggleFocusable
              rightSectionWidth={48}
              visibilityToggleButtonProps={{
                "aria-label": showCurrent
                  ? "Ocultar senha atual"
                  : "Mostrar senha atual",
                "aria-pressed": showCurrent,
              }}
              visibilityToggleIcon={({ reveal }) =>
                reveal ? <EyeOff size={18} /> : <Eye size={18} />
              }
            />
            <PasswordInput
              className="cr-field cr-password-input"
              label="Nova senha"
              description="Use pelo menos 12 caracteres."
              autoComplete="new-password"
              required
              withAsterisk={false}
              minLength={12}
              maxLength={256}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              visible={showNext}
              onVisibilityChange={setShowNext}
              visibilityToggleFocusable
              rightSectionWidth={48}
              visibilityToggleButtonProps={{
                "aria-label": showNext
                  ? "Ocultar nova senha"
                  : "Mostrar nova senha",
                "aria-pressed": showNext,
              }}
              visibilityToggleIcon={({ reveal }) =>
                reveal ? <EyeOff size={18} /> : <Eye size={18} />
              }
            />
            <PasswordInput
              className="cr-field cr-password-input"
              label="Confirme a nova senha"
              autoComplete="new-password"
              required
              withAsterisk={false}
              minLength={12}
              maxLength={256}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              visible={showConfirmation}
              onVisibilityChange={setShowConfirmation}
              visibilityToggleFocusable
              rightSectionWidth={48}
              visibilityToggleButtonProps={{
                "aria-label": showConfirmation
                  ? "Ocultar confirmação de senha"
                  : "Mostrar confirmação de senha",
                "aria-pressed": showConfirmation,
              }}
              visibilityToggleIcon={({ reveal }) =>
                reveal ? <EyeOff size={18} /> : <Eye size={18} />
              }
            />
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            <footer className="cr-form-footer">
              <Button
                type="submit"
                loading={busy}
                aria-label={busy ? "Salvando…" : "Confirmar nova senha"}
              >
                Confirmar nova senha
              </Button>
            </footer>
          </ValidatedForm>
        </Modal>
      )}
    </Card>
  );
}
