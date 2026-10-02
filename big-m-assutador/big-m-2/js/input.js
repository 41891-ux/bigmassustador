/**
 * js/input.js - Gerenciador central de entradas físicas (event.code) e ações lógicas.
 * Único dono do Set de teclas ativas (_activeCodes). Previne teclas presas em blur,
 * aplica preventDefault seletivo e fornece leitura determinística a 60 Hz.
 * REVISADO: Garante que todas as teclas da tela de comandos funcionem sem conflito.
 * Namespace global: window.SI.Input
 */

window.SI = window.SI || {};

window.SI.Input = (function() {
  const _activeCodes = new Set();
  const _justPressedCodes = new Set();
  const _justPressedBuffer = new Set(); // Buffer para evitar perda de inputs entre frames
  const _registeredGameCodes = new Set();

  let _initialized = false;

  function init() {
    if (_initialized) return;

    buildRegisteredCodes();

    window.addEventListener('keydown', onKeyDown, { passive: false, capture: true });
    window.addEventListener('keyup', onKeyUp, { passive: false, capture: true });

    window.addEventListener('blur', () => {
      clearAllKeys();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearAllKeys();
      }
    });

    setupTouchButtons();
    _initialized = true;
  }

  function buildRegisteredCodes() {
    _registeredGameCodes.clear();
    const KB = SI.CONFIG.KEYBINDS;
    if (KB) {
      for (const action in KB) {
        const codes = KB[action];
        if (Array.isArray(codes)) {
          codes.forEach(c => _registeredGameCodes.add(c));
        }
      }
    }

    const DBG = SI.CONFIG.DEBUG_KEYS;
    if (DBG) {
      for (const k in DBG) {
        _registeredGameCodes.add(DBG[k]);
      }
    }
  }

  function onKeyDown(e) {
    const code = e.code;

    if (SI.Audio && SI.Audio.resume) {
      SI.Audio.resume();
    }

    // Previne default para todas as teclas do jogo (inclui F1, Escape, Space, Shift, etc.)
    if (_registeredGameCodes.has(code)) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!_activeCodes.has(code)) {
      _justPressedCodes.add(code);
      _justPressedBuffer.add(code);
    }
    _activeCodes.add(code);
  }

  function onKeyUp(e) {
    const code = e.code;
    if (_registeredGameCodes.has(code)) {
      e.preventDefault();
      e.stopPropagation();
    }
    _activeCodes.delete(code);
  }

  function clearAllKeys() {
    _activeCodes.clear();
    _justPressedCodes.clear();
    _justPressedBuffer.clear();
  }

  function isActionDown(actionName) {
    const codes = SI.CONFIG.KEYBINDS[actionName];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (_activeCodes.has(codes[i])) return true;
    }
    return false;
  }

  function isActionJustPressed(actionName) {
    const codes = SI.CONFIG.KEYBINDS[actionName];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (_justPressedCodes.has(codes[i])) {
        _justPressedCodes.delete(codes[i]);
        return true;
      }
      // Also check buffer for inputs that may have been missed
      if (_justPressedBuffer.has(codes[i])) {
        _justPressedBuffer.delete(codes[i]);
        return true;
      }
    }
    return false;
  }

  function isCodeDown(code) {
    return _activeCodes.has(code);
  }

  function isCodeJustPressed(code) {
    if (_justPressedCodes.has(code)) {
      _justPressedCodes.delete(code);
      return true;
    }
    if (_justPressedBuffer.has(code)) {
      _justPressedBuffer.delete(code);
      return true;
    }
    return false;
  }

  function clearFrame() {
    _justPressedCodes.clear();
    _justPressedBuffer.clear();
  }

  function getActiveCodesList() {
    return Array.from(_activeCodes);
  }

  function setupTouchButtons() {
    bindTouchAction('btn-left', 'ArrowLeft');
    bindTouchAction('btn-right', 'ArrowRight');
    bindTouchAction('btn-fire', 'Space');
    bindTouchAction('btn-special', 'KeyX');
    bindTouchAction('btn-parry', 'KeyC');
  }

  function bindTouchAction(elementId, virtualCode) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const start = (e) => {
      e.preventDefault();
      if (SI.Audio && SI.Audio.resume) SI.Audio.resume();
      if (!_activeCodes.has(virtualCode)) {
        _justPressedCodes.add(virtualCode);
        _justPressedBuffer.add(virtualCode);
      }
      _activeCodes.add(virtualCode);
    };

    const end = (e) => {
      e.preventDefault();
      _activeCodes.delete(virtualCode);
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  return {
    init,
    isActionDown,
    isActionJustPressed,
    isCodeDown,
    isCodeJustPressed,
    clearFrame,
    clearAllKeys,
    getActiveCodesList
  };
})();
