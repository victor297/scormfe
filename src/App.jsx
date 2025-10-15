// App.jsx
import React, { useState, useEffect } from "react";
import ScormPlayer from "./ScormPlayer";
import axios from "axios";

const App = () => {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scormPackages, setScormPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      loadScormPackages(token);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        "https://scorm-test-qcso.onrender.com/api/scorm/login",
        {
          email,
          password,
        }
      );

      const data = response.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      loadScormPackages(data.token);
    } catch (error) {
      alert(error.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        "https://scorm-test-qcso.onrender.com/api/scorm/register",
        {
          email,
          password,
        }
      );

      const data = response.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    } catch (error) {
      alert(error.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const loadScormPackages = async (token) => {
    try {
      const response = await axios.get(
        "https://scorm-test-qcso.onrender.com/api/scorm/scorm-packages",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setScormPackages(response.data);
    } catch (error) {
      console.error("Failed to load packages:", error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("scormFile", file);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "https://scorm-test-qcso.onrender.com/api/scorm/upload-scorm",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const newPackage = response.data;
      setScormPackages((prev) => [...prev, newPackage]);
      setShowUpload(false);
      alert("SCORM package uploaded successfully!");
    } catch (error) {
      alert(error.response?.data?.error || "Upload failed");
    }
  };

  const handleProgressUpdate = (progress) => {
    setScormPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === selectedPackage.id ? { ...pkg, userProgress: progress } : pkg
      )
    );
  };

  if (!user) {
    return (
      <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto" }}>
        <h2>SCORM LMS Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", margin: "5px 0", padding: "8px" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", margin: "5px 0", padding: "8px" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "10px", margin: "5px 0" }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <h3>Or Register</h3>
        <form onSubmit={handleRegister}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", margin: "5px 0", padding: "8px" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", margin: "5px 0", padding: "8px" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "10px", margin: "5px 0" }}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
      </div>
    );
  }

  if (selectedPackage) {
    return (
      <ScormPlayer
        packageId={selectedPackage.id}
        launchUrl={selectedPackage.launchUrl}
        onClose={() => setSelectedPackage(null)}
        onProgressUpdate={handleProgressUpdate}
      />
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>SCORM LMS</h1>
        <div>
          <span>Welcome, {user.email} </span>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              setUser(null);
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ margin: "20px 0" }}>
        <button onClick={() => setShowUpload(!showUpload)}>
          Upload SCORM Package
        </button>

        {showUpload && (
          <div style={{ margin: "10px 0" }}>
            <input type="file" accept=".zip" onChange={handleFileUpload} />
          </div>
        )}
      </div>

      <h2>Available Courses</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {scormPackages.map((pkg) => (
          <div
            key={pkg.id}
            style={{
              border: "1px solid #ddd",
              padding: "15px",
              borderRadius: "5px",
            }}
          >
            <h3>{pkg.title}</h3>
            <p>
              <strong>Version:</strong> {pkg.version}
            </p>
            <p>
              <strong>Organization:</strong> {pkg.organization}
            </p>
            <p>
              <strong>Progress:</strong> {pkg.userProgress.progress}%
            </p>
            <p>
              <strong>Score:</strong> {pkg.userProgress.score}
            </p>
            <p>
              <strong>Status:</strong> {pkg.userProgress.status}
            </p>
            <button
              onClick={() => setSelectedPackage(pkg)}
              style={{ width: "100%", padding: "10px", marginTop: "10px" }}
            >
              Launch Course
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
