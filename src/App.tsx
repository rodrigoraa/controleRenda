import {
  Alert,
  Button,
  UnstyledButton,
  TextInput,
  Portal,
  Drawer,
} from "@mantine/core";
import { FinancialOverview } from "./components/FinancialOverview";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FlaskConical,
  LayoutDashboard,
  Landmark,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  addMonths,
  dateInMonth,
  invoice,
  localDate,
  money,
  monthLabel,
  monthOf,
  occurrences,
  shortDate,
  splitPurchase,
  summarize,
  withCurrentBalance,
} from "./lib/finance";
import { parseBackup, serializeBackup } from "./lib/validation";
import { BudgetConflictError, type BudgetPersistence } from "./lib/persistence";
import { AccountPanel } from "./components/AccountPanel";
import { BankConnections } from "./components/BankConnections";
import { unassignedBankPurchases } from "./lib/bank-feed";
import { useBankConnections } from "./lib/use-bank-connections";
import type { AuthUser } from "./lib/api";
import { createDemo } from "./lib/demo";
import {
  assignOccurrenceOwner,
  deleteOccurrence,
  editOccurrence,
  type DeleteScope,
} from "./lib/entry-editing";
import type { Entry, Occurrence, State, Transfer, Person } from "./lib/types";
import { Modal } from "./components/Modal";
import { TransactionsTable } from "./components/TransactionsTable";
import { MobileNav } from "./components/MobileNav";
import { PurchaseSimulator } from "./components/PurchaseSimulator";
import { AttentionPage, DailyBalance } from "./components/Planning";
import { collectAttention } from "./lib/attention";
import { ThemeToggle } from "./ui/theme";
import { DeleteEntryDialog } from "./components/DeleteEntryDialog";
import { PersonDialog } from "./components/PersonControls";
import { TransactionFilters } from "./components/TransactionFilters";
import { addPersonToBudget } from "./lib/people";
import {
  defaultTransactionFilters,
  selectTransactions,
} from "./lib/transaction-filters";
import {
  BalanceForm,
  EntryForm,
  SettingsForm,
  TransferForm,
} from "./components/Forms";
type Page =
  | "overview"
  | "planning"
  | "banks"
  | "entries"
  | "card"
  | "simulator"
  | "attention"
  | "settings";
type Dialog =
  | { type: "entry"; editing?: Occurrence }
  | { type: "settings" }
  | { type: "balance" }
  | { type: "payment"; month: string }
  | { type: "reimbursement"; month: string }
  | { type: "other-reimbursement"; month: string; person: string }
  | { type: "settle"; entry: Occurrence }
  | { type: "delete-installments"; entry: Occurrence }
  | { type: "person"; entry?: Occurrence }
  | { type: "confirm"; title: string; description: string; action: () => void }
  | null;
