import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Alert,
} from "@mui/material";
import { api } from "../api";
import { useQueueSocket } from "../useQueueSocket";

export default function PublicDisplay() {
  const [snapshot, setSnapshot] = useState({
    steps: [1, 2, 3, 4].map((step) => ({ step, serving: [] })),
  });
  const [audioError, setAudioError] = useState("");
  const [audioNeedsInteraction, setAudioNeedsInteraction] = useState(false);
  const [callAnimations, setCallAnimations] = useState({});
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);
  const videoSource = import.meta.env.VITE_DISPLAY_VIDEO_URL || "/display-video.mp4";
  const audioRef = useRef(true);
  const announceQueue = useRef([]);
  const speaking = useRef(false);
  const utteranceRef = useRef(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/display");
      setSnapshot(data);
      setError("");
    } catch {
      setError("Unable to refresh queue display.");
    }
  }, []);
  const speakNext = useCallback(() => {
    if (
      !audioRef.current ||
      speaking.current ||
      !announceQueue.current.length ||
      !("speechSynthesis" in window)
    )
      return;
    speaking.current = true;
    const announcement = announceQueue.current.shift();
    const { step, queueNumber, counterLabel, message } = announcement;
    const text = message || `Queue number ${queueNumber.replace("-", " ")}, please proceed to ${counterLabel}, step ${step}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.lang = "en-PH";
    utterance.rate = 0.65;
    utterance.onend = () => {
      utteranceRef.current = null;
      speaking.current = false;
      speakNext();
    };
    utterance.onerror = (event) => {
      utteranceRef.current = null;
      speaking.current = false;
      if (event.error === "not-allowed") {
        if (!message) announceQueue.current.unshift(announcement);
        setAudioNeedsInteraction(true);
        setAudioError("");
      } else {
        setAudioError(`Voice announcement failed (${event.error}). Click Enable announcements to try again and check the device volume.`);
      }
      audioRef.current = false;
    };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, []);
  const event = useCallback(
    (type, payload) => {
      if (type === "refresh") load();
      if (
        type === "announce" &&
        payload?.queueNumber &&
        /^[A-Z]-\d{3,}$/.test(payload.queueNumber) &&
        Number.isInteger(payload.step) &&
        payload.step >= 1 &&
        typeof payload.counterLabel === "string"
      ) {
        const callKey = `${payload.step}:${payload.queueNumber}`;
        setCallAnimations((current) => ({
          ...current,
          [callKey]: (current[callKey] || 0) + 1,
        }));
        announceQueue.current.push(payload);
        speakNext();
      }
    },
    [load, speakNext],
  );
  const displaySteps = snapshot.steps;
  const desktopRows = displaySteps.slice(0, 2).map(item => `"step${item.step} video"`);
  if (displaySteps[2]) desktopRows.push(`"step${displaySteps[2].step} ${displaySteps[3] ? `step${displaySteps[3].step}` : '.'}"`);
  for (let index = 4; index < displaySteps.length; index += 2) {
    desktopRows.push(`"step${displaySteps[index].step} ${displaySteps[index + 1] ? `step${displaySteps[index + 1].step}` : '.'}"`);
  }
  useQueueSocket("public", event);
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);
  const enableAudio = () => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioError("This browser does not support voice announcements. Open the display in a browser with speech synthesis support.");
      return;
    }
    setAudioError("");
    setAudioNeedsInteraction(false);
    audioRef.current = true;
    announceQueue.current.unshift({ message: "Voice announcements are enabled." });
    speakNext();
  };
  const renderStepCard = (s) => (
<Paper
                  key={s.step}
                  elevation={8}
                  sx={{
                    p: { xs: 2, md: 3 },
                    background: "#10243d",
                    color: "white",
                    border: "2px solid #92b8e5",
                    borderRadius: 4,
                    minHeight: 150,
                    gridArea: `step${s.step}`,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ color: "#dcecff" }}
                  >
                    {s.name || `STEP ${s.step}`}
                  </Typography>
                  {s.serving.length ? (
                    s.serving.map((item, i) => (
                      <Box
                        key={`${item.queueNumber}-${i}`}
                        sx={{
                          mt: 2,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "#193a62",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography
                          key={`${item.queueNumber}:${callAnimations[`${s.step}:${item.queueNumber}`] || 0}`}
                          fontWeight={900}
                          sx={{
                            fontSize: { xs: 36, md: 54 },
                            animation: item.status === "CALLED" && callAnimations[`${s.step}:${item.queueNumber}`]
                              ? "queueNumberSlideIn 600ms ease-out both"
                              : "none",
                            "@keyframes queueNumberSlideIn": {
                              from: { opacity: 0, transform: "translateX(-32px)" },
                              to: { opacity: 1, transform: "translateX(0)" },
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                              animation: "none",
                            },
                          }}
                        >
                          {item.queueNumber}
                        </Typography>
                        <Box textAlign="right">
                          <Typography fontWeight={700}>
                            {item.counterLabel}
                          </Typography>
                          <Typography variant="body2">
                            {item.status === "CALLED"
                              ? "PLEASE PROCEED"
                              : "PROCESSING"}
                          </Typography>
                        </Box>
                      </Box>
                    ))
                  ) : (
                    <Typography sx={{ mt: 5, color: "#e3edfa" }} variant="h5">
                      Waiting for next call
                    </Typography>
                  )}
                </Paper>
  );
  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        overflow: "auto",
        background: "linear-gradient(145deg,#07152e,#14355e)",
        color: "#fff",
        p: { xs: 2, md: 3 },
      }}
    >
        <Stack spacing={2} sx={{ minHeight: "100%", height: { md: "100%" } }}>
          {error && <Alert severity="warning">{error}</Alert>}
          {audioError && <Alert severity="error">{audioError}</Alert>}
          {audioNeedsInteraction && (
            <Alert
              severity="info"
              action={<Button color="inherit" onClick={enableAudio}>Enable announcements</Button>}
            >
              Your browser needs one click to allow voice announcements on this display.
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              flex: 1,
              minHeight: 0,
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
              gridTemplateAreas: {
                xs: [...displaySteps.slice(0, 3).map(item => `"step${item.step}"`), '"video"', ...displaySteps.slice(3).map(item => `"step${item.step}"`)].join(' '),
                md: desktopRows.join(' '),
              },
              gridTemplateRows: { md: `repeat(${desktopRows.length}, minmax(150px, 1fr))` },
              gap: 2,
              alignItems: "stretch",
            }}
          >
            {displaySteps.map(renderStepCard)}
            <Paper
              elevation={8}
              sx={{
                overflow: "hidden",
                background: "#10243d",
                color: "white",
                border: "2px solid #92b8e5",
                borderRadius: 4,
                gridArea: "video",
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography variant="h5" fontWeight={700} sx={{ p: 3, color: "#dcecff" }}>
                INFORMATION VIDEO
              </Typography>
              {videoError ? (
                <Box sx={{ p: 3, flex: 1, aspectRatio: { xs: "16 / 9", md: "auto" }, display: "grid", placeItems: "center" }}>
                  <Typography color="inherit" textAlign="center">
                    The information video is currently unavailable.
                  </Typography>
                </Box>
              ) : (
                <Box
                  component="video"
                  src={videoSource}
                  autoPlay
                  muted
                  loop
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Information video"
                  onError={() => setVideoError(true)}
                  sx={{ display: "block", width: "100%", flex: 1, minHeight: 0, height: { md: 0 }, aspectRatio: { xs: "16 / 9", md: "auto" }, objectFit: "contain", bgcolor: "#000" }}
                />
              )}
            </Paper>
          </Box>
        </Stack>
    </Box>
  );
}
