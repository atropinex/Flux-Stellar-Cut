import type {Clip, Sequence, Track} from '../../../common/stellar/StellarContract';
import {defaultColor} from '../../../common/stellar/StellarColor';
import {createSequence} from '../../../common/stellar/StellarProjectFactory';
import {createId} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../project/StellarEditor.Store';
import {activateSequence, commit, showToast} from '../project/StellarProject.Controller';
import {clearRange, findClip, findTrack, withLinkedClips} from './StellarTimeline.Controller';

// Nesting: the selected clips become a sequence of their own, and that sequence takes their place as one clip.

function nextNestName(names: string[]): string {
    let number = 1;

    while (names.includes(`Nested Sequence ${String(number).padStart(2, '0')}`)) {
        number += 1;
    }

    return `Nested Sequence ${String(number).padStart(2, '0')}`;
}

/** The lowest track of a kind that holds one of the clips. The nested clip is placed there. */
function lowestTrack(sequence: Sequence, clips: Clip[], type: Track['type']): Track | undefined {
    const tracks = sequence.tracks.filter((track) => track.type === type && clips.some((clip) => clip.trackId === track.id));

    return tracks[0];
}

export function nestSelection(): void {
    const sequence = getActiveSequence();
    const state = editorStore.get();

    if (!sequence || state.selection.length === 0) {
        showToast('Select some clips to nest first.');
        return;
    }

    const ids = new Set(state.linkedSelection ? withLinkedClips(sequence, state.selection) : state.selection);
    const chosen = sequence.clips.filter((clip) => ids.has(clip.id) && !findTrack(sequence, clip.trackId)?.locked);

    if (chosen.length === 0) {
        return;
    }

    const first = Math.min(...chosen.map((clip) => clip.start));
    const last = Math.max(...chosen.map((clip) => clip.start + clip.duration));
    let nestClipIds: string[] = [];

    commit('Nest', (document) => {
        const name = nextNestName(document.sequences.map((item) => item.name));
        const inner = createSequence(name, sequence.settings);
        const trackMap = new Map<string, string>();
        const tracks = sequence.tracks.map((track) => {
            const copy: Track = {...track, id: createId(track.type === 'video' ? 'v' : 'a'), muted: false, solo: false, locked: false};

            trackMap.set(track.id, copy.id);

            return copy;
        });
        const innerClips = chosen.map((clip) => ({...clip, trackId: trackMap.get(clip.trackId) as string, start: clip.start - first}));
        const nested: Sequence = {...inner, tracks, clips: innerClips};

        const videoHost = lowestTrack(sequence, chosen, 'video');
        const audioHost = lowestTrack(sequence, chosen, 'audio');
        const linkId = videoHost && audioHost ? createId('link') : null;
        const hostClips: Clip[] = [];

        for (const host of [videoHost, audioHost]) {
            if (!host) {
                continue;
            }

            hostClips.push({
                ...chosen[0],
                id: createId('clip'),
                trackId: host.id,
                mediaId: '',
                name,
                start: first,
                inPoint: 0,
                duration: last - first,
                speed: 1,
                reverse: false,
                motion: {x: 0, y: 0, scale: 100, rotation: 0, opacity: 100},
                volumeDb: 0,
                pan: 0,
                effects: [],
                keyframes: {},
                color: defaultColor(),
                masks: [],
                text: null,
                frameMode: 'sampling',
                maintainPitch: true,
                nestId: nested.id,
                linkId,
                enabled: true,
                label: 'lavender'
            });
        }

        nestClipIds = hostClips.map((clip) => clip.id);

        const active = document.sequences.find((item) => item.id === document.activeSequenceId) as Sequence;
        let clips = active.clips.filter((clip) => !chosen.some((picked) => picked.id === clip.id));

        for (const clip of hostClips) {
            clips = clearRange(clips, clip.trackId, clip.start, clip.start + clip.duration);
        }

        const updated: Sequence = {...active, clips: [...clips, ...hostClips]};

        return {
            ...document,
            sequences: [...document.sequences.map((item) => (item.id === active.id ? updated : item)), nested]
        };
    });

    editorStore.set({selection: nestClipIds});
}

/** Double-clicking a nested clip opens the sequence that is inside it. */
export function openNestedSequence(clipId: string): void {
    const sequence = getActiveSequence();
    const clip = sequence ? findClip(sequence, clipId) : undefined;

    if (clip?.nestId) {
        activateSequence(clip.nestId);
    }
}
