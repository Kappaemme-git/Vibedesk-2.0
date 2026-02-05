import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";

const BG = "#0f1116";
const ACCENT = "#7b5cff";
const SOFT = "rgba(123,92,255,0.16)";

const durations = {
  intro: 60,
  hero: 180,
  icons: 180,
  focus: 180,
  text: 300,
  back: 120,
  outro: 180
};

const sceneAt = {
  intro: 0,
  hero: durations.intro,
  icons: durations.intro + durations.hero,
  focus: durations.intro + durations.hero + durations.icons,
  text:
    durations.intro + durations.hero + durations.icons + durations.focus,
  back:
    durations.intro +
    durations.hero +
    durations.icons +
    durations.focus +
    durations.text,
  outro:
    durations.intro +
    durations.hero +
    durations.icons +
    durations.focus +
    durations.text +
    durations.back
};

const inScene = (frame, start, duration) => frame >= start && frame < start + duration;

const Title = ({ start, text, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - start;
  const enter = spring({ frame: local, fps, config: { damping: 14 } });
  const y = interpolate(enter, [0, 1], [24, 0]);
  const o = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div style={{ textAlign: "center", color: "white" }}>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -1,
          transform: `translateY(${y}px)`,
          opacity: o
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 36,
          color: "rgba(255,255,255,0.75)",
          transform: `translateY(${y}px)`,
          opacity: o
        }}
      >
        {sub}
      </div>
    </div>
  );
};

const LogoBadge = ({ size = 220 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      overflow: "hidden",
      boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      border: "1px solid rgba(255,255,255,0.12)"
    }}
  >
    <Img
      src={staticFile("trailer/logo.png")}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </div>
);

const ScreenShot = ({ start, duration, from, to, zoomFrom = 1, zoomTo = 1.1, caption }) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  if (local < 0 || local >= duration) return null;

  const progress = interpolate(local, [0, duration], [0, 1]);
  const x = interpolate(progress, [0, 1], [from.x, to.x]);
  const y = interpolate(progress, [0, 1], [from.y, to.y]);
  const scale = interpolate(progress, [0, 1], [zoomFrom, zoomTo]);
  const opacity = interpolate(progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 70,
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        opacity
      }}
    >
      <div
        style={{
          width: "120%",
          height: "120%",
          transform: `translate(${x}px, ${y}px) scale(${scale})`
        }}
      >
        <Img
          src={staticFile("trailer/screen.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 24,
            padding: "10px 16px",
            background: "rgba(15,17,22,0.75)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 14,
            color: "white",
            fontSize: 26,
            fontWeight: 600
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

const FocusPulse = ({ start, duration }) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  if (local < 0 || local >= duration) return null;

  const pulse = (local % 24) / 24;
  const scale = interpolate(pulse, [0, 1], [1, 1.2]);
  const opacity = interpolate(pulse, [0, 0.5, 1], [0.65, 0.25, 0.0]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "72%",
        width: 320,
        height: 120,
        borderRadius: 999,
        border: `2px solid rgba(123,92,255,${opacity})`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        boxShadow: `0 0 40px rgba(123,92,255,${opacity})`
      }}
    />
  );
};

const FeatureStack = ({ start, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - start;
  if (local < 0 || local >= duration) return null;

  const lines = [
    "New tasks sync with calendar",
    "Create savable presets",
    "New login system",
    "New stats and level for the users"
  ];

  const per = 70;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "center"
      }}
    >
      {lines.map((text, idx) => {
        const startAt = idx * per;
        const t = local - startAt;
        const show = t >= 0 && t < per;
        const enter = spring({ frame: t, fps, config: { damping: 14 } });
        const y = interpolate(enter, [0, 1], [18, 0]);
        const opacity = interpolate(enter, [0, 0.2, 1], [0, 1, 1]);
        return (
          <div
            key={text}
            style={{
              padding: "12px 20px",
              borderRadius: 999,
              background: SOFT,
              border: `1px solid rgba(123,92,255,0.45)`,
              color: "white",
              fontSize: 30,
              fontWeight: 600,
              opacity: show ? opacity : 0,
              transform: `translateY(${y}px)`
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
};

export const Trailer = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: "Quicksand, Arial" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(123,92,255,0.2), transparent 55%), radial-gradient(circle at 90% 10%, rgba(255,255,255,0.08), transparent 45%)"
        }}
      />

      {inScene(frame, sceneAt.intro, durations.intro) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
            <LogoBadge size={200} />
            <Title start={sceneAt.intro} text="VibeDesk" sub="Focus. Flow. Repeat." />
          </div>
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.hero, durations.hero) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <ScreenShot
            start={sceneAt.hero}
            duration={durations.hero}
            from={{ x: -60, y: -20 }}
            to={{ x: -160, y: -80 }}
            zoomFrom={1.02}
            zoomTo={1.08}
            caption="Your calm focus workspace"
          />
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.icons, durations.icons) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <ScreenShot
            start={sceneAt.icons}
            duration={durations.icons}
            from={{ x: -60, y: 140 }}
            to={{ x: 40, y: 220 }}
            zoomFrom={1.08}
            zoomTo={1.2}
            caption="Fullscreen · Music · Notes · Tasks · Calendar · Login"
          />
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.focus, durations.focus) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <ScreenShot
            start={sceneAt.focus}
            duration={durations.focus}
            from={{ x: -30, y: 40 }}
            to={{ x: 180, y: 80 }}
            zoomFrom={1.12}
            zoomTo={1.3}
            caption="Tap Start. Drop in."
          />
          <FocusPulse start={sceneAt.focus + 20} duration={durations.focus - 20} />
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.text, durations.text) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <FeatureStack start={sceneAt.text} duration={durations.text} />
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.back, durations.back) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <ScreenShot
            start={sceneAt.back}
            duration={durations.back}
            from={{ x: 60, y: -20 }}
            to={{ x: -60, y: -60 }}
            zoomFrom={1.06}
            zoomTo={1.12}
            caption="Back to focus"
          />
        </AbsoluteFill>
      ) : null}

      {inScene(frame, sceneAt.outro, durations.outro) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
            <LogoBadge size={240} />
            <div style={{ color: "white", fontSize: 48, fontWeight: 700 }}>
              VibeDesk
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 30 }}>
              www.vibedesk.online
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
