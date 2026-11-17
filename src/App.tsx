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

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizePhotoUrl(raw: string): string {
  if (!raw) return "";

  const match = raw.match(/\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
  }

  return raw;
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbxl_lECjua0gAV6DA8UHsmrhRMDhwo2dJ39BbfFm0KsTesGp0wYJ0u7Nbg_LhQIOYrNDQ/exec";

const card: CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const label: CSSProperties = {
  color: "#475569",
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 10,
  textTransform: "uppercase",
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
  const isBrigadnik = [employee?.role, userRole].some((role) =>
    ["brigadnik", "brigádník"].includes(role?.trim().toLowerCase() ?? "")
  );

  const sortedForForgiveness = [...errors].sort(
    (a, b) =>
      new Date(a.reseno || "").getTime() -
      new Date(b.reseno || "").getTime()
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

  const currentMonth = new Date().toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
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

  const quality = Math.max(0, 100 - errors.length * 10);
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
      } catch {
        setError("Nepodařilo se spojit se serverem.");
      } finally {
        setInitialLoading(false);
      }
    }

    void restoreSession();
  }, [loadUserRole]);

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
            maxWidth: 800,
            margin: "50px auto",
            ...card,
          }}
        >
          <h2>⭐ Nahlášení přínosu</h2>

          <input
            type="text"
            value={benefitTitle}
            onChange={(e) => setBenefitTitle(e.target.value)}
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
            value={benefitDescription}
            onChange={(e) => setBenefitDescription(e.target.value)}
            placeholder="Detailní popis..."
            style={{
              width: "100%",
              minHeight: 150,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          />

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={handleBenefitSubmit}
              disabled={sendingBenefit}
              style={{
                background: "#22c55e",
                color: "white",
                border: "none",
                padding: "12px 18px",
                borderRadius: 8,
                cursor: sendingBenefit ? "not-allowed" : "pointer",
              }}
            >
              {sendingBenefit ? "Odesílám..." : "Odeslat"}
            </button>

            <button
              type="button"
              onClick={() => setPage("dashboard")}
              style={{
                background: "#94a3b8",
                color: "white",
                border: "none",
                padding: "12px 18px",
                borderRadius: 8,
                cursor: "pointer",
                marginLeft: 10,
              }}
            >
              Zpět
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "white",
          fontSize: "24px",
          fontWeight: "bold",
        }}
      >
        📊 Načítání aplikace...
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 420,
            background: "white",
            borderRadius: 24,
            padding: 40,
            boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 60,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            📊
          </div>

          <h1
            style={{
              textAlign: "center",
              marginBottom: 10,
              fontSize: 32,
            }}
          >
            Evidence chyb
          </h1>

          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              marginBottom: 30,
            }}
          >
            Přihlášení zaměstnance
          </p>

          <input
            type="text"
            placeholder="Osobní číslo"
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              marginBottom: 14,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              marginBottom: 14,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div
              style={{
                color: "#ef4444",
                marginBottom: 15,
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 12,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            {loading ? "Přihlašování..." : "Přihlásit"}
          </button>
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
                  Osobní číslo: {employee.personalNumber}
                </p>

                <p
                  style={{
                    color: "#fcfdff",
                    margin: "2px 0",
                    fontSize: 18,
                  }}
                >
                  Evidence chyb • {currentMonth}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {adminViewSnapshot && (
                <button
                  type="button"
                  onClick={returnToAdmin}
                  style={{
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: 19,
                    padding: "16px 25px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Zpět na můj účet
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                style={{
                  background: "#910528d7",
                  color: "white",
                  border: "none",
                  borderRadius: 19,
                  padding: "16px 25px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Odhlásit
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

        {!isBrigadnik && (
          <>
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

            <p>Počet zaměstnanců: {allUsers.length}</p>

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

            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                marginTop: 20,
              }}
            >
              {allUsers.map((user) => (
                <div
                  key={user.osCislo}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                >
                  {user.jmeno} | {user.osCislo} | {user.smena}
                </div>
              ))}
            </div>

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

          <div style={card}>
            <div style={label}>📊 Evidované chyby</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: qualityColor,
              }}
            >
              {errors.length}
            </div>
            <div
              style={{
                color: "#040505",
                marginTop: 10,
                fontSize: 18,
              }}
            >
              Počet evidovaných chyb
            </div>
          </div>

          {!adminViewSnapshot && (
          <div style={card}>
            <div style={label}>⭐ PŘÍNOS PRO SKLAD</div>
            <div
              style={{
                color: "#22c55e",
                fontWeight: "bold",
                fontSize: 18,
                marginBottom: 15,
              }}
            >
              Udělal jsi něco navíc?
            </div>

            <button type="button" onClick={() => setPage("benefit")}>
              ➕ Nahlásit přínos
            </button>
          </div>
          )}

          <div style={card}>
            <div style={label}>⭐ Přínosy</div>
            <div
              style={{
                marginTop: 15,
                lineHeight: 2,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              <div>⏳ Čekající: {approvedBenefits}</div>
              <div>🔄 Zpracovávány: {pendingBenefits}</div>
              <div>✅ Schválené: {rejectedBenefits}</div>
            </div>
            <div style={{ color: "#040405", marginTop: 10 }}>
              
            </div>
          </div>

          {(employee.role === "employee" || !employee.role) && (
            <div style={card}>
              <div style={label}>💰 Bonus</div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: "bold",
                  color: "#2563eb",
                }}
              >
                {currentBonus.toLocaleString("cs-CZ")} Kč
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: "#64748b",
                  fontSize: 13,
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

              <div style={{ marginTop: 10, color: "#334155" }}>
                Aktuální bonus z 2 000 Kč
              </div>

              <div
                style={{
                  color: "#64748b",
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Uzávěrka za {daysLeft} dní
              </div>
            </div>
          )}

          {!adminViewSnapshot && (
          <div style={card}>
            <div style={label}>🤝 Schůzky</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#f59e0b",
                marginBottom: 15,
              }}
            >
              Domluvit schůzku
            </div>
            <button
              type="button"
              onClick={() => alert("Musíme to opravit 🫡 .")}
              style={{
                width: "100%",
                background: "#0938b9",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 17,
              }}
            >
              📅 Požádat o schůzku
            </button>
          </div>
          )}

          <div style={card}>
            <div style={label}>⌚️ Docházka</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: "#8b5cf6",
              }}
            >
              {dochazkaBody}
            </div>
            <div
              style={{
                color: "#040505",
                marginTop: 10,
              }}
            >
              Body docházky tento měsíc
            </div>
          </div>
        </div>

        {errors.length === 0 && (
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
            🏆 Gratulujeme, nemáte evidované žádné chyby.
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
          </>
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
          <h3 style={{ marginTop: 0, marginBottom: 20 }}>📋 Historie chyb</h3>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, minWidth: "130px" }}>Způsobeno📆</th>
                <th style={{ ...th, minWidth: "130px" }}>Řešeno📅</th>
                <th style={th}>Kategorie</th>
                <th style={th}>FA/OBJ/BOX</th>
                <th style={th}>Popis chyby</th>
                <th style={th}>Foto</th>
              </tr>
            </thead>
            <tbody>
              {errors.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    Nebyly nalezeny žádné chyby.
                  </td>
                </tr>
              ) : (
                [...errors]
                  .sort(
                    (a, b) =>
                      new Date(b.reseno || "").getTime() -
                      new Date(a.reseno || "").getTime()
                  )
                  .map((item, index) => (
    <tr
      key={`${item.reference ?? "item"}-${index}`}
      style={{
        background: item.foto ? "#f8e42a" : "#ffffff",
      }}
    >
      <td style={td}>{formatDate(item.zpusobeno)}</td>

      <td style={td}>{formatDate(item.reseno)}</td>

      <td style={td}>
        {isBrigadnik ? (
          item.kategorie || "—"
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
          {item.kategorie || "—"}
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
              Bez dopadu na bonus
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
              setSelectedPhoto(normalizePhotoUrl(item.foto || ""))
            }
            title="Zobrazit fotografii"
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "16px",
            }}
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
            }}
          >
            <div
              style={{
                background: "white",
                padding: 20,
                borderRadius: 12,
                maxWidth: "80%",
                maxHeight: "80%",
                overflow: "hidden",
              }}
            >
              <img
                src={selectedPhoto}
                alt="Fotka chyby"
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "80vh",
                  borderRadius: 12,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
