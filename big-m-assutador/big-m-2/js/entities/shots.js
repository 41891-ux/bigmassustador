/**
 * js/entities/shots.js - Gerenciador de projéteis do jogador e padrões de bullet hell inimigos.
 * Suporta modificadores permanentes (pierce, rapid, triple, homing, ricochet).
 * Implementa PATTERN_LIBRARY com corredor seguro, pooling e anulação mútua.
 * Namespace global: window.SI.Shots
 */

window.SI = window.SI || {};

window.SI.Shots = (function() {
  const P_CFG = SI.CONFIG.PLAYER_SHOT;
  const BH_CFG = SI.CONFIG.BULLET_HELL;
  const PARRY_CFG = SI.CONFIG.PARRY;
  const MOD_CFG = SI.CONFIG.MODIFIERS;

  class ShotsManager {
    constructor() {
      this.playerShots = [];
      this.enemyShots = [];

      this.playerShotPool = new SI.Util.ObjectPool(
        () => ({
          x: 0, y: 0, vx: 0, vy: -P_CFG.SPEED, width: P_CFG.WIDTH, height: P_CFG.HEIGHT,
          isPierce: false, isTripleChild: false, isHoming: false, isRicochet: false,
          bounceCount: 0, maxBounces: 0, extraBossDamage: 0, hitIds: new Set(), active: false
        }),
        (s) => {
          s.active = false;
          s.hitIds.clear();
          s.bounceCount = 0;
        },
        32
      );

      this.enemyShotPool = new SI.Util.ObjectPool(
        () => ({
          x: 0, y: 0, vx: 0, vy: BH_CFG.BASE_SPEED, width: 3, height: 7,
          type: 'linear', animFrame: 0, animTimer: 0, parryable: true,
          waveOffset: 0, waveTimer: 0, active: false,
          slowMult: 1.0 // For slowfield super
        }),
        (s) => { s.active = false; s.slowMult = 1.0; },
        80
      );

      this.enemyReloadTimer = 0;
      this.burstQueue = [];
    }

    reset() {
      for (const s of this.playerShots) this.playerShotPool.release(s);
      for (const s of this.enemyShots) this.enemyShotPool.release(s);
      this.playerShots.length = 0;
      this.enemyShots.length = 0;
      this.burstQueue.length = 0;
      this.enemyReloadTimer = 0;
    }

    // --- Disparos do Jogador com Modificadores Permanentes ---
    spawnPlayerShot(playerX, playerY, player) {
      const hasPierce = player.hasModifier(MOD_CFG.TYPES.PIERCE);
      const hasTriple = player.hasModifier(MOD_CFG.TYPES.TRIPLE);
      const hasHoming = player.hasModifier(MOD_CFG.TYPES.HOMING);
      const hasRicochet = player.hasModifier(MOD_CFG.TYPES.RICOCHET);

      const tripleStacks = player.getModifierStacks(MOD_CFG.TYPES.TRIPLE);
      const count = hasTriple ? Math.min(7, MOD_CFG.TRIPLE_PROJECTILES + (tripleStacks - 1) * 2) : 1;

      if (count > 1) {
        // Tiro em leque
        const spreadDeg = MOD_CFG.TRIPLE_SPREAD_DEG + (tripleStacks - 1) * 6;
        const halfSpread = spreadDeg / 2;
        const angleStep = spreadDeg / (count - 1);
        const spd = P_CFG.SPEED;

        for (let i = 0; i < count; i++) {
          const deg = -halfSpread + i * angleStep;
          const rad = SI.Util.degToRad(deg);
          const s = this.playerShotPool.obtain();
          s.x = playerX + 6;
          s.y = playerY - 4;
          s.vx = Math.sin(rad) * spd;
          s.vy = -Math.cos(rad) * spd;
          s.width = P_CFG.WIDTH;
          s.height = P_CFG.HEIGHT;
          s.isPierce = hasPierce;
          s.isTripleChild = true;
          s.isHoming = hasHoming;
          s.isRicochet = hasRicochet;
          s.bounceCount = 0;
          s.maxBounces = hasRicochet ? MOD_CFG.RICOCHET_MAX_BOUNCES + player.getModifierStacks(MOD_CFG.TYPES.RICOCHET) - 1 : 0;
          s.extraBossDamage = 0;
          s.hitIds.clear();
          s.active = true;
          this.playerShots.push(s);
        }
      } else {
        // Tiro único
        const s = this.playerShotPool.obtain();
        s.x = playerX + 6;
        s.y = playerY - 4;
        s.vx = 0;
        s.vy = -P_CFG.SPEED;
        s.width = P_CFG.WIDTH;
        s.height = P_CFG.HEIGHT;
        s.isPierce = hasPierce;
        s.isTripleChild = false;
        s.isHoming = hasHoming;
        s.isRicochet = hasRicochet;
        s.bounceCount = 0;
        s.maxBounces = hasRicochet ? MOD_CFG.RICOCHET_MAX_BOUNCES + player.getModifierStacks(MOD_CFG.TYPES.RICOCHET) - 1 : 0;
        s.extraBossDamage = 0;
        s.hitIds.clear();
        s.active = true;
        this.playerShots.push(s);
      }

      SI.Audio.playPlayerShot();
    }

    getEffectivePlayerShotCount() {
      let count = 0;
      let hasTriple = false;
      for (const s of this.playerShots) {
        if (s.isTripleChild) {
          hasTriple = true;
        } else {
          count++;
        }
      }
      return count + (hasTriple ? 1 : 0);
    }

    // --- Biblioteca de Padrões de Bullet Hell ---

    spawnLinearAimed(originX, originY, targetX, speedMult) {
      speedMult = speedMult || 1.0;
      const s = this.enemyShotPool.obtain();
      s.x = originX - 1;
      s.y = originY;
      s.vx = 0;
      s.vy = BH_CFG.BASE_SPEED * 1.1 * speedMult;
      s.width = 3;
      s.height = 7;
      s.type = 'linear';
      s.parryable = true;
      s.animFrame = 0;
      s.animTimer = 0;
      s.slowMult = 1.0;
      s.active = true;
      this.enemyShots.push(s);
    }

    spawnZigzag(originX, originY, speedMult) {
      speedMult = speedMult || 1.0;
      const s = this.enemyShotPool.obtain();
      s.x = originX - 1;
      s.y = originY;
      s.vx = 0;
      s.vy = BH_CFG.BASE_SPEED * speedMult;
      s.width = 3;
      s.height = 7;
      s.type = 'zigzag';
      s.parryable = true;
      s.waveOffset = originX;
      s.waveTimer = 0;
      s.animFrame = 0;
      s.animTimer = 0;
      s.slowMult = 1.0;
      s.active = true;
      this.enemyShots.push(s);
    }

    spawnFan(originX, originY, count, spreadDeg, speedMult) {
      count = count || 3;
      spreadDeg = spreadDeg || 24;
      speedMult = speedMult || 1.0;
      const angleStep = spreadDeg / (count - 1);
      const halfSpread = spreadDeg / 2;
      const spd = BH_CFG.BASE_SPEED * speedMult;

      for (let i = 0; i < count; i++) {
        const deg = -halfSpread + i * angleStep;
        const rad = SI.Util.degToRad(deg);
        const s = this.enemyShotPool.obtain();
        s.x = originX - 1;
        s.y = originY;
        s.vx = Math.sin(rad) * spd;
        s.vy = Math.cos(rad) * spd;
        s.width = 3;
        s.height = 7;
        s.type = 'fan';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.slowMult = 1.0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    queueBurst(originX, originY, count, intervalFrames) {
      count = count || 3;
      intervalFrames = intervalFrames || 8;
      for (let i = 0; i < count; i++) {
        this.burstQueue.push({
          delay: i * intervalFrames,
          x: originX,
          y: originY
        });
      }
    }

    spawnWallWithGap(originY, playerX, speedMult) {
      speedMult = speedMult || 1.0;
      const safeWidth = BH_CFG.SAFE_LANE_MIN_WIDTH + 6;
      const gapCenter = SI.Util.clamp(playerX + SI.Util.randomRange(-25, 25), 20, 204);
      const gapMin = gapCenter - safeWidth / 2;
      const gapMax = gapCenter + safeWidth / 2;

      const step = 8;
      for (let x = 12; x <= SI.CONFIG.VIDEO.LOGICAL_WIDTH - 12; x += step) {
        if (x >= gapMin && x <= gapMax) continue;
        const s = this.enemyShotPool.obtain();
        s.x = x;
        s.y = originY;
        s.vx = 0;
        s.vy = BH_CFG.BASE_SPEED * 0.9 * speedMult;
        s.width = 3;
        s.height = 7;
        s.type = 'wall';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.slowMult = 1.0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    spawnSpiral(originX, originY, baseAngleRad, count, speedMult) {
      count = count || 6;
      speedMult = speedMult || 1.0;
      const angleStep = (Math.PI * 2) / count;
      const spd = BH_CFG.BASE_SPEED * 0.85 * speedMult;

      for (let i = 0; i < count; i++) {
        const ang = baseAngleRad + i * angleStep;
        const s = this.enemyShotPool.obtain();
        s.x = originX - 2;
        s.y = originY - 2;
        s.vx = Math.cos(ang) * spd;
        s.vy = Math.sin(ang) * spd;
        s.width = 4;
        s.height = 4;
        s.type = 'spiral';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.slowMult = 1.0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    // --- Atualização de Disparos Inimigos por Onda ---
    updateEnemyFiring(wave, formation, playerX) {
      const speedMult = SI.CONFIG.WAVE_SCALING.ENEMY_SHOT_SPEED_MULT(wave);

      // Processa fila de rajadas
      for (let i = this.burstQueue.length - 1; i >= 0; i--) {
        const item = this.burstQueue[i];
        item.delay--;
        if (item.delay <= 0) {
          this.spawnLinearAimed(item.x, item.y, playerX, speedMult);
          this.burstQueue.splice(i, 1);
        }
      }

      if (this.enemyReloadTimer > 0) {
        this.enemyReloadTimer--;
        return;
      }

      const maxBullets = BH_CFG.MAX_ENEMY_BULLETS(wave);
      if (this.enemyShots.length >= maxBullets) return;

      const lowestInvaders = formation.getLowestInvadersAllCols();
      if (lowestInvaders.length === 0) return;

      // Cadência escala com a onda
      this.enemyReloadTimer = SI.CONFIG.WAVE_SCALING.ENEMY_RELOAD_TIME(wave);

      // Quantidade de colunas que podem atirar
      const shotsToFire = SI.CONFIG.WAVE_SCALING.FIRING_COLUMNS(wave);

      // Atiradores (GUNNER) disparam com mais frequência
      const gunners = formation.getGunnerInvaders();
      for (const g of gunners) {
        if (this.enemyShots.length >= maxBullets) break;
        const ox = g.x + g.width / 2;
        const oy = g.y + g.height;
        this.spawnFan(ox, oy, 3, 18, speedMult);
        g.gunnerCooldown = Math.max(60, 120 - wave * 5);
      }

      for (let s = 0; s < shotsToFire; s++) {
        if (this.enemyShots.length >= maxBullets) break;

        const invader = SI.Util.randomChoice(lowestInvaders);
        if (!invader) continue;

        const ox = invader.x + invader.width / 2;
        const oy = invader.y + invader.height;

        // Escolhe o padrão com base na intensidade da onda
        const roll = SI.Util.random();
        if (wave <= 2 || roll < 0.35) {
          this.spawnLinearAimed(ox, oy, playerX, speedMult);
        } else if (roll < 0.55) {
          this.spawnZigzag(ox, oy, speedMult);
        } else if (roll < 0.75) {
          this.spawnFan(ox, oy, 3, 20, speedMult);
        } else if (roll < 0.88) {
          this.queueBurst(ox, oy, 3, 8);
        } else if (wave >= 3) {
          this.spawnWallWithGap(oy, playerX, speedMult);
        }
      }
    }

    // Encontra o inimigo mais próximo de uma posição (para tiro homing)
    findNearestEnemy(x, y, formation, boss) {
      let nearest = null;
      let nearestDist = Infinity;

      if (formation && formation.livingInvaders) {
        for (const inv of formation.livingInvaders) {
          if (inv.enemyType === 'GHOST' && inv.isGhosted) continue;
          const dx = (inv.x + inv.width / 2) - x;
          const dy = (inv.y + inv.height / 2) - y;
          const dist = dx * dx + dy * dy;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = { x: inv.x + inv.width / 2, y: inv.y + inv.height / 2 };
          }
        }
      }

      if (boss && boss.active && boss.hp > 0) {
        const dx = (boss.x + boss.width / 2) - x;
        const dy = (boss.y + boss.height / 2) - y;
        const dist = dx * dx + dy * dy;
        if (dist < nearestDist) {
          nearest = { x: boss.x + boss.width / 2, y: boss.y + boss.height / 2 };
        }
      }

      return nearest;
    }

    update(particleSystem, formation, boss) {
      // 1. Atualização dos tiros do jogador
      for (let i = this.playerShots.length - 1; i >= 0; i--) {
        const s = this.playerShots[i];

        // Homing: curva em direção ao inimigo mais próximo
        if (s.isHoming) {
          const target = this.findNearestEnemy(s.x, s.y, formation, boss);
          if (target) {
            const dx = target.x - s.x;
            const dy = target.y - s.y;
            const angle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(s.vy, s.vx);
            let diff = angle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turnRate = MOD_CFG.HOMING_TURN_RATE;
            const newAngle = currentAngle + SI.Util.clamp(diff, -turnRate, turnRate);
            const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
            s.vx = Math.cos(newAngle) * speed;
            s.vy = Math.sin(newAngle) * speed;
          }
        }

        s.x += s.vx;
        s.y += s.vy;

        // Ricochet: rebate nas bordas laterais
        if (s.isRicochet && s.bounceCount < s.maxBounces) {
          if (s.x <= 2 || s.x >= SI.CONFIG.VIDEO.LOGICAL_WIDTH - 2) {
            s.vx = -s.vx;
            s.bounceCount++;
            if (particleSystem) {
              particleSystem.emit(s.x, s.y, 3, '#b46bff', 1.0, 8, 1);
            }
          }
        }

        // Dissipação no teto ou fora da tela
        if (s.y <= P_CFG.BURST_Y_TOP || s.x < -10 || s.x > SI.CONFIG.VIDEO.LOGICAL_WIDTH + 10 || s.y > SI.CONFIG.VIDEO.LOGICAL_HEIGHT) {
          if (particleSystem) {
            particleSystem.emit(s.x, s.y, 4, '#ffffff', 1.0, 8, 1);
          }
          this.playerShots.splice(i, 1);
          this.playerShotPool.release(s);
        }
      }

      // 2. Atualização dos tiros inimigos
      for (let i = this.enemyShots.length - 1; i >= 0; i--) {
        const s = this.enemyShots[i];
        const slow = s.slowMult || 1.0;

        if (s.type === 'zigzag') {
          s.waveTimer += 0.12 * slow;
          s.x = s.waveOffset + Math.sin(s.waveTimer) * 12;
          s.y += s.vy * slow;
        } else {
          s.x += s.vx * slow;
          s.y += s.vy * slow;
        }

        s.animTimer++;
        if (s.animTimer >= 6) {
          s.animTimer = 0;
          s.animFrame = (s.animFrame + 1) % 4;
        }

        if (s.y >= SI.CONFIG.PLAYER.GROUND_Y || s.x < -10 || s.x > SI.CONFIG.VIDEO.LOGICAL_WIDTH + 10) {
          this.enemyShots.splice(i, 1);
          this.enemyShotPool.release(s);
        }
      }

      // 3. Anulação mútua de tiros
      for (let i = this.playerShots.length - 1; i >= 0; i--) {
        const pShot = this.playerShots[i];
        for (let j = this.enemyShots.length - 1; j >= 0; j--) {
          const eShot = this.enemyShots[j];
          if (SI.Util.checkAABB(pShot, eShot)) {
            if (particleSystem) {
              particleSystem.emit(pShot.x, pShot.y, 5, '#ffffff', 1.2, 10, 1);
            }
            this.enemyShots.splice(j, 1);
            this.enemyShotPool.release(eShot);

            if (!pShot.isPierce) {
              this.playerShots.splice(i, 1);
              this.playerShotPool.release(pShot);
              break;
            }
          }
        }
      }
    }

    // Aplica efeito de lentidão a todos os tiros inimigos
    applySlowField(factor) {
      for (const s of this.enemyShots) {
        s.slowMult = factor;
      }
    }

    removeSlowField() {
      for (const s of this.enemyShots) {
        s.slowMult = 1.0;
      }
    }

    render(ctx) {
      // 1. Tiros do Jogador
      for (let i = 0; i < this.playerShots.length; i++) {
        const s = this.playerShots[i];
        if (s.isPierce) {
          ctx.fillStyle = '#ff8800';
          ctx.fillRect(Math.round(s.x), Math.round(s.y), s.width, s.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x), Math.round(s.y + 1), s.width, s.height - 2);
        } else if (s.isHoming) {
          ctx.fillStyle = '#33d17a';
          ctx.fillRect(Math.round(s.x), Math.round(s.y), s.width + 1, s.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x), Math.round(s.y + 1), s.width, 2);
        } else if (s.isRicochet) {
          ctx.fillStyle = '#b46bff';
          ctx.fillRect(Math.round(s.x), Math.round(s.y), s.width + 1, s.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x), Math.round(s.y + 1), s.width, 2);
        } else {
          SI.Assets.draw(ctx, 'shot_player', s.x, s.y, 0, s.width, s.height);
        }
      }

      // 2. Projéteis Inimigos
      for (let i = 0; i < this.enemyShots.length; i++) {
        const s = this.enemyShots[i];
        const key = 'shot_' + s.type;

        if (s.parryable) {
          ctx.save();
          ctx.strokeStyle = PARRY_CFG.COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(
            Math.round(s.x - 1),
            Math.round(s.y - 1),
            s.width + 2,
            s.height + 2
          );
          ctx.restore();
        }

        // Tint azulado se sob efeito de slowfield
        if (s.slowMult < 1.0) {
          ctx.save();
          ctx.globalAlpha = 0.7;
        }

        SI.Assets.draw(ctx, key, s.x, s.y, s.animFrame, s.width, s.height);

        if (s.slowMult < 1.0) {
          ctx.restore();
        }
      }
    }
  }

  return ShotsManager;
})();
