import { useState, type CSSProperties } from "react";
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

      setEmployee(data.employee);
      setErrors(data.errors || []);
      setBenefits(data.benefits || []);
      setSelectedPhoto(undefined);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    }

    setLoading(false);
  };

  const logout = () => {
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
                color: "#64748b",
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
      color: "#64748b",
      marginTop: 10,
    }}
  >
    Schválené přínosy
  </div>
</div>

          <div style={card}>
            <div style={label}>🏆 Moje skóre</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: "#2563eb",
              }}
            >
              {Math.max(0, 10 - errors.length)}
            </div>
            <div
              style={{
                color: "#64748b",
                marginTop: 10,
              }}
            >
              Aktuální skóre
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
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              📅 Požádat o schůzku
            </button>
          </div>

          <div style={card}>
            <div style={label}>📈 Aktivita</div>
            <div
              style={{
                fontSize: 38,
                fontWeight: "bold",
                color: "#8b5cf6",
              }}
            >
              0
            </div>
            <div
              style={{
                color: "#64748b",
                marginTop: 10,
              }}
            >
              Aktivit tento měsíc
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
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />

            <div style={{ marginTop: 15 }}>
              <button
                style={{
                  background: "#22c55e",
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
            border: "1px solid #e2e8f0",
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
                      new Date(b.zpusobeno).getTime() -
                      new Date(a.zpusobeno).getTime()
                  )
                  .map((item, index) => (
                    <tr
                      key={index}
                      style={{
                        background: item.foto
                          ? "#fefce8"
                          : index % 2 === 0
                            ? "#ffffff"
                            : "#f8fafc",
                      }}
                    >
                      <td style={td}>{formatDate(item.zpusobeno)}</td>
                      <td style={td}>{formatDate(item.reseno)}</td>
                      <td style={td}>
                        <span
                          style={{
                            background:
                              item.kategorie === "Picking"
                                ? "#fee2e2"
                                : item.kategorie === "Balení"
                                  ? "#dbeafe"
                                  : "#dcfce7",
                            color:
                              item.kategorie === "Picking"
                                ? "#991b1b"
                                : item.kategorie === "Balení"
                                  ? "#1e40af"
                                  : "#166534",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "bold",
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
