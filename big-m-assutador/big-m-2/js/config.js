/**
 * js/config.js - Configurações centrais, constantes de balanceamento e mapeamento de teclas.
 * Fonte única da verdade (Single Source of Truth) para todo o jogo.
 * Namespace global: window.SI.CONFIG
 */

window.SI = window.SI || {};

window.SI.CONFIG = {
  // --- Vídeo e Resolução ---
  VIDEO: {
    LOGICAL_WIDTH: 224,      // Grade lógica do arcade original (ref.)
    LOGICAL_HEIGHT: 256,     // Grade lógica do arcade original (ref.)
    RENDER_SCALE: 4,         // Fator de escala interna (896x1024)
    PIXEL_ART: true          // true = pixel art sem suavização; false = texturas suavizadas
  },

  // --- Loop de Jogo em Passo Fixo ---
  LOOP: {
    TARGET_FPS: 60,
    TIMESTEP: 1000 / 60      // Passo fixo de 60 Hz (16.666ms)
  },

  // --- Chaves dos Recursos e Modos ---
  FEATURES: {
    bulletHell: true,        // Padrões de tiros avançados estilo Touhou
    parry: true,             // Mecânica de Parry com tecla C
    items: true,             // Drops determinísticos a cada 20 abates (mantido para UFO)
    specials: true,          // Especiais recarregáveis
    boss: true,              // Bosses a cada 5 waves
    focusMode: true          // Modo foco (Shift) com hitbox visível
  },

  // --- Mapeamento Único de Teclas (Single Source of Truth) ---
  KEYBINDS: {
    moveLeft: ['ArrowLeft', 'KeyA'],
    moveRight: ['ArrowRight', 'KeyD'],
    fire: ['Space'],
    parry: ['KeyC'],
    special: ['KeyX'],
    focus: ['ShiftLeft', 'ShiftRight'],
    pause: ['KeyP', 'Escape'],
    mute: ['KeyM'],
    confirm: ['Enter'],
    commands: ['F1'],
    switchSuper: ['KeyQ']
  },

  KEYBIND_LABELS: {
    moveLeft: 'Mover para a Esquerda',
    moveRight: 'Mover para a Direita',
    fire: 'Disparar Canhão',
    parry: 'Parry (Aparar Projétil Magenta)',
    special: 'Ativar Arma Especial',
    focus: 'Modo Foco (Velocidade 0.4x + Hitbox)',
    pause: 'Pausar / Retomar Jogo',
    mute: 'Alternar Som (Mudo)',
    confirm: 'Confirmar / Iniciar / Reiniciar',
    commands: 'Painel de Comandos',
    switchSuper: 'Trocar Super Equipado'
  },

  // Atalhos do Modo Debug (?debug=1)
  DEBUG_KEYS: {
    itemForce: 'KeyI',       // Força próximo abate a soltar Item Comum
    specialForce: 'KeyO',    // Força próximo abate a soltar Especial
    killAll: 'KeyK',         // Elimina todos os invasores vivos da onda
    bossJump: 'KeyB',        // Salta para a próxima wave de boss
    skipWave: 'KeyN'         // Pula a wave atual
  },

  // --- Jogador (Canhão) ---
  PLAYER: {
    SPEED: 2.5,              // 2.5 px lógicos/frame para esquiva em bullet hell (ref.)
    FOCUS_SPEED_MULT: 0.4,   // 0.4x da velocidade normal durante o modo foco
    HITBOX_RADIUS: 3.0,      // Hitbox real circular de 3 px centralizado no sprite
    INITIAL_LIVES: 3,        // 3 vidas iniciais (ref.)
    EXTRA_LIFE_SCORE: 1500,  // Vida extra única em 1.500 pontos (ref.)
    WIDTH: 13,               // Largura visual do sprite (ref.)
    HEIGHT: 8,               // Altura visual do sprite (ref.)
    START_X: 105,            // Posição X inicial (centro aproximado)
    START_Y: 216,            // Posição Y inicial
    CANNON_Y: 216,           // Linha Y de referência do canhão
    GROUND_Y: 240,           // Linha verde do chão do arcade (ref.)
    MIN_X: 8,                // Limite horizontal esquerdo
    MAX_X: 203,              // Limite horizontal direito (224 - 13 - 8)
    RESPAWN_DELAY_FRAMES: 90 // ~1.5s ao ser destruído
  },

  // --- Disparo do Jogador ---
  PLAYER_SHOT: {
    SPEED: 4.0,              // ~4 px/frame subindo (ref.)
    WIDTH: 1,                // Largura do projétil básico
    HEIGHT: 4,               // Altura do projétil básico
    MAX_NORMAL: 1,           // Apenas UM tiro simultâneo por padrão (ref.)
    BURST_Y_TOP: 28          // Posição Y onde o tiro se dissipa no teto
  },

  // --- Sistema de Parry (Cuphead Style) ---
  PARRY: {
    WINDOW_MS: 180,          // Janela de antecipação do parry (180ms ≈ 11 frames)
    RING_RADIUS: 10.5,       // Raio do anel de parry (~3.5x o hitbox do jogador)
    IFRAMES_MS: 300,         // Duração da invencibilidade após parry bem-sucedido (300ms = 18 frames)
    SCORE_BONUS: 50,         // Pontos de bônus por parry bem-sucedido
    COLOR: '#ff2fd0',        // Magenta pulsante exclusivo para elementos parryable
    PARRYABLE_BY_TYPE: {
      linear: true,
      zigzag: true,
      fan: true,
      wall: true,
      spiral: true,
      burst: true,
      boss_shot: true,
      boss_beam: false       // O raio vertical do chefe NÃO é parryable
    }
  },

  // --- Bullet Hell & Safe Lanes ---
  BULLET_HELL: {
    SAFE_LANE_MIN_WIDTH: 19, // Largura mínima do corredor seguro (sprite 13px + 6px)
    BASE_SPEED: 1.25,        // Velocidade base dos projéteis inimigos
    MAX_ENEMY_BULLETS: function(wave) {
      return Math.min(80, 12 + wave * 4);
    }
  },

  // --- Tabela de Tiers de Qualidade (Compartilhada entre Itens e Especiais) ---
  TIER_TABLE: [
    { tier: 0, name: 'Comum',    weight: 0.40, mult: 1.0, color: '#9aa0a6' },
    { tier: 1, name: 'Incomum',  weight: 0.27, mult: 1.3, color: '#33d17a' },
    { tier: 2, name: 'Raro',     weight: 0.18, mult: 1.6, color: '#3fa9ff' },
    { tier: 3, name: 'Épico',    weight: 0.10, mult: 2.0, color: '#b46bff' },
    { tier: 4, name: 'Lendário', weight: 0.05, mult: 2.5, color: '#ffd23f' }
  ],

  // --- Sistema de Modificadores Permanentes de Tiro ---
  MODIFIERS: {
    TYPES: {
      PIERCE: 'pierce',
      RAPID: 'rapid',
      TRIPLE: 'triple',
      HOMING: 'homing',
      RICOCHET: 'ricochet'
    },
    DEFINITIONS: {
      pierce: {
        name: 'Tiro Perfurante',
        desc: 'Tiros atravessam inimigos sem serem destruídos.',
        icon: '🗡️',
        color: '#ff8800'
      },
      rapid: {
        name: 'Cadência Acelerada',
        desc: 'Dispare mais rápido com vários tiros na tela.',
        icon: '⚡',
        color: '#ffd23f'
      },
      triple: {
        name: 'Tiro Triplo',
        desc: 'Cada disparo sai em leque de 3 projéteis.',
        icon: '🔱',
        color: '#22e6ff'
      },
      homing: {
        name: 'Tiro Teleguiado',
        desc: 'Projéteis curvam suavemente em direção ao inimigo mais próximo.',
        icon: '🎯',
        color: '#33d17a'
      },
      ricochet: {
        name: 'Tiro Ricochete',
        desc: 'Tiros ricocheteiam nas bordas laterais uma vez.',
        icon: '💎',
        color: '#b46bff'
      }
    },
    RAPID_MAX_SHOTS: 4,
    RAPID_COOLDOWN_FRAMES: 10,
    TRIPLE_PROJECTILES: 3,
    TRIPLE_SPREAD_DEG: 24,
    HOMING_TURN_RATE: 0.04,
    RICOCHET_MAX_BOUNCES: 1,
    CHOICES_PER_WAVE: 3
  },

  // --- Sistema de Itens Comuns (mantido apenas para drops de UFO) ---
  ITEMS: {
    ITEM_DROP_INTERVAL: 20,  // Drop determinístico nos abates múltiplos de 20
    BASE_DURATION_SEC: 6,    // Duração base de 6s, multiplicada pelo tier
    MAX_ACTIVE: 2,           // Até 2 slots de itens ativos simultaneamente
    FALL_SPEED: 0.75,        // Cápsula desce reta e devagar
    WIDTH: 8,
    HEIGHT: 8,
    TYPES: {
      PIERCE: 'pierce',
      RAPID: 'rapid',
      TRIPLE: 'triple'
    },
    RAPID_MAX_SHOTS: [4, 4, 5, 6, 7],      // Tiros simultâneos por tier (0 a 4)
    RAPID_COOLDOWN_FRAMES: 12,             // Intervalo fixo entre tiros
    TRIPLE_PROJECTILES: [3, 3, 3, 5, 7],   // Quantidade de tiros no leque por tier
    TRIPLE_MAX_SPREAD_DEG: 36,             // Leque de até ±36° no Tier 4
    PIERCE_BOSS_EXTRA_DMG: [0, 0, 0, 1, 2] // Dano extra por acerto no chefe por tier
  },

  // --- Sistema de Especiais Recarregáveis ---
  SPECIALS: {
    SPECIAL_DROP_INTERVAL: 70,             // Drop determinístico nos abates múltiplos de 70
    CHARGE_REQUIRED: 20,                   // Carga fixa necessária para ativar
    TYPES: {
      LASER: 'laser',
      BOMB: 'bomb',
      SHIELD: 'shield',
      SLOWFIELD: 'slowfield'
    },
    CHARGE_VALUES: {
      COMMON_KILL: 1,
      REINFORCEMENT_KILL: 1,
      UFO_KILL: 3,
      PARRY_SUCCESS: 1
    },
    BOSS_DAMAGE_REDUCTION: 0.45,           // Bosses recebem apenas 45% do dano dos supers
    CAST_LOCK_FRAMES: 30,                  // Jogador fica imóvel por 30 frames durante o cast

    LASER: {
      CONVERGE_FRAMES: 21,                 // 0.35s de convergência dos feixes
      DURATION_FRAMES: 90,                 // 1.5s de feixe (reduzido de ~2s)
      BEAM_WIDTH: 30,                      // Largura reduzida do feixe
      TICK_DAMAGE_INTERVAL: 8,             // Dano a cada 8 frames (menos frequente)
      DAMAGE_PER_TICK: 1,                  // 1 de dano por tick (reduzido)
      NAME: 'Laser Convergente',
      DESC: 'Converge feixes em um raio que varre a tela verticalmente.'
    },

    BOMB: {
      HP_PERCENT_DAMAGE: 0.50,             // Causa 50% da vida máxima de cada inimigo
      IFRAMES_FRAMES: 60,                  // 1s de invencibilidade
      NAME: 'Bomba Estelar',
      DESC: 'Causa 50% da vida a todos os inimigos e limpa projéteis.'
    },

    SHIELD: {
      DURATION_FRAMES: 180,                // 3s de escudo ativo
      RADIUS: 20,                          // Raio do escudo
      NAME: 'Escudo Quântico',
      DESC: 'Cria uma barreira que bloqueia projéteis por 3 segundos.'
    },

    SLOWFIELD: {
      DURATION_FRAMES: 300,                // 5s de campo de lentidão
      SLOW_FACTOR: 0.35,                   // 35% da velocidade normal
      NAME: 'Campo Temporal',
      DESC: 'Reduz a velocidade de inimigos e projéteis por 5 segundos.'
    }
  },

  // --- Bosses (a cada 5 waves) ---
  BOSS: {
    BOSS_INTERVAL: 5,                      // Boss aparece a cada 5 waves
    WARNING_FRAMES: 120,                   // 2.0s de aviso WARNING
    DESCEND_FRAMES: 120,                   // 2.0s de descida
    INVULNERABLE_FRAMES: 120,              // 2.0s de invulnerabilidade ao surgir
    PLAYER_RESPAWN_INVULN_FRAMES: 120,     // 2.0s de invulnerabilidade ao renascer na luta
    DEATH_EXPLOSION_FRAMES: 180,           // 3.0s de explosões ao morrer
    INTRO_FREEZE_FRAMES: 30,              // 0.5s de congelamento inicial

    // HP base escala com o número do boss (1º, 2º, 3º...)
    BASE_HP: 80,
    HP_PER_BOSS_NUMBER: 30,

    WIDTH: 48,
    HEIGHT: 24,
    Y_FIGHT: 44,

    PHASES: {
      PHASE_1: { hpThreshold: 1.00, speed: 0.8, color: '#33d17a' },
      PHASE_2: { hpThreshold: 0.66, speed: 1.3, color: '#ffd23f' },
      PHASE_3: { hpThreshold: 0.33, speed: 1.8, color: '#ff3344' }
    },
    REINFORCEMENTS: {
      INTERVAL_FRAMES: 12 * 60,            // A cada ~12s
      SPAWN_COUNT: 7,                      // 6 a 8 mini-invasores
      MAX_ALIVE: 10                        // Teto de 10 vivos simultâneos
    },

    // Visuais de cada boss (cor principal, cor secundária)
    BOSS_THEMES: [
      { name: 'Comandante Void',    color1: '#551177', color2: '#ff2fd0', eyeColor: '#22e6ff' },
      { name: 'Almirante Blaze',    color1: '#882200', color2: '#ff8800', eyeColor: '#ffd23f' },
      { name: 'General Frost',      color1: '#004488', color2: '#22e6ff', eyeColor: '#ffffff' },
      { name: 'Imperador Neon',     color1: '#006644', color2: '#33d17a', eyeColor: '#ffd23f' },
      { name: 'Lorde Carmesim',     color1: '#660022', color2: '#ff3344', eyeColor: '#ff2fd0' },
      { name: 'Arauto Dourado',     color1: '#664400', color2: '#ffd23f', eyeColor: '#ffffff' }
    ]
  },

  // --- Formação de Invasores (escala com wave) ---
  FORMATION: {
    BASE_ROWS: 5,                          // Linhas base
    COLS: 11,                              // 11 colunas = 55 invasores base
    BASE_INVADERS: 55,                     // Base count
    EXTRA_PER_WAVE: 4,                     // +4 inimigos por wave (distribuído)
    MAX_ROWS: 7,                           // Máximo de linhas
    SPACING_X: 16,                         // Espaçamento horizontal
    SPACING_Y: 16,                         // Espaçamento vertical
    STEP_X: 2,                             // Passo de 2 px por movimento
    STEP_Y: 8,                             // Descida de 8 px ao tocar a borda
    MARGIN_LEFT: 8,                        // Margem esquerda
    MARGIN_RIGHT: 208,                     // Margem direita
    START_X: 24,                           // X da primeira coluna na onda 1
    WAVE_START_Y_CYCLE: [64, 72, 80, 88, 96, 104, 112, 120], // Ciclo de 8 posições
    POINTS: {
      ROW_TOP: 30,                         // Invasor pequeno = 30 pts
      ROW_MID: 20,                         // Invasor médio = 20 pts
      ROW_BOT: 10                          // Invasor grande = 10 pts
    },
    EXPLOSION_FRAMES: 15,                  // Tempo do sprite de explosão

    // Tipos de inimigos novos (introduzidos por wave)
    ENEMY_TYPES: {
      // Wave 1: clássicos
      BASIC: { minWave: 1, hp: 1, color: '#ffffff', name: 'Básico' },
      // Wave 2: zig-zag - move lateralmente ao descer
      ZIGZAG: { minWave: 2, hp: 1, color: '#ffd23f', name: 'Zigue-Zague' },
      // Wave 3: blindado - aguenta 2 tiros
      ARMORED: { minWave: 3, hp: 2, color: '#3fa9ff', name: 'Blindado' },
      // Wave 4: veloz - move 2x mais rápido
      SPEEDER: { minWave: 4, hp: 1, color: '#33d17a', name: 'Veloz' },
      // Wave 5: (boss wave, novos tipos continuam)
      // Wave 6: divisor - ao morrer, se divide em 2 fragmentos
      SPLITTER: { minWave: 6, hp: 2, color: '#ff8800', name: 'Divisor' },
      // Wave 7: atirador - dispara mais frequentemente
      GUNNER: { minWave: 7, hp: 1, color: '#ff3344', name: 'Atirador' },
      // Wave 8: fantasma - pisca e fica transparente periodicamente
      GHOST: { minWave: 8, hp: 1, color: '#b46bff', name: 'Fantasma' },
      // Wave 9: tanque - muita vida
      TANK: { minWave: 9, hp: 4, color: '#888888', name: 'Tanque' },
      // Wave 11: bombardeiro - solta tiro ao morrer
      BOMBER: { minWave: 11, hp: 2, color: '#ff2fd0', name: 'Bombardeiro' },
      // Wave 13: regenerador - recupera HP lentamente
      REGEN: { minWave: 13, hp: 3, color: '#00ff88', name: 'Regenerador' }
    }
  },

  // --- Bunkers (4 Abrigos com corrosão por pixel) ---
  BUNKERS: {
    COUNT: 4,
    WIDTH: 22,
    HEIGHT: 16,
    Y: 192,
    X_POSITIONS: [32, 76, 120, 164],
    EROSION_RADIUS_PLAYER: 3,
    EROSION_RADIUS_ENEMY: 3,
    EROSION_RADIUS_INVADER: 4
  },

  // --- UFO (Nave Mistério) ---
  UFO: {
    SPAWN_INTERVAL_FRAMES: 25 * 60,        // A cada ~25s
    MIN_INVADERS_ALIVE: 8,                 // Apenas com >= 8 invasores vivos
    Y: 42,
    WIDTH: 16,
    HEIGHT: 8,
    SPEED: 1.0,
    POINTS_TABLE: [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100, 50],
    SCORE_DISPLAY_FRAMES: 45
  },

  // --- Dificuldade por Wave ---
  WAVE_SCALING: {
    // Velocidade base de tiros inimigos escala
    ENEMY_SHOT_SPEED_MULT: function(wave) {
      return 1.0 + (wave - 1) * 0.06;
    },
    // Cadência de tiro inimigo (intervalo em frames entre rajadas)
    ENEMY_RELOAD_TIME: function(wave) {
      return Math.max(12, 55 - wave * 3);
    },
    // Número de colunas que atiram por ciclo
    FIRING_COLUMNS: function(wave) {
      return Math.min(4, 1 + Math.floor(wave / 2));
    },
    // HP extra para inimigos por wave
    ENEMY_HP_BONUS: function(wave) {
      return Math.floor((wave - 1) / 5);
    }
  },

  // --- Textos e Mensagens Oficiais ---
  STRINGS: {
    GAME_TITLE: "INVASORES",
    SCORE_HEADER: "SCORE",
    HI_SCORE_HEADER: "HI-SCORE",
    WAVE_HEADER: "ONDA",
    PUSH_ENTER: "PRESS ENTER TO START",
    PAUSED: "PAUSADO",
    GAME_OVER: "GAME OVER",
    VICTORY: "MISSÃO CUMPRIDA!",
    WARNING: "WARNING! ALERTA DE CHEFE!",
    BOSS_HP: "BOSS HP",
    POINTS_TABLE_TITLE: "* TABELA DE PONTOS *",
    POINTS_UFO: "=?  NAVE MISTÉRIO",
    POINTS_SMALL: "=30 PONTOS",
    POINTS_MEDIUM: "=20 PONTOS",
    POINTS_LARGE: "=10 PONTOS",
    CREDITS: "1 JOGADOR - ARCADE V2",
    PARRY_TEXT: "PARRY!",
    MODIFIER_TITLE: "ESCOLHA UM MODIFICADOR",
    MODIFIER_SUBTITLE: "Permanente até o fim da partida",
    CASTING: "CONJURANDO..."
  }
};
