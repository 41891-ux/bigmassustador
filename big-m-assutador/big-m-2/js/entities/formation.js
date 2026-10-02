/**
 * js/entities/formation.js - Formação de invasores com tipos únicos por wave.
 * Cada wave introduz novos tipos de inimigos. Quantidade escala gradualmente.
 * Inimigos com HP > 1, comportamentos especiais (zigzag, fantasma, divisor, etc.)
 * Namespace global: window.SI.Formation
 */

window.SI = window.SI || {};

window.SI.Formation = (function() {
  const CFG = SI.CONFIG.FORMATION;

  class Invader {
    constructor(row, col, x, y, type, points, enemyType) {
      this.row = row;
      this.col = col;
      this.x = x;
      this.y = y;
      this.type = type; // visual sprite: 'invader_small', 'invader_medium', 'invader_large'
      this.points = points;
      this.alive = true;
      this.explodingTimer = 0;
      this.animFrame = 0;

      // Tipo de inimigo especial
      this.enemyType = enemyType || 'BASIC'; // 'BASIC', 'ZIGZAG', 'ARMORED', etc.
      const typeDef = CFG.ENEMY_TYPES[enemyType] || CFG.ENEMY_TYPES.BASIC;
      this.maxHp = typeDef.hp || 1;
      this.hp = this.maxHp;
      this.specialColor = typeDef.color || null;

      // Dimensões lógicas exatas
      if (type === 'invader_small') {
        this.width = 8;
        this.height = 8;
      } else if (type === 'invader_medium') {
        this.width = 11;
        this.height = 8;
      } else {
        this.width = 12;
        this.height = 8;
      }

      // Comportamentos especiais
      this.zigzagOffset = 0;
      this.zigzagDir = SI.Util.random() < 0.5 ? 1 : -1;
      this.ghostTimer = Math.floor(SI.Util.random() * 120);
      this.isGhosted = false;
      this.regenTimer = 0;
      this.speedMult = (enemyType === 'SPEEDER') ? 2.0 : 1.0;
      this.gunnerCooldown = 0;
    }
  }

  class Formation {
    constructor() {
      this.invaders = [];
      this.livingInvaders = [];
      this.currentInvaderIndex = 0;
      this.direction = 1;
      this.dropCycleActive = false;
      this.edgeTriggered = false;
      this.wave = 1;
      this.waveYOffsetIndex = 0;
      this.splitQueue = []; // Cola para inimigos que se dividem ao morrer

      this.initWave(1);
    }

    initWave(waveNumber = 1) {
      this.wave = waveNumber;
      this.invaders = [];
      this.livingInvaders = [];
      this.currentInvaderIndex = 0;
      this.direction = 1;
      this.dropCycleActive = false;
      this.edgeTriggered = false;
      this.splitQueue = [];

      // Posição Y inicial da onda conforme ciclo de 8 posições
      this.waveYOffsetIndex = (waveNumber - 1) % CFG.WAVE_START_Y_CYCLE.length;
      const startY = CFG.WAVE_START_Y_CYCLE[this.waveYOffsetIndex];
      const startX = CFG.START_X;

      // Calcula número de linhas para esta wave
      const extraRows = Math.min(Math.floor((waveNumber - 1) / 3), CFG.MAX_ROWS - CFG.BASE_ROWS);
      const rows = CFG.BASE_ROWS + extraRows;

      // Tipos disponíveis para esta wave
      const availableTypes = this.getAvailableEnemyTypes(waveNumber);

      // Gera a formação
      for (let r = 0; r < rows; r++) {
        let type = 'invader_large';
        let pts = CFG.POINTS.ROW_BOT;

        if (r === 0) {
          type = 'invader_small';
          pts = CFG.POINTS.ROW_TOP;
        } else if (r <= 2) {
          type = 'invader_medium';
          pts = CFG.POINTS.ROW_MID;
        }

        for (let c = 0; c < CFG.COLS; c++) {
          const x = startX + c * CFG.SPACING_X;
          const y = startY + r * CFG.SPACING_Y;

          // Seleciona tipo de inimigo especial baseado na wave
          let enemyType = 'BASIC';
          if (availableTypes.length > 1 && waveNumber > 1) {
            // Distribui tipos especiais nas linhas e colunas
            const specialChance = Math.min(0.6, 0.1 + waveNumber * 0.04);
            if (SI.Util.random() < specialChance) {
              // Tipos mais recentes aparecem com menos frequência
              const typeIndex = Math.floor(SI.Util.random() * availableTypes.length);
              enemyType = availableTypes[typeIndex];
            }
          }

          // Adiciona HP bônus por wave
          const invader = new Invader(r, c, x, y, type, pts, enemyType);
          const hpBonus = SI.CONFIG.WAVE_SCALING.ENEMY_HP_BONUS(waveNumber);
          invader.maxHp += hpBonus;
          invader.hp = invader.maxHp;

          this.invaders.push(invader);
          this.livingInvaders.push(invader);
        }
      }
    }

    getAvailableEnemyTypes(wave) {
      const types = [];
      const allTypes = CFG.ENEMY_TYPES;
      for (const key in allTypes) {
        if (allTypes[key].minWave <= wave) {
          types.push(key);
        }
      }
      return types;
    }

    getLivingCount() {
      return this.livingInvaders.length;
    }

    // --- Movimento 1:1 com o Arcade Original ---
    update(bunkers) {
      // 1. Processa splits pendentes
      if (this.splitQueue.length > 0) {
        for (const split of this.splitQueue) {
          this.livingInvaders.push(split);
          this.invaders.push(split);
        }
        this.splitQueue = [];
      }

      // 2. Atualiza temporizadores de explosão
      for (let i = 0; i < this.invaders.length; i++) {
        const inv = this.invaders[i];
        if (!inv.alive && inv.explodingTimer > 0) {
          inv.explodingTimer--;
        }
      }

      // 3. Atualiza comportamentos especiais de inimigos vivos
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (!inv.alive) continue;

        // Fantasma: alterna entre visível e invisível
        if (inv.enemyType === 'GHOST') {
          inv.ghostTimer++;
          inv.isGhosted = (inv.ghostTimer % 120) > 80;
        }

        // Regenerador: recupera 1 HP a cada 5s
        if (inv.enemyType === 'REGEN' && inv.hp < inv.maxHp) {
          inv.regenTimer++;
          if (inv.regenTimer >= 300) {
            inv.regenTimer = 0;
            inv.hp = Math.min(inv.maxHp, inv.hp + 1);
          }
        }

        // Atirador: rastreia cooldown
        if (inv.enemyType === 'GUNNER') {
          if (inv.gunnerCooldown > 0) inv.gunnerCooldown--;
        }
      }

      if (this.livingInvaders.length === 0) return;

      if (this.currentInvaderIndex >= this.livingInvaders.length) {
        this.currentInvaderIndex = 0;
        this.onFullCycleComplete();
      }

      // Exatamente UM invasor vivo é atualizado a cada frame (60 Hz).
      const invader = this.livingInvaders[this.currentInvaderIndex];
      if (invader && invader.alive) {
        const spdMult = invader.speedMult || 1.0;

        if (this.dropCycleActive) {
          invader.y += CFG.STEP_Y;
          if (bunkers) {
            bunkers.checkInvaderOverlap(invader);
          }
        } else {
          const stepX = CFG.STEP_X * spdMult;
          invader.x += this.direction * stepX;

          // Zigue-zague: movimenta lateralmente extra
          if (invader.enemyType === 'ZIGZAG') {
            invader.zigzagOffset += invader.zigzagDir * 0.3;
            if (Math.abs(invader.zigzagOffset) > 4) {
              invader.zigzagDir = -invader.zigzagDir;
            }
          }

          // Verifica se tocou a borda lateral
          if (
            (this.direction === 1 && invader.x + invader.width >= CFG.MARGIN_RIGHT) ||
            (this.direction === -1 && invader.x <= CFG.MARGIN_LEFT)
          ) {
            this.edgeTriggered = true;
          }
        }

        invader.animFrame = 1 - invader.animFrame;
      }

      this.currentInvaderIndex++;
      if (this.currentInvaderIndex >= this.livingInvaders.length) {
        this.currentInvaderIndex = 0;
        this.onFullCycleComplete();
      }
    }

    onFullCycleComplete() {
      SI.Audio.playMarchStep();

      if (this.dropCycleActive) {
        this.dropCycleActive = false;
        this.edgeTriggered = false;
      } else if (this.edgeTriggered) {
        this.dropCycleActive = true;
        this.direction = -this.direction;
        this.edgeTriggered = false;
      }
    }

    hasReachedCannonLine(cannonY) {
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (inv.y + inv.height >= cannonY) {
          return true;
        }
      }
      return false;
    }

    findLowestInvaderInCol(col) {
      let lowest = null;
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (inv.col === col) {
          if (!lowest || inv.y > lowest.y) {
            lowest = inv;
          }
        }
      }
      return lowest;
    }

    findLowestInvaderNearX(targetX) {
      let closest = null;
      let minDiff = Infinity;

      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        const diff = Math.abs((inv.x + inv.width / 2) - targetX);
        if (diff < minDiff) {
          minDiff = diff;
          closest = inv;
        }
      }
      return closest;
    }

    getLowestInvadersAllCols() {
      const result = [];
      for (let c = 0; c < CFG.COLS; c++) {
        const lowest = this.findLowestInvaderInCol(c);
        if (lowest) result.push(lowest);
      }
      return result;
    }

    // Retorna inimigos do tipo GUNNER que estão prontos para atirar
    getGunnerInvaders() {
      const gunners = [];
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (inv.enemyType === 'GUNNER' && inv.gunnerCooldown <= 0) {
          gunners.push(inv);
        }
      }
      return gunners;
    }

    // Aplica dano a um invasor. Retorna true se o invasor morreu.
    damageInvader(invader, damage) {
      if (!invader.alive) return false;

      // Fantasmas ghosted são imunes
      if (invader.enemyType === 'GHOST' && invader.isGhosted) return false;

      invader.hp -= damage;
      if (invader.hp <= 0) {
        return true; // Morreu
      }
      return false; // Ainda vivo
    }

    killInvader(invader) {
      if (!invader.alive) return;
      invader.alive = false;
      invader.explodingTimer = CFG.EXPLOSION_FRAMES;

      // Divisor: gera 2 fragmentos ao morrer
      if (invader.enemyType === 'SPLITTER' && invader.maxHp > 1) {
        const fragment1 = new Invader(
          invader.row, invader.col,
          invader.x - 6, invader.y,
          'invader_small', Math.ceil(invader.points / 2), 'BASIC'
        );
        fragment1.maxHp = 1;
        fragment1.hp = 1;

        const fragment2 = new Invader(
          invader.row, invader.col,
          invader.x + 6, invader.y,
          'invader_small', Math.ceil(invader.points / 2), 'BASIC'
        );
        fragment2.maxHp = 1;
        fragment2.hp = 1;

        this.splitQueue.push(fragment1, fragment2);
      }

      const idx = this.livingInvaders.indexOf(invader);
      if (idx !== -1) {
        this.livingInvaders.splice(idx, 1);
        if (this.currentInvaderIndex > idx) {
          this.currentInvaderIndex--;
        }
      }

      SI.Audio.playInvaderExplosion();
    }

    killAll() {
      for (let i = this.livingInvaders.length - 1; i >= 0; i--) {
        const inv = this.livingInvaders[i];
        inv.alive = false;
        inv.explodingTimer = 10;
      }
      this.livingInvaders.length = 0;
      this.currentInvaderIndex = 0;
    }

    render(ctx) {
      // 1. Invasores vivos
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];

        // Fantasma ghosted: semi-transparente
        if (inv.enemyType === 'GHOST' && inv.isGhosted) {
          ctx.save();
          ctx.globalAlpha = 0.25;
        }

        // Desenha o sprite base
        SI.Assets.draw(ctx, inv.type, inv.x + (inv.zigzagOffset || 0), inv.y, inv.animFrame, inv.width, inv.height);

        // Overlay de cor para tipos especiais
        if (inv.specialColor && inv.enemyType !== 'BASIC') {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = inv.specialColor;
          ctx.fillRect(Math.round(inv.x + (inv.zigzagOffset || 0)), Math.round(inv.y), inv.width, inv.height);
          ctx.restore();
        }

        // Barra de HP para inimigos com mais de 1 HP
        if (inv.maxHp > 1) {
          const barW = inv.width;
          const barH = 2;
          const barX = Math.round(inv.x + (inv.zigzagOffset || 0));
          const barY = Math.round(inv.y - 3);
          ctx.fillStyle = '#140a2e';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = inv.specialColor || '#33d17a';
          ctx.fillRect(barX, barY, Math.round(barW * (inv.hp / inv.maxHp)), barH);
        }

        if (inv.enemyType === 'GHOST' && inv.isGhosted) {
          ctx.restore();
        }
      }

      // 2. Explosões temporárias dos destruídos
      for (let i = 0; i < this.invaders.length; i++) {
        const inv = this.invaders[i];
        if (!inv.alive && inv.explodingTimer > 0) {
          SI.Assets.draw(ctx, 'invader_death', inv.x, inv.y, 0, 13, 8);
        }
      }
    }
  }

  return Formation;
})();
