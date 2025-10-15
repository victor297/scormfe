// ScormPlayer.jsx
import React, { useState, useEffect, useRef } from "react";
import { Scorm12API, Scorm2004API } from "scorm-again";
import axios from "axios";

const ScormPlayer = ({ packageId, launchUrl, onClose, onProgressUpdate }) => {
  const iframeRef = useRef(null);
  const scormAPIRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [scormData, setScormData] = useState({});
  const [scormVersion, setScormVersion] = useState("1.2");

  // Function to get all SCORM data by reading individual values
  const getAllScormData = (scormAPI) => {
    const data = {};

    // Common SCORM 1.2 data elements
    const scorm12Elements = [
      "cmi.core.student_name",
      "cmi.core.student_id",
      "cmi.core.lesson_status",
      "cmi.core.score.raw",
      "cmi.core.score.max",
      "cmi.core.score.min",
      "cmi.core.lesson_location",
      "cmi.core.entry",
      "cmi.suspend_data",
      "cmi.launch_data",
      "cmi.core.session_time",
      "cmi.core.total_time",
    ];

    // Common SCORM 2004 data elements
    const scorm2004Elements = [
      "cmi.completion_status",
      "cmi.success_status",
      "cmi.score.raw",
      "cmi.score.max",
      "cmi.score.min",
      "cmi.location",
      "cmi.entry",
      "cmi.suspend_data",
      "cmi.launch_data",
      "cmi.session_time",
      "cmi.total_time",
      "cmi.progress_measure",
    ];

    // Try to get SCORM 1.2 values
    scorm12Elements.forEach((element) => {
      try {
        const value = scormAPI.LMSGetValue(element);
        if (value !== "" && value !== null) {
          data[element] = value;
        }
      } catch (error) {
        // Ignore errors for elements that don't exist
      }
    });

    // Try to get SCORM 2004 values
    scorm2004Elements.forEach((element) => {
      try {
        const value = scormAPI.LMSGetValue(element);
        if (value !== "" && value !== null) {
          data[element] = value;
        }
      } catch (error) {
        // Ignore errors for elements that don't exist
      }
    });

    return data;
  };

  // Initialize SCORM API
  const initializeSCORM = async () => {
    try {
      const token = localStorage.getItem("token");

      // Load existing progress
      const response = await axios.get(
        `http://localhost:3001/api/progress/${packageId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const progressData = response.data;
      const version = progressData.scormData?.version || "1.2";
      setScormVersion(version);

      // SCORM settings
      const settings = {
        debug: true,
        // You can add initial suspend data if needed
        // suspend_data: progressData.scormData?.suspend_data || ''
      };

      let scormAPI;

      // Initialize the appropriate SCORM API
      if (version === "2004") {
        scormAPI = new Scorm2004API(settings);
        window.API_1484_11 = scormAPI;
        window.API = scormAPI; // Some content might look for this
      } else {
        scormAPI = new Scorm12API(settings);
        window.API = scormAPI;
        // Also set 2004 API for compatibility
        window.API_1484_11 = scormAPI;
      }

      // Set up event listeners if they exist
      if (scormAPI.on) {
        scormAPI.on("commit", handleScormCommit);
        scormAPI.on("error", handleScormError);
      }

      scormAPIRef.current = scormAPI;

      // Initialize the SCORM connection
      const initResult = scormAPI.initialize();
      console.log("SCORM Initialize result:", initResult);

      if (initResult) {
        setIsInitialized(true);
        console.log("SCORM API initialized successfully for version:", version);

        // Load initial data using our custom function
        const currentData = getAllScormData(scormAPI);
        setScormData(currentData);

        // Restore saved data if it exists
        if (progressData.scormData) {
          Object.keys(progressData.scormData).forEach((key) => {
            if (key !== "version" && progressData.scormData[key]) {
              try {
                scormAPI.LMSSetValue(key, progressData.scormData[key]);
              } catch (error) {
                console.warn(`Failed to restore ${key}:`, error);
              }
            }
          });
        }
      } else {
        console.error("SCORM Initialize failed");
      }
    } catch (error) {
      console.error("Failed to initialize SCORM:", error);
    }
  };

  const handleScormCommit = async () => {
    try {
      console.log("SCORM Commit triggered");
      await saveProgressToServer();
    } catch (error) {
      console.error("Failed to save progress on commit:", error);
    }
  };

  const handleScormError = (error) => {
    console.error("SCORM Error:", error);
  };

  const saveProgressToServer = async () => {
    if (!scormAPIRef.current) return;

    try {
      const token = localStorage.getItem("token");
      const currentData = getAllScormData(scormAPIRef.current);
      setScormData(currentData);

      // Extract progress information from SCORM data
      const score = parseFloat(
        currentData["cmi.core.score.raw"] || currentData["cmi.score.raw"] || 0
      );

      const status =
        currentData["cmi.core.lesson_status"] ||
        currentData["cmi.completion_status"] ||
        "incomplete";

      const progress = calculateProgress(currentData);

      const progressData = {
        score,
        progress,
        status,
        scormData: {
          ...currentData,
          version: scormVersion,
          lastSaved: new Date().toISOString(),
        },
      };

      await axios.post(
        `http://localhost:3001/api/progress/${packageId}`,
        progressData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      onProgressUpdate(progressData);
      console.log("Progress saved successfully");
    } catch (error) {
      console.error("Failed to save progress to server:", error);
    }
  };

  const calculateProgress = (data) => {
    // Try to get progress from SCORM 2004 data
    if (data["cmi.progress_measure"] !== undefined) {
      return Math.round(parseFloat(data["cmi.progress_measure"]) * 100);
    }

    // Fallback calculation based on status
    if (
      data["cmi.core.lesson_status"] === "completed" ||
      data["cmi.completion_status"] === "completed" ||
      data["cmi.core.lesson_status"] === "passed" ||
      data["cmi.completion_status"] === "passed"
    ) {
      return 100;
    }

    // Calculate based on score
    const score = parseFloat(
      data["cmi.core.score.raw"] || data["cmi.score.raw"] || 0
    );

    return Math.min(100, Math.max(0, score));
  };

  const handleBeforeUnload = async (e) => {
    if (scormAPIRef.current) {
      await saveProgressToServer();
      scormAPIRef.current.terminate();
    }
  };

  const handleManualSave = () => {
    if (scormAPIRef.current) {
      scormAPIRef.current.commit();
    }
  };

  const handleForceReinitialize = () => {
    // Clean up existing API
    if (scormAPIRef.current) {
      scormAPIRef.current.terminate();
    }

    delete window.API;
    delete window.API_1484_11;

    // Reinitialize
    initializeSCORM();
  };

  useEffect(() => {
    initializeSCORM();

    // Set up beforeunload to save progress when window closes
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (scormAPIRef.current) {
        scormAPIRef.current.terminate();
        delete window.API;
        delete window.API_1484_11;
      }
    };
  }, []);

  // Auto-save progress periodically
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (scormAPIRef.current && isInitialized) {
        saveProgressToServer();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [isInitialized]);

  const getCurrentStatus = () => {
    return (
      scormData["cmi.core.lesson_status"] ||
      scormData["cmi.completion_status"] ||
      "not attempted"
    );
  };

  const getCurrentScore = () => {
    return scormData["cmi.core.score.raw"] || scormData["cmi.score.raw"] || 0;
  };

  const getCurrentProgress = () => {
    return calculateProgress(scormData);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "white",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <strong>SCORM Player</strong> | Score: {getCurrentScore()} | Progress:{" "}
          {getCurrentProgress()}% | Status: {getCurrentStatus()} | Version:{" "}
          {scormVersion} |
          {isInitialized ? " ✅ Connected" : " ⚠️ Initializing..."}
        </div>
        <div>
          <button
            onClick={handleManualSave}
            style={{ marginRight: "10px", fontSize: "12px" }}
          >
            Save Now
          </button>
          <button
            onClick={handleForceReinitialize}
            style={{ marginRight: "10px", fontSize: "12px" }}
          >
            Reconnect
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        src={`http://localhost:3001/scorm-packages/package-${packageId}/${launchUrl}`}
        style={{ width: "100%", height: "calc(100% - 60px)", border: "none" }}
        title="SCORM Content"
        onLoad={() => {
          console.log("SCORM content loaded");
          console.log("Window APIs:", {
            API: window.API ? "Available" : "Missing",
            API_1484_11: window.API_1484_11 ? "Available" : "Missing",
          });
        }}
      />

      {/* Debug information */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          fontSize: "12px",
          maxWidth: "300px",
          maxHeight: "200px",
          overflow: "auto",
        }}
      >
        <strong>Debug Info:</strong>
        <div>API: {window.API ? "✅" : "❌"}</div>
        <div>API_1484_11: {window.API_1484_11 ? "✅" : "❌"}</div>
        <div>Initialized: {isInitialized ? "✅" : "❌"}</div>
        <div>SCORM Version: {scormVersion}</div>
      </div>
    </div>
  );
};

export default ScormPlayer;
