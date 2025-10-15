// ScormPlayer.jsx
import React, { useState, useEffect, useRef } from "react";

const ScormPlayer = ({ packageId, launchUrl, onClose, onProgressUpdate }) => {
  const iframeRef = useRef(null);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("not attempted");

  // SCORM API implementation
  const initializeSCORM = () => {
    const scormAPI = {
      // Initialize
      LMSInitialize: () => {
        console.log("SCORM Initialized");
        return "true";
      },

      // Terminate
      LMSFinish: () => {
        saveProgress();
        console.log("SCORM Terminated");
        return "true";
      },

      // Get value
      LMSGetValue: (element) => {
        switch (element) {
          case "cmi.core.student_name":
            return localStorage.getItem("userEmail") || "Student";
          case "cmi.core.lesson_status":
            return status;
          case "cmi.core.score.raw":
            return score.toString();
          case "cmi.core.lesson_location":
            return localStorage.getItem(`lesson_location_${packageId}`) || "";
          case "cmi.suspend_data":
            return localStorage.getItem(`suspend_data_${packageId}`) || "";
          default:
            return "";
        }
      },

      // Set value
      LMSSetValue: (element, value) => {
        console.log(`SCORM Set: ${element} = ${value}`);

        switch (element) {
          case "cmi.core.lesson_status":
            setStatus(value);
            break;
          case "cmi.core.score.raw":
            const newScore = parseFloat(value) || 0;
            setScore(newScore);
            break;
          case "cmi.core.lesson_location":
            localStorage.setItem(`lesson_location_${packageId}`, value);
            break;
          case "cmi.suspend_data":
            localStorage.setItem(`suspend_data_${packageId}`, value);
            break;
        }

        return "true";
      },

      // Commit changes
      LMSCommit: () => {
        saveProgress();
        return "true";
      },

      // Get error
      LMSGetLastError: () => "0",
      LMSGetErrorString: (errorCode) => "No error",
      LMSGetDiagnostic: (errorCode) => "No diagnostic",
    };

    // Expose to window for SCORM content
    window.API = scormAPI;
    return scormAPI;
  };

  const saveProgress = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/progress/${packageId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            score,
            progress,
            status,
          }),
        }
      );

      if (response.ok) {
        onProgressUpdate({ score, progress, status });
      }
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  useEffect(() => {
    const scormAPI = initializeSCORM();
    scormAPI.LMSInitialize();

    // Load saved progress
    const loadProgress = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://localhost:3001/api/progress/${packageId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setScore(data.score);
          setProgress(data.progress);
          setStatus(data.status);
        }
      } catch (error) {
        console.error("Failed to load progress:", error);
      }
    };

    loadProgress();

    return () => {
      scormAPI.LMSFinish();
    };
  }, [packageId]);

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
        }}
      >
        <div>
          <strong>SCORM Player</strong> | Score: {score} | Progress: {progress}%
          | Status: {status}
        </div>
        <button onClick={onClose}>Close</button>
      </div>

      <iframe
        ref={iframeRef}
        src={`http://localhost:3001/scorm-packages/package-${packageId}/${launchUrl}`}
        style={{ width: "100%", height: "calc(100% - 50px)", border: "none" }}
        title="SCORM Content"
      />
    </div>
  );
};

export default ScormPlayer;
