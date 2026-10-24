import { useEffect, useState } from "react";

type ShaderGradientModule = typeof import("@shadergradient/react");

export function WorkspaceBackground() {
  const [shaderGradient, setShaderGradient] = useState<ShaderGradientModule | null>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;

    const loadShader = async () => {
      if (motionPreference.matches) {
        setShaderGradient(null);
        return;
      }

      try {
        const module = await import("@shadergradient/react");
        if (active && !motionPreference.matches) setShaderGradient(module);
      } catch (error) {
        console.error("Unable to load the workspace shader background.", error);
      }
    };

    const handleMotionChange = () => {
      void loadShader();
    };

    void loadShader();
    motionPreference.addEventListener("change", handleMotionChange);

    return () => {
      active = false;
      motionPreference.removeEventListener("change", handleMotionChange);
    };
  }, []);

  const Background = shaderGradient?.ShaderGradientCanvas;
  const Shader = shaderGradient?.ShaderGradient;

  return (
    <div className="workspace-background" aria-hidden="true">
      {Background && Shader ? (
        <Background
          className="workspace-background-canvas"
          style={{ position: "absolute", inset: 0 }}
          pixelDensity={1}
          fov={45}
          pointerEvents="none"
          powerPreference="low-power"
        >
          <Shader
            animate="on"
            brightness={0.5}
            cAzimuthAngle={149}
            cDistance={2.71}
            cPolarAngle={74}
            cameraZoom={1}
            color1="#040000"
            color2="#1f3434"
            color3="#1300e1"
            envPreset="city"
            grain="off"
            lightType="env"
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={28.3}
            rangeStart={13.4}
            reflection={0}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="waterPlane"
            uAmplitude={1}
            uDensity={1.2}
            uFrequency={3.5}
            uSpeed={0.2}
            uStrength={1.25}
            uTime={13.4}
            wireframe={false}
            zoomOut={false}
          />
        </Background>
      ) : null}
    </div>
  );
}
