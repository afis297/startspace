// ============================================================================
// ИСПРАВЛЕННЫЕ ФУНКЦИИ ДЛЯ script.js
// ============================================================================
// Замените обе функции в script.js на эти версии
// ============================================================================

// === 1. ФУНКЦИЯ showContextMenu (строка ~2776) ===
function showContextMenu(widgetId, mouseX, mouseY) {
    activeWidgetId = widgetId;
    const w = widgets.find(widget => widget.id === widgetId);
    if (!w) return;
    ensureStyle(w);

    const clockSet = document.getElementById('clock-specific-settings');
    if (w.type === 'clock') {
        clockSet.classList.remove('hidden');
        document.getElementById('ctx-clock-mode').value = w.clockSettings.mode;
        document.getElementById('ctx-clock-format').value = w.clockSettings.format;
        document.getElementById('ctx-show-seconds').checked = w.clockSettings.showSeconds;
    } else clockSet.classList.add('hidden');

    const weatherSet = document.getElementById('weather-specific-settings');
    if (w.type === 'weather') {
        weatherSet.classList.remove('hidden');
        document.getElementById('ctx-weather-city').value = w.city || 'Moscow';
    } else weatherSet.classList.add('hidden');

    for (const [key, config] of Object.entries(WIDGET_STYLE_SCHEMA)) {
        const input = document.getElementById(`ctx-${key}`);
        if (input) {
            if (config.type === 'checkbox') input.checked = !!w.style[key];
            else input.value = w.style[key] ?? config.default;
            const span = document.getElementById(`ctx-${key}-val`);
            if (span && config.type === 'range') span.textContent = `${Math.round((w.style[key] ?? config.default) * (config.multiplier || 1))}${config.suffix || ''}`;
        }
    }
    
    const windowScaleInput = document.getElementById('ctx-window-scale');
    const windowScaleVal = document.getElementById('ctx-window-scale-val');
    const windowFontInput = document.getElementById('ctx-window-font-size');
    const windowFontVal = document.getElementById('ctx-window-font-size-val');
    
    if (windowScaleInput && windowScaleVal) {
        const savedScale = globalSettings.contextMenuScale || 1;
        windowScaleInput.value = savedScale;
        windowScaleVal.textContent = Math.round(savedScale * 100) + '%';
    }
    
    if (windowFontInput && windowFontVal) {
        const savedSize = globalSettings.contextMenuFontSize || 14;
        windowFontInput.value = savedSize;
        windowFontVal.textContent = savedSize + 'px';
    }
    
    const menu = document.getElementById('widget-context-menu');
    if (globalSettings.contextMenuFontSize) {
        applyWindowFontSize('widget-context-menu', globalSettings.contextMenuFontSize);
    }
    
    menu.classList.remove('hidden');
    
    const uiScale = globalSettings.uiScale ?? 1;
    const menuScale = globalSettings.contextMenuScale ?? 1;
    const totalScale = uiScale * menuScale;
    
    if (globalSettings.contextMenuPos) {
        menu.style.left = globalSettings.contextMenuPos.x + 'px';
        menu.style.top = globalSettings.contextMenuPos.y + 'px';
        menu.style.transform = `scale(${totalScale})`;
        menu.style.transformOrigin = 'top left';
    } else {
        menu.style.left = '50%';
        menu.style.top = '50%';
        menu.style.transform = `translate(-50%, -50%) scale(${totalScale})`;
        menu.style.transformOrigin = 'center center';
    }
    
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        let left = parseFloat(menu.style.left);
        let top = parseFloat(menu.style.top);
        
        if (menu.style.left.includes('%')) {
            left = rect.left;
            top = rect.top;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
            menu.style.transform = `scale(${totalScale})`;
            menu.style.transformOrigin = 'top left';
        }
        
        let changed = false;
        
        if (rect.left < 0) {
            left -= rect.left;
            changed = true;
        }
        if (rect.right > window.innerWidth) {
            left -= (rect.right - window.innerWidth);
            changed = true;
        }
        if (rect.top < 0) {
            top -= rect.top;
            changed = true;
        }
        if (rect.bottom > window.innerHeight) {
            top -= (rect.bottom - window.innerHeight);
            changed = true;
        }
        
        if (changed) {
            menu.style.left = Math.max(0, left) + 'px';
            menu.style.top = Math.max(0, top) + 'px';
            globalSettings.contextMenuPos = { x: parseInt(menu.style.left), y: parseInt(menu.style.top) };
            saveSettings();
        }
    });
}


