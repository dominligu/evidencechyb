import { useState, useEffect, type CSSProperties } from "react";
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
    return `https://drive.google.com/file/d/${match[1]}/view`;
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
  letterSpacing: "0.5px",
};

const th: CSSProperties = {
  background: "#f1f5f9",
  color: "#0b50b1",
  borderBottom: "2px solid #cbd5e1",
  padding: "14px 14px",
  textAlign: "center",
  fontSize: 18,
  fontWeight: 900,
};

const td: CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: 14,
};

export default function App() {
  const [adminStats, setAdminStats] = useState<any>(null);
  const [userRole, setUserRole] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [personalNumber, setPersonalNumber] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [benefits, setBenefits] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | undefined>(undefined);
  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [benefitTitle, setBenefitTitle] = useState("");
  const [benefitDescription, setBenefitDescription] = useState("");
  const [sendingBenefit, setSendingBenefit] = useState(false);
  const [dochazkaBody, setDochazkaBody] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
  const savedPersonalNumber = localStorage.getItem("personalNumber");
  const savedPin = localStorage.getItem("pin");

  if (savedPersonalNumber && savedPin) {
    setPersonalNumber(savedPersonalNumber);
    setPin(savedPin);

    autoLogin(savedPersonalNumber, savedPin)
      .finally(() => setInitialLoading(false));
  } else {
    setInitialLoading(false);
  }
}, []);

  const autoLogin = async (savedPersonalNumber: string, savedPin: string) => {
    setLoading(true);
    setError("");

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
      console.log("AUTOLOGIN DATA:", data);

      if (!data.success) {
        setError(data.message || "Přihlášení se nezdařilo.");
        setLoading(false);
        return;
      }

      await loadUserRole(data.employee.personalNumber);
      setEmployee(data.employee);
      console.log("EMPLOYEE NASTAVEN");

localStorage.setItem(
  "employee",
  JSON.stringify(data.employee)
);

localStorage.setItem(
  "personalNumber",
  savedPersonalNumber
);

localStorage.setItem(
  "pin",
  savedPin
);
      setErrors(data.errors || []);
      setBenefits(data.benefits || []);
      setSelectedPhoto(undefined);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    }

    setLoading(false);
  };

  function calculateCurrentBonus() {
    let deduction = 0;

    const groupA = errors.filter(
      (e: { kategorie: string; }) => e.kategorie === "1. PROŠLO K ZÁKAZNÍKOVI" ||
        e.kategorie === "4. CHYBNÉ BALENÍ" ||
        e.kategorie === "6. PŘÍJEM REALIZACE"
    ).length;

    const groupB = errors.filter(
      (e: { kategorie: string; }) => e.kategorie === "2. ZPOŽDĚNÉ ODESLÁNÍ" ||
        e.kategorie === "5. PŘÍJEM"
    ).length;

    const groupC = errors.filter(
      (e: { kategorie: string; }) => e.kategorie === "3. ZASTAVENO KONTROLOU" ||
        e.kategorie === "7. NEPOŘÁDEK"
    ).length;

    deduction += groupA * 250;
    if (groupB > 1) deduction += (groupB - 1) * 100;
    if (groupC > 3) deduction += (groupC - 3) * 50;

    return Math.max(0, 2000 - deduction);
  }

  const currentBonus = calculateCurrentBonus();
  const bonusPercent = (currentBonus / 2000) * 100;

  useEffect(() => {
    if (!personalNumber) return;

    fetch(`${API_URL}?action=getDochazka&osCislo=${personalNumber}`)
      .then((res) => res.json())
      .then((data) => {
        setDochazkaBody(Number(data.body) || 0);
      })
      .catch((err) => console.error("Chyba načtení docházky:", err));
  }, [personalNumber]);
