"use client";
import React, { useRef, useEffect } from "react";
import * as THREE from "three";

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export default function SpinningCar() {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const carRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const keys = useRef({ w: false, s: false, a: false, d: false });
  const velocity = useRef({ speed: 0 });
  const clock = useRef(new THREE.Clock());

  useEffect(() => {
    if (!mainCanvasRef.current || !mapCanvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mainCanvasRef.current.clientWidth / mainCanvasRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: mainCanvasRef.current,
    });
    renderer.setSize(
      mainCanvasRef.current.clientWidth,
      mainCanvasRef.current.clientHeight
    );
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mapCtxRef.current = mapCanvasRef.current.getContext("2d");

    scene.add(new THREE.AmbientLight(0x666666));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(20, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    scene.add(dir);

    const trackCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0.1, -80),
        new THREE.Vector3(50, 0.1, -80),
        new THREE.Vector3(80, 0.1, -50),
        new THREE.Vector3(80, 0.1, 50),
        new THREE.Vector3(50, 0.1, 80),
        new THREE.Vector3(-50, 0.1, 80),
        new THREE.Vector3(-80, 0.1, 50),
        new THREE.Vector3(-80, 0.1, -50),
        new THREE.Vector3(-50, 0.1, -80),
      ],
      true
    );

    const trackPoints = trackCurve.getPoints(500); // More points for a smoother texture
    const trackBoundingBox = new THREE.Box3().setFromPoints(trackPoints);
    const trackSize = new THREE.Vector3();
    trackSize.subVectors(trackBoundingBox.max, trackBoundingBox.min);

    const textureSize = 1024;
    const roadCanvas = document.createElement("canvas");
    roadCanvas.width = textureSize;
    roadCanvas.height = textureSize;
    const roadCtx = roadCanvas.getContext("2d")!;

    roadCtx.fillStyle = "#90ee90";
    roadCtx.fillRect(0, 0, textureSize, textureSize);

    // Calculate scale to fit the track onto the canvas
    const scale =
      Math.min(textureSize / trackSize.x, textureSize / trackSize.z) * 0.9;

    // *** FIX: DRAW THE ROAD CENTERED ON THE CANVAS ***
    roadCtx.lineWidth = 30;
    roadCtx.strokeStyle = "#444444";
    roadCtx.lineCap = "round";
    roadCtx.lineJoin = "round";
    roadCtx.beginPath();
    // This new formula centers the drawing
    roadCtx.moveTo(
      trackPoints[0].x * scale + textureSize / 2,
      trackPoints[0].z * scale + textureSize / 2
    );
    for (let i = 1; i < trackPoints.length; i++) {
      roadCtx.lineTo(
        trackPoints[i].x * scale + textureSize / 2,
        trackPoints[i].z * scale + textureSize / 2
      );
    }
    roadCtx.stroke();

    const roadTexture = new THREE.CanvasTexture(roadCanvas);

    // *** FIX: MAKE THE GROUND PLANE THE EXACT SIZE OF THE TEXTURE'S WORLD AREA ***
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(textureSize / scale, textureSize / scale),
      new THREE.MeshLambertMaterial({ map: roadTexture })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const dashMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const dashGeo = new THREE.BoxGeometry(0.2, 0.02, 2.5);
    for (let t = 0; t < 1; t += 0.01) {
      const p1 = trackCurve.getPointAt(t);
      const tangent = trackCurve.getTangentAt(t);
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.copy(p1).setY(0.02);
      dash.lookAt(p1.clone().add(tangent));
      scene.add(dash);
    }

    const car = new THREE.Group();
    carRef.current = car;
    scene.add(car);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.8, 3),
      new THREE.MeshPhongMaterial({ color: 0xff4444 })
    );
    body.position.y = 0.4;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.8, 1.8),
      new THREE.MeshPhongMaterial({ color: 0x333333 })
    );
    cabin.position.set(0, 1.0, -0.2);
    cabin.castShadow = true;
    car.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    [
      [0.76, 0.3, 1],
      [-0.76, 0.3, 1],
      [0.76, 0.3, -1],
      [-0.76, 0.3, -1],
    ].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
      w.rotation.z = Math.PI / 2;
      car.add(w);
    });

    const startPoint = trackCurve.getPointAt(0);
    const startTangent = trackCurve.getTangentAt(0);
    car.position.copy(startPoint);
    car.lookAt(startPoint.clone().add(startTangent));

    const camDist = 8,
      camH = 4;
    const initialOffset = new THREE.Vector3(0, camH, -camDist);
    initialOffset.applyQuaternion(car.quaternion);
    camera.position.copy(car.position).add(initialOffset);
    camera.lookAt(car.position);

    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = true;
      if (e.code === "KeyS") keys.current.s = true;
      if (e.code === "KeyA") keys.current.a = true;
      if (e.code === "KeyD") keys.current.d = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = false;
      if (e.code === "KeyS") keys.current.s = false;
      if (e.code === "KeyA") keys.current.a = false;
      if (e.code === "KeyD") keys.current.d = false;
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);

    const maxSpeed = 35;
    const accel = 20;
    const turnSpeed = 1.8;
    const friction = 0.97;

    const drawMinimap = () => {
      const ctx = mapCtxRef.current;
      const carPos = carRef.current?.position;
      if (!ctx || !carPos) return;

      const mapSize = 200;
      const mapScale =
        Math.min(mapSize / trackSize.x, mapSize / trackSize.z) * 0.9;

      ctx.clearRect(0, 0, mapSize, mapSize);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, mapSize, mapSize);

      const worldToMap = (x: number, z: number) => ({
        x: x * mapScale + mapSize / 2,
        y: z * mapScale + mapSize / 2,
      });

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const firstPoint = worldToMap(trackPoints[0].x, trackPoints[0].z);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < trackPoints.length; i++) {
        const p = worldToMap(trackPoints[i].x, trackPoints[i].z);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.fillStyle = "red";
      ctx.beginPath();
      const carMapPos = worldToMap(carPos.x, carPos.z);
      ctx.arc(carMapPos.x, carMapPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.current.getDelta();

      if (carRef.current && cameraRef.current && rendererRef.current) {
        const car = carRef.current;
        const camera = cameraRef.current;

        if (keys.current.a) car.rotation.y += turnSpeed * dt;
        if (keys.current.d) car.rotation.y -= turnSpeed * dt;

        if (keys.current.w) velocity.current.speed += accel * dt;
        else if (keys.current.s) velocity.current.speed -= accel * dt;
        else velocity.current.speed *= friction;

        velocity.current.speed = clamp(
          velocity.current.speed,
          -maxSpeed,
          maxSpeed
        );

        car.translateZ(velocity.current.speed * dt);

        const camDist = 8,
          camH = 4;
        const offset = new THREE.Vector3(0, camH, -camDist);
        offset.applyQuaternion(car.quaternion);
        camera.position.copy(car.position).add(offset);
        camera.lookAt(car.position);

        rendererRef.current.render(scene, camera);
        drawMinimap();
      }
    };
    animate();

    const onResize = () => {
      if (!mainCanvasRef.current || !cameraRef.current || !rendererRef.current)
        return;
      cameraRef.current.aspect =
        mainCanvasRef.current.clientWidth / mainCanvasRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(
        mainCanvasRef.current.clientWidth,
        mainCanvasRef.current.clientHeight
      );
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas ref={mainCanvasRef} className="w-full h-full" />
      <canvas
        ref={mapCanvasRef}
        width="200"
        height="200"
        className="absolute bottom-4 right-4 border-2 border-gray-500 rounded-lg"
      />
    </div>
  );
}
