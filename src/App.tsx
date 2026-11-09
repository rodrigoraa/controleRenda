import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Leaf,
  Menu,
  Pencil,
  Plus,
  Repeat2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
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
} from "./lib/finance";
import { parseBackup, serializeBackup } from "./lib/validation";
import { BudgetConflictError, type BudgetPersistence } from "./lib/persistence";
import { AccountPanel } from "./components/AccountPanel";
import type { AuthUser } from "./lib/api";
import { createDemo } from "./lib/demo";
import type { Entry, Occurrence, State, Transfer } from "./lib/types";
import { Modal } from "./components/Modal";
import { TransactionsTable } from "./components/TransactionsTable";
import { MobileNav } from "./components/MobileNav";
import { EntryForm, SettingsForm, TransferForm } from "./components/Forms";
type Page = "overview" | "entries" | "card" | "recurring" | "settings";
type Dialog =
  | { type: "entry"; editing?: Occurrence }
  | { type: "settings" }
  | { type: "payment" }
  | { type: "reimbursement" }
  | { type: "settle"; entry: Occurrence }
  | { type: "confirm"; title: string; description: string; action: () => void }
  | null;
const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "entries", label: "Lançamentos", icon: ArrowDownLeft },
  { id: "card", label: "Cartão compartilhado", icon: CreditCard },
  { id: "recurring", label: "Recorrências", icon: Repeat2 },
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
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => occurrences(state, month), [state, month]);
  const summary = useMemo(
    () => summarize(state, month, today),
    [state, month, today],
  );
  const bill = summary.invoice;
  const monthName = monthLabel(month).split(" de ")[0];
  useEffect(() => {
    if (dialog) setNotice(null);
  }, [dialog]);
  useEffect(() => {
    if (!notice) return;
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
      setNotice({
        text: demo ? "Alteração feita somente no exemplo." : message,
      });
      return true;
    } catch (error) {
      if (error instanceof BudgetConflictError) {
        setDialog((current) => (current?.type === "confirm" ? null : current));
        try {
          const latest = await persistence.load();
          setReal(latest.state);
          setSnapshot(latest.snapshot);
          setConnected(true);
        } catch {
          setConnected(false);
        }
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
  function navigate(next: Page) {
    setPage(next);
    setFilter("all");
    setSearch("");
    setMenu(false);
    if (window.matchMedia?.("(max-width: 900px)").matches)
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function saveEntry(entry: Entry, count: number, settled: boolean) {
    const next = structuredClone(state);
    if (dialog?.type === "entry" && dialog.editing) {
      const row = dialog.editing;
      next.overrides[row.key] = {
        description: entry.description,
        amount: entry.amount,
        owner: entry.owner,
        category: entry.category,
      };
    } else {
      const items =
        entry.method === "card" && count > 1
          ? splitPurchase(entry, count)
          : [entry];
      next.entries.push(...items);
      if (settled && entry.method === "account")
        next.settled[`${entry.id}:${monthOf(entry.date)}`] = { date: today };
    }
    if (await commit(next, "Lançamento salvo.")) setDialog(null);
  }
  function assign(row: Occurrence, owner: Entry["owner"]) {
    const next = structuredClone(state);
    next.overrides[row.key] = {
      description: row.description,
      amount: row.amount,
      category: row.category,
      owner,
    };
    commit(next, "Responsável atualizado.");
  }
  function deleteRow(row: Occurrence) {
    setDialog({
      type: "confirm",
      title: "Excluir este lançamento?",
      description: `“${row.description}” será removido somente de ${monthLabel(row.month)}. Outras parcelas e meses continuam no controle.`,
      action: async () => {
        const next = structuredClone(state);
        next.skipped.push(row.key);
        delete next.settled[row.key];
        if (await commit(next, "Lançamento excluído.")) setDialog(null);
      },
    });
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
        const next = structuredClone(state);
        delete next.settled[row.key];
        if (await commit(next)) setDialog(null);
      },
    });
  }
  function stopRecurring(row: Occurrence) {
    setDialog({
      type: "confirm",
      title: "Encerrar a repetição?",
      description: `Este lançamento continua até ${monthLabel(month)} e deixa de aparecer a partir do mês seguinte.`,
      action: async () => {
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
          setDialog(null);
      },
    });
  }
  async function saveTransfer(value: Transfer) {
    const next = structuredClone(state);
    if (dialog?.type === "payment") next.payments.push(value);
    else if (dialog?.type === "reimbursement") next.reimbursements.push(value);
    else if (dialog?.type === "settle")
      next.settled[dialog.entry.key] = { date: value.date };
    if (await commit(next, "Movimentação confirmada.")) setDialog(null);
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
    setDialog({
      type: "confirm",
      title: "Restaurar este backup?",
      description: `${source} tem ${imported.entries.length} lançamentos, com início em ${monthLabel(imported.settings.initialMonth)}. Ele substituirá seu orçamento no servidor em todos os aparelhos. Exporte o orçamento atual antes de continuar.`,
      action: async () => {
        if (await commit(imported, "Dados importados para o servidor.")) {
          setMonth(
            currentMonth < imported.settings.initialMonth
              ? imported.settings.initialMonth
              : currentMonth,
          );
          setDialog(null);
        }
      },
    });
  }
  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("O backup deve ter no máximo 5 MB.");
      confirmImport(parseBackup(await file.text()), "O arquivo");
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo.",
        error: true,
      });
    }
  }
  const filteredRows = rows.filter(
    (row) =>
      (!search ||
        `${row.description} ${row.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))) &&
      (page !== "card" || row.method === "card") &&
      (page !== "recurring" || row.repeat === "monthly") &&
      (filter === "all" ||
        (filter === "income" && row.kind === "income") ||
        (filter === "expense" && row.kind === "expense") ||
        (filter === "pending" && row.method === "account" && !row.settledOn) ||
        (["me", "mother", "unknown"].includes(filter) && row.owner === filter)),
  );
  const unknownCount = rows.filter(
    (e) => e.method === "card" && e.owner === "unknown",
  ).length;
  const recentRows = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const dueRows = rows
    .filter((e) => e.method === "account" && !e.settledOn)
    .slice(0, 3);
  function startDemo() {
    setDemo(createDemo(currentMonth));
    setMonth(currentMonth);
    navigate("overview");
  }
  function endDemo() {
    setDemo(null);
    setDialog(null);
    setMonth(
      currentMonth < real.settings.initialMonth
        ? real.settings.initialMonth
        : currentMonth,
    );
    navigate("overview");
  }
  const titles: Record<Page, { title: string; subtitle: string }> = {
    overview: {
      title: "Seu dinheiro, com clareza.",
      subtitle: "Menos planilhas. Mais tranquilidade para o seu mês.",
    },
    entries: {
      title: "Cada movimento, no seu lugar.",
      subtitle: "Receitas e despesas organizadas, sem complicação.",
    },
    card: {
      title: "Um cartão. Tudo separado.",
      subtitle: "Saiba de quem é cada compra e acompanhe os repasses.",
    },
    recurring: {
      title: "Cadastre uma vez. Acompanhe sempre.",
      subtitle:
        "Suas receitas e contas mensais entram automaticamente na previsão.",
    },
    settings: {
      title: "Do seu jeito.",
      subtitle: "Ajuste seu controle e cuide dos seus dados.",
    },
  };
  return (
    <div className="app-shell" aria-busy={saving}>
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className={`sidebar ${menu ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-icon">
            <TrendingUp size={25} strokeWidth={2.4} />
          </span>
          <span>
            controle<span className="brand-weight">renda</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <p className="nav-label">MEU CONTROLE</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
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
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={19} />
            </span>
            <strong>
              Pequenos passos.
              <br />
              Mais tranquilidade.
            </strong>
            <p>O melhor controle é aquele que você consegue manter.</p>
          </div>
          <button
            className={`nav-button ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
            Configurações e dados
          </button>
          <div className="local-status">
            <span className="status-dot" />
            <span role="status">
              {saving
                ? "Salvando no servidor…"
                : connected
                  ? "Seus dados no servidor"
                  : "Sem conexão com o servidor"}
            </span>
            <ShieldCheck size={14} />
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              <span className="breadcrumb-root">
                Meu espaço<span>/</span>
              </span>
              <strong>
                {page === "settings"
                  ? "Configurações"
                  : navigation.find((n) => n.id === page)?.label}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              {new Intl.DateTimeFormat("pt-BR", {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }).format(new Date(`${today}T12:00:00Z`))}
            </span>
            <button
              className="icon-button"
              title="Entenda as previsões"
              aria-label="Entenda as previsões"
              onClick={() =>
                setDialog({
                  type: "confirm",
                  title: "Como calculamos sua previsão",
                  description:
                    "Partimos do saldo no início do controle, somamos as receitas e descontamos as despesas cadastradas até o mês escolhido. A fatura inteira sai do saldo; o repasse da sua mãe entra separadamente. Pendências anteriores continuam na previsão. O saldo disponível usa somente movimentações confirmadas até hoje. Novos gastos e rendas variáveis precisam ser cadastrados.",
                  action: () => setDialog(null),
                })
              }
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="profile-avatar"
              aria-label="Minha conta"
              onClick={() => navigate("settings")}
            >
              <UserRound size={18} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <FlaskConical size={17} />
              <strong>Modo de exemplo</strong>
              <span>Valores fictícios, separados dos seus dados.</span>
            </span>
            <button onClick={endDemo}>
              Sair do exemplo <X size={15} />
            </button>
          </div>
        )}
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SIMPLICIDADE QUE FAZ DIFERENÇA</p>
              <h1>{titles[page].title}</h1>
              <p className="page-subtitle">{titles[page].subtitle}</p>
            </div>
            <button
              className="button primary add-button"
              onClick={() => setDialog({ type: "entry" })}
            >
              <Plus size={18} />
              Novo lançamento
            </button>
          </div>
          {page !== "settings" && (
            <div className="period-toolbar">
              <div className="month-picker">
                <button
                  className="icon-button"
                  aria-label="Mês anterior"
                  disabled={month <= state.settings.initialMonth}
                  onClick={() => setMonth(addMonths(month, -1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>{monthLabel(month)}</span>
                <button
                  className="icon-button"
                  aria-label="Próximo mês"
                  disabled={month >= "2099-11"}
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
              <div className="period-right">
                {month !== currentMonth && (
                  <button
                    className="text-button small"
                    onClick={() =>
                      setMonth(
                        currentMonth < state.settings.initialMonth
                          ? state.settings.initialMonth
                          : currentMonth,
                      )
                    }
                  >
                    Voltar para hoje
                  </button>
                )}
                <span className="soft-label">
                  <span className="status-dot" />
                  {demo ? "Exemplo interativo" : "Atualizado a cada lançamento"}
                </span>
              </div>
            </div>
          )}
          {page === "overview" && (
            <>
              {!state.entries.length && !loadError && (
                <div className="welcome-card">
                  <span className="welcome-icon">
                    <Sparkles size={24} />
                  </span>
                  <div>
                    <h3>Um começo simples para cuidar do seu dinheiro.</h3>
                    <p>
                      Defina seu saldo inicial e adicione suas rendas. A gente
                      faz as contas.
                    </p>
                  </div>
                  <div className="welcome-actions">
                    <button className="button secondary" onClick={startDemo}>
                      Explorar exemplo
                    </button>
                    <button
                      className="button primary"
                      onClick={() => setDialog({ type: "settings" })}
                    >
                      Configurar meu saldo <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="metrics-grid">
                <section
                  className={`metric metric-primary ${summary.closing < 0 ? "negative-metric" : ""}`}
                  aria-label="Sobra prevista"
                >
                  <div className="metric-top">
                    <span>Sobra prevista em {monthName}</span>
                    <span className="metric-icon">
                      <Wallet size={18} />
                    </span>
                  </div>
                  <strong className="metric-value">
                    {money(summary.closing)}
                  </strong>
                  <div className="metric-bottom">
                    <span className="metric-tag">
                      {summary.closing >= 0 ? (
                        <TrendingUp size={13} />
                      ) : (
                        <TriangleAlert size={13} />
                      )}{" "}
                      {summary.closing >= 0
                        ? "Previsão positiva"
                        : "Atenção ao orçamento"}
                    </span>
                    <svg
                      className="sparkline"
                      viewBox="0 0 110 35"
                      aria-hidden="true"
                    >
                      <path
                        d={
                          summary.nextClosing > summary.closing
                            ? "M1 32L108 2"
                            : summary.nextClosing < summary.closing
                              ? "M1 2L108 32"
                              : "M1 17L108 17"
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </section>
                <section
                  className="metric"
                  aria-label="Previsão do próximo mês"
                >
                  <div className="metric-top">
                    <span>No próximo mês</span>
                    <span className="metric-icon light">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <strong
                    className={`metric-value ${summary.nextClosing < 0 ? "negative" : ""}`}
                  >
                    {money(summary.nextClosing)}
                  </strong>
                  <p className="metric-caption">
                    Saldo previsto ao fechar{" "}
                    <strong>
                      {monthLabel(addMonths(month, 1)).split(" de ")[0]}
                    </strong>
                  </p>
                  <span className="metric-footnote">
                    Já inclui a sobra de {monthName}
                  </span>
                </section>
                <section className="metric" aria-label="Saldo disponível hoje">
                  <div className="metric-top">
                    <span>Disponível hoje</span>
                    <span className="metric-icon light">
                      <Wallet size={18} />
                    </span>
                  </div>
                  <strong
                    className={`metric-value ${summary.available < 0 ? "negative" : ""}`}
                  >
                    {money(summary.available)}
                  </strong>
                  <p className="metric-caption">
                    Somente o que já entrou e saiu
                  </p>
                  <span className="metric-footnote">
                    <ShieldCheck size={12} />
                    Movimentações confirmadas até hoje
                  </span>
                </section>
              </div>
              <div className="forecast-note">
                <CircleHelp size={14} />
                <span>
                  Previsões consideram os lançamentos cadastrados, incluindo
                  valores pendentes. Novos gastos mudam o resultado.
                </span>
              </div>
              {bill.unknown > 0 && (
                <div className="alert compact">
                  <span className="alert-icon">
                    <Users size={18} />
                  </span>
                  <div>
                    <strong>
                      {unknownCount}{" "}
                      {unknownCount === 1
                        ? "compra precisa"
                        : "compras precisam"}{" "}
                      de um responsável
                    </strong>
                    <p>
                      Identifique {money(bill.unknown)} para separar a sua parte
                      da parte da sua mãe.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      navigate("card");
                      setFilter("unknown");
                    }}
                  >
                    Conferir compras <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="panel projection-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Olhe para os próximos meses</h2>
                      <p>Sua sobra prevista, mês a mês.</p>
                    </div>
                    <span className="chart-legend">
                      <span />
                      Saldo projetado
                    </span>
                  </div>
                  <ProjectionChart state={state} month={month} today={today} />
                  <div className="flow-summary">
                    <div>
                      <span className="flow-icon income">
                        <ArrowDownLeft size={18} />
                      </span>
                      <div>
                        <small>Receitas de {monthName}</small>
                        <strong>{money(summary.income)}</strong>
                      </div>
                    </div>
                    <div>
                      <span className="flow-icon expense">
                        <ArrowUpRight size={18} />
                      </span>
                      <div>
                        <small>Despesas de {monthName}</small>
                        <strong>{money(summary.expenses)}</strong>
                      </div>
                    </div>
                    <div className="flow-personal">
                      <small>Gastos por sua conta</small>
                      <strong>{money(summary.personalExpenses)}</strong>
                    </div>
                  </div>
                  <p className="chart-footnote">
                    Despesas incluem a fatura inteira. Gastos por sua conta
                    incluem compras a identificar.
                  </p>
                </section>
                <section className="panel card-preview-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Cartão compartilhado</h2>
                      <p>Cada compra com seu responsável.</p>
                    </div>
                    <CreditCard size={20} />
                  </div>
                  <div className="virtual-card">
                    <div className="virtual-card-top">
                      <span>{state.settings.cardName}</span>
                      <span className="card-circles">
                        <i />
                        <i />
                      </span>
                    </div>
                    <span className="virtual-card-label">
                      Fatura de {monthName}
                    </span>
                    <strong>{money(bill.total)}</strong>
                    <div className="virtual-card-bottom">
                      <span>EU + MINHA MÃE</span>
                      <span>Vence dia {state.settings.invoiceDay}</span>
                    </div>
                  </div>
                  <div className="share-row">
                    <span>
                      <span className="person-dot me" />
                      Sua parte
                    </span>
                    <strong>{money(bill.me)}</strong>
                  </div>
                  <div className="share-row">
                    <span>
                      <span className="person-dot mother" />
                      Parte da sua mãe
                    </span>
                    <strong>{money(bill.mother)}</strong>
                  </div>
                  <div className="card-panel-bottom">
                    <span>
                      A receber dela <strong>{money(bill.toReceive)}</strong>
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Ver detalhes do cartão"
                      onClick={() => navigate("card")}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="dashboard-grid lower-grid">
                <section className="panel movements-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Lançamentos do mês</h2>
                      <p>Os detalhes que fazem a diferença.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("entries")}
                    >
                      Ver todos <ArrowRight size={15} />
                    </button>
                  </div>
                  <TransactionsTable
                    items={recentRows}
                    compact
                    page={page}
                    search={search}
                    filter={filter}
                    onAssign={assign}
                    onTogglePaid={togglePaid}
                    onEdit={(row) => setDialog({ type: "entry", editing: row })}
                    onDelete={deleteRow}
                    onStop={stopRecurring}
                    onCreate={() => setDialog({ type: "entry" })}
                  />
                </section>
                <section className="panel upcoming-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>No seu radar</h2>
                      <p>Entradas e contas pendentes.</p>
                    </div>
                    <Clock3 size={19} />
                  </div>
                  {dueRows.length ? (
                    dueRows.map((row) => (
                      <div className="upcoming-row" key={row.key}>
                        <span
                          className={`date-tile ${row.date < today ? "overdue" : ""}`}
                        >
                          <strong>{row.date.slice(8)}</strong>
                          <small>{monthName.slice(0, 3)}</small>
                        </span>
                        <div>
                          <strong>{row.description}</strong>
                          <small>
                            {row.date < today
                              ? "Confirmar movimentação"
                              : row.kind === "income"
                                ? "Entrada prevista"
                                : "Pagamento previsto"}
                          </small>
                        </div>
                        <strong
                          className={row.kind === "income" ? "positive" : ""}
                        >
                          {row.kind === "income" ? "+ " : ""}
                          {money(row.amount)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <div className="quiet-state">
                      <CheckCircle2 size={29} />
                      <strong>Tudo tranquilo por aqui.</strong>
                      <p>As pendências deste mês aparecem aqui.</p>
                    </div>
                  )}
                  <div className="upcoming-note">
                    <Leaf size={17} />
                    <p>
                      Um lançamento por vez.
                      <br />
                      <strong>Seu futuro agradece.</strong>
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
          {(page === "entries" || page === "recurring" || page === "card") && (
            <>
              {page === "card" && (
                <>
                  <div className="card-metrics">
                    <section className="small-metric">
                      <CreditCard size={20} />
                      <span>Fatura completa</span>
                      <strong>{money(bill.total)}</strong>
                      <small>Falta pagar {money(bill.outstanding)}</small>
                    </section>
                    <section className="small-metric">
                      <UserRound size={20} />
                      <span>Sua parte identificada</span>
                      <strong>{money(bill.me)}</strong>
                      <small>Compras atribuídas a você</small>
                    </section>
                    <section
                      className="small-metric"
                      role="region"
                      aria-label="Repasse da sua mãe"
                    >
                      <Heart size={20} />
                      <span>A receber da sua mãe</span>
                      <strong>{money(bill.toReceive)}</strong>
                      <small>Já recebido: {money(bill.received)}</small>
                    </section>
                    <section className="small-metric">
                      <CircleHelp size={20} />
                      <span>A identificar</span>
                      <strong>{money(bill.unknown)}</strong>
                      <small>
                        {unknownCount}{" "}
                        {unknownCount === 1
                          ? "compra sem responsável"
                          : "compras sem responsável"}
                      </small>
                    </section>
                  </div>
                  <div className="card-action-bar">
                    <p>
                      <Clock3 size={16} />
                      Vencimento:{" "}
                      {shortDate(dateInMonth(month, state.settings.invoiceDay))}
                      <span>·</span>Você paga a fatura e registra o repasse
                      dela.
                    </p>
                    <div>
                      <button
                        className="button secondary"
                        disabled={bill.toReceive <= 0}
                        onClick={() => setDialog({ type: "reimbursement" })}
                      >
                        <ArrowDownLeft size={16} />
                        Registrar repasse
                      </button>
                      <button
                        className="button primary"
                        disabled={bill.outstanding <= 0}
                        onClick={() => setDialog({ type: "payment" })}
                      >
                        <Check size={16} />
                        Registrar pagamento
                      </button>
                    </div>
                  </div>
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
              {page === "recurring" && (
                <div className="info-banner">
                  <Repeat2 size={21} />
                  <p>
                    Os lançamentos abaixo se repetem todos os meses. Editar
                    altera somente este mês; encerrar interrompe os próximos.
                  </p>
                </div>
              )}
              <section className="panel">
                <div className="panel-heading list-panel-heading">
                  <div>
                    <h2>
                      {page === "card"
                        ? "Compras da fatura"
                        : page === "recurring"
                          ? "Entradas e contas recorrentes"
                          : "Todos os lançamentos"}
                    </h2>
                    <p>
                      {filteredRows.length}{" "}
                      {filteredRows.length === 1 ? "lançamento" : "lançamentos"}{" "}
                      em {monthLabel(month)}
                    </p>
                  </div>
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Buscar lançamentos"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar lançamento..."
                    />
                  </label>
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
                        ["pending", "Pendentes"],
                      ]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={`filter-chip ${filter === value ? "active" : ""}`}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <TransactionsTable
                  items={filteredRows}
                  page={page}
                  search={search}
                  filter={filter}
                  onAssign={assign}
                  onTogglePaid={togglePaid}
                  onEdit={(row) => setDialog({ type: "entry", editing: row })}
                  onDelete={deleteRow}
                  onStop={stopRecurring}
                  onCreate={() => setDialog({ type: "entry" })}
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
                        <button
                          className="text-button small"
                          onClick={() =>
                            setDialog({
                              type: "confirm",
                              title: "Desfazer esta movimentação?",
                              description:
                                "O valor voltará a ficar pendente e será retirado das movimentações confirmadas.",
                              action: async () => {
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
                                if (await commit(next)) setDialog(null);
                              },
                            })
                          }
                        >
                          Desfazer
                        </button>
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
              <button
                className="settings-shortcut"
                onClick={() => navigate("recurring")}
                aria-label="Gerenciar recorrências"
              >
                <span className="settings-icon">
                  <Repeat2 size={23} />
                </span>
                <span>
                  <strong>Recorrências</strong>
                  <small>Suas rendas e contas de todo mês</small>
                </span>
                <ArrowRight size={20} />
              </button>
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <Settings2 size={24} />
                </span>
                <h2>Meu controle</h2>
                <p>O ponto de partida para suas previsões.</p>
                <dl>
                  <div>
                    <dt>Mês inicial</dt>
                    <dd>{monthLabel(state.settings.initialMonth)}</dd>
                  </div>
                  <div>
                    <dt>Saldo inicial</dt>
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
                <button
                  className="button secondary"
                  onClick={() => setDialog({ type: "settings" })}
                >
                  <Pencil size={16} />
                  Editar configurações
                </button>
              </section>
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <ShieldCheck size={24} />
                </span>
                <h2>Seus dados, com você</h2>
                <p>
                  Seus dados ficam no banco do servidor e podem ser acessados em
                  outros aparelhos com seu login. As alterações são atualizadas
                  ao voltar à página ou a cada 30 segundos. Exporte uma cópia
                  sempre que precisar.
                </p>
                <div className="backup-actions">
                  <button
                    className="button primary"
                    disabled={!!demo}
                    onClick={exportBackup}
                  >
                    <Download size={17} />
                    Exportar backup
                  </button>
                  <button
                    className="button secondary"
                    disabled={!!demo}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={17} />
                    Importar backup
                  </button>
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
                  <button
                    className="button secondary"
                    onClick={() =>
                      confirmImport(legacyBudget, "O orçamento deste navegador")
                    }
                  >
                    Importar dados deste navegador
                  </button>
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
                <button
                  className="button secondary"
                  onClick={demo ? endDemo : startDemo}
                >
                  {demo ? "Voltar aos meus dados" : "Abrir exemplo"}
                </button>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={14} />
              Uma relação mais leve com o seu dinheiro.
            </span>
            <span>
              Controle Renda<span className="footer-dot">·</span>Feito para
              simplificar
            </span>
          </footer>
        </main>
      </div>
      <MobileNav
        current={page}
        onNavigate={navigate}
        onAdd={() => setDialog({ type: "entry" })}
        menuOpen={menu}
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
        <div
          className={`toast ${notice.error ? "toast-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? (
            <TriangleAlert size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
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
              setDialog(null);
            }
          }}
        />
      )}
      {(dialog?.type === "payment" ||
        dialog?.type === "reimbursement" ||
        dialog?.type === "settle") && (
        <TransferForm
          mode={dialog.type}
          maximum={
            dialog.type === "payment"
              ? bill.outstanding
              : dialog.type === "reimbursement"
                ? bill.toReceive
                : dialog.entry.amount
          }
          month={month}
          today={today}
          initialMonth={state.settings.initialMonth}
          onSave={saveTransfer}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "confirm" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <div className="form-content">
            <p className="confirm-description">{dialog.description}</p>
            <footer className="form-footer">
              <button
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button className="button primary" onClick={dialog.action}>
                {dialog.title === "Como calculamos sua previsão"
                  ? "Entendi"
                  : "Confirmar"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ProjectionChart({
  state,
  month,
  today,
}: {
  state: State;
  month: string;
  today: string;
}) {
  const values = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(month, i);
    return { month: m, value: summarize(state, m, today).closing };
  });
  const max = Math.max(...values.map((v) => v.value), 10000),
    min = Math.min(...values.map((v) => v.value), 0),
    range = max - min;
  return (
    <div
      className="projection-chart"
      role="img"
      aria-label={`Saldo projetado: ${values.map((v) => `${monthLabel(v.month)}: ${money(v.value)}`).join("; ")}`}
    >
      <div className="chart-axis">
        <span>{money(max).replace(",00", "")}</span>
        <span>{money(Math.round((max + min) / 2)).replace(",00", "")}</span>
        <span>{money(min).replace(",00", "")}</span>
      </div>
      <div className="chart-plot">
        <div className="chart-gridline line-top" />
        <div className="chart-gridline line-middle" />
        <div className="chart-gridline line-bottom" />
        {min < 0 && (
          <div
            className="chart-zero"
            style={{ bottom: `calc(28px + (100% - 28px) * ${-min / range})` }}
          />
        )}
        {values.map(({ month: m, value }, i) => (
          <div className="chart-column" key={m}>
            <div className="bar-track">
              <div
                className={`chart-bar ${i === 0 ? "current" : ""} ${value < 0 ? "bar-negative" : ""}`}
                style={{
                  height: `${Math.max((Math.abs(value) / range) * 100, 0.6)}%`,
                  bottom: `${((value < 0 ? value - min : -min) / range) * 100}%`,
                }}
              >
                <span>{money(value)}</span>
              </div>
            </div>
            <span className={`chart-month ${i === 0 ? "selected" : ""}`}>
              {new Intl.DateTimeFormat("pt-BR", {
                month: "short",
                timeZone: "UTC",
              })
                .format(new Date(`${m}-15T12:00:00Z`))
                .replace(".", "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
