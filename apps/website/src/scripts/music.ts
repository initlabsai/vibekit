// The landing page's music player: an <audio> element routed through an
// AnalyserNode so the header visualiser has something to draw. Tracks live in
// public/music and are listed here rather than parsed from filenames.

export type Track = { artist: string; title: string; src: string }

export const TRACKS: Track[] = [
  { artist: 'LNPlusMusic', title: '80s Retro', src: '/music/80s-retro.mp3' },
  { artist: 'Alex Morgan', title: 'Neon Synthwave Drive', src: '/music/neon-drive.mp3' },
  { artist: 'Alex Morgan', title: 'Neon Drive Horizon', src: '/music/neon-horizon.mp3' },
  { artist: 'The Mountain', title: 'Retro', src: '/music/retro.mp3' },
]

export class Music {
  playing = false
  track = TRACKS[0]!
  analyser!: AnalyserNode
  /** Called when the track changes on its own (a track ending). */
  onchange?: () => void

  private audio = new Audio()
  private ac?: AudioContext
  private index = 0

  constructor() {
    this.audio.preload = 'none'
    this.audio.src = this.track.src
    // Auto-advance so the player keeps going without another click.
    this.audio.addEventListener('ended', () => {
      this.select((this.index + 1) % TRACKS.length)
      void this.audio.play()
      this.onchange?.()
    })
  }

  // createMediaElementSource may only be called once per element, so the
  // graph is built on the first play and the element is reused after that.
  private boot() {
    if (this.ac) return
    const ac = (this.ac = new AudioContext())
    this.analyser = ac.createAnalyser()
    this.analyser.fftSize = 128
    this.analyser.smoothingTimeConstant = 0.8
    const gain = ac.createGain()
    gain.gain.value = 0.6
    ac.createMediaElementSource(this.audio).connect(gain)
    gain.connect(this.analyser).connect(ac.destination)
  }

  private select(index: number) {
    this.index = index
    this.track = TRACKS[index]!
    this.audio.src = this.track.src
  }

  toggle() {
    this.boot()
    void this.ac!.resume()
    if (this.playing) {
      this.audio.pause()
      this.playing = false
      return
    }
    void this.audio.play()
    this.playing = true
  }

  next() {
    this.boot()
    this.select((this.index + 1) % TRACKS.length)
    if (this.playing) void this.audio.play()
  }
}
