import { UnstyledButton } from "@mantine/core";
import {
  LayoutDashboard,
  ArrowDownLeft,
  Plus,
  CreditCard,
  Ellipsis,
} from "lucide-react";
import "../ui/lists.css";
type Page = "overview" | "entries" | "card" | "settings";
export function MobileNav({
  current,
  onNavigate,
  onAdd,
  menuOpen,
}: {
  current: string;
  onNavigate: (page: Page) => void;
  onAdd: () => void;
  menuOpen: boolean;
}) {
  return (
    <nav
      className={`mobile-nav cr-mobile-nav ${menuOpen ? "menu-is-open" : ""}`}
      aria-label="Navegação do celular"
    >
      <UnstyledButton
        type="button"
        aria-label="Ir para visão geral"
        aria-current={current === "overview" ? "page" : undefined}
        className={current === "overview" ? "active" : ""}
        onClick={() => onNavigate("overview")}
      >
        <LayoutDashboard size={22} />
        <span>Início</span>
      </UnstyledButton>
      <UnstyledButton
        type="button"
        aria-label="Ver lançamentos"
        aria-current={current === "entries" ? "page" : undefined}
        className={current === "entries" ? "active" : ""}
        onClick={() => onNavigate("entries")}
      >
        <ArrowDownLeft size={23} />
        <span>Lançamentos</span>
      </UnstyledButton>
      <UnstyledButton
        type="button"
        className="mobile-add"
        aria-label="Adicionar lançamento"
        onClick={onAdd}
      >
        <span className="cr-mobile-add-circle">
          <Plus size={27} />
        </span>
        <span>Novo</span>
      </UnstyledButton>
      <UnstyledButton
        type="button"
        aria-label="Ver cartão compartilhado"
        aria-current={current === "card" ? "page" : undefined}
        className={current === "card" ? "active" : ""}
        onClick={() => onNavigate("card")}
      >
        <CreditCard size={23} />
        <span>Cartão</span>
      </UnstyledButton>
      <UnstyledButton
        type="button"
        aria-label="Abrir mais opções"
        aria-current={
          ["settings", "recurring"].includes(current) ? "page" : undefined
        }
        className={["settings", "recurring"].includes(current) ? "active" : ""}
        onClick={() => onNavigate("settings")}
      >
        <Ellipsis size={25} />
        <span>Mais</span>
      </UnstyledButton>
    </nav>
  );
}