function retainReusableDraft(current: Dialog): Dialog {
  return current?.type === "entry" ||
    current?.type === "balance" ||
    (current?.type === "person" && !current.entry)
    ? current
    : null;
}
const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "entries", label: "Lançamentos", icon: ArrowDownLeft },
  { id: "banks", label: "Bancos", icon: Landmark },
  { id: "planning", label: "Planejar", icon: CalendarDays },
  { id: "card", label: "Cartão compartilhado", icon: CreditCard },
  { id: "attention", label: "Pendências", icon: ListTodo },
  { id: "simulator", label: "Simular compra", icon: Calculator },
];
export default function App({
  today = localDate(),
  persistence,
  account,
  legacyBudget,
}: {
  today?: string;
  persistence: BudgetPersistence;
  account?: { user: AuthUser; onLogout: () => Promise<void> };
  legacyBudget?: State | null;
}) {
  const currentMonth = monthOf(today);
  const [loaded] = useState(persistence.initial);
  const [saving, setSaving] = useState(false),
    [connected, setConnected] = useState(true);
  const savingRef = useRef(false);
  const [snapshot, setSnapshot] = useState(loaded.snapshot);
  const [real, setReal] = useState(loaded.state),
    [demo, setDemo] = useState<State | null>(null),
    [loadError, setLoadError] = useState(loaded.error);
  const state = demo ?? real;
  const [month, setMonth] = useState(
      currentMonth < state.settings.initialMonth
        ? state.settings.initialMonth
        : currentMonth,
    ),
    [page, setPage] = useState<Page>("overview");
  const [dialog, setDialog] = useState<Dialog>(null),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const dataModeRef = useRef(0);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [transactionFilters, setTransactionFilters] = useState(
    defaultTransactionFilters,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusPage = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => occurrences(state, month), [state, month]);
  const summary = useMemo(
    () => summarize(state, month, today),
    [state, month, today],
  );
  const bill = summary.invoice;
  const attention = useMemo(
    () => collectAttention(state, today),
    [state, today],
  );
  const bank = useBankConnections(
    demo ? undefined : account?.user.id,
    page === "overview" || page === "attention" || page === "banks",
  );
  const bankPurchases = useMemo(
    () => unassignedBankPurchases(bank.view),
    [bank.view],
  );
  const bankChecking =
    !bank.failed &&
    (bank.view === null ||
      (bank.view.enabled && bank.view.status === "loading"));
  const bankAttentionStatus = bank.failed
    ? "Não foi possível verificar as compras dos bancos."
    : bankChecking
      ? "Verificando compras dos bancos…"
      : bank.view?.enabled &&
          bank.view.banks.some(({ status }) => status !== "ready")
        ? "Alguns bancos estão com dados incompletos. Confira as conexões em Bancos."
        : undefined;
  useEffect(() => {
    if (dialog) setNotice(null);
  }, [dialog]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (dialog || demo) return;
    let active = true;
    const refresh = async () => {
      if (savingRef.current || document.visibilityState === "hidden") return;
      try {
        const latest = await persistence.load();
        if (!active || savingRef.current) return;
        setConnected(true);
        if (latest.snapshot !== snapshot) {
          setReal(latest.state);
          setSnapshot(latest.snapshot);
          setLoadError(latest.error);
          setMonth((m) =>
            m < latest.state.settings.initialMonth
              ? latest.state.settings.initialMonth
              : m,
          );
        }
      } catch {
        if (active) setConnected(false);
      }
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [persistence, snapshot, dialog, demo]);
  async function commit(
    next: State,
    message = "Alteração salva.",
  ): Promise<boolean> {
    if (savingRef.current) {
      setNotice({ text: "Aguarde o salvamento em andamento.", error: true });
      return false;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (demo) setDemo(next);
      else {
        const saved = await persistence.save(next, snapshot);
        setReal(saved.state);
        setSnapshot(saved.snapshot);
        setLoadError(null);
        setConnected(true);
      }
      setDialog(retainReusableDraft);
      setNotice({
        text: demo ? "Alteração feita somente no exemplo." : message,
      });
      return true;
    } catch (error) {
      if (error instanceof BudgetConflictError) {
        try {
          const latest = await persistence.load();
          setReal(latest.state);
          setSnapshot(latest.snapshot);
          setConnected(true);
          setMonth((m) =>
            m < latest.state.settings.initialMonth
              ? latest.state.settings.initialMonth
              : m,
          );
        } catch {
          setConnected(false);
        }
        setDialog(retainReusableDraft);
        setNotice({
          text: "Outro aparelho ou aba atualizou seu orçamento. Sua alteração não foi gravada. Revise os dados e refaça a ação.",
          error: true,
        });
        return false;
      }
      setConnected(false);
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar no servidor. A alteração não foi aplicada.",
        error: true,
      });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function closeSavedDialog(origin: Dialog) {
    setDialog((current) => (current === origin ? null : current));
  }
  function navigate(next: Page) {
    focusPage.current = next !== page;
    setPage(next);
    setFilter("all");
    setSearch("");
    setTransactionFilters(defaultTransactionFilters);
    setRecurringOnly(false);
    setMenu(false);
    if (next !== page && window.scrollY > 0)
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function saveEntry(
    entry: Entry,
    count: number,
    settled: boolean,
    settledOn?: string,
  ) {
    const origin = dialogRef.current;
    try {
      const editing = dialog?.type === "entry" ? dialog.editing : undefined;
      const next = editing
        ? editOccurrence(state, editing, entry, settledOn)
        : structuredClone(state);
      if (!editing) {
        next.entries.push(
          ...(entry.method === "card" && count > 1
            ? splitPurchase(entry, count)
            : [entry]),
        );
        if (settled && entry.method === "account")
          next.settled[`${entry.id}:${monthOf(entry.date)}`] = { date: today };
      }
      const moved = editing && entry.date !== editing.date;
      if (
        await commit(
          next,
          moved
            ? `Data atualizada. Lançamento em ${monthLabel(monthOf(entry.date))}.`
            : !editing && entry.repeat === "monthly"
              ? `Lançamento mensal salvo a partir de ${monthLabel(monthOf(entry.date))}.`
              : "Lançamento salvo.",
        )
      ) {
        if (dialogRef.current !== origin) return;
        if (moved) {
          setMonth(monthOf(entry.date));
        }
        closeSavedDialog(origin);
      }
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível alterar o lançamento.",
        error: true,
      });
    }
  }
  function assign(row: Occurrence, owner: Entry["owner"]) {
    try {
      const next = assignOccurrenceOwner(state, row, owner);
      commit(
        next,
        row.installment
          ? "Responsável atualizado em todas as parcelas desta compra."
          : "Responsável atualizado.",
      );
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível alterar o responsável.",
        error: true,
      });
    }
  }
  async function addPerson(
    name: string,
    row?: Occurrence,
  ): Promise<Person | undefined> {
    try {
      const added = addPersonToBudget(state, name);
      const next = row
        ? assignOccurrenceOwner(added.state, row, added.person.id)
        : added.state;
      if (
        await commit(
          next,
          row?.installment
            ? "Pessoa cadastrada e atribuída a todas as parcelas desta compra."
            : "Pessoa cadastrada.",
        )
      )
        return added.person;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar a pessoa.",
        error: true,
      });
    }
    return undefined;
  }
  function deleteRow(row: Occurrence) {
    if (row.installment) {
      setDialog({ type: "delete-installments", entry: row });
      return;
    }
    setDialog({
      type: "confirm",
      title: "Excluir este lançamento?",
      description: `“${row.description}” será removido somente de ${monthLabel(row.month)}. Outras parcelas e meses continuam no controle.`,
      action: () => removeEntry(row, "single"),
    });
  }
  async function removeEntry(row: Occurrence, scope: DeleteScope) {
    const origin = dialogRef.current;
    try {
      const next = deleteOccurrence(state, row, scope);
      if (
        await commit(
          next,
          scope === "purchase"
            ? "Compra e todas as suas parcelas excluídas."
            : "Lançamento excluído.",
        )
      )
        closeSavedDialog(origin);
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o lançamento.",
        error: true,
      });
    }
  }
  function togglePaid(row: Occurrence) {
    if (!row.settledOn) {
      setDialog({ type: "settle", entry: row });
      return;
    }
    setDialog({
      type: "confirm",
      title: "Voltar para pendente?",
      description:
        "A movimentação será retirada do saldo disponível e continuará na previsão.",
      action: async () => {
        const origin = dialogRef.current;
        const next = structuredClone(state);
        delete next.settled[row.key];
        if (await commit(next)) closeSavedDialog(origin);
      },
    });
  }
  function stopRecurring(row: Occurrence) {
    setDialog({
      type: "confirm",
      title: "Encerrar a repetição?",
      description: `Este lançamento continua até ${monthLabel(month)} e deixa de aparecer a partir do mês seguinte.`,
      action: async () => {
        const origin = dialogRef.current;
        const next = structuredClone(state);
        if (
          Object.keys(next.settled).some(
            (k) => k.startsWith(`${row.id}:`) && k.slice(-7) > month,
          )
        ) {
          setNotice({
            text: "Há movimentações confirmadas em meses seguintes. Desfaça essas confirmações antes de encerrar a repetição.",
            error: true,
          });
          return;
        }
        next.entries = next.entries.map((e) =>
          e.id === row.id ? { ...e, endMonth: month } : e,
        );
        for (const key of Object.keys(next.overrides))
          if (key.startsWith(`${row.id}:`) && key.slice(-7) > month)
            delete next.overrides[key];
        next.skipped = next.skipped.filter(
          (k) => !k.startsWith(`${row.id}:`) || k.slice(-7) <= month,
        );
        if (await commit(next, "Repetição encerrada para os próximos meses."))
          closeSavedDialog(origin);
      },
    });
  }
  async function saveTransfer(value: Transfer) {
    const origin = dialogRef.current;
    const next = structuredClone(state);
    if (dialog?.type === "payment") next.payments.push(value);
    else if (dialog?.type === "reimbursement") next.reimbursements.push(value);
    else if (dialog?.type === "settle")
      next.settled[dialog.entry.key] = { date: value.date };
    else if (dialog?.type === "other-reimbursement") {
      next.entries.push({
        id: value.id,
        description: `Repasse de ${dialog.person}`,
        category: "Repasses",
        amount: value.amount,
        date: value.date,
        kind: "income",
        method: "account",
        owner: "me",
        repeat: "none",
      });
      next.settled[`${value.id}:${monthOf(value.date)}`] = { date: value.date };
    }
    if (await commit(next, "Movimentação confirmada."))
      closeSavedDialog(origin);
  }
  function download(text: string, name: string, type = "application/json") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup() {
    if (demo) return;
    try {
      download(serializeBackup(real), `controle-renda-backup-${today}.json`);
    } catch {
      setNotice({ text: "Não foi possível exportar os dados.", error: true });
    }
  }
  function confirmImport(imported: State, source: string) {
    const originMode = dataModeRef.current;
    setDialog({
      type: "confirm",
      title: "Restaurar este backup?",
      description: `${source} tem ${imported.entries.length} lançamentos, com início em ${monthLabel(imported.settings.initialMonth)}. Ele substituirá seu orçamento no servidor em todos os aparelhos. Exporte o orçamento atual antes de continuar.`,
      action: async () => {
        if (dataModeRef.current !== originMode) return;
        const origin = dialogRef.current;
        if (await commit(imported, "Dados importados para o servidor.")) {
          if (dialogRef.current !== origin) {
            setMonth((m) =>
              m < imported.settings.initialMonth
                ? imported.settings.initialMonth
                : m,
            );
            return;
          }
          setMonth(
            currentMonth < imported.settings.initialMonth
              ? imported.settings.initialMonth
              : currentMonth,
          );
          closeSavedDialog(origin);
        }
      },
    });
  }
  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const originMode = dataModeRef.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || demo) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("O backup deve ter no máximo 5 MB.");
      const text = await file.text();
      if (dataModeRef.current !== originMode) return;
      confirmImport(parseBackup(text), "O arquivo");
    } catch (error) {
      if (dataModeRef.current !== originMode) return;
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo.",
        error: true,
      });
    }
  }
  const listFilters = { ...transactionFilters, query: search, quick: filter };
  const filteredRows = selectTransactions(
    rows.filter(
      (row) =>
        (page !== "card" || row.method === "card") &&
        (!recurringOnly || row.repeat === "monthly"),
    ),
    listFilters,
    bill.outstanding === 0,
  );
  const hasDetailedFilters =
    transactionFilters.status !== "all" ||
    transactionFilters.owner !== "all" ||
    !!transactionFilters.minimum ||
    !!transactionFilters.maximum;
  const unknownCount = rows.filter(
    (e) => e.method === "card" && e.owner === "unknown",
  ).length;
  function startDemo() {
    if (savingRef.current) {
      setNotice({ text: "Aguarde o salvamento em andamento.", error: true });
      return;
    }
    dataModeRef.current += 1;
    setDemo(createDemo(currentMonth));
    setMonth(currentMonth);
    navigate("overview");
  }
  function endDemo() {
    if (savingRef.current) {
      setNotice({ text: "Aguarde o salvamento em andamento.", error: true });
      return;
    }
    dataModeRef.current += 1;
    setDemo(null);
    setDialog(null);
    setMonth(
      currentMonth < real.settings.initialMonth
        ? real.settings.initialMonth
        : currentMonth,
    );
    navigate("overview");
  }
  const pageTitle =
    page === "settings"
      ? "Configurações e dados"
      : navigation.find(({ id }) => id === page)!.label;
  const subtitles: Partial<Record<Page, string>> = {
    planning: "Veja os próximos vencimentos e quando seu saldo pode apertar.",
    banks: "Confira os dados conectados e identifique quem fez cada compra.",
    card: "Acompanhe as compras, os pagamentos e os repasses registrados no orçamento.",
    simulator: "Veja quanto sobraria nos próximos meses antes de decidir.",
    attention:
      "Confira atrasos, vencimentos nos próximos 7 dias e compras sem responsável.",
  };
  useEffect(() => {
    document.title = `${pageTitle} · Controle Renda`;
    if (focusPage.current) headingRef.current?.focus({ preventScroll: true });
    focusPage.current = false;
  }, [pageTitle]);
  const navigationContent = (
    <>
      <UnstyledButton
        className="brand"
        aria-label="Controle Renda — Visão Geral"
        onClick={() => navigate("overview")}
      >
        <span className="brand-icon">
          <TrendingUp size={25} strokeWidth={2.4} />
        </span>
        <span>
          controle<span className="brand-weight">renda</span>
          <span className="brand-dot">.</span>
        </span>
      </UnstyledButton>
      <nav aria-label="Navegação principal">
        {navigation
          .filter(({ id }) => id !== "banks" || (account && !demo))
          .map(({ id, label, icon: Icon }) => (
            <UnstyledButton
              key={id}
              aria-label={label}
              className={`nav-button ${page === id ? "active" : ""}`}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "card" && unknownCount > 0 && (
                <span className="nav-count">{unknownCount}</span>
              )}
            </UnstyledButton>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <UnstyledButton
          className={`nav-button ${page === "settings" ? "active" : ""}`}
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => navigate("settings")}
        >
          <Settings2 size={19} />
          Configurações e dados
        </UnstyledButton>
      </div>
    </>
  );
  return (
    <div className="app-shell" aria-busy={saving}>
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">{navigationContent}</aside>
      <Drawer
        id="navigation-menu"
        opened={menu}
        onClose={() => setMenu(false)}
        title="Menu"
        size={300}
        position="left"
        closeButtonProps={{ "aria-label": "Fechar menu" }}
        classNames={{
          body: "cr-menu-body",
          header: "cr-menu-header",
          title: "cr-menu-title",
        }}
      >
        <div className="cr-menu-content">{navigationContent}</div>
      </Drawer>
      <div className="main-shell">
        <header className="topbar">
          <div className="local-status" data-offline={!connected || undefined}>
            <span className="status-dot" />
            <span role="status">
              {saving
                ? "Salvando no servidor…"
                : connected
                  ? "Conectado"
                  : "Sem conexão com o servidor"}
            </span>
            <ShieldCheck size={14} />
          </div>
          <div className="topbar-right">
            <ThemeToggle />
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <FlaskConical size={17} />
              <strong>Modo de exemplo</strong>
              <span>Valores fictícios, separados dos seus dados.</span>
            </span>
            <UnstyledButton onClick={endDemo}>
              Sair do exemplo <X size={15} />
            </UnstyledButton>
          </div>
        )}
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {pageTitle}
              </h1>
              {subtitles[page] && (
                <p className="page-subtitle">{subtitles[page]}</p>
              )}
            </div>
            {(["overview", "entries", "card", "planning"] as Page[]).includes(
              page,
            ) && (
              <Button
                className="button primary add-button"
                onClick={() => setDialog({ type: "entry" })}
              >
                <Plus size={18} />
                Novo lançamento
              </Button>
            )}
          </div>
          {page === "planning" && (
            <DailyBalance
              state={state}
              today={today}
              onSimulate={() => navigate("simulator")}
            />
          )}
          {(() => {
            const periodToolbar = (
              <div className="period-toolbar">
                <div
                  className="month-picker"
                  role="group"
                  aria-label="Mês selecionado"
                >
                  <UnstyledButton
                    className="icon-button"
                    aria-label="Mês anterior"
                    disabled={month <= state.settings.initialMonth}
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    <ChevronLeft size={17} />
                  </UnstyledButton>
                  <span aria-live="polite">{monthLabel(month)}</span>
                  <UnstyledButton
                    className="icon-button"
                    aria-label="Próximo mês"
                    disabled={month >= "2099-11"}
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <ChevronRight size={17} />
                  </UnstyledButton>
                </div>
                <div className="period-right">
                  {month !==
                    (currentMonth < state.settings.initialMonth
                      ? state.settings.initialMonth
                      : currentMonth) && (
                    <UnstyledButton
                      className="text-button small"
                      onClick={() =>
                        setMonth(
                          currentMonth < state.settings.initialMonth
                            ? state.settings.initialMonth
                            : currentMonth,
                        )
                      }
                    >
                      Voltar ao mês atual
                    </UnstyledButton>
                  )}
                </div>
              </div>
            );
            return (
              <>
                {(["planning", "entries", "card"] as Page[]).includes(page) &&
                  periodToolbar}
                {page === "overview" && (
                  <FinancialOverview
                    key={demo ? "demo" : (account?.user.id ?? "local")}
                    state={state}
                    monthToolbar={periodToolbar}
                    bankRead={bank.view}
                    bankError={bank.failed}
                    summary={summary}
                    month={month}
                    today={today}
                    people={state.people}
                    attentionCount={attention.total + bankPurchases.length}
                    attentionStatus={bankAttentionStatus}
                    onlyBankPurchases={
                      attention.total === 0 && bankPurchases.length > 0
                    }
                    onMonthChange={setMonth}
                    onPlan={() => navigate("planning")}
                    onAttention={() => navigate("attention")}
                    onBalance={() => setDialog({ type: "balance" })}
                    onCard={() => navigate("card")}
                    onEntries={() => navigate("entries")}
                    onDemo={
                      !state.entries.length && !loadError && !demo
                        ? startDemo
                        : undefined
                    }
                  />
                )}
              </>
            );
          })()}
          {page === "planning" && (
            <section
              className="panel projection-panel plan-projection"
              aria-labelledby="monthly-projection-title"
            >
              <div className="panel-heading">
                <div>
                  <h2 id="monthly-projection-title">
                    Saldo acumulado nos próximos meses
                  </h2>
                  <p>
                    Previsão do saldo no fim de cada mês, a partir de{" "}
                    {monthLabel(month)}.
                  </p>
                </div>
              </div>
              <ProjectionList state={state} month={month} today={today} />
            </section>
          )}
          {page === "banks" && account && !demo && (
            <BankConnections
              key={account.user.id}
              connection={bank}
              people={state.people}
            />
          )}
          {(page === "entries" || page === "card") && (
            <>
              {page === "card" && (
                <>
                  <section
                    className="panel card-settlement"
                    aria-labelledby="card-settlement-title"
                  >
                    <div>
                      <h2 id="card-settlement-title">Pagamento da fatura</h2>
                      <p>
                        Vencimento em{" "}
                        {shortDate(
                          dateInMonth(month, state.settings.invoiceDay),
                        )}
                      </p>
                    </div>
                    <div>
                      <span>Falta pagar</span>
                      <strong>{money(bill.outstanding)}</strong>
                    </div>
                    <div role="region" aria-label="Repasse da sua mãe">
                      <span>A receber da sua mãe</span>
                      <strong>{money(bill.toReceive)}</strong>
                      <small>Já recebido: {money(bill.received)}</small>
                    </div>
                    <div className="card-settlement-actions">
                      <Button
                        className="button secondary"
                        disabled={bill.toReceive <= 0}
                        onClick={() =>
                          setDialog({ type: "reimbursement", month })
                        }
                      >
                        <ArrowDownLeft size={16} />
                        Registrar repasse
                      </Button>
                      <Button
                        className="button primary"
                        disabled={bill.outstanding <= 0}
                        onClick={() => setDialog({ type: "payment", month })}
                      >
                        <Check size={16} />
                        Registrar pagamento
                      </Button>
                    </div>
                    {bill.otherParts.length > 0 && (
                      <details className="other-repayments">
                        <summary>Registrar repasse de outra pessoa</summary>
                        <div className="other-repayments-people">
                          {bill.otherParts.map(({ owner, name }) => (
                            <Button
                              key={owner}
                              variant="default"
                              onClick={() =>
                                setDialog({
                                  type: "other-reimbursement",
                                  month,
                                  person: name,
                                })
                              }
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                      </details>
                    )}
                  </section>
                  {(bill.credit > 0 || bill.received > bill.mother) && (
                    <div className="alert">
                      <TriangleAlert size={18} />
                      <p>
                        Os valores registrados superam as compras atribuídas.
                        Confira as compras e o histórico. Crédito de pagamento:{" "}
                        {money(bill.credit)}. Repasse acima da parte dela:{" "}
                        {money(Math.max(0, bill.received - bill.mother))}.
                      </p>
                    </div>
                  )}
                </>
              )}
              <section className="panel">
                <div className="panel-heading list-panel-heading">
                  <div>
                    <h2>
                      {page === "card"
                        ? "Compras da fatura"
                        : "Movimentações do orçamento"}
                    </h2>
                    <p>
                      {filteredRows.length}{" "}
                      {filteredRows.length === 1 ? "lançamento" : "lançamentos"}{" "}
                      em {monthLabel(month)}
                    </p>
                  </div>
                  <TextInput
                    ref={searchRef}
                    className="search-field"
                    rightSectionPointerEvents="all"
                    rightSectionWidth={44}
                    aria-label="Buscar lançamentos"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar descrição ou categoria"
                    leftSection={<Search size={18} />}
                    rightSection={
                      search ? (
                        <UnstyledButton
                          className="search-clear"
                          aria-label="Limpar busca"
                          onClick={() => {
                            setSearch("");
                            searchRef.current?.focus();
                          }}
                        >
                          <X size={16} />
                        </UnstyledButton>
                      ) : null
                    }
                  />
                </div>
                <div className="filter-bar">
                  {(page === "card"
                    ? [
                        ["all", "Todas as compras"],
                        ["me", "Minhas"],
                        ["mother", "Da minha mãe"],
                        ["unknown", "A identificar"],
                      ]
                    : [
                        ["all", "Todos"],
                        ["income", "Receitas"],
                        ["expense", "Despesas"],
                      ]
                  ).map(([value, label]) => (
                    <UnstyledButton
                      key={value}
                      className={`filter-chip ${filter === value ? "active" : ""}`}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </UnstyledButton>
                  ))}
                  {page === "entries" && (
                    <UnstyledButton
                      className={`filter-chip recurring-toggle ${recurringOnly ? "active" : ""}`}
                      aria-pressed={recurringOnly}
                      onClick={() => setRecurringOnly((current) => !current)}
                    >
                      Só recorrentes
                    </UnstyledButton>
                  )}
                </div>
                <TransactionFilters
                  value={listFilters}
                  people={state.people}
                  onChange={setTransactionFilters}
                  onReset={() => {
                    setTransactionFilters(defaultTransactionFilters);
                    setSearch("");
                    setFilter("all");
                    setRecurringOnly(false);
                    searchRef.current?.focus();
                  }}
                />
                {recurringOnly && (
                  <p className="cr-filter-note">
                    Editar altera a ocorrência do mês. Encerrar interrompe as
                    próximas.
                  </p>
                )}
                <TransactionsTable
                  people={state.people}
                  onAddPerson={(row) =>
                    setDialog({ type: "person", entry: row })
                  }
                  paginationKey={JSON.stringify([
                    month,
                    listFilters,
                    recurringOnly,
                  ])}
                  items={filteredRows}
                  page={page}
                  recurringOnly={recurringOnly}
                  search={search}
                  filter={
                    hasDetailedFilters || recurringOnly ? "filtered" : filter
                  }
                  onAssign={assign}
                  onTogglePaid={togglePaid}
                  onEdit={(row) => setDialog({ type: "entry", editing: row })}
                  onDelete={deleteRow}
                  onStop={stopRecurring}
                />
              </section>
              {page === "card" && (
                <section className="panel history-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Pagamentos e repasses</h2>
                      <p>Dinheiro que realmente entrou ou saiu.</p>
                    </div>
                  </div>
                  {[
                    ...state.payments
                      .filter((t) => t.month === month)
                      .map((t) => ({ ...t, type: "payment" as const })),
                    ...state.reimbursements
                      .filter((t) => t.month === month)
                      .map((t) => ({ ...t, type: "reimbursement" as const })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((t) => (
                      <div className="history-row" key={t.id}>
                        <span
                          className={`flow-icon ${t.type === "payment" ? "expense" : "income"}`}
                        >
                          {t.type === "payment" ? (
                            <ArrowUpRight size={17} />
                          ) : (
                            <ArrowDownLeft size={17} />
                          )}
                        </span>
                        <div>
                          <strong>
                            {t.type === "payment"
                              ? "Pagamento da fatura"
                              : "Repasse da sua mãe"}
                          </strong>
                          <small>{shortDate(t.date)}</small>
                        </div>
                        <strong>{money(t.amount)}</strong>
                        <UnstyledButton
                          className="text-button small"
                          onClick={() =>
                            setDialog({
                              type: "confirm",
                              title: "Desfazer esta movimentação?",
                              description:
                                "O valor voltará a ficar pendente e será retirado das movimentações confirmadas.",
                              action: async () => {
                                const origin = dialogRef.current;
                                const next = structuredClone(state);
                                if (t.type === "payment")
                                  next.payments = next.payments.filter(
                                    (p) => p.id !== t.id,
                                  );
                                else
                                  next.reimbursements =
                                    next.reimbursements.filter(
                                      (p) => p.id !== t.id,
                                    );
                                if (await commit(next))
                                  closeSavedDialog(origin);
                              },
                            })
                          }
                        >
                          Desfazer
                        </UnstyledButton>
                      </div>
                    ))}
                  {!state.payments.some((t) => t.month === month) &&
                    !state.reimbursements.some((t) => t.month === month) && (
                      <p className="empty-history">
                        Nenhuma movimentação registrada para esta fatura.
                      </p>
                    )}
                </section>
              )}
            </>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <Settings2 size={24} />
                </span>
                <h2>Orçamento e cartão</h2>
                <dl>
                  <div>
                    <dt>Mês inicial</dt>
                    <dd>{monthLabel(state.settings.initialMonth)}</dd>
                  </div>
                  <div>
                    <dt>Saldo antes do mês inicial</dt>
                    <dd>{money(state.settings.openingBalance)}</dd>
                  </div>
                  <div>
                    <dt>Cartão</dt>
                    <dd>{state.settings.cardName}</dd>
                  </div>
                  <div>
                    <dt>Vencimento</dt>
                    <dd>Dia {state.settings.invoiceDay}</dd>
                  </div>
                </dl>
                <Button
                  className="button secondary"
                  onClick={() => setDialog({ type: "settings" })}
                >
                  <Pencil size={16} />
                  Editar configurações
                </Button>
              </section>
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <ShieldCheck size={24} />
                </span>
                <h2>Backup dos dados</h2>
                <p>
                  Exporte uma cópia do orçamento ou restaure um arquivo salvo.
                </p>
                <div className="backup-actions">
                  <Button
                    className="button primary"
                    disabled={!!demo}
                    onClick={exportBackup}
                  >
                    <Download size={17} />
                    Exportar backup
                  </Button>
                  <Button
                    className="button secondary"
                    disabled={!!demo}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={17} />
                    Importar backup
                  </Button>
                </div>
                <p className="field-note">
                  O backup contém seus dados financeiros. Guarde o arquivo em um
                  lugar privado. A importação pede confirmação antes de
                  substituir seus dados.
                </p>
              </section>
              {legacyBudget && !demo && (
                <section className="panel settings-panel">
                  <h2>Trazer meus dados antigos</h2>
                  <p>
                    Encontramos um orçamento da versão anterior neste navegador.
                    Você pode copiá-lo para sua conta. Os dados locais serão
                    preservados.
                  </p>
                  <Button
                    className="button secondary"
                    onClick={() =>
                      confirmImport(legacyBudget, "O orçamento deste navegador")
                    }
                  >
                    Importar dados deste navegador
                  </Button>
                </section>
              )}
              {account && (
                <AccountPanel user={account.user} onLogout={account.onLogout} />
              )}
              <section className="panel settings-panel example-settings">
                <span className="settings-icon">
                  <FlaskConical size={24} />
                </span>
                <div>
                  <h2>Conheça com um exemplo</h2>
                  <p>
                    Teste os recursos com valores fictícios. Seu orçamento fica
                    separado.
                  </p>
                </div>
                <Button
                  className="button secondary"
                  onClick={demo ? endDemo : startDemo}
                >
                  {demo ? "Voltar aos meus dados" : "Abrir exemplo"}
                </Button>
              </section>
            </div>
          )}
        </main>
      </div>
      <MobileNav
        current={page}
        onNavigate={navigate}
        onAdd={() => setDialog({ type: "entry" })}
        menuOpen={menu}
        onMenu={() => setMenu((open) => !open)}
        showBanks={!!account && !demo}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Selecionar backup"
        onChange={importBackup}
      />
      {notice && (
        <Portal>
          <Alert
            className="cr-notice"
            color={notice.error ? "red" : "finance"}
            variant="filled"
            role={notice.error ? "alert" : "status"}
            icon={
              notice.error ? (
                <TriangleAlert size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )
            }
            withCloseButton
            closeButtonLabel="Fechar aviso"
            onClose={() => setNotice(null)}
          >
            {notice.text}
          </Alert>
        </Portal>
      )}
      {dialog?.type === "entry" && (
        <EntryForm
          month={month}
          today={today}
          state={state}
          editing={dialog.editing}
          initialMethod={page === "card" ? "card" : "account"}
          onClose={() => setDialog(null)}
          onSave={saveEntry}
          onAddPerson={(name) => addPerson(name)}
        />
      )}
      {dialog?.type === "balance" && (
        <BalanceForm
          current={summary.available}
          onClose={() => setDialog(null)}
          onSave={async (amount) => {
            try {
              const next = withCurrentBalance(state, amount, today);
              if (await commit(next, "Saldo da conta atualizado."))
                closeSavedDialog(dialog);
            } catch (error) {
              setNotice({
                text:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível ajustar o saldo.",
                error: true,
              });
            }
          }}
        />
      )}
      {dialog?.type === "settings" && (
        <SettingsForm
          state={state}
          onClose={() => setDialog(null)}
          onSave={async (settings) => {
            if (await commit({ ...state, settings }, "Configurações salvas.")) {
              if (month < settings.initialMonth)
                setMonth(settings.initialMonth);
              closeSavedDialog(dialog);
            }
          }}
        />
      )}
      {(dialog?.type === "payment" ||
        dialog?.type === "reimbursement" ||
        dialog?.type === "other-reimbursement" ||
        dialog?.type === "settle") && (
        <TransferForm
          mode={
            dialog.type === "other-reimbursement"
              ? "reimbursement"
              : dialog.type
          }
          receivedFrom={
            dialog.type === "other-reimbursement" ? dialog.person : undefined
          }
          maximum={
            dialog.type === "payment"
              ? invoice(state, dialog.month).outstanding
              : dialog.type === "reimbursement"
                ? invoice(state, dialog.month).toReceive
                : dialog.type === "settle"
                  ? dialog.entry.amount
                  : undefined
          }
          month={dialog.type === "settle" ? dialog.entry.month : dialog.month}
          today={today}
          initialMonth={state.settings.initialMonth}
          onSave={saveTransfer}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "person" && (
        <PersonDialog
          onAdd={(name) => addPerson(name, dialog.entry)}
          onClose={() => closeSavedDialog(dialog)}
        />
      )}
      {dialog?.type === "delete-installments" && (
        <DeleteEntryDialog
          entry={dialog.entry}
          count={
            state.entries.filter(
              (entry) =>
                entry.method === "card" &&
                entry.installment?.group === dialog.entry.installment?.group,
            ).length
          }
          saving={saving}
          onClose={() => setDialog(null)}
          onDelete={(scope) => removeEntry(dialog.entry, scope)}
        />
      )}
      {dialog?.type === "confirm" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <div className="form-content">
            <p className="confirm-description">{dialog.description}</p>
            <footer className="cr-form-footer">
              <Button
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </Button>
              <Button className="button primary" onClick={dialog.action}>
                {dialog.title === "Como calculamos sua previsão"
                  ? "Entendi"
                  : "Confirmar"}
              </Button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ProjectionList({
  state,
  month,
  today,
}: {
  state: State;
  month: string;
  today: string;
}) {
  const values = Array.from({ length: 6 }, (_, i) => {
    const period = addMonths(month, i);
    return { month: period, value: summarize(state, period, today).closing };
  });
  return (
    <dl className="fo-parts monthly-projection" aria-label="Previsão por mês">
      {values.map(({ month, value }) => (
        <div key={month}>
          <dt>
            <time dateTime={month}>{monthLabel(month)}</time>
          </dt>
          <dd className={value < 0 ? "negative" : undefined}>{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
