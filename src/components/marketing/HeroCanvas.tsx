"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";

import { prefersReducedMotion } from "@/lib/motion";

export function HeroCanvas({ heroRef }: { heroRef: React.RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const heroSection = heroRef.current;
    if (!canvas || !heroSection) return;
    const heroEl: HTMLElement = heroSection;

    const reduced = prefersReducedMotion();
    const isDark = resolvedTheme === "dark";
    const color = isDark ? 0xc9973f : 0xb8862f;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const count = 120;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.04,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let mouseX = 0;
    let mouseY = 0;
    let opacity = 1;
    let raf = 0;

    function onMouseMove(e: MouseEvent) {
      const rect = heroEl.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.3;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.2;
    }

    function onScroll() {
      const rect = heroEl.getBoundingClientRect();
      const progress = 1 - Math.min(Math.max(-rect.top / rect.height, 0), 1);
      opacity = progress;
    }

    function resize() {
      const rect = heroEl.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function animate() {
      raf = requestAnimationFrame(animate);
      if (!reduced) {
        points.rotation.y += 0.0008;
        points.rotation.x += 0.0004;
        points.position.x += (mouseX - points.position.x) * 0.04;
        points.position.y += (-mouseY - points.position.y) * 0.04;
      }
      material.opacity = 0.55 * opacity;
      if (canvas) canvas.style.opacity = String(opacity);
      renderer.render(scene, camera);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    resize();
    onScroll();
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [heroRef, resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
