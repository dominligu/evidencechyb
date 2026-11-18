import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Employee = {
  personalNumber: string;
  name: string;
  shift?: string;
  position?: string;
  manager?: string;
  role?: string;
};

type ErrorEntry = {
  kategorie?: string;
  reference?: string;
  popis?: string;
  foto?: string;
  zpusobeno?: string | Date | null;
  reseno?: string | Date | null;
};

type Benefit = {
  status?: string;
};

type AdminUser = {
  jmeno: string;
  osCislo: string | number;
  smena?: string;
};

type AdminStats = {
  employeesCount: number;
  errorsCount: number;
};

type AdminViewSnapshot = {
  employee: Employee;
  errors: ErrorEntry[];
  benefits: Benefit[];
  dochazkaBody: number;
  userRole: string;
};

type AdminViewResponse = {
  success: boolean;
  message?: string;
  employee?: Employee;
  userRole?: string;
  errors?: ErrorEntry[];
  benefits?: Benefit[];
  dochazkaBody?: number | string;
};

type Language = "cs" | "en";

const translations = {
  cs: {
    evidence: "Evidence chyb",
    loading: "Načítání aplikace...",
    login: "Přihlásit",
    loggingIn: "Přihlašování...",
    loginSubtitle: "Přihlášení zaměstnance",
    personalNumber: "Osobní číslo",
    pin: "PIN",
    personalNumberLabel: "Osobní číslo:",
    benefitTitle: "Nahlášení přínosu",
    benefitPlaceholder: "Co jsi udělal pro sklad?",
    benefitDetail: "Detailní popis...",
    send: "Odeslat",
    sending: "Odesílám...",
    back: "Zpět",
    logout: "Odhlásit",
    returnToAdmin: "Zpět na můj účet",
    history: "Historie chyb",
    caused: "Způsobeno",
    resolved: "Řešeno",
    category: "Kategorie",
    reference: "FA/OBJ/BOX",
    description: "Popis chyby",
    photo: "Foto",
    noErrors: "Nebyly nalezeny žádné chyby.",
    noErrorsCongrats: "Gratulujeme, nemáte evidované žádné chyby.",
    photoTitle: "Zobrazit fotografii",
    photoAlt: "Fotka chyby",
    allGood: "Bez dopadu na bonus",
  },
  en: {
    evidence: "Error tracking",
    loading: "Loading application...",
    login: "Log in",
    loggingIn: "Logging in...",
    loginSubtitle: "Employee login",
    personalNumber: "Employee number",
    pin: "PIN",
    personalNumberLabel: "Employee number:",
    benefitTitle: "Report a contribution",
    benefitPlaceholder: "What did you do to help the warehouse?",
    benefitDetail: "Detailed description...",
    send: "Submit",
    sending: "Submitting...",
    back: "Back",
    logout: "Log out",
    returnToAdmin: "Back to my account",
    history: "Error history",
    caused: "Occurred",
    resolved: "Resolved",
    category: "Category",
    reference: "FA/OBJ/BOX",
    description: "Error description",
    photo: "Photo",
    noErrors: "No errors found.",
    noErrorsCongrats: "Congratulations, you have no recorded errors.",
    photoTitle: "View photo",
    photoAlt: "Error photo",
    allGood: "No impact on bonus",
  },
} as const;

