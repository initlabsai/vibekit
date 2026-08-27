// Procedural synthwave: a 16th-note sequencer scheduling kick, snare, hats,
// bass, pad and arp on WebAudio. Tracks are chord progressions in MIDI notes.

type Track = { name: string; bpm: number; chords: number[][]; arp: number[] }

export const TRACKS: Track[] = [
  { name: 'neon.drive', bpm: 104, chords: [[45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53], [40, 43, 47, 50]], arp: [0, 1, 2, 3, 2, 1] },
  { name: 'last.round', bpm: 96, chords: [[38, 41, 45, 48], [46, 50, 53, 57], [41, 45, 48, 52], [43, 47, 50, 53]], arp: [0, 2, 1, 3, 1, 2] },
  { name: 'ghost.of.2036', bpm: 112, chords: [[40, 43, 47, 50], [47, 50, 54, 57], [45, 48, 52, 55], [43, 47, 50, 53]], arp: [3, 2, 1, 0, 1, 2] },
]

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

export class Synth {
  playing = false
  track = TRACKS[0]!
  analyser!: AnalyserNode
  private ac?: AudioContext
  private out!: GainNode
  private noise!: AudioBuffer
  private step = 0
  private nextTime = 0
  private timer = 0
  private index = 0

  private boot() {
    if (this.ac) return
    const ac = (this.ac = new AudioContext())
    this.analyser = ac.createAnalyser()
    this.analyser.fftSize = 128
    this.analyser.smoothingTimeConstant = .8
    this.out = ac.createGain()
    this.out.gain.value = .5
    const comp = ac.createDynamicsCompressor()
    const delay = ac.createDelay()
    delay.delayTime.value = 60 / this.track.bpm * .75
    const fb = ac.createGain()
    fb.gain.value = .3
    const wet = ac.createGain()
    wet.gain.value = .22
    this.out.connect(comp).connect(this.analyser).connect(ac.destination)
    this.out.connect(delay).connect(fb).connect(delay)
    delay.connect(wet).connect(comp)
    this.noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }

  toggle() { this.playing ? this.stop() : this.start() }

  next() {
    this.index = (this.index + 1) % TRACKS.length
    this.track = TRACKS[this.index]!
    this.step = 0
    if (this.playing) { this.stop(); this.start() }
  }

  private start() {
    this.boot()
    this.ac!.resume()
    this.playing = true
    this.nextTime = this.ac!.currentTime + .05
    this.tick()
  }

  private stop() {
    this.playing = false
    clearTimeout(this.timer)
    this.ac!.suspend()
  }

  private tick = () => {
    const ac = this.ac!
    while (this.nextTime < ac.currentTime + .12) {
      this.play(this.step, this.nextTime)
      this.nextTime += 60 / this.track.bpm / 4
      this.step++
    }
    this.timer = window.setTimeout(this.tick, 30)
  }

  private tone(type: OscillatorType, freq: number, t: number, len: number, gain: number, cutoff: number, detune = 0) {
    const ac = this.ac!
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const f = ac.createBiquadFilter()
    f.frequency.setValueAtTime(cutoff, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff / 6), t + len)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + .01)
    g.gain.exponentialRampToValueAtTime(.001, t + len)
    o.connect(f).connect(g).connect(this.out)
    o.start(t)
    o.stop(t + len + .05)
  }

  private hit(t: number, len: number, gain: number, type: BiquadFilterType, freq: number) {
    const ac = this.ac!
    const s = ac.createBufferSource()
    s.buffer = this.noise
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(.001, t + len)
    s.connect(f).connect(g).connect(this.out)
    s.start(t)
    s.stop(t + len)
  }

  private play(step: number, t: number) {
    const ac = this.ac!
    const { chords, arp, bpm } = this.track
    const beat = 60 / bpm
    const chord = chords[Math.floor(step / 16) % chords.length]!
    const s16 = step % 16

    if (s16 % 4 === 0) { // kick
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.frequency.setValueAtTime(150, t)
      o.frequency.exponentialRampToValueAtTime(40, t + .12)
      g.gain.setValueAtTime(.9, t)
      g.gain.exponentialRampToValueAtTime(.001, t + .3)
      o.connect(g).connect(this.out)
      o.start(t); o.stop(t + .3)
    }
    if (s16 === 4 || s16 === 12) this.hit(t, .18, .35, 'bandpass', 1800) // snare
    if (s16 % 2 === 1) this.hit(t, .04, .08, 'highpass', 8000) // hats
    if (s16 % 2 === 0) this.tone('sawtooth', hz(chord[0]! - 12), t, beat / 4, .32, s16 % 8 === 0 ? 900 : 500) // bass
    this.tone('square', hz(chord[arp[step % arp.length]]! + 12), t, beat / 3, .06, 2600) // arp
    if (s16 === 0) for (const n of chord) { // pad
      this.tone('sawtooth', hz(n), t, beat * 4, .045, 1400, -7)
      this.tone('sawtooth', hz(n), t, beat * 4, .045, 1400, 7)
    }
  }
}