const calculateFinalBonusAfterAttendance = () => {
    const sortedErrors = [...errors].sort(
      (a, b) =>
        new Date(b.reseno || "").getTime() - new Date(a.reseno || "").getTime()
    );

    const remainingErrors = sortedErrors.slice(dochazkaBody);

    let deduction = 0;

    const groupA = remainingErrors.filter(
      (e) =>
        e.kategorie === "1. PROŠLO K ZÁKAZNÍKOVI" ||
        e.kategorie === "4. CHYBNÉ BALENÍ" ||
        e.kategorie === "6. PŘÍJEM REALIZACE"
    ).length;

    const groupB = remainingErrors.filter(
      (e) =>
        e.kategorie === "2. ZPOŽDĚNÉ ODESLÁNÍ" ||
        e.kategorie === "5. PŘÍJEM"
    ).length;

    const groupC = remainingErrors.filter(
      (e) =>
        e.kategorie === "3. ZASTAVENO KONTROLOU" ||
        e.kategorie === "7. NEPOŘÁDEK"
    ).length;

    deduction += groupA * 250;

    if (groupB > 3) {
      deduction += (groupB - 3) * 100;
    }

    if (groupC > 4) {
      deduction += (groupC - 4) * 50;
    }

    return Math.max(0, 2000 - deduction);
  };
  const finalBonus = calculateFinalBonusAfterAttendance();
  const quality = Math.max(0, 100 - errors.length * 10);
  const qualityColor =
    quality >= 90 ? "#22c55e" : quality >= 70 ? "#f59e0b" : "#ef4444";

  const currentMonth = new Date().toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });

  const approvedBenefits = benefits.filter(
    (b: any) => b.status === "Schváleno"
  ).length;

  const pendingBenefits = benefits.filter(
    (b: any) => b.status === "Čeká na schválení"
  ).length;

  const rejectedBenefits = benefits.filter(
    (b: any) => b.status === "Zamítnuto"
  ).length;

  const handleBenefitSubmit = async () => {
    if (!benefitTitle.trim()) {
      alert("Vyplň název přínosu.");
      return;
    }

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
    }

    setSendingBenefit(false);
  };
  async function loadUserRole(osCislo: any) {
    try {
      const response = await fetch(
        `${API_URL}?action=getUser&osCislo=${osCislo}`
      );

      const user = await response.json();

      setUserRole(user.role);

if (user.role === "superadmin") {

  const usersResponse = await fetch(
    `${API_URL}?action=getAllUsers`
  );

  const users = await usersResponse.json();

  setAllUsers(Array.isArray(users) ? users : []);

  const statsResponse = await fetch(
    `${API_URL}?action=getAdminStats`
  );

  const stats = await statsResponse.json();

  setAdminStats(stats);
}
    } catch (error) {
      console.error("Chyba načtení role:", error);
    }
  }
  const handleLogin = async () => {

    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          personalNumber,
          pin,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Přihlášení se nezdařilo.");
        setLoading(false);
        return;
      }

      await loadUserRole(data.employee.personalNumber);

      setEmployee(data.employee);
      localStorage.setItem(
  "personalNumber",
  personalNumber
);

localStorage.setItem(
  "pin",
  pin
);

      localStorage.setItem("employee",
      JSON.stringify(data.employee)
);
      setErrors(data.errors || []);
      setBenefits(data.benefits || []);
      setSelectedPhoto(undefined);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    }

    setLoading(false);
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
  };
  if (page === "benefit") {
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
              onClick={handleBenefitSubmit}
              disabled={sendingBenefit}
              style={{
                background: "#22c55e",
                color: "white",
                border: "none",
                padding: "12px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {sendingBenefit ? "Odesílám..." : "Odeslat"}
            </button>

            <button
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
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
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
            <div>
              <h2
                style={{
                  fontSize: 35,
                  fontWeight: 700,
                  margin: 0,
                  color: "#ffffff",
                }}
              >
                🤦🏽‍♀️ {employee.name}
              </h2>
              <p style={{ color: "#cbd5e1" }}>
                Osobní číslo: {employee.personalNumber}
              </p>
              <p style={{ color: "#fcfdff", margin: 2, fontSize: 18 }}>
                Evidence chyb • {currentMonth}
              </p>
            </div>

            <button
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

        {userRole === "superadmin" && (
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
    <div><strong>Směna:</strong> {employee.shift}</div>
    <div><strong>Pozice:</strong> {employee.position}</div>
    <div><strong>Vedoucí:</strong> {employee.manager}</div>
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

  <button
  onClick={() => setPage("benefit")}
>
  ➕ Nahlásit přínos
</button>
</div>
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
    <div>✅ Schválené: {approvedBenefits}</div>
    <div>⏳ Čekající: {pendingBenefits}</div>
    <div>❌ Zamítnuté: {rejectedBenefits}</div>
  </div>
  <div
    style={{
      color: "#040405",
      marginTop: 10,
    }}
  >
    Schválené přínosy
  </div>
</div>

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
    <div
  style={{
    marginTop: 10,
    color: "#64748b",
    fontSize: 13,
  }}
>
  Po uzávěrce: {finalBonus.toLocaleString("cs-CZ")} Kč
</div>
  </div>

  <div
    style={{
      width: "100%",
      height: 18,
      background: "#e5e7eb",
      borderRadius: "999px",
      overflow: "hidden",
      marginTop: 10,
      marginBottom: 10,
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

  <div
    style={{
      color: "#010205",
      marginTop: 10,
    }}
  >
    Aktuální bonus z 2 000 Kč
    <div
  style={{
    color: "#64748b",
    marginTop: 6,
    fontSize: 13,
  }}
>
  Uzávěrka za{" "}
  {new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate() - new Date().getDate()}{" "}
  dní
</div>
  </div>
</div>

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

        {showBenefitForm && (
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
                      key={index}
                      style={{
                        background: item.foto
                          ? "#f8e42a"
                          : index % 2 === 0
                            ? "#ffffff"
                            : "#ffffff",
                      }}
                    >
                      <td style={td}>{formatDate(item.zpusobeno)}</td>
                      <td style={td}>{formatDate(item.reseno)}</td>
                      <td style={td}>
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
        case "6. PŘÍJEM":
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
  {item.kategorie}
</span>
                      </td>
                      <td style={td}>{item.reference}</td>
                      <td style={td}>{item.popis}</td>
                      <td style={td}>
                        {item.foto ? (
                          <button
                            onClick={() =>
                              window.open(normalizePhotoUrl(item.foto), "_blank")
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
  );
}
