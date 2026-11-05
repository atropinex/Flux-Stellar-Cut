// The sound of the preview goes through a small mixing desk made with Web Audio:
// every clip has its own volume and pan, every track has a bus with a fader, and the master bus has the meters.
//
//   clip element -> clip gain -> clip pan -> track bus (gain, pan) -> master (gain) -> speakers
//                                                    \-> meter                  \-> meter

export interface MeterReading {
    left: number;  // peak, 0..1 (more than 1 is too loud)
    right: number;
}

interface Bus {
    input: GainNode;
    panner: StereoPannerNode;
    analysers: [AnalyserNode, AnalyserNode];
}

export interface ClipOutput {
    setBus(busId: string): void;
    setLevels(gain: number, pan: number): void;
    dispose(): void;
}

const SILENT: MeterReading = {left: 0, right: 0};
const MASTER = 'master';

class StellarAudioEngine {
    private context: AudioContext | null = null;
    private enabled = true;
    private buses = new Map<string, Bus>();
    private buffer = new Float32Array(1024);

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled && typeof AudioContext !== 'undefined';
    }

    /** Starts the audio context. Browsers only allow this after the person has pressed something. */
    resume(): void {
        if (!this.isEnabled()) {
            return;
        }

        const context = this.ensureContext();

        if (context && context.state === 'suspended') {
            void context.resume().catch(() => undefined);
        }
    }

    private ensureContext(): AudioContext | null {
        if (this.context) {
            return this.context;
        }

        if (!this.isEnabled()) {
            return null;
        }

        try {
            this.context = new AudioContext({latencyHint: 'interactive'});
            this.buses.set(MASTER, this.createBus(this.context, this.context.destination));
        } catch {
            this.context = null;
            this.enabled = false;
        }

        return this.context;
    }

    private createBus(context: AudioContext, destination: AudioNode): Bus {
        const input = context.createGain();
        const panner = context.createStereoPanner();
        const splitter = context.createChannelSplitter(2);
        const left = context.createAnalyser();
        const right = context.createAnalyser();

        left.fftSize = 1024;
        right.fftSize = 1024;
        input.connect(panner);
        panner.connect(destination);
        panner.connect(splitter);
        splitter.connect(left, 0);
        splitter.connect(right, 1);

        return {input, panner, analysers: [left, right]};
    }

    private busFor(id: string): Bus | null {
        const context = this.ensureContext();

        if (!context) {
            return null;
        }

        const existing = this.buses.get(id);

        if (existing) {
            return existing;
        }

        const master = this.buses.get(MASTER) as Bus;
        const bus = this.createBus(context, master.input);

        this.buses.set(id, bus);

        return bus;
    }

    /** Sets the fader and pan of a track (or "master"). Gain is a plain multiplier. */
    setBus(id: string, gain: number, pan: number): void {
        const bus = this.busFor(id);
        const context = this.context;

        if (!bus || !context) {
            return;
        }

        bus.input.gain.setTargetAtTime(Math.max(0, gain), context.currentTime, 0.01);
        bus.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), context.currentTime, 0.01);
    }

    /** Connects a media element to the desk. Returns null when Web Audio cannot be used for it. */
    attach(element: HTMLMediaElement): ClipOutput | null {
        const context = this.ensureContext();

        if (!context) {
            return null;
        }

        try {
            element.crossOrigin = 'anonymous';

            const source = context.createMediaElementSource(element);
            const gain = context.createGain();
            const panner = context.createStereoPanner();
            let connectedTo: Bus | null = null;

            source.connect(gain);
            gain.connect(panner);

            return {
                setBus: (busId) => {
                    const bus = this.busFor(busId);

                    if (bus && bus !== connectedTo) {
                        panner.disconnect();
                        panner.connect(bus.input);
                        connectedTo = bus;
                    }
                },
                setLevels: (level, pan) => {
                    gain.gain.setTargetAtTime(Math.max(0, level), context.currentTime, 0.01);
                    panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), context.currentTime, 0.01);
                },
                dispose: () => {
                    try {
                        source.disconnect();
                        gain.disconnect();
                        panner.disconnect();
                    } catch {
                        // Already disconnected.
                    }
                }
            };
        } catch {
            return null;
        }
    }

    /** The loudest sample of the last moment, for the meters. */
    read(id: string): MeterReading {
        const bus = this.buses.get(id);

        if (!bus || !this.context || this.context.state !== 'running') {
            return SILENT;
        }

        const peaks = bus.analysers.map((analyser) => {
            analyser.getFloatTimeDomainData(this.buffer);

            let peak = 0;

            for (let index = 0; index < this.buffer.length; index += 1) {
                const value = Math.abs(this.buffer[index]);

                if (value > peak) {
                    peak = value;
                }
            }

            return peak;
        });

        return {left: peaks[0], right: peaks[1]};
    }

    readMaster(): MeterReading {
        return this.read(MASTER);
    }

    get masterId(): string {
        return MASTER;
    }
}

export const audioEngine = new StellarAudioEngine();

export function gainToDb(gain: number): number {
    return gain > 0.000001 ? 20 * Math.log10(gain) : -Infinity;
}