function formatDate(value: unknown, language: Language): string {
  if (value === null || value === undefined || value === "") return "—";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseErrorDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim();
  const dotted = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s|$)/);
  if (dotted) {
    return new Date(
      Number(dotted[3]),
      Number(dotted[2]) - 1,
      Number(dotted[1])
    );
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getErrorMonthKey(value: unknown): string {
  const date = parseErrorDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeHistoryErrors(rawHistory: unknown): ErrorEntry[] {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory.map((raw) => {
    if (Array.isArray(raw)) {
      return {
        osoba: String(raw[1] ?? ""),
        zpusobeno: raw[2],
        reseno: raw[4],
        kategorie: String(raw[5] ?? ""),
        reference: String(raw[6] ?? ""),
        popis: String(raw[7] ?? ""),
        foto: String(raw[8] ?? ""),
      } as ErrorEntry;
    }
    if (!raw || typeof raw !== "object") return {};
    const row = raw as Record<string, unknown>;

    return {
      osoba: String(row.osoba ?? row.jmeno ?? row.name ?? ""),
      zpusobeno: row.zpusobeno ?? row.caused ?? row.datum ?? row.date,
      reseno: row.reseno ?? row.resolved ?? row.resenoDne,
      kategorie: String(row.kategorie ?? row.category ?? ""),
      reference: String(row.reference ?? row.ref ?? row.fafObjBox ?? ""),
      popis: String(row.popis ?? row.description ?? ""),
      foto: String(row.foto ?? row.photo ?? ""),
    } as ErrorEntry;
  }).filter((entry) =>
    entry.zpusobeno !== undefined ||
    entry.reseno !== undefined ||
    entry.kategorie ||
    entry.reference ||
    entry.popis
  );
}

function mergeErrorEntries(current: ErrorEntry[], history: ErrorEntry[]): ErrorEntry[] {
  const merged = new Map<string, ErrorEntry>();

  const getKey = (entry: ErrorEntry) =>
    [
      String(entry.zpusobeno ?? ""),
      String(entry.reseno ?? ""),
      entry.kategorie ?? "",
      entry.reference ?? "",
      entry.popis ?? "",
    ].join("|");

  current.forEach((entry) => merged.set(getKey(entry), entry));
  history.forEach((entry) => merged.set(getKey(entry), entry));
  return [...merged.values()];
}

function getDrivePhotoId(raw: string): string {
  const trimmed = raw.trim();

  const id = (
    trimmed.match(/\/d\/([^/?#]+)/)?.[1] ||
    trimmed.match(/[?&]id=([^&#]+)/)?.[1] ||
    ""
  ).replace(/&.*$/, "");

  return id ? decodeURIComponent(id) : "";
}

function getPhotoOriginalUrl(raw: string): string {
  const trimmed = raw.trim();
  const driveId =
    trimmed.match(/\/d\/([^/?#]+)/)?.[1] ||
    trimmed.match(/[?&]id=([^&#]+)/)?.[1];

  if (driveId) {
    return `https://drive.google.com/file/d/${decodeURIComponent(driveId)}/view`;
  }

  return trimmed;
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbxl_lECjua0gAV6DA8UHsmrhRMDhwo2dJ39BbfFm0KsTesGp0wYJ0u7Nbg_LhQIOYrNDQ/exec";

const card: CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  minHeight: 220,
  height: "100%",
};

const actionButtonBase: CSSProperties = {
  minHeight: 46,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  padding: "11px 18px",
  border: "1px solid transparent",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: ".1px",
  transition: "transform .16s ease, filter .16s ease, box-shadow .16s ease",
};

const primaryActionButton: CSSProperties = {
  ...actionButtonBase,
  color: "#fff",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  borderColor: "rgba(29, 78, 216, .7)",
  boxShadow: "0 8px 18px rgba(37, 99, 235, .22)",
};

const secondaryActionButton: CSSProperties = {
  ...actionButtonBase,
  minHeight: 42,
  color: "#1e293b",
  background: "linear-gradient(180deg, #fff, #f8fafc)",
  borderColor: "#dbe3ef",
  borderRadius: 999,
  boxShadow: "0 3px 9px rgba(15, 23, 42, .12)",
  fontSize: 13,
};

const dangerActionButton: CSSProperties = {
  ...actionButtonBase,
  color: "#fff",
  background: "linear-gradient(135deg, #be123c, #881337)",
  borderColor: "rgba(136, 19, 55, .7)",
  borderRadius: 999,
  boxShadow: "0 8px 18px rgba(136, 19, 55, .25)",
};

const photoActionButton: CSSProperties = {
  ...primaryActionButton,
  width: 40,
  minHeight: 38,
  padding: 0,
  borderRadius: 10,
  fontSize: 16,
};

const label: CSSProperties = {
  color: "#475569",
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 10,
  textTransform: "uppercase",
  minHeight: 28,
  lineHeight: "28px",
  display: "flex",
  alignItems: "center",
};

const th: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  fontSize: 14,
  color: "#1e293b",
};

const td: CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid #cbd5e1",
  verticalAlign: "top",
  color: "#334155",
};

export default function App() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("language") === "en" ? "en" : "cs")
  );
  const t = (key: keyof typeof translations.cs) =>
    translations[language][key];

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [personalNumber, setPersonalNumber] = useState(
    () => localStorage.getItem("personalNumber") || ""
  );
  const [pin, setPin] = useState(() => localStorage.getItem("pin") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(
    () => Boolean(localStorage.getItem("personalNumber") && localStorage.getItem("pin"))
  );
  const [page, setPage] = useState<"dashboard" | "benefit">("dashboard");
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | undefined>(undefined);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState(
    () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
  );
  const [benefitTitle, setBenefitTitle] = useState("");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [sendingBenefit, setSendingBenefit] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [dochazkaBody, setDochazkaBody] = useState(0);
  const [selectedAdminEmployee, setSelectedAdminEmployee] = useState("");
  const [adminViewSnapshot, setAdminViewSnapshot] =
    useState<AdminViewSnapshot | null>(null);
  const [adminViewLoading, setAdminViewLoading] = useState(false);
  const [adminViewError, setAdminViewError] = useState("");
  const toggleLanguage = () => {
    const nextLanguage = language === "cs" ? "en" : "cs";
    setLanguage(nextLanguage);
    localStorage.setItem("language", nextLanguage);
  };
  const translateCategory = (category?: string) => {
    if (language !== "en" || !category) return category || "—";
    const categoryTranslations: Record<string, string> = {
      "1. PROŠLO K ZÁKAZNÍKOVI": "1. Passed to customer",
      "2. ZPOŽDĚNÉ ODESLÁNÍ": "2. Delayed dispatch",
      "3. ZASTAVENO KONTROLOU": "3. Held by inspection",
      "4. CHYBNÉ BALENÍ": "4. Incorrect packaging",
      "5. PŘÍJEM": "5. Incoming goods",
      "6. PŘÍJEM REALIZACE": "6. Receiving / implementation",
      "7. NEPOŘÁDEK": "7. Untidy area",
    };
    return categoryTranslations[category] || category;
  };
  const normalizeRole = (value?: string) =>
    value
      ?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? "";

  const isBrigadnik = [employee?.role, employee?.position, userRole].some(
    (role) => normalizeRole(role) === "brigadnik"
  );

  const today = new Date();
  const currentMonthKey = getErrorMonthKey(today);
  const currentMonthErrors = errors.filter(
    (error) => getErrorMonthKey(error.reseno) === currentMonthKey
  );

  const sortedForForgiveness = [...currentMonthErrors].sort(
    (a, b) =>
      (parseErrorDate(a.reseno)?.getTime() ?? 0) -
      (parseErrorDate(b.reseno)?.getTime() ?? 0)
  );
  const groupAErrors = sortedForForgiveness.filter(
    (error) =>
      error.kategorie === "1. PROŠLO K ZÁKAZNÍKOVI" ||
      error.kategorie === "4. CHYBNÉ BALENÍ" ||
      error.kategorie === "6. PŘÍJEM REALIZACE"
  );
  const groupBErrors = sortedForForgiveness.filter(
    (error) =>
      error.kategorie === "2. ZPOŽDĚNÉ ODESLÁNÍ" ||
      error.kategorie === "5. PŘÍJEM"
  );
  const groupCErrors = sortedForForgiveness.filter(
    (error) =>
      error.kategorie === "3. ZASTAVENO KONTROLOU" ||
      error.kategorie === "7. NEPOŘÁDEK"
  );

  const automaticForgivenErrors = new Set<ErrorEntry>([
    ...groupBErrors.slice(0, 1),
    ...groupCErrors.slice(0, 3),
  ]);
  const deductionByError = new Map<ErrorEntry, number>();
  groupAErrors.forEach((error) => deductionByError.set(error, 250));
  groupBErrors.slice(1).forEach((error) => deductionByError.set(error, 100));
  groupCErrors.slice(3).forEach((error) => deductionByError.set(error, 50));
  const totalDeduction = [...deductionByError.values()].reduce(
    (total, deduction) => total + deduction,
    0
  );

  const currentMonth = new Date().toLocaleDateString(language === "en" ? "en-GB" : "cs-CZ", {
    month: "long",
    year: "numeric",
  });

  const historyMonthKeys = [...new Set([
    currentMonthKey,
    ...errors
      .map((error) => getErrorMonthKey(error.reseno))
      .filter(Boolean),
  ])].sort((a, b) => b.localeCompare(a));

  const selectedHistoryErrors = selectedHistoryMonth === "all"
    ? errors
    : errors.filter(
        (error) => getErrorMonthKey(error.reseno) === selectedHistoryMonth
      );

  const getPreviousMonthKey = (monthKey: string): string => {
    const [year, month] = monthKey.split("-").map(Number);
    const previous = new Date(year, month - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  };

  const previousHistoryMonthKey =
    selectedHistoryMonth === "all"
      ? ""
      : getPreviousMonthKey(selectedHistoryMonth);
  const previousHistoryErrors =
    previousHistoryMonthKey
      ? errors.filter(
          (error) => getErrorMonthKey(error.reseno) === previousHistoryMonthKey
        )
      : [];

  const daysLeft =
    new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() -
    today.getDate();

  const currentBonus = Math.max(0, 2000 - totalDeduction);
  const bonusPercent = (currentBonus / 2000) * 100;
  const attendanceCredit = Math.max(0, dochazkaBody * 50);
  const finalBonus = Math.max(
    0,
    Math.min(2000, 2000 - totalDeduction + attendanceCredit)
  );

  let remainingCredit = attendanceCredit;
  const forgivenByAttendance = new Set<ErrorEntry>();

  for (const error of sortedForForgiveness) {
    if (automaticForgivenErrors.has(error)) continue;

    const deduction = deductionByError.get(error);
    if (deduction === undefined || deduction > remainingCredit) continue;

    forgivenByAttendance.add(error);
    remainingCredit -= deduction;
  }

  const quality = Math.max(0, 100 - currentMonthErrors.length * 10);
  const qualityColor =
    quality >= 90 ? "#22c55e" : quality >= 70 ? "#f59e0b" : "#ef4444";

  const approvedBenefits = benefits.filter(
    (b) => b.status === "Čekající"
  ).length;

  const pendingBenefits = benefits.filter(
    (b) => b.status === "Zpracovány"
  ).length;

  const rejectedBenefits = benefits.filter(
    (b) => b.status === "Schválené"
  ).length;

  const loadUserRole = useCallback(async (osCislo: string) => {
    try {
      const response = await fetch(
        `${API_URL}?action=getUser&osCislo=${osCislo}`
      );

      const user = await response.json();
      const nextRole = user?.role || "";
      setUserRole(nextRole);

      if (nextRole === "superadmin") {
        const usersResponse = await fetch(`${API_URL}?action=getAllUsers`);
        const users = await usersResponse.json();
        setAllUsers(Array.isArray(users) ? users : []);

        const statsResponse = await fetch(`${API_URL}?action=getAdminStats`);
        const stats = await statsResponse.json();
        setAdminStats(stats || null);
      }
    } catch (err) {
      console.error("Chyba načtení role:", err);
    }
  }, []);

  const loadHistory = useCallback(async (osCislo: string) => {
    try {
      const response = await fetch(
        `${API_URL}?action=getHistory&osCislo=${encodeURIComponent(osCislo)}`
      );
      const data = await response.json();
      const rawHistory =
        data.history ?? data.errors ?? data.data ?? data.records ?? [];
      const historyEntries = normalizeHistoryErrors(rawHistory);

      if (historyEntries.length > 0) {
        setErrors((current) => mergeErrorEntries(current, historyEntries));
      }
    } catch (err) {
      console.error("Chyba načtení historie chyb:", err);
    }
  }, []);

  useEffect(() => {
    const savedPersonalNumber = localStorage.getItem("personalNumber");
    const savedPin = localStorage.getItem("pin");

    if (!savedPersonalNumber || !savedPin) {
      return;
    }

    async function restoreSession() {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            personalNumber: savedPersonalNumber,
            pin: savedPin,
          }),
        });

        const data = await response.json();

        if (!data.success || !data.employee) {
          localStorage.removeItem("employee");
          localStorage.removeItem("personalNumber");
          localStorage.removeItem("pin");
          setError(data.message || "Přihlášení se nezdařilo.");
          return;
        }

        const restoredEmployee = data.employee as Employee;
        setEmployee(restoredEmployee);
        setErrors(Array.isArray(data.errors) ? data.errors : []);
        setBenefits(Array.isArray(data.benefits) ? data.benefits : []);
        localStorage.setItem("employee", JSON.stringify(restoredEmployee));
        await loadUserRole(restoredEmployee.personalNumber);
        await loadHistory(restoredEmployee.personalNumber);
      } catch {
        setError("Nepodařilo se spojit se serverem.");
      } finally {
        setInitialLoading(false);
      }
    }

    void restoreSession();
  }, [loadUserRole, loadHistory]);

  const attendancePersonalNumber =
    adminViewSnapshot?.employee.personalNumber || personalNumber;

  useEffect(() => {
    if (!attendancePersonalNumber) return;

    fetch(`${API_URL}?action=getDochazka&osCislo=${attendancePersonalNumber}`)
      .then((res) => res.json())
      .then((data) => {
        setDochazkaBody(Number(data.body) || 0);
      })
      .catch((err) => console.error("Chyba načtení docházky:", err));
  }, [attendancePersonalNumber]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ personalNumber, pin }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Přihlášení se nezdařilo.");
        return;
      }

      const loggedEmployee = data.employee as Employee;
      await loadUserRole(loggedEmployee.personalNumber);
      setEmployee(loggedEmployee);
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setBenefits(Array.isArray(data.benefits) ? data.benefits : []);
      setSelectedPhoto(undefined);

      await loadHistory(loggedEmployee.personalNumber);

      localStorage.setItem("employee", JSON.stringify(loggedEmployee));
      localStorage.setItem("personalNumber", loggedEmployee.personalNumber);
      localStorage.setItem("pin", pin);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("employee");
    localStorage.removeItem("personalNumber");
    localStorage.removeItem("pin");
    setEmployee(null);
    setErrors([]);
    setBenefits([]);
    setPersonalNumber("");
    setPin("");
    setError("");
    setSelectedPhoto(undefined);
    setUserRole("");
    setAllUsers([]);
    setAdminStats(null);
    setPage("dashboard");
    setAdminViewSnapshot(null);
    setSelectedAdminEmployee("");
    setAdminViewError("");
  };

  const handleAdminView = async () => {
    if (
      !employee ||
      userRole !== "superadmin" ||
      !selectedAdminEmployee ||
      adminViewSnapshot
    ) {
      return;
    }

    setAdminViewLoading(true);
    setAdminViewError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "adminViewEmployee",
          adminPersonalNumber: employee.personalNumber,
          adminPin: pin,
          targetPersonalNumber: selectedAdminEmployee,
        }),
      });

      const data = (await response.json()) as AdminViewResponse;
      if (!data.success || !data.employee) {
        setAdminViewError(
          data.message || "Nepodařilo se načíst zaměstnance."
        );
        return;
      }

      setAdminViewSnapshot({
        employee,
        errors,
        benefits,
        dochazkaBody,
        userRole,
      });
      setEmployee(data.employee);
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setBenefits(Array.isArray(data.benefits) ? data.benefits : []);
      setDochazkaBody(Number(data.dochazkaBody) || 0);
      setUserRole(data.userRole || data.employee.role || "");
      await loadHistory(data.employee.personalNumber);
      setPage("dashboard");
    } catch {
      setAdminViewError("Nepodařilo se spojit se serverem.");
    } finally {
      setAdminViewLoading(false);
    }
  };

  const returnToAdmin = () => {
    if (!adminViewSnapshot) return;

    setEmployee(adminViewSnapshot.employee);
    setErrors(adminViewSnapshot.errors);
    setBenefits(adminViewSnapshot.benefits);
    setDochazkaBody(adminViewSnapshot.dochazkaBody);
    setUserRole(adminViewSnapshot.userRole);
    setAdminViewSnapshot(null);
    setSelectedAdminEmployee("");
    setAdminViewError("");
  };

  const handleBenefitSubmit = async () => {
    if (!benefitTitle.trim()) {
      alert("Vyplň název přínosu.");
      return;
    }

    if (!employee || adminViewSnapshot) return;

    setSendingBenefit(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "benefit",
          personalNumber: employee.personalNumber,
          name: employee.name,
          title: benefitTitle,
          description: benefitDescription,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Přínos byl odeslán.");
        setBenefitTitle("");
        setBenefitDescription("");
        setPage("dashboard");
      } else {
        alert(data.message || "Nepodařilo se uložit přínos.");
      }
    } catch {
      alert("Nepodařilo se spojit se serverem.");
    } finally {
      setSendingBenefit(false);
    }
  };

  if (page === "benefit" && !adminViewSnapshot) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to bottom right,#e2e8f0,#f8fafc)",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "clamp(16px, 6vh, 56px) auto",
            ...card,
            padding: "clamp(22px, 5vw, 36px)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <h2 style={{ color: "#172554", fontWeight: 750, margin: 0 }}>
              ⭐ {t("benefitTitle")}
            </h2>
            <button type="button" onClick={toggleLanguage} style={secondaryActionButton}>
              {language === "cs" ? "🇬🇧 English" : "🇨🇿 Čeština"}
            </button>
          </div>

          <input
            type="text"
            value={benefitTitle}
            onChange={(e) => setBenefitTitle(e.target.value)}
            placeholder={t("benefitPlaceholder")}
            aria-label={t("benefitPlaceholder")}
            className="benefit-form-field"
            style={{
              width: "100%",
              minHeight: 50,
              padding: "13px 15px",
              marginBottom: 12,
              borderRadius: 12,
              border: "1px solid #d5deea",
              background: "#f8fafc",
              color: "#0f172a",
              colorScheme: "light",
              fontSize: 15,
              boxShadow: "inset 0 1px 2px rgba(15, 23, 42, .03)",
            }}
          />

          <textarea
            value={benefitDescription}
            onChange={(e) => setBenefitDescription(e.target.value)}
            placeholder={t("benefitDetail")}
            aria-label={t("benefitDetail")}
            className="benefit-form-field"
            style={{
              width: "100%",
              minHeight: 180,
              padding: "14px 15px",
              borderRadius: 12,
              border: "1px solid #d5deea",
              background: "#f8fafc",
              color: "#0f172a",
              colorScheme: "light",
              fontFamily: "inherit",
              fontSize: 15,
              lineHeight: 1.6,
              resize: "vertical",
              boxShadow: "inset 0 1px 2px rgba(15, 23, 42, .03)",
            }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <button
              type="button"
              onClick={handleBenefitSubmit}
              disabled={sendingBenefit}
              style={{
                ...primaryActionButton,
                minWidth: 130,
                opacity: sendingBenefit ? 0.65 : 1,
                cursor: sendingBenefit ? "not-allowed" : "pointer",
              }}
            >
              <span aria-hidden="true">➤</span>
              {sendingBenefit ? t("sending") : t("send")}
            </button>

            <button
              type="button"
              onClick={() => setPage("dashboard")}
              style={secondaryActionButton}
            >
              <span aria-hidden="true">←</span>
              {t("back")}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (initialLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "radial-gradient(circle at 78% 18%, rgba(59,130,246,.28), transparent 28%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        }}
      >
        <div style={{ color: "white", display: "flex", alignItems: "center", gap: 14, fontSize: 18, fontWeight: 700 }}>
          <span style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)" }}>📊</span>
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 78% 18%, rgba(59,130,246,.32), transparent 25%), radial-gradient(circle at 12% 82%, rgba(37,99,235,.24), transparent 30%), linear-gradient(135deg, #0f172a 0%, #172554 58%, #1e3a8a 100%)",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(440px, 100%)",
            background: "rgba(255,255,255,.98)",
            borderRadius: 28,
            padding: "28px 34px 34px",
            boxShadow: "0 30px 80px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.8)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button type="button" onClick={toggleLanguage} style={secondaryActionButton}>
              {language === "cs" ? "🇬🇧 English" : "🇨🇿 Čeština"}
            </button>
          </div>
          <div
            style={{
              width: 78,
              height: 78,
              margin: "4px auto 14px",
              borderRadius: 22,
              background: "linear-gradient(145deg,#eff6ff,#dbeafe)",
              boxShadow: "0 12px 28px rgba(37,99,235,.14)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 5,
              padding: "20px 16px",
              textAlign: "center",
              fontSize: 0,
            }}
          >
            <span style={{ width: 12, height: 28, borderRadius: 4, background: "#60a5fa" }} />
            <span style={{ width: 12, height: 38, borderRadius: 4, background: "#22c55e" }} />
            <span style={{ width: 12, height: 22, borderRadius: 4, background: "#ec4899" }} />
            <span style={{ width: 12, height: 32, borderRadius: 4, background: "#2563eb" }} />
          </div>

          <h1
            style={{
              textAlign: "center",
              margin: "0 0 6px",
              fontSize: 30,
              lineHeight: 1.2,
              color: "#172554",
              letterSpacing: "-0.8px",
            }}
          >
            {t("evidence")}
          </h1>

          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              marginBottom: 24,
              fontSize: 15,
            }}
          >
            {t("loginSubtitle")}
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 700, marginBottom: 7 }}>
              {t("personalNumber")}
            </label>
            <input
              type="text"
              autoComplete="username"
              placeholder={t("personalNumber")}
              value={personalNumber}
              onChange={(e) => setPersonalNumber(e.target.value)}
              style={{
                width: "100%",
                height: 52,
                padding: "0 16px",
                marginBottom: 16,
                borderRadius: 12,
                border: "1px solid #dbe3ef",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 16,
                outline: "none",
              }}
            />

            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 700, marginBottom: 7 }}>
              PIN
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{
                width: "100%",
                height: 52,
                padding: "0 16px",
                marginBottom: 18,
                borderRadius: 12,
                border: "1px solid #dbe3ef",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 16,
                outline: "none",
              }}
            />

            {error && (
              <div
                role="alert"
                style={{
                  color: "#dc2626",
                  marginBottom: 14,
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 52,
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                color: "white",
                border: "none",
                borderRadius: 12,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 800,
                fontSize: 16,
                boxShadow: "0 12px 24px rgba(37,99,235,.24)",
                opacity: loading ? 0.72 : 1,
              }}
            >
              {loading ? t("loggingIn") : t("login")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right,#e2e8f0,#f8fafc)",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg,#1e293b,#0f172a)",
            color: "white",
            padding: 30,
            borderRadius: 24,
            marginBottom: 30,
            boxShadow: "0 30px 40px rgba(34, 161, 34, 0.72)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 15,
              }}
            >
            <img
  src="/3.png"
  alt="MDC"
  style={{
    width: 112,
    height: 98,
    objectFit: "contain",
  }}
/>

              <div>
                <h2
                  style={{
                    fontSize: 35,
                    fontWeight: 700,
                    margin: 0,
                    color: "#ffffff",
                  }}
                >
                  {employee.name}
                </h2>

                <p
                  style={{
                    color: "#cbd5e1",
                    margin: "2px 0",
                  }}
                >
                  {t("personalNumberLabel")} {employee.personalNumber}
                </p>

                <p
                  style={{
                    color: "#fcfdff",
                    margin: "2px 0",
                    fontSize: 18,
                  }}
                >
                  {t("evidence")} • {currentMonth}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={toggleLanguage}
                style={secondaryActionButton}
              >
                {language === "cs" ? "🇬🇧 English" : "🇨🇿 Čeština"}
              </button>
              {adminViewSnapshot && (
                <button
                  type="button"
                  onClick={returnToAdmin}
                  style={{ ...primaryActionButton, borderRadius: 999 }}
                >
                  {t("returnToAdmin")}
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                style={dangerActionButton}
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>

        {adminViewSnapshot && (
          <div
            style={{
              background: "#dbeafe",
              color: "#1e3a8a",
              padding: "12px 18px",
              borderRadius: 12,
              marginBottom: 20,
              fontWeight: 700,
            }}
          >
            Režim zobrazení pouze pro čtení: {employee.name} (
            {employee.personalNumber})
          </div>
        )}

        {userRole === "superadmin" && !adminViewSnapshot && (
          <div
            style={{
              background: "linear-gradient(135deg,#dc2626,#991b1b)",
              color: "white",
              padding: 25,
              borderRadius: 24,
              marginBottom: 25,
              boxShadow: "0 15px 30px rgba(220,38,38,0.3)",
            }}
          >
            <h2 style={{ margin: 0 }}>👑 SUPERADMIN DASHBOARD</h2>

            {adminStats && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 15,
                  marginBottom: 20,
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    background: "#2563eb",
                    padding: 20,
                    borderRadius: 16,
                  }}
                >
                  <div>👥 Zaměstnanci</div>
                  <h2>{adminStats.employeesCount}</h2>
                </div>

                <div
                  style={{
                    background: "#dc2626",
                    padding: 20,
                    borderRadius: 16,
                  }}
                >
                  <div>⚠️ Chyby</div>
                  <h2>{adminStats.errorsCount}</h2>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 15,
              }}
            >
              <select
                aria-label="Vybrat zaměstnance pro zobrazení"
                value={selectedAdminEmployee}
                onChange={(event) => {
                  setSelectedAdminEmployee(event.target.value);
                  setAdminViewError("");
                }}
                style={{
                  flex: "1 1 240px",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="">Vyberte zaměstnance...</option>
                {allUsers
                  .filter(
                    (user) =>
                      String(user.osCislo) !== String(employee.personalNumber)
                  )
                  .map((user) => (
                    <option key={user.osCislo} value={String(user.osCislo)}>
                      {user.jmeno} | {user.osCislo}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAdminView}
                disabled={!selectedAdminEmployee || adminViewLoading}
                style={{
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 18px",
                  cursor:
                    !selectedAdminEmployee || adminViewLoading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {adminViewLoading ? "Načítám..." : "Zobrazit pouze pro čtení"}
              </button>
            </div>
            {adminViewError && (
              <p role="alert" style={{ color: "#fecaca" }}>
                {adminViewError}
              </p>
            )}

            <p style={{ marginTop: 10 }}>Přihlášen jako SuperAdmin.</p>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 35,
            marginBottom: 45,
          }}
        >
          {!isBrigadnik && (
          <div style={card}>
            <div style={label}>👤 MŮJ PROFIL</div>
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.8,
                color: "#334155",
              }}
            >
              <div>
                <strong>Směna:</strong> {employee.shift || "—"}
              </div>
              <div>
                <strong>Pozice:</strong> {employee.position || "—"}
              </div>
              {employee.manager && (
                <div>
                  <strong>Vedoucí:</strong> {employee.manager}
                </div>
              )}
            </div>
          </div>
          )}

          {!isBrigadnik && (
          <div style={card}>
            <div style={{ ...label, justifyContent: "center" }}>📊 Evidované chyby</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: qualityColor,
                textAlign: "center",
              }}
            >
              {currentMonthErrors.length}
            </div>
            <div
              style={{
                color: "#040505",
                marginTop: 10,
                fontSize: 18,
                textAlign: "center",
              }}
            >
              Počet evidovaných chyb
            </div>
          </div>
          )}

          {!adminViewSnapshot &&
            normalizeRole(employee?.position) !== "brigadnik" &&
            normalizeRole(employee?.role) !== "brigadnik" &&
            normalizeRole(userRole) !== "brigadnik" && (
          <div style={card}>
            <div style={{ ...label, justifyContent: "center", textAlign: "center" }}>⭐ PŘÍNOS PRO SKLAD</div>
            <div
              style={{
                color: "#22c55e",
                fontWeight: "bold",
                fontSize: 18,
                marginBottom: 15,
                textAlign: "center",
              }}
            >
              Udělal jsi něco navíc?
            </div>

            <button
              type="button"
              onClick={() => setPage("benefit")}
              style={{ ...primaryActionButton, width: "100%" }}
            >
              <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>＋</span>
              Nahlásit přínos
            </button>
          </div>
          )}

          {!isBrigadnik && (
          <div style={card}>
            <div style={{ ...label, justifyContent: "center" }}>⭐ Přínosy</div>
            <div
              style={{
                marginTop: 15,
                lineHeight: 2,
                fontSize: 16,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <div>⏳ Čekající: {approvedBenefits}</div>
              <div>🔄 Zpracovávány: {pendingBenefits}</div>
              <div>✅ Schválené: {rejectedBenefits}</div>
            </div>
            <div style={{ color: "#040405", marginTop: 10 }}>
              
            </div>
          </div>
          )}

          {(employee.role === "employee" || !employee.role) && (
            <div style={card}>
              <div style={{ ...label, justifyContent: "center" }}>💰 Bonus</div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: "bold",
                  color: "#2563eb",
                  textAlign: "center",
                }}
              >
                {currentBonus.toLocaleString("cs-CZ")} Kč
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: "#64748b",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Po uzávěrce: {finalBonus.toLocaleString("cs-CZ")} Kč
              </div>

              <div
                style={{
                  width: "100%",
                  height: 18,
                  background: "#e5e7eb",
                  borderRadius: "999px",
                  overflow: "hidden",
                  marginTop: 15,
                }}
              >
                <div
                  style={{
                    width: `${bonusPercent}%`,
                    height: "100%",
                    background:
                      bonusPercent >= 75
                        ? "#22c55e"
                        : bonusPercent >= 50
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                />
              </div>

              <div style={{ marginTop: 10, color: "#334155", textAlign: "center" }}>
                Aktuální bonus z 2 000 Kč
              </div>

              <div
                style={{
                  color: "#64748b",
                  marginTop: 6,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Uzávěrka za {daysLeft} dní
              </div>
            </div>
          )}

          {!adminViewSnapshot &&
            normalizeRole(employee?.position) !== "brigadnik" &&
            normalizeRole(employee?.role) !== "brigadnik" &&
            normalizeRole(userRole) !== "brigadnik" && (
          <div style={card}>
            <div style={{ ...label, justifyContent: "center" }}>🤝 Schůzky</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#f59e0b",
                marginBottom: 15,
                textAlign: "center",
              }}
            >
              Domluvit schůzku
            </div>
            <button
              type="button"
              onClick={() => alert("Musíme to opravit 🫡 .")}
              style={{ ...primaryActionButton, width: "100%" }}
            >
              📅 Požádat o schůzku
            </button>
          </div>
          )}

          {!isBrigadnik && (
          <div style={card}>
            <div style={{ ...label, justifyContent: "center" }}>⌚️ Docházka</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: "#8b5cf6",
                textAlign: "center",
              }}
            >
              {dochazkaBody}
            </div>
            <div
              style={{
                color: "#040505",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Body docházky tento měsíc
            </div>
          </div>
          )}
        </div>

        {currentMonthErrors.length === 0 && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: 20,
              borderRadius: 16,
              marginBottom: 20,
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            🏆 {t("noErrorsCongrats")}
          </div>
        )}

        {!adminViewSnapshot && showBenefitForm && (
          <div
            style={{
              ...card,
              marginBottom: 20,
            }}
          >
            <h3>⭐ Nahlášení přínosu</h3>

            <input
              type="text"
              placeholder="Co jsi udělal pro sklad?"
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />

            <textarea
              placeholder="Detailní popis..."
              style={{
                width: "100%",
                minHeight: 120,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #c8cfd6",
                boxSizing: "border-box",
              }}
            />

            <div style={{ marginTop: 15 }}>
              <button
                type="button"
                style={{
                  background: "#26d420",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  marginRight: 10,
                }}
              >
                Odeslat
              </button>

              <button
                type="button"
                onClick={() => setShowBenefitForm(false)}
                style={{
                  background: "#94a3b8",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: 24,
            border: "1px solid #1f569c",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <h3 style={{ margin: 0 }}>📋 {t("history")}</h3>
            <select
              aria-label={language === "cs" ? "Vybrat měsíc historie" : "Select history month"}
              value={selectedHistoryMonth}
              onChange={(event) => setSelectedHistoryMonth(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "white",
                color: "#334155",
                fontWeight: 700,
              }}
            >
              {historyMonthKeys.map((monthKey) => {
                const [year, month] = monthKey.split("-").map(Number);
                const label = new Date(year, month - 1, 1).toLocaleDateString(
                  language === "en" ? "en-GB" : "cs-CZ",
                  { month: "long", year: "numeric" }
                );
                return (
                  <option key={monthKey} value={monthKey}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                );
              })}
              <option value="all">
                {language === "cs" ? "Všechny měsíce" : "All months"}
              </option>
            </select>
          </div>

          {selectedHistoryMonth !== "all" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                color: "#1e3a8a",
              }}
            >
              <strong>
                {language === "cs"
                  ? `Chyby v tomto měsíci: ${selectedHistoryErrors.length}`
                  : `Errors this month: ${selectedHistoryErrors.length}`}
              </strong>
              {previousHistoryMonthKey && (
                <span>
                  {language === "cs"
                    ? `Minulý měsíc: ${previousHistoryErrors.length} • `
                    : `Previous month: ${previousHistoryErrors.length} • `}
                  {selectedHistoryErrors.length < previousHistoryErrors.length
                    ? (language === "cs" ? "Výborně, máme zlepšení!" : "Great, we improved!")
                    : selectedHistoryErrors.length === previousHistoryErrors.length
                      ? (language === "cs" ? "Stejný počet jako minulý měsíc." : "Same as the previous month.")
                      : (language === "cs" ? "Máme prostor na zlepšení." : "We have room to improve.")}
                </span>
              )}
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, minWidth: "130px" }}>{t("caused")} 📆</th>
                <th style={{ ...th, minWidth: "130px" }}>{t("resolved")} 📅</th>
                <th style={th}>{t("category")}</th>
                <th style={th}>{t("reference")}</th>
                <th style={th}>{t("description")}</th>
                <th style={th}>{t("photo")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedHistoryErrors.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    {t("noErrors")}
                  </td>
                </tr>
              ) : (
                [...selectedHistoryErrors]
                  .sort(
                    (a, b) =>
                      (parseErrorDate(b.reseno)?.getTime() ?? 0) -
                      (parseErrorDate(a.reseno)?.getTime() ?? 0)
                  )
                  .map((item, index) => (
    <tr
      key={`${item.reference ?? "item"}-${index}`}
      style={{
        background: item.foto ? "#f8e42a" : "#ffffff",
      }}
    >
      <td style={td}>{formatDate(item.zpusobeno, language)}</td>

      <td style={td}>{formatDate(item.reseno, language)}</td>

      <td style={td}>
        {isBrigadnik ? (
          translateCategory(item.kategorie)
        ) : (
        <span
          style={{
            background: (() => {
              switch (item.kategorie) {
                case "1. PROŠLO K ZÁKAZNÍKOVI":
                  return "#FEE2E2";
                case "2. ZPOŽDĚNÉ ODESLÁNÍ":
                  return "#FFEDD5";
                case "3. ZASTAVENO KONTROLOU":
                  return "#FEF3C7";
                case "4. CHYBNÉ BALENÍ":
                  return "#EDE9FE";
                case "5. PŘÍJEM":
                  return "#DCFCE7";
                case "6. PŘÍJEM REALIZACE":
                  return "#CFFAFE";
                case "7. NEPOŘÁDEK":
                  return "#DBEAFE";
                default:
                  return "#F3F4F6";
              }
            })(),
            color: (() => {
              switch (item.kategorie) {
                case "1. PROŠLO K ZÁKAZNÍKOVI":
                  return "#B91C1C";
                case "2. ZPOŽDĚNÉ ODESLÁNÍ":
                  return "#C2410C";
                case "3. ZASTAVENO KONTROLOU":
                  return "#92400E";
                case "4. CHYBNÉ BALENÍ":
                  return "#6D28D9";
                case "5. PŘÍJEM":
                  return "#15803D";
                case "6. PŘÍJEM REALIZACE":
                  return "#0F766E";
                case "7. NEPOŘÁDEK":
                  return "#1D4ED8";
                default:
                  return "#374151";
              }
            })(),
            padding: "6px 12px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 700,
            display: "inline-block",
            textAlign: "center",
          }}
        >
          {translateCategory(item.kategorie)}
        </span>
        )}

        {!isBrigadnik && (
        <div style={{ marginTop: 6 }}>
          {automaticForgivenErrors.has(item) ||
          forgivenByAttendance.has(item) ? (
            <span
              style={{
                background: automaticForgivenErrors.has(item)
                  ? "#2563eb"
                  : "#22c55e",
                color: "white",
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {automaticForgivenErrors.has(item)
                ? "✅ Odpuštěno automaticky"
                : "✅ Odpuštěno docházkou"}
            </span>
          ) : deductionByError.has(item) ? (
            <span
              style={{
                background: "#ef4444",
                color: "white",
                padding: "4px 8px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 700,
                minWidth: 130,
                textAlign: "center"
              }}
            >
              ❌ Ovlivňuje bonus
            </span>
          ) : (
            <span
              style={{
                background: "#e2e8f0",
                color: "#475569",
                padding: "4px 8px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {t("allGood")}
            </span>
          )}
        </div>
        )}
      </td>

      <td style={td}>{item.reference || "—"}</td>

      <td style={td}>{item.popis || "—"}</td>

      <td style={td}>
        {item.foto ? (
          <button
            type="button"
            onClick={() =>
              setSelectedPhoto(item.foto || "")
            }
            title={t("photoTitle")}
            aria-label={t("photoTitle")}
            style={photoActionButton}
          >
            📷
          </button>
        ) : (
          "-"
        )}
      </td>
    </tr>
                  ))
  )}
            </tbody>
          </table>
        </div>

        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(undefined)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                background: "white",
                padding: 20,
                borderRadius: 12,
                maxWidth: "90vw",
                maxHeight: "90vh",
                overflow: "auto",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
                <a
                  href={getPhotoOriginalUrl(selectedPhoto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1d4ed8",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    padding: "8px 10px",
                  }}
                >
                  {language === "cs" ? "Otevřít původní" : "Open original"}
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(undefined)}
                  style={{
                    border: "none",
                    background: "#e2e8f0",
                    color: "#334155",
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                  aria-label={language === "cs" ? "Zavřít fotografii" : "Close photo"}
                >
                  ×
                </button>
              </div>
              {getDrivePhotoId(selectedPhoto) ? (
                <iframe
                  key={selectedPhoto}
                  title={t("photoAlt")}
                  src={`https://drive.google.com/file/d/${getDrivePhotoId(selectedPhoto)}/preview`}
                  style={{
                    display: "block",
                    width: "80vw",
                    height: "80vh",
                    maxWidth: 1000,
                    maxHeight: 800,
                    border: "none",
                    borderRadius: 12,
                    background: "#f8fafc",
                  }}
                  allow="fullscreen"
                />
              ) : (
                <img
                  key={selectedPhoto}
                  src={selectedPhoto}
                  alt={t("photoAlt")}
                  style={{
                    display: "block",
                    maxWidth: "80vw",
                    maxHeight: "80vh",
                    borderRadius: 12,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