// === 2. ФУНКЦИЯ initDraggableWindows (строка ~2516) ===
function initDraggableWindows() {
    let action = null, target = null, offsetX, offsetY, startWidth, startHeight;

    const constrainToScreen = (element) => {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        let left = parseFloat(element.style.left) || 0;
        let top = parseFloat(element.style.top) || 0;
        
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        let changed = false;

        if (rect.left < 0) {
            left -= rect.left;
            changed = true;
        }
        if (rect.right > window.innerWidth) {
            left -= (rect.right - window.innerWidth);
            changed = true;
        }
        if (rect.top < 0) {
            top -= rect.top;
            changed = true;
        }
        if (rect.bottom > window.innerHeight) {
            top -= (rect.bottom - window.innerHeight);
            changed = true;
        }

        if (changed) {
            element.style.left = Math.max(0, left) + 'px';
            element.style.top = Math.max(0, top) + 'px';
            saveWindowPosition(element.id, parseInt(element.style.left), parseInt(element.style.top));
        }
    };

    const saveWindowPosition = (id, x, y) => {
        if (id === 'settings-panel') globalSettings.settingsPos = { x, y };
        else if (id === 'widget-context-menu') globalSettings.contextMenuPos = { x, y };
        else if (id === 'widget-menu') globalSettings.widgetMenuPos = { x, y };
        saveSettings();
    };

    const settingsPanel = document.getElementById('settings-panel');
    const contextMenu = document.getElementById('widget-context-menu');
    const widgetMenu = document.getElementById('widget-menu');
    
    const uiScale = globalSettings.uiScale ?? 1;
    const contextMenuScale = globalSettings.contextMenuScale ?? 1;
    const settingsPanelScale = globalSettings.settingsPanelScale ?? 1;
    
    const totalContextScale = uiScale * contextMenuScale;
    const totalSettingsScale = uiScale * settingsPanelScale;

    if (globalSettings.settingsPos && settingsPanel) {
        settingsPanel.style.left = globalSettings.settingsPos.x + 'px';
        settingsPanel.style.top = globalSettings.settingsPos.y + 'px';
        settingsPanel.style.transform = `scale(${totalSettingsScale})`;
        settingsPanel.style.transformOrigin = 'top left';
        setTimeout(() => constrainToScreen(settingsPanel), 50);
    } else if (settingsPanel) {
        settingsPanel.style.left = '50%';
        settingsPanel.style.top = '50%';
        settingsPanel.style.transform = `translate(-50%, -50%) scale(${totalSettingsScale})`;
        settingsPanel.style.transformOrigin = 'center center';
    }
    if (globalSettings.settingsSize && settingsPanel) {
        settingsPanel.style.width = globalSettings.settingsSize.w + 'px';
        settingsPanel.style.height = globalSettings.settingsSize.h + 'px';
    }
    if (globalSettings.settingsPanelFontSize && settingsPanel) {
        applyWindowFontSize('settings-panel', globalSettings.settingsPanelFontSize);
    }

    if (globalSettings.contextMenuPos && contextMenu) {
        contextMenu.style.left = globalSettings.contextMenuPos.x + 'px';
        contextMenu.style.top = globalSettings.contextMenuPos.y + 'px';
        contextMenu.style.transform = `scale(${totalContextScale})`;
        contextMenu.style.transformOrigin = 'top left';
        setTimeout(() => constrainToScreen(contextMenu), 50);
    } else if (contextMenu) {
        contextMenu.style.left = '50%';
        contextMenu.style.top = '50%';
        contextMenu.style.transform = `translate(-50%, -50%) scale(${totalContextScale})`;
        contextMenu.style.transformOrigin = 'center center';
    }
    if (globalSettings.contextMenuSize && contextMenu) {
        contextMenu.style.width = globalSettings.contextMenuSize.w + 'px';
        contextMenu.style.height = globalSettings.contextMenuSize.h + 'px';
    }
    if (globalSettings.contextMenuFontSize && contextMenu) {
        applyWindowFontSize('widget-context-menu', globalSettings.contextMenuFontSize);
    }

    if (globalSettings.widgetMenuPos && widgetMenu) {
        widgetMenu.style.left = globalSettings.widgetMenuPos.x + 'px';
        widgetMenu.style.top = globalSettings.widgetMenuPos.y + 'px';
        widgetMenu.style.transform = `scale(${uiScale})`;
        widgetMenu.style.transformOrigin = 'top left';
        
        if (globalSettings.widgetMenuSize) {
            widgetMenu.style.width = globalSettings.widgetMenuSize.w + 'px';
            widgetMenu.style.height = globalSettings.widgetMenuSize.h + 'px';
        }
        
        setTimeout(() => constrainToScreen(widgetMenu), 50);
    } else if (widgetMenu) {
        widgetMenu.style.left = '50%';
        widgetMenu.style.bottom = '100px';
        widgetMenu.style.transform = `translateX(-50%) scale(${uiScale})`;
        widgetMenu.style.transformOrigin = 'center bottom';
    }

    document.addEventListener('mousedown', e => {
        const resizeHandle = e.target.closest('.window-resize-handle');
        const panel = e.target.closest('#settings-panel, #widget-context-menu, #widget-menu');
        
        if (!panel) return;

        if (resizeHandle) {
            action = 'resize';
            target = panel;
            offsetX = e.clientX;
            offsetY = e.clientY;
            startWidth = target.offsetWidth;
            startHeight = target.offsetHeight;
            target.style.transition = 'none';
            document.body.style.cursor = 'nwse-resize';
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (e.target.closest('button, input, select, textarea, a, .menu-item, .ctx-row, .settings-tab, .settings-body, .window-content, .menu-tabs, .menu-tab')) {
            return;
        }

        if (panel.id === 'settings-panel' && !e.target.closest('.settings-header')) return;
        if (panel.id === 'widget-context-menu' && !e.target.closest('.window-header')) return;
        if (panel.id === 'widget-menu' && !e.target.closest('.menu-header')) return;

        action = 'drag';
        target = panel;
        
        const currentTransform = target.style.transform;
        const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
        const scaleStr = scaleMatch ? scaleMatch[0] : '';
        
        const rect = target.getBoundingClientRect();
        target.style.left = rect.left + 'px';
        target.style.top = rect.top + 'px';
        target.style.transform = scaleStr;
        target.style.transformOrigin = 'top left';

        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        target.style.transition = 'none';
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', e => {
        if (!action || !target) return;

        if (action === 'resize') {
            const deltaX = e.clientX - offsetX;
            const deltaY = e.clientY - offsetY;
            const newWidth = Math.max(280, startWidth + deltaX);
            const newHeight = Math.max(200, startHeight + deltaY);
            
            target.style.width = newWidth + 'px';
            target.style.height = newHeight + 'px';
            
            constrainToScreen(target);
            
            if (globalSettings.autoScaleFont) applyAutoScaleFont();
        } 
        else if (action === 'drag') {
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;
            
            const rect = target.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            
            const maxX = window.innerWidth - width;
            const maxY = window.innerHeight - height;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            target.style.left = newLeft + 'px';
            target.style.top = newTop + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (!target) return;
        target.style.transition = '';
        document.body.style.cursor = '';
        
        constrainToScreen(target);
        
        const x = parseInt(target.style.left) || 0;
        const y = parseInt(target.style.top) || 0;
        const w = target.offsetWidth;
        const h = target.offsetHeight;
        
        saveWindowPosition(target.id, x, y);
        
        if (target.id === 'settings-panel') {
            globalSettings.settingsSize = { w, h };
        } else if (target.id === 'widget-context-menu') {
            globalSettings.contextMenuSize = { w, h };
        } else if (target.id === 'widget-menu') {
            globalSettings.widgetMenuSize = { w, h };
        }
        
        saveSettings();
        
        action = null;
        target = null;
    });

    window.addEventListener('resize', () => {
        if (settingsPanel && !settingsPanel.classList.contains('hidden')) constrainToScreen(settingsPanel);
        if (contextMenu && !contextMenu.classList.contains('hidden')) constrainToScreen(contextMenu);
        if (widgetMenu && !widgetMenu.classList.contains('hidden')) constrainToScreen(widgetMenu);
    });
}
