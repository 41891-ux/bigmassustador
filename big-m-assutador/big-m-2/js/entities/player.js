/**
 * js/entities/player.js - Canhão do jogador com modificadores permanentes de tiro,
 * seleção de super equipado, mecânica de cast lock (imóvel durante conjuração),
 * hitbox reduzido de 3px, anel de parry e modo foco.
 * Namespace global: window.SI.Player
 */

window.SI = window.SI || {};

window.SI.Player = (function() {
  const P_CFG = SI.CONFIG.PLAYER;
  const PARRY_CFG = SI.CONFIG.PARRY;
  const MOD_CFG = SI.CONFIG.MODIFIERS;
  const SP_CFG = SI.CONFIG.SPECIALS;

  class Player {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = P_CFG.START_X;
      this.y = P_CFG.START_Y;
      this.width = P_CFG.WIDTH;
      this.height = P_CFG.HEIGHT;
      this.lives = P_CFG.INITIAL_LIVES;
      this.alive = true;
      this.deathTimer = 0;
      this.invulnerableTimer = 0;
      this.shotCooldown = 0;

      // Hitbox circular reduzido (3px) para bullet hell
      this.hitboxRadius = P_CFG.HITBOX_RADIUS;

      // Anel de parry (10.5px)
      this.parryRingRadius = PARRY_CFG.RING_RADIUS;
      this.parryPulseTimer = 0;
      this.parryCooldownTimer = 0;

      // Efeito de feedback "PARRY!"
      this.parryFeedbacks = [];

      // Modificadores Permanentes de Tiro (acumuláveis)
      this.modifiers = {}; // { pierce: true, rapid: true, etc. }
      this.modifierCount = 0; // Quantas vezes cada mod foi pego (para stacking)
      this.modifierStacks = {}; // { pierce: 1, rapid: 2, etc. }

      // Itens Comuns Ativos (Máximo de 2 slots simultâneos, mantido para UFO drops)
      this.activeItems = {};

      // Super Equipado e Barra de Carga
      this.equippedSuper = SP_CFG.TYPES.LASER;
      this.availableSupers = [SP_CFG.TYPES.LASER, SP_CFG.TYPES.BOMB]; // Desbloqueados
      this.specialCharge = 0;

      // Cast Lock: jogador imóvel durante conjuração de super
      this.castLockTimer = 0;
      this.isCasting = false;

      // Estado de Foco
      this.isFocusing = false;
    }

    getCenterX() {
      return this.x + this.width / 2;
    }

    getCenterY() {
      return this.y + this.height / 2;
    }

    getHitboxCircle() {
      return {
        x: this.getCenterX(),
        y: this.getCenterY(),
        radius: this.hitboxRadius
      };
    }

    getParryRingCircle() {
      return {
        x: this.getCenterX(),
        y: this.getCenterY(),
        radius: this.parryRingRadius
      };
    }

    update(isLaserActive = false) {
      if (!this.alive) {
        if (this.deathTimer > 0) this.deathTimer--;
        return;
      }

      // 1. Atualização dos timers
      if (this.invulnerableTimer > 0) this.invulnerableTimer--;
      if (this.shotCooldown > 0) this.shotCooldown--;
      if (this.parryPulseTimer > 0) this.parryPulseTimer--;
      if (this.parryCooldownTimer > 0) this.parryCooldownTimer--;

      // Cast lock timer
      if (this.castLockTimer > 0) {
        this.castLockTimer--;
        this.isCasting = true;
        if (this.castLockTimer <= 0) {
          this.isCasting = false;
        }
        return; // Não pode se mover nem atirar durante cast
      }
      this.isCasting = false;

      // 2. Atualização dos itens comuns ativos (temporários - de drops UFO)
      for (const type in this.activeItems) {
        const item = this.activeItems[type];
        item.timer--;
        if (item.timer <= 0) {
          delete this.activeItems[type];
        }
      }

      // 3. Atualização dos textos flutuantes de feedback do parry
      for (let i = this.parryFeedbacks.length - 1; i >= 0; i--) {
        const fb = this.parryFeedbacks[i];
        fb.y -= 0.5;
        fb.alpha -= 0.03;
        if (fb.alpha <= 0) {
          this.parryFeedbacks.splice(i, 1);
        }
      }

      // 4. Modo Foco (Shift)
      this.isFocusing = SI.CONFIG.FEATURES.focusMode && SI.Input.isActionDown('focus');

      // 5. Cálculo da velocidade de deslocamento
      let currentSpeed = P_CFG.SPEED;
      if (this.isFocusing) {
        currentSpeed *= P_CFG.FOCUS_SPEED_MULT;
      }
      if (isLaserActive) {
        currentSpeed *= 0.5; // 50% durante laser
      }

      // 6. Movimentação Estritamente Horizontal
      if (SI.Input.isActionDown('moveLeft')) {
        this.x -= currentSpeed;
      }
      if (SI.Input.isActionDown('moveRight')) {
        this.x += currentSpeed;
      }

      this.x = SI.Util.clamp(this.x, P_CFG.MIN_X, P_CFG.MAX_X);
    }

    // --- Travar jogador para cast de super ---
    startCastLock() {
      this.castLockTimer = SP_CFG.CAST_LOCK_FRAMES;
      this.isCasting = true;
    }

    // --- Mecânica de Parry ---
    attemptParry(shotsManager, boss, addScoreCallback) {
      if (!SI.CONFIG.FEATURES.parry || !this.alive || this.parryCooldownTimer > 0 || this.isCasting) return false;

      this.parryCooldownTimer = 12;
      this.parryPulseTimer = 10;

      const playerCenter = { x: this.getCenterX(), y: this.getCenterY() };
      let parriedAny = false;

      // 1. Verifica tiros inimigos comuns e padrões
      if (shotsManager && shotsManager.enemyShots) {
        for (let i = shotsManager.enemyShots.length - 1; i >= 0; i--) {
          const s = shotsManager.enemyShots[i];
          if (!s.parryable) continue;

          const sx = s.x + s.width / 2;
          const sy = s.y + s.height / 2;
          const dist = SI.Util.distance(playerCenter.x, playerCenter.y, sx, sy);

          const maxReachDist = this.parryRingRadius + (s.vy || 1.25) * 8;
          if (dist <= maxReachDist) {
            shotsManager.enemyShots.splice(i, 1);
            shotsManager.enemyShotPool.release(s);
            this.onParrySuccess(sx, sy, addScoreCallback);
            parriedAny = true;
            break;
          }
        }
      }

      // 2. Verifica projéteis do chefe
      if (!parriedAny && boss && boss.active && boss.bossShots) {
        for (let i = boss.bossShots.length - 1; i >= 0; i--) {
          const bs = boss.bossShots[i];
          if (bs.parryable === false) continue;

          const sx = bs.x + bs.width / 2;
          const sy = bs.y + bs.height / 2;
          const dist = SI.Util.distance(playerCenter.x, playerCenter.y, sx, sy);

          if (dist <= this.parryRingRadius + 10) {
            boss.bossShots.splice(i, 1);
            this.onParrySuccess(sx, sy, addScoreCallback);
            parriedAny = true;
            break;
          }
        }
      }

      if (!parriedAny) {
        SI.Audio.playParryAttempt();
      }

      return parriedAny;
    }

    onParrySuccess(x, y, addScoreCallback) {
      const iframes = Math.round(PARRY_CFG.IFRAMES_MS / (1000 / 60));
      this.invulnerableTimer = Math.max(this.invulnerableTimer, iframes);

      if (addScoreCallback) {
        addScoreCallback(PARRY_CFG.SCORE_BONUS);
      }

      this.addSpecialCharge(SP_CFG.CHARGE_VALUES.PARRY_SUCCESS);
      SI.Audio.playParrySuccess();

      this.parryFeedbacks.push({
        x: x || this.getCenterX(),
        y: (y || this.y) - 6,
        alpha: 1.0,
        scale: 1.2
      });
    }

    // --- Disparo do Jogador ---
    canShoot(activeCount) {
      if (!this.alive || this.isCasting) return false;

      // Se tem modificador rapid, permite mais tiros
      if (this.modifiers[MOD_CFG.TYPES.RAPID]) {
        const stacks = this.modifierStacks[MOD_CFG.TYPES.RAPID] || 1;
        const maxShots = 3 + stacks;
        return activeCount < maxShots && this.shotCooldown <= 0;
      }

      // Regra clássica: apenas UM disparo na tela por vez
      return activeCount < SI.CONFIG.PLAYER_SHOT.MAX_NORMAL;
    }

    registerShotFired() {
      if (this.modifiers[MOD_CFG.TYPES.RAPID]) {
        const stacks = this.modifierStacks[MOD_CFG.TYPES.RAPID] || 1;
        this.shotCooldown = Math.max(6, MOD_CFG.RAPID_COOLDOWN_FRAMES - stacks * 2);
      }
    }

    // --- Modificadores Permanentes de Tiro ---
    addModifier(modType) {
      if (!this.modifiers[modType]) {
        this.modifiers[modType] = true;
        this.modifierStacks[modType] = 1;
      } else {
        // Stacking - incrementa potência
        this.modifierStacks[modType] = (this.modifierStacks[modType] || 1) + 1;
      }
      this.modifierCount++;
    }

    hasModifier(modType) {
      return !!this.modifiers[modType];
    }

    getModifierStacks(modType) {
      return this.modifierStacks[modType] || 0;
    }

    // --- Coleta de Itens Comuns (temporários - mantido para UFO) ---
    addItem(type, tierObj) {
      const baseSec = SI.CONFIG.ITEMS.BASE_DURATION_SEC;
      const durationFrames = Math.round(baseSec * tierObj.mult * 60);

      const activeKeys = Object.keys(this.activeItems);
      if (!this.activeItems[type] && activeKeys.length >= SI.CONFIG.ITEMS.MAX_ACTIVE) {
        let lowestKey = activeKeys[0];
        let lowestTimer = this.activeItems[lowestKey].timer;
        for (let i = 1; i < activeKeys.length; i++) {
          if (this.activeItems[activeKeys[i]].timer < lowestTimer) {
            lowestKey = activeKeys[i];
            lowestTimer = this.activeItems[lowestKey].timer;
          }
        }
        delete this.activeItems[lowestKey];
      }

      const defs = MOD_CFG.DEFINITIONS;
      const def = defs[type] || {};

      this.activeItems[type] = {
        timer: durationFrames,
        maxDuration: durationFrames,
        tier: tierObj.tier,
        mult: tierObj.mult,
        color: tierObj.color,
        name: def.name || type,
        desc: def.desc || ''
      };

      SI.Audio.playItemCollect();
    }

    // --- Super System ---
    switchSuper() {
      if (this.availableSupers.length <= 1) return;
      const idx = this.availableSupers.indexOf(this.equippedSuper);
      const nextIdx = (idx + 1) % this.availableSupers.length;
      this.equippedSuper = this.availableSupers[nextIdx];
    }

    unlockSuper(type) {
      if (!this.availableSupers.includes(type)) {
        this.availableSupers.push(type);
      }
    }

    addSpecialCharge(amount = 1) {
      const maxCharge = SP_CFG.CHARGE_REQUIRED;
      this.specialCharge = Math.min(maxCharge, this.specialCharge + amount);
    }

    getRequiredSpecialCharge() {
      return SP_CFG.CHARGE_REQUIRED;
    }

    isSpecialReady() {
      return this.specialCharge >= SP_CFG.CHARGE_REQUIRED;
    }

    consumeSpecial() {
      if (this.isSpecialReady()) {
        this.specialCharge = 0;
        return true;
      }
      return false;
    }

    getEquippedSuperName() {
      const types = SP_CFG.TYPES;
      if (this.equippedSuper === types.LASER) return SP_CFG.LASER.NAME;
      if (this.equippedSuper === types.BOMB) return SP_CFG.BOMB.NAME;
      if (this.equippedSuper === types.SHIELD) return SP_CFG.SHIELD.NAME;
      if (this.equippedSuper === types.SLOWFIELD) return SP_CFG.SLOWFIELD.NAME;
      return 'Super';
    }

    // --- Dano e Morte ---
    hit() {
      if (!this.alive || this.invulnerableTimer > 0) return false;

      this.alive = false;
      this.lives--;
      this.deathTimer = P_CFG.RESPAWN_DELAY_FRAMES;
      this.castLockTimer = 0;
      this.isCasting = false;
      SI.Audio.playPlayerExplosion();
      return true;
    }

    respawn(isBossFight = false) {
      this.x = P_CFG.START_X;
      this.y = P_CFG.START_Y;
      this.alive = true;
      this.deathTimer = 0;
      this.shotCooldown = 0;
      this.castLockTimer = 0;
      this.isCasting = false;
      this.invulnerableTimer = isBossFight ? SI.CONFIG.BOSS.PLAYER_RESPAWN_INVULN_FRAMES : 60;
    }

    render(ctx) {
      const cx = this.getCenterX();
      const cy = this.getCenterY();

      // 1. Se estiver morto, desenha animação de explosão
      if (!this.alive) {
        const frame = Math.floor(this.deathTimer / 8) % 2;
        SI.Assets.draw(ctx, 'player_death', this.x - 1, this.y, frame, 15, 8);
        return;
      }

      // 2. Efeito de piscar durante invulnerabilidade
      if (this.invulnerableTimer > 0) {
        if (Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
          return;
        }
      }

      // 3. Cast lock visual
      if (this.isCasting) {
        ctx.save();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1;
        const castProgress = 1 - (this.castLockTimer / SP_CFG.CAST_LOCK_FRAMES);
        ctx.beginPath();
        ctx.arc(cx, cy, 8 + castProgress * 4, 0, Math.PI * 2 * castProgress);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Desenho do sprite do Canhão
      SI.Assets.draw(ctx, 'player', this.x, this.y, 0, this.width, this.height);

      // 5. Modo Foco: exibe o hitbox circular brilhante
      if (this.isFocusing) {
        ctx.save();
        ctx.strokeStyle = '#22e6ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, this.hitboxRadius + 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Pulso visual do Parry
      if (this.parryPulseTimer > 0) {
        ctx.save();
        const progress = 1 - (this.parryPulseTimer / 10);
        ctx.strokeStyle = PARRY_CFG.COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, this.parryRingRadius * (0.8 + progress * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 7. Textos de feedback "PARRY!"
      for (const fb of this.parryFeedbacks) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 47, 208, ${fb.alpha})`;
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(SI.CONFIG.STRINGS.PARRY_TEXT, Math.round(fb.x), Math.round(fb.y));
        ctx.restore();
      }
    }
  }

  return Player;
})();
