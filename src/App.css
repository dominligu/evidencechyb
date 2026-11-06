import { useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxl_lECjua0gAV6DA8UHsmrhRMDhwo2dJ39BbfFm0KsTesGp0wYJ0u7Nbg_LhQIOYrNDQ/exec";

export default function App() {
  const [personalNumber, setPersonalNumber] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employee, setEmployee] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);

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
    } catch (err) {
      setError("Nepodařilo se spojit se serverem.");
    }

    setLoading(false);
  };

  const logout = () => {
    setEmployee(null);
    setErrors([]);
    setPersonalNumber("");
    setPin("");
    setError("");
  };

  if (!employee) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 400,
            background: "white",
            borderRadius: 16,
            padding: 30,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          }}
        >
          <h1
            style={{
              textAlign: "center",
              marginBottom: 30,
            }}
          >
            Evidence chyb
          </h1>

          <input
            type="text"
            placeholder="Osobní číslo"
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          {error && (
            <div
              style={{
                color: "red",
                marginBottom: 15,
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
              padding: 12,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
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
        background: "#f5f5f5",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 16,
            marginBottom: 20,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h2>{employee.name}</h2>

          <p>
            Osobní číslo: <b>{employee.personalNumber}</b>
          </p>

          <p>
            Celkem evidovaných chyb: <b>{errors.length}</b>
          </p>

          <button
            onClick={logout}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Odhlásit
          </button>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            overflowX: "auto",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h3>Historie chyb</h3>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Způsobeno</th>
                <th style={th}>Řešeno</th>
                <th style={th}>Kategorie</th>
                <th style={th}>FA / OBJ / BOX</th>
                <th style={th}>Popis chyby</th>
              </tr>
            </thead>

            <tbody>
              {errors.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: 20,
                      textAlign: "center",
                    }}
                  >
                    Nebyly nalezeny žádné chyby.
                  </td>
                </tr>
              ) : (
                errors.map((item, index) => (
                  <tr key={index}>
                    <td style={td}>{item.zpusobeno}</td>
                    <td style={td}>{item.reseno}</td>
                    <td style={td}>{item.kategorie}</td>
                    <td style={td}>{item.reference}</td>
                    <td style={td}>{item.popis}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: 12,
  textAlign: "left",
  background: "#f8fafc",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: 12,
};