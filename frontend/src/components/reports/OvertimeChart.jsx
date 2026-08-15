import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';

export default function OvertimeChart({ data = [] }) {
  const containerRef = useRef(null);
  const themeMode = useSelector((state) => state.ui.themeMode);
  const isDark = themeMode === 'dark';

  const visibleData = useMemo(
    () => (Array.isArray(data) ? data.slice(0, 20) : []),
    [data]
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x0f172a : 0xffffff);

    const camera = new THREE.OrthographicCamera(
      0,
      width,
      height,
      0,
      0.1,
      1000
    );

    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const BAR_WIDTH = 18;
    const BAR_GAP = 12;
    const CHART_BOTTOM = 20;

    const maxValue = Math.max(
      ...visibleData.flatMap((item) => [
        Number(item.overtime) || 0,
        Number(item.deductions) || 0,
      ]),
      1
    );

    const totalWidth =
      visibleData.length * (BAR_WIDTH * 2 + BAR_GAP);

    const scaleX = Math.min(
      1,
      (width - 40) / Math.max(totalWidth, 1)
    );

    const scaleY = (height - 45) / maxValue;

    const overtimeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const deductionGeometry = new THREE.BoxGeometry(1, 1, 1);

    const overtimeMaterial = new THREE.MeshBasicMaterial({
      color: isDark ? 0x60a5fa : 0x2563eb,
    });

    const deductionMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    const overtimeMesh = new THREE.InstancedMesh(
      overtimeGeometry,
      overtimeMaterial,
      visibleData.length
    );

    const deductionMesh = new THREE.InstancedMesh(
      deductionGeometry,
      deductionMaterial,
      visibleData.length
    );

    const matrix = new THREE.Matrix4();

    visibleData.forEach((item, index) => {
      const overtime = Math.max(
        0,
        Number(item.overtime) || 0
      );

      const deductions = Math.max(
        0,
        Number(item.deductions) || 0
      );

      const x =
        20 +
        index * (BAR_WIDTH * 2 + BAR_GAP) * scaleX;

      const overtimeHeight = Math.max(
        1,
        overtime * scaleY
      );

      const deductionHeight = Math.max(
        1,
        deductions * scaleY
      );

      // Overtime bar
      matrix.makeScale(
        BAR_WIDTH * scaleX,
        overtimeHeight,
        0.5
      );

      matrix.setPosition(
        x,
        CHART_BOTTOM + overtimeHeight / 2,
        0
      );

      overtimeMesh.setMatrixAt(index, matrix);

      // Deduction bar
      matrix.makeScale(
        BAR_WIDTH * scaleX,
        deductionHeight,
        0.5
      );

      matrix.setPosition(
        x + BAR_WIDTH * scaleX + 0.05,
        CHART_BOTTOM + deductionHeight / 2,
        0
      );

      deductionMesh.setMatrixAt(index, matrix);
    });

    overtimeMesh.instanceMatrix.needsUpdate = true;
    deductionMesh.instanceMatrix.needsUpdate = true;

    scene.add(overtimeMesh);
    scene.add(deductionMesh);

    renderer.render(scene, camera);

    const handleResize = () => {
      if (!container) {
        return;
      }

      const newWidth = container.clientWidth || 600;
      const newHeight = container.clientHeight || 320;

      camera.right = newWidth;
      camera.top = newHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
      renderer.render(scene, camera);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      overtimeGeometry.dispose();
      deductionGeometry.dispose();
      overtimeMaterial.dispose();
      deductionMaterial.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [visibleData, isDark]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        Overtime vs Deductions
      </h2>

      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-lg"
      />

      <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-blue-600" />
          Overtime
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500" />
          Deductions
        </div>
      </div>
    </div>
  );
}