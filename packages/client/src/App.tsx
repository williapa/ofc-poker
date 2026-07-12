import { Canvas } from "@react-three/fiber";

export function App() {
  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="app-title">
        <p className="eyebrow">Open-Face Chinese Poker</p>
        <h1 id="app-title">Build your board.</h1>
        <p>
          Lobby setup and gameplay arrive in the next implementation milestones.
        </p>
      </section>
      <section
        className="table-preview"
        aria-label="Three-dimensional table preview"
      >
        <Canvas camera={{ position: [0, 2.8, 4], fov: 45 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 4, 2]} intensity={2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.2, 2.2, 0.12, 48]} />
            <meshStandardMaterial color="#175a46" roughness={0.75} />
          </mesh>
        </Canvas>
      </section>
    </main>
  );
}
