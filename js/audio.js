// ============================================================
// 织律 Weaveline - Audio System
// Web Audio API 合成：五声音阶国风 BGM + 打击音效
// 剑圣清脆高频 / 武圣低频厚重；普通/精英/Boss 三档情绪
// ============================================================

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.6;
    this.currentBgm = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    // BGM 调度器状态
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmNextTime = 0;
    this._bgmType = null;
  }

  async init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 1.0;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.bgmGain.gain.value = this.musicVolume;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = this.sfxVolume;

      this.initialized = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ============ BGM：五声音阶生成式国风配乐 ============

  playBgm(type) {
    if (!this.initialized) return;
    this.stopBgm();

    switch (type) {
      case 'battle': this._startPentatonicBgm('battle'); break;
      case 'elite': this._startPentatonicBgm('elite'); break;
      case 'boss': this._startPentatonicBgm('boss'); break;
      case 'victory': this._playStinger(true); break;
      case 'defeat': this._playStinger(false); break;
    }
  }

  /**
   * 五声音阶 BGM 调度器
   * 羽调式（A C D E G）古筝拨弦 + 低音铺底 + 堂鼓
   * 使用 lookahead 调度保证节奏稳定
   */
  _startPentatonicBgm(type) {
    if (!this.ctx) return;
    this._bgmType = type;
    this._bgmStep = 0;
    this._bgmNextTime = this.ctx.currentTime + 0.08;

    // 各档参数
    const conf = {
      battle: { bpm: 88,  root: 110.00, melodyVol: 0.16, drumVol: 0.10, droneVol: 0.055, droneNotes: [55.00, 82.41] },
      elite:  { bpm: 104, root: 98.00,  melodyVol: 0.17, drumVol: 0.15, droneVol: 0.06,  droneNotes: [49.00, 73.42] },
      boss:   { bpm: 76,  root: 87.31,  melodyVol: 0.18, drumVol: 0.19, droneVol: 0.075, droneNotes: [43.65, 65.41] }
    }[type];
    this._bgmConf = conf;

    // 羽调五声音阶（相对 root 的音程倍数）：1, ♭3, 4, 5, ♭7
    // A: A C D E G
    const scale = [1, 6/5, 4/3, 3/2, 9/5, 2, 12/5, 8/3];
    // 旋律动机池（索引序列，0 = root；-1 = 休止），循环播放，带即兴扰动
    this._bgmMotifs = {
      battle: [
        [0, -1, 2, 3, -1, 3, 2, -1, 1, -1, 2, -1, 0, -1, -1, -1],
        [3, -1, 4, 5, -1, 4, 3, 2, -1, 2, 1, -1, 0, -1, -1, -1],
        [0, 1, 2, -1, 3, -1, 2, 1, -1, 0, -1, 1, 2, -1, -1, -1]
      ],
      elite: [
        [0, 2, -1, 3, 4, -1, 3, 2, 1, -1, 2, 3, -1, 3, 2, -1],
        [5, -1, 4, 3, -1, 2, 3, 4, 3, -1, 2, -1, 1, 2, -1, 0]
      ],
      boss: [
        [0, -1, -1, 1, -1, -1, 2, -1, -1, -1, 1, -1, 0, -1, -1, -1],
        [3, -1, -1, -1, 2, -1, -1, 1, -1, -1, -1, -1, 0, -1, -1, 1]
      ]
    }[type];
    this._bgmScale = scale;

    // 低音铺底（持续 drone）
    this._bgmDroneNodes = conf.droneNotes.map((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      gain.gain.value = conf.droneVol / (i + 1);
      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start();
      return { osc, gain };
    });

    // 调度循环
    const stepDur = 60 / conf.bpm / 2; // 八分音符
    this._bgmStepDur = stepDur;
    this._bgmTimer = setInterval(() => this._bgmSchedule(), 40);
    this.currentBgm = { type };
  }

  _bgmSchedule() {
    if (!this.ctx || !this._bgmTimer) return;
    const lookahead = 0.16;
    while (this._bgmNextTime < this.ctx.currentTime + lookahead) {
      this._bgmPlayStep(this._bgmStep, this._bgmNextTime);
      this._bgmStep++;
      this._bgmNextTime += this._bgmStepDur;
    }
  }

  _bgmPlayStep(step, time) {
    const conf = this._bgmConf;
    const scale = this._bgmScale;
    const bar16 = step % 16;
    const motifIdx = Math.floor(step / 16) % this._bgmMotifs.length;
    const motif = this._bgmMotifs[motifIdx];
    const noteIdx = motif[bar16];

    // 古筝拨弦（即兴：20% 概率把休止替换成邻近音，战斗越久越活）
    if (noteIdx >= 0 || (noteIdx === -1 && Math.random() < 0.14 && bar16 % 2 === 0)) {
      const idx = noteIdx >= 0 ? noteIdx : Math.floor(Math.random() * 3);
      const octaveDrop = (this._bgmType === 'boss' && bar16 % 8 === 0) ? 0.5 : 1;
      const freq = conf.root * 2 * scale[idx % scale.length] * octaveDrop;
      this._pluck(freq, time, conf.melodyVol * (bar16 % 4 === 0 ? 1.15 : 0.9));
      // 泛音点缀
      if (bar16 % 8 === 4 && Math.random() < 0.5) {
        this._pluck(freq * 2, time + this._bgmStepDur * 0.5, conf.melodyVol * 0.35);
      }
    }

    // 堂鼓：每拍一声，强拍更重；Boss 战加附点
    if (this._bgmType !== 'battle' ? bar16 % 2 === 0 : bar16 % 4 === 0) {
      const accent = bar16 % 8 === 0;
      this._drum(time, conf.drumVol * (accent ? 1.3 : 0.8));
    }
    if (this._bgmType === 'boss' && bar16 === 14) {
      this._drum(time, conf.drumVol * 0.9, 90);
    }
  }

  /** 古筝式拨弦：双振荡器 + 快速衰减包络 */
  _pluck(freq, time, vol) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2.003; // 轻微失谐产生拨弦光泽
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.bgmGain);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 1.0);
    osc2.stop(time + 1.0);
  }

  /** 堂鼓：低频噪声 + 正弦鼓腔 */
  _drum(time, vol, freq = 65) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, time + 0.18);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  /** 胜败 stinger：五声音阶短句 */
  _playStinger(victory) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.02;
    if (victory) {
      // 上行五声：宫-商-角-徵
      const notes = [261.63, 293.66, 329.63, 392.00, 523.25];
      notes.forEach((f, i) => this._pluck(f, t0 + i * 0.12, 0.22));
      this._drum(t0 + 0.6, 0.2, 80);
    } else {
      // 下行：徵-角-商-宫（低）
      const notes = [392.00, 329.63, 293.66, 261.63];
      notes.forEach((f, i) => this._pluck(f * 0.75, t0 + i * 0.18, 0.18));
      this._drum(t0 + 0.72, 0.22, 55);
    }
  }

  stopBgm() {
    if (this._bgmTimer) {
      clearInterval(this._bgmTimer);
      this._bgmTimer = null;
    }
    if (this._bgmDroneNodes) {
      this._bgmDroneNodes.forEach(({ osc, gain }) => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
          osc.stop(this.ctx.currentTime + 0.45);
        } catch (e) { /* ignore */ }
      });
      this._bgmDroneNodes = null;
    }
    this.currentBgm = null;
  }

  // ============ SFX ============

  /** Generate impact SFX based on type and character style */
  playSfx(type, characterStyle) {
    if (!this.initialized) return;

    switch (type) {
      // Card interaction
      case 'card_draw': this._playCardDraw(); break;
      case 'card_select': this._playCardSelect(); break;
      case 'card_play': this._playCardPlay(); break;
      case 'card_discard': this._playCardDiscard(); break;
      case 'card_exhaust': this._playCardExhaust(); break;
      case 'energy_spend': this._playEnergySpend(); break;
      case 'intent_refresh': this._playIntentRefresh(); break;
      case 'ultimate_ready': this._playUltimateReady(); break;
      case 'ultimate_click': this._playUltimateClick(); break;
      // Combat
      case 'blade_light': this._playBladeLight(); break;
      case 'blade_multi': this._playBladeMulti(); break;
      case 'arrow': this._playArrow(); break;
      case 'arrow_hit': this._playArrowHit(); break;
      case 'sword_qi': this._playSwordQi(); break;
      case 'sword_qi_bloom': this._playSwordQiBloom(); break;
      case 'fist_heavy': this._playFistHeavy(); break;
      case 'kick_heavy': this._playKickHeavy(); break;
      case 'inner_power': this._playInnerPower(); break;
      case 'heavy_sweetener': this._playHeavySweetener(); break;
      case 'execute': this._playExecute(); break;
      case 'hit': this._playHit(); break;
      case 'skill_select': this._playSkillSelect(); break;
      default: this._playHit();
    }
  }

  _playBladeLight() {
    this._noiseBurst(0.06, 3000, 8000, 'bandpass', 0.15);
  }

  // 箭矢：拉弦嗖声（高频下坠）
  _playArrow() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  // 箭矢命中：短促金属入木声
  _playArrowHit() {
    this._noiseBurst(0.05, 1200, 4000, 'bandpass', 0.18);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  _playBladeMulti() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this._noiseBurst(0.04, 2500, 6000, 'bandpass', 0.12), i * 80);
    }
  }

  _playSwordQi() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  _playSwordQiBloom() {
    this._playSwordQi();
    setTimeout(() => this._noiseBurst(0.1, 800, 2000, 'lowpass', 0.2), 150);
    // 剑鸣 effect
    setTimeout(() => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(3600, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    }, 200);
  }

  _playFistHeavy() {
    this._noiseBurst(0.15, 80, 300, 'lowpass', 0.35);
  }

  _playKickHeavy() {
    this._noiseBurst(0.12, 60, 250, 'lowpass', 0.3);
    // Wind whoosh before impact
    setTimeout(() => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    }, 10);
  }

  _playInnerPower() {
    // Low rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }

  _playHeavySweetener() {
    this._noiseBurst(0.2, 30, 150, 'lowpass', 0.4);
    // Sub-bass
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.value = 40;
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  _playExecute() {
    // Brief silence / suction effect
    setTimeout(() => {
      this._noiseBurst(0.08, 40, 120, 'lowpass', 0.6);
      // Impact
      setTimeout(() => {
        this._noiseBurst(0.3, 20, 80, 'lowpass', 0.5);
        // Resonance tail
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.6);
      }, 60);
    }, 100);
  }

  _playHit() {
    this._noiseBurst(0.05, 500, 2000, 'bandpass', 0.2);
  }

  // ===== Card SFX =====
  _playCardDraw() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  _playCardSelect() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, this.ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  _playCardPlay() {
    this._noiseBurst(0.06, 600, 1200, 'bandpass', 0.12);
  }

  _playCardDiscard() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  _playCardExhaust() {
    this._noiseBurst(0.1, 200, 600, 'lowpass', 0.1);
  }

  _playEnergySpend() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  _playIntentRefresh() {
    this._noiseBurst(0.04, 200, 400, 'bandpass', 0.08);
  }

  _playUltimateReady() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2400, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
    setTimeout(() => this._noiseBurst(0.08, 800, 1600, 'bandpass', 0.12), 100);
  }

  _playUltimateClick() {
    this._noiseBurst(0.12, 40, 120, 'lowpass', 0.3);
    setTimeout(() => this._playSwordQiBloom(), 50);
  }

  _playSkillSelect() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  _noiseBurst(duration, freqLow, freqHigh, filterType, vol) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = (freqLow + freqHigh) / 2;
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.value = vol;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start();
    source.stop(this.ctx.currentTime + duration);
  }

  // ============ UI Sounds ============

  playUiClick() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playUiHover() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.bgmGain) this.bgmGain.gain.value = v;
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}

// Singleton
const audio = new AudioSystem();
