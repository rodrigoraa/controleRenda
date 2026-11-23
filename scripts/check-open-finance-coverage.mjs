import { pathToFileURL } from "node:url";

const api = "https://api.pluggy.ai";
const institutions = [
  {
    name: "Nubank",
    matches: /\b(?:nubank|nu pagamentos)\b/,
    products: ["ACCOUNTS", "TRANSACTIONS"],
  },
  {
    name: "Banco do Brasil",
    matches: /\bbanco do brasil\b/,
    products: ["ACCOUNTS", "TRANSACTIONS"],
  },
  {
    name: "Cartão Mercado Pago",
    matches: /\bmercado pago\b/,
    products: ["CREDIT_CARDS", "TRANSACTIONS"],
  },
];

function normalize(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function summarizeCoverage(connectors) {
  const official = connectors.filter(
    (connector) =>
      connector?.isOpenFinance === true &&
      connector.isSandbox === false &&
      typeof connector.name === "string",
  );
  return institutions.map(({ name, matches, products }) => ({
    institution: name,
    connectors: official
      .filter((connector) => matches.test(normalize(connector.name)))
      .map((connector) => {
        const available = Array.isArray(connector.products)
          ? connector.products.filter((product) =>
              ["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS"].includes(product),
            )
          : [];
        return {
          name: connector.name,
          id: connector.id,
          available,
          missing: products.filter((product) => !available.includes(product)),
        };
      }),
  }));
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${api}${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      ...options,
    });
  } catch {
    throw new Error("Não foi possível acessar api.pluggy.ai por HTTPS.");
  }
  if (!response.ok) {
    const operation =
      path === "/auth" ? "autenticação da aplicação" : "consulta ao catálogo";
    throw new Error(
      `A Pluggy não completou a ${operation} (HTTP ${response.status}).`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("A Pluggy respondeu em um formato inesperado.");
  }
}

async function main() {
  const { PLUGGY_CLIENT_ID: clientId, PLUGGY_CLIENT_SECRET: clientSecret } =
    process.env;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no terminal seguro. Use as chaves de desenvolvedor, não as credenciais do banco.",
    );
  }
  const { apiKey } = await requestJson("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, nonExpiring: false }),
  });
  if (typeof apiKey !== "string" || !apiKey)
    throw new Error("A Pluggy não retornou um token de aplicação.");
  const connectors = [];
  for (let page = 1; page <= 25; page++) {
    const query = new URLSearchParams({
      countries: "BR",
      isOpenFinance: "true",
      sandbox: "false",
      page: String(page),
    });
    const catalog = await requestJson(`/connectors?${query}`, {
      headers: { "X-API-KEY": apiKey },
    });
    if (
      !Array.isArray(catalog?.results) ||
      (page > 1 && catalog.page !== page)
    ) {
      throw new Error(
        "O catálogo retornou uma página inesperada; a cobertura continua sem confirmação.",
      );
    }
    connectors.push(...catalog.results);
    if (!Number.isInteger(catalog.totalPages) || page >= catalog.totalPages) {
      if (
        Number.isInteger(catalog.total) &&
        connectors.length < catalog.total
      ) {
        throw new Error(
          "O catálogo retornou resultados incompletos; a cobertura continua sem confirmação.",
        );
      }
      console.log(JSON.stringify(summarizeCoverage(connectors), null, 2));
      return;
    }
  }
  throw new Error(
    "A consulta chegou ao limite de páginas; a cobertura continua sem confirmação.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Não foi possível verificar o catálogo.",
    );
    process.exitCode = 1;
  }
}
