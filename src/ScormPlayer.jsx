// ScormPlayer.jsx
import React, { useState, useEffect, useRef } from "react";
import { Scorm12API } from "scorm-again";
import axios from "axios";

const ScormPlayer = ({ packageId, launchUrl, onClose, onProgressUpdate }) => {
  const iframeRef = useRef(null);
  const scormAPIRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [scormData, setScormData] = useState({});

  // Initialize SCORM API
  const initializeSCORM = async () => {
    try {
      const token = localStorage.getItem("token");

      // Load existing progress
      const response = await axios.get(`/api/scorm/progress/${packageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const progressData = response.data;

      // Initialize SCORM Again with saved data
      const scormAPI = new Scorm12API({
        // You can configure SCORM version here
        version: "1.2", // or '2004'

        // Initial data from server
        data: progressData.scormData || {},
      });

      // Set up event listeners
      scormAPI.on("commit", handleScormCommit);
      scormAPI.on("error", handleScormError);
      scormAPI.on("dataChange", handleScormDataChange);

      scormAPIRef.current = scormAPI;
      setIsInitialized(true);

      // Expose to window for SCORM content
      window.API = scormAPI;
      window.API_1484_11 = scormAPI; // For SCORM 2004

      console.log("SCORM API initialized successfully");
    } catch (error) {
      console.error("Failed to initialize SCORM:", error);
    }
  };

  const handleScormCommit = async (data) => {
    try {
      await saveProgressToServer(data);
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  const handleScormError = (error) => {
    console.error("SCORM Error:", error);
  };

  const handleScormDataChange = (newData) => {
    setScormData(newData);
  };

  const saveProgressToServer = async (data = scormData) => {
    try {
      const token = localStorage.getItem("token");

      // Extract progress information from SCORM data
      const score = parseFloat(
        data["cmi.core.score.raw"] || data["cmi.score.raw"] || 0
      );
      const status =
        data["cmi.core.lesson_status"] ||
        data["cmi.completion_status"] ||
        "incomplete";
      const progress = calculateProgress(data);

      const progressData = {
        score,
        progress,
        status,
        scormData: data,
      };

      await axios.post(`/api/scorm/progress/${packageId}`, progressData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onProgressUpdate(progressData);
      console.log("Progress saved successfully");
    } catch (error) {
      console.error("Failed to save progress to server:", error);
    }
  };

  const calculateProgress = (data) => {
    // Calculate progress based on SCORM data
    // This is a simple implementation - adjust based on your needs
    if (
      data["cmi.core.lesson_status"] === "completed" ||
      data["cmi.completion_status"] === "completed"
    ) {
      return 100;
    }

    // You can implement more sophisticated progress calculation
    // based on your specific SCORM package requirements
    const score = parseFloat(
      data["cmi.core.score.raw"] || data["cmi.score.raw"] || 0
    );
    return Math.min(100, Math.max(0, score));
  };

  const handleBeforeUnload = async () => {
    if (scormAPIRef.current) {
      await saveProgressToServer();
      scormAPIRef.current.LMSFinish();
    }
  };

  useEffect(() => {
    initializeSCORM();

    // Set up beforeunload to save progress when window closes
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Cleanup
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (scormAPIRef.current) {
        handleBeforeUnload();
        delete window.API;
        delete window.API_1484_11;
      }
    };
  }, []);

  // Auto-save progress periodically
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (scormAPIRef.current && Object.keys(scormData).length > 0) {
        saveProgressToServer();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [scormData]);

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
        }}
      >
        <div>
          <strong>SCORM Player</strong> | Score: {getCurrentScore()} | Progress:{" "}
          {getCurrentProgress()}% | Status: {getCurrentStatus()} |
          {isInitialized ? " SCORM Connected" : " Initializing..."}
        </div>
        <div>
          <button
            onClick={saveProgressToServer}
            style={{ marginRight: "10px" }}
          >
            Save Progress
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        src={`/scorm-packages/package-${packageId}/${launchUrl}`}
        style={{ width: "100%", height: "calc(100% - 50px)", border: "none" }}
        title="SCORM Content"
        sandbox="allow-scripts allow-same-origin" // Add this
        onLoad={() => {
          console.log("SCORM content loaded");
        }}
      />
    </div>
  );
};

export default ScormPlayer;
