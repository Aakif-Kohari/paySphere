/**
 * @fileoverview Dynamic Drag-and-Drop Dashboard Grid
 * @description Integrates react-grid-layout to allow users to customize their
 * dashboard widget layout. Supports edit mode, resizing, and persistent storage.
 * Issue: #932
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
// `react-grid-layout@2` dropped the `WidthProvider` HOC and exports a
// width-aware `ResponsiveGridLayout` instead. package.json has asked for
// `^2.2.4` while this file used the v1 API, so the build failed here:
//
//     "WidthProvider" is not exported by react-grid-layout/dist/index.mjs
//
// Nothing caught it because the build was already failing earlier in the graph
// on Navbar.jsx's duplicated imports, so nobody ever reached this error.
import { ResponsiveGridLayout } from 'react-grid-layout';
import PropTypes from 'prop-types';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import api from '../../services/api';
import { WIDGET_REGISTRY, DEFAULT_LAYOUT } from './WidgetRegistry';

export default function DashboardGrid() {
  const { t } = useTranslation();
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isEditMode, setIsEditMode] = useState(false);
  // Derived from a module-level constant that never changes, so this was
  // state with no setter in use. `saving` was the same — declared, never
  // read, never set. Both tripped `no-unused-vars` as soon as this file was
  // staged, which had not happened before because lint-staged only lints
  // what a commit touches.
  const availableWidgets = Object.keys(WIDGET_REGISTRY);
  const debounceTimer = useRef(null);

  // Fetch saved layout on mount
  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const res = await api.get('/api/dashboard/layout');
        if (res.data && res.data.layout && res.data.layout.length > 0) {
          setLayout(res.data.layout);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard layout, using default', err);
      }
    };
    fetchLayout();
  }, []);

  // Debounced save to backend
  const saveLayout = useCallback(async (newLayout) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        await api.put('/api/dashboard/layout', { layout: newLayout });
      } catch (err) {
        console.error('Failed to save layout', err);
      }
    }, 1000); // 1 second debounce
  }, []);

  const handleLayoutChange = (currentLayout) => {
    // Clean up react-grid-layout internal properties before saving
    const cleanLayout = currentLayout.map((l) => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: l.minW,
      minH: l.minH,
    }));
    setLayout(cleanLayout);
    if (isEditMode) saveLayout(cleanLayout);
  };

  const addWidget = (widgetId) => {
    if (layout.some((l) => l.i === widgetId)) return; // Already exists

    const widgetConfig = WIDGET_REGISTRY[widgetId];
    const newItem = {
      i: widgetId,
      x: 0,
      y: Infinity, // Pushes to bottom
      w: widgetConfig.defaultW,
      h: widgetConfig.defaultH,
      minW: widgetConfig.minW || 2,
      minH: widgetConfig.minH || 2,
    };
    const newLayout = [...layout, newItem];
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  const removeWidget = (widgetId) => {
    const newLayout = layout.filter((l) => l.i !== widgetId);
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('dashboard.widgets.overview', 'Dashboard Overview')}
        </h2>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <select
                onChange={(e) => {
                  addWidget(e.target.value);
                  e.target.value = '';
                }}
                className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                defaultValue=""
                aria-label={t('dashboard.widgets.addWidget', '+ Add Widget')}
              >
                <option value="" disabled>
                  {t('dashboard.widgets.addWidget', '+ Add Widget')}
                </option>
                {availableWidgets.map((wId) => (
                  <option
                    key={wId}
                    value={wId}
                    disabled={layout.some((l) => l.i === wId)}
                  >
                    {WIDGET_REGISTRY[wId].title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsEditMode(false)}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700"
              >
                <SaveIcon fontSize="small" /> {t('dashboard.widgets.done', 'Done')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <EditIcon fontSize="small" /> {t('dashboard.widgets.editLayout', 'Edit Layout')}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700 min-h-[600px]">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
          useCSSTransforms={true}
        >
          {layout.map((item) => {
            const WidgetComponent = WIDGET_REGISTRY[item.i]?.component;
            if (!WidgetComponent) return null;

            return (
              <div
                key={item.i}
                className="relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Drag Handle & Remove Button */}
                <div
                  className={`widget-drag-handle flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                >
                  <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 truncate">
                    {WIDGET_REGISTRY[item.i].title}
                  </h3>
                  {isEditMode && (
                    <button
                      onClick={() => removeWidget(item.i)}
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={t('dashboard.widgets.remove', 'Remove widget')}
                    >
                      <CancelIcon fontSize="small" />
                    </button>
                  )}
                </div>

                {/* Widget Content */}
                <div className="p-4 h-[calc(100%-40px)] overflow-auto">
                  <WidgetComponent />
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
