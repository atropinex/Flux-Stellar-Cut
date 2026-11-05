import type {Clip, MediaItem, Sequence, Track} from '../../../common/stellar/StellarContract';
import {createClip} from '../../../common/stellar/StellarProjectFactory';
import {clamp, createId} from '../../../common/utils/StellarTimeHelper';

// All timeline edits are plain functions: they take a sequence and give back a new one.
// Nothing here touches the screen, so every edit can be tested and undone by keeping the old sequence.

const EPSILON = 1e-6;

/** Where a clip's source range starts after seconds are cut from the front of the clip on the timeline. */
export function inPointAfterHeadCut(clip: Clip, seconds: number): number {
    return clip.reverse ? clip.inPoint : clip.inPoint + seconds * clip.speed;
}

/** Where a clip's source range starts after seconds are cut from the back of the clip on the timeline. */
export function inPointAfterTailCut(clip: Clip, seconds: number): number {
    return clip.reverse ? clip.inPoint + seconds * clip.speed : clip.inPoint;
}

export function clipEnd(clip: Clip): number {
    return clip.start + clip.duration;
}

export function sequenceDuration(sequence: Sequence): number {
    return sequence.clips.reduce((latest, clip) => Math.max(latest, clipEnd(clip)), 0);
}

export function findClip(sequence: Sequence, id: string): Clip | undefined {
    return sequence.clips.find((clip) => clip.id === id);
}

export function findTrack(sequence: Sequence, id: string): Track | undefined {
    return sequence.tracks.find((track) => track.id === id);
}

export function tracksOfType(sequence: Sequence, type: Track['type']): Track[] {
    return sequence.tracks.filter((track) => track.type === type);
}

/** How much of the source file the clip uses. */
export function sourceLength(clip: Clip): number {
    return clip.duration * clip.speed;
}

function replaceClips(sequence: Sequence, clips: Clip[]): Sequence {
    return {...sequence, clips};
}

// === Selection === //

/** A selected clip also selects the clips linked to it (the sound of a video, for example). */
export function withLinkedClips(sequence: Sequence, ids: string[]): string[] {
    const linkIds = new Set<string>();

    for (const id of ids) {
        const clip = findClip(sequence, id);

        if (clip?.linkId) {
            linkIds.add(clip.linkId);
        }
    }

    const result = new Set(ids);

    for (const clip of sequence.clips) {
        if (clip.linkId && linkIds.has(clip.linkId)) {
            result.add(clip.id);
        }
    }

    return [...result];
}

export function clipsAtOrAfter(sequence: Sequence, clipId: string): string[] {
    const anchor = findClip(sequence, clipId);

    if (!anchor) {
        return [];
    }

    return sequence.clips
        .filter((clip) => clip.trackId === anchor.trackId && clip.start >= anchor.start - EPSILON)
        .map((clip) => clip.id);
}

// === Making room === //

/**
 * Clears the time range [start, end) on one track, the way "overwrite" does.
 * Clips inside are removed, clips at the edges are trimmed, a clip around the range is cut in two.
 */
export function clearRange(clips: Clip[], trackId: string, start: number, end: number, keepIds: Set<string> = new Set()): Clip[] {
    const result: Clip[] = [];

    for (const clip of clips) {
        const isOnTrack = clip.trackId === trackId && !keepIds.has(clip.id);
        const overlaps = clip.start < end - EPSILON && clipEnd(clip) > start + EPSILON;

        if (!isOnTrack || !overlaps) {
            result.push(clip);
            continue;
        }

        const startsBefore = clip.start < start - EPSILON;
        const endsAfter = clipEnd(clip) > end + EPSILON;

        if (startsBefore) {
            result.push({...clip, duration: start - clip.start, inPoint: inPointAfterTailCut(clip, clip.duration - (start - clip.start))});
        }

        if (endsAfter) {
            const cut = end - clip.start;

            result.push({
                ...clip,
                id: startsBefore ? createId('clip') : clip.id,
                linkId: startsBefore ? null : clip.linkId,
                start: end,
                inPoint: inPointAfterHeadCut(clip, cut),
                duration: clipEnd(clip) - end
            });
        }
    }

    return result;
}

// === Splitting === //

/** Cuts one clip in two at a time. The second part gets a new id. */
function splitOne(clip: Clip, time: number, rightLinkId: string | null): [Clip, Clip] {
    const leftDuration = time - clip.start;
    const left: Clip = {...clip, duration: leftDuration, inPoint: inPointAfterTailCut(clip, clip.duration - leftDuration)};
    const right: Clip = {
        ...clip,
        id: createId('clip'),
        linkId: rightLinkId,
        start: time,
        inPoint: inPointAfterHeadCut(clip, leftDuration),
        duration: clip.duration - leftDuration
    };

    return [left, right];
}

function canSplit(clip: Clip, time: number): boolean {
    return time > clip.start + EPSILON && time < clipEnd(clip) - EPSILON;
}

/** Adds an edit at a time on the given clips (and the clips linked to them). */
export function splitClipsAt(sequence: Sequence, clipIds: string[], time: number): Sequence {
    const ids = new Set(withLinkedClips(sequence, clipIds));
    const newLinkIds = new Map<string, string>(); // old link id -> link id for the right halves
    const result: Clip[] = [];

    for (const clip of sequence.clips) {
        if (!ids.has(clip.id) || !canSplit(clip, time)) {
            result.push(clip);
            continue;
        }

        let rightLinkId: string | null = null;

        if (clip.linkId) {
            if (!newLinkIds.has(clip.linkId)) {
                newLinkIds.set(clip.linkId, createId('link'));
            }
            rightLinkId = newLinkIds.get(clip.linkId) ?? null;
        }

        result.push(...splitOne(clip, time, rightLinkId));
    }

    return replaceClips(sequence, result);
}

/** Splits every clip under the time, on tracks that are not locked. */
export function splitAllTracksAt(sequence: Sequence, time: number): Sequence {
    const ids = sequence.clips
        .filter((clip) => canSplit(clip, time) && !findTrack(sequence, clip.trackId)?.locked)
        .map((clip) => clip.id);

    return splitClipsAt(sequence, ids, time);
}

export function clipsUnderTime(sequence: Sequence, time: number, ids?: string[]): string[] {
    return sequence.clips
        .filter((clip) => canSplit(clip, time) && (!ids || ids.includes(clip.id)))
        .map((clip) => clip.id);
}

// === Moving === //

/**
 * Moves clips by a time and by a number of tracks. Whatever is under the new place is overwritten.
 * Clips never leave their track type: a video clip stays on video tracks.
 */
export function moveClips(sequence: Sequence, ids: string[], deltaTime: number, deltaTracks: number, shiftType?: Track['type']): Sequence {
    const moving = new Set(ids);
    const moved: Clip[] = [];
    const others: Clip[] = [];

    for (const clip of sequence.clips) {
        if (moving.has(clip.id)) {
            moved.push(clip);
        } else {
            others.push(clip);
        }
    }

    if (moved.length === 0) {
        return sequence;
    }

    const earliest = Math.min(...moved.map((clip) => clip.start));
    const safeDelta = Math.max(deltaTime, -earliest); // nothing may start before 0

    const placed = moved.map((clip) => {
        const type = findTrack(sequence, clip.trackId)?.type;
        const trackId = !shiftType || type === shiftType ? shiftTrack(sequence, clip.trackId, deltaTracks) : clip.trackId;

        return {...clip, trackId, start: clip.start + safeDelta};
    });

    let remaining = others;

    for (const clip of placed) {
        remaining = clearRange(remaining, clip.trackId, clip.start, clipEnd(clip));
    }

    return replaceClips(sequence, [...remaining, ...placed]);
}

function shiftTrack(sequence: Sequence, trackId: string, delta: number): string {
    const track = findTrack(sequence, trackId);

    if (!track || delta === 0) {
        return trackId;
    }

    const sameType = tracksOfType(sequence, track.type);
    const index = sameType.findIndex((item) => item.id === trackId);
    const target = sameType[clamp(index + delta, 0, sameType.length - 1)];

    return target.id;
}

/** Lowest and highest track shift that keeps every selected clip on a track of its own type. */
export function allowedTrackShift(sequence: Sequence, ids: string[], onlyType?: Track['type']): { min: number; max: number } {
    let min = -Infinity;
    let max = Infinity;

    for (const id of ids) {
        const clip = findClip(sequence, id);
        const track = clip ? findTrack(sequence, clip.trackId) : undefined;

        if (!clip || !track || (onlyType && track.type !== onlyType)) {
            continue;
        }

        const sameType = tracksOfType(sequence, track.type);
        const index = sameType.findIndex((item) => item.id === track.id);

        min = Math.max(min, -index);
        max = Math.min(max, sameType.length - 1 - index);
    }

    return {min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0};
}

// === Trimming === //

export interface TrimLimits {
    min: number;
    max: number;
}

/** How far the start or end edge of a clip can move, from the source length and the neighbors. */
export function trimLimits(sequence: Sequence, clip: Clip, edge: 'start' | 'end', mediaDuration: number, isStill: boolean, ripple: boolean): TrimLimits {
    const neighbors = sequence.clips.filter((other) => other.trackId === clip.trackId && other.id !== clip.id);
    const previousEnd = neighbors.filter((other) => clipEnd(other) <= clip.start + EPSILON).reduce((latest, other) => Math.max(latest, clipEnd(other)), 0);
    const nextStart = neighbors.filter((other) => other.start >= clipEnd(clip) - EPSILON).reduce((soonest, other) => Math.min(soonest, other.start), Infinity);
    const minLength = 1 / 120;

    if (edge === 'start') {
        const roomBefore = clip.reverse ? (mediaDuration - (clip.inPoint + clip.duration * clip.speed)) / clip.speed : clip.inPoint / clip.speed;
        const sourceRoom = isStill ? Infinity : Math.max(0, roomBefore);
        const min = Math.max(ripple ? clip.start - sourceRoom : previousEnd, clip.start - sourceRoom);

        return {min: Math.max(0, min), max: clipEnd(clip) - minLength};
    }

    const roomAfter = clip.reverse ? clip.inPoint / clip.speed + clip.duration : (mediaDuration - clip.inPoint) / clip.speed;
    const sourceRoom = isStill ? Infinity : Math.max(0, roomAfter);
    const max = Math.min(ripple ? Infinity : nextStart, clip.start + sourceRoom);

    return {min: clip.start + minLength, max};
}

/**
 * Moves one edge of a clip to a new time. With ripple, the clips after the edit slide to close or open the gap.
 * Clips linked to it are trimmed by the same amount.
 */
export function trimClip(sequence: Sequence, clipId: string, edge: 'start' | 'end', time: number, ripple: boolean, linked: boolean): Sequence {
    const clip = findClip(sequence, clipId);

    if (!clip) {
        return sequence;
    }

    const ids = new Set(linked ? withLinkedClips(sequence, [clipId]) : [clipId]);
    const oldEnd = clipEnd(clip);
    const delta = edge === 'start' ? time - clip.start : time - oldEnd;
    const affectedTracks = new Set<string>();
    const result: Clip[] = [];

    for (const item of sequence.clips) {
        if (!ids.has(item.id)) {
            result.push(item);
            continue;
        }

        affectedTracks.add(item.trackId);

        if (edge === 'start') {
            result.push({...item, start: ripple ? item.start : item.start + delta, inPoint: inPointAfterHeadCut(item, delta), duration: item.duration - delta});
        } else {
            result.push({...item, duration: item.duration + delta, inPoint: inPointAfterTailCut(item, -delta)});
        }
    }

    if (!ripple || Math.abs(delta) < EPSILON) {
        return replaceClips(sequence, result);
    }

    // The clips after the edit point slide by the change in length.
    const shift = edge === 'start' ? -delta : delta;
    const shifted = result.map((item) => {
        const isTrimmed = ids.has(item.id);
        const isAfter = item.start >= oldEnd - EPSILON && !isTrimmed;
        const isLocked = findTrack(sequence, item.trackId)?.locked ?? false;

        return isAfter && !isLocked ? {...item, start: Math.max(0, item.start + shift)} : item;
    });

    return replaceClips(sequence, shifted);
}

// === Deleting === //

/** Removes clips and leaves a gap. */
export function liftClips(sequence: Sequence, ids: string[]): Sequence {
    const remove = new Set(ids);

    return replaceClips(sequence, sequence.clips.filter((clip) => !remove.has(clip.id)));
}

/** Removes clips and closes the gap on every track that is not locked. */
export function rippleDeleteClips(sequence: Sequence, ids: string[]): Sequence {
    const remove = new Set(ids);
    const removed = sequence.clips.filter((clip) => remove.has(clip.id));

    if (removed.length === 0) {
        return sequence;
    }

    const start = Math.min(...removed.map((clip) => clip.start));
    const end = Math.max(...removed.map(clipEnd));

    return extractRange(liftClips(sequence, ids), start, end);
}

/** Removes a time range from every track that is not locked and closes the gap. */
export function extractRange(sequence: Sequence, start: number, end: number): Sequence {
    const length = end - start;
    let clips = sequence.clips;

    for (const track of sequence.tracks) {
        if (!track.locked) {
            clips = clearRange(clips, track.id, start, end);
        }
    }

    const closed = clips.map((clip) => {
        const isLocked = findTrack(sequence, clip.trackId)?.locked ?? false;

        return !isLocked && clip.start >= end - EPSILON ? {...clip, start: clip.start - length} : clip;
    });

    return replaceClips(sequence, closed);
}

/** Removes a time range from every track that is not locked and leaves the gap. */
export function liftRange(sequence: Sequence, start: number, end: number): Sequence {
    let clips = sequence.clips;

    for (const track of sequence.tracks) {
        if (!track.locked) {
            clips = clearRange(clips, track.id, start, end);
        }
    }

    return replaceClips(sequence, clips);
}

// === Adding media === //

export interface PlaceOptions {
    mode: 'insert' | 'overwrite';
    time: number;
    videoTrackId: string | null;
    audioTrackId: string | null;
    sourceIn: number;
    sourceOut: number;
    stillDuration: number;
}

export interface PlaceResult {
    sequence: Sequence;
    clipIds: string[];
}

/** Puts a media item on the timeline. Video with sound becomes a video clip and a linked audio clip. */
export function placeMedia(sequence: Sequence, media: MediaItem, options: PlaceOptions): PlaceResult {
    const isStill = media.kind === 'image';
    const length = isStill ? options.stillDuration : Math.max(0, options.sourceOut - options.sourceIn);

    if (length <= EPSILON) {
        return {sequence, clipIds: []};
    }

    const linkId = media.kind === 'video' && media.hasAudio ? createId('link') : null;
    const newClips: Clip[] = [];

    if (media.hasVideo && options.videoTrackId) {
        newClips.push(createClip({
            trackId: options.videoTrackId, mediaId: media.id, name: media.name,
            start: options.time, inPoint: isStill ? 0 : options.sourceIn, duration: length,
            linkId, label: isStill ? 'mint' : 'iris'
        }));
    }

    if (media.hasAudio && !isStill && options.audioTrackId) {
        newClips.push(createClip({
            trackId: options.audioTrackId, mediaId: media.id, name: media.name,
            start: options.time, inPoint: options.sourceIn, duration: length,
            linkId, label: 'forest'
        }));
    }

    if (newClips.length === 0) {
        return {sequence, clipIds: []};
    }

    return {sequence: addClips(sequence, newClips, options.mode, options.time, length), clipIds: newClips.map((clip) => clip.id)};
}

/** Insert pushes everything after the time to the right. Overwrite replaces what is there. */
export function addClips(sequence: Sequence, newClips: Clip[], mode: 'insert' | 'overwrite', time: number, length: number): Sequence {
    let clips = sequence.clips;

    if (mode === 'insert') {
        const splitIds = clipsUnderTime({...sequence, clips}, time).filter((id) => !findTrack(sequence, findClip(sequence, id)?.trackId ?? '')?.locked);
        clips = splitClipsAt({...sequence, clips}, splitIds, time).clips;
        clips = clips.map((clip) => {
            const isLocked = findTrack(sequence, clip.trackId)?.locked ?? false;

            return !isLocked && clip.start >= time - EPSILON ? {...clip, start: clip.start + length} : clip;
        });
    } else {
        for (const clip of newClips) {
            clips = clearRange(clips, clip.trackId, clip.start, clipEnd(clip));
        }
    }

    return replaceClips(sequence, [...clips, ...newClips]);
}

/** Pastes copied clips so the earliest one starts at the time. */
export function pasteClips(sequence: Sequence, copied: Clip[], time: number, mode: 'insert' | 'overwrite'): PlaceResult {
    if (copied.length === 0) {
        return {sequence, clipIds: []};
    }

    const earliest = Math.min(...copied.map((clip) => clip.start));
    const latest = Math.max(...copied.map(clipEnd));
    const linkMap = new Map<string, string>();

    const pasted = copied
        .filter((clip) => findTrack(sequence, clip.trackId))
        .map((clip) => {
            let linkId: string | null = null;

            if (clip.linkId) {
                if (!linkMap.has(clip.linkId)) {
                    linkMap.set(clip.linkId, createId('link'));
                }
                linkId = linkMap.get(clip.linkId) ?? null;
            }

            return {...clip, id: createId('clip'), linkId, start: time + (clip.start - earliest)};
        });

    return {sequence: addClips(sequence, pasted, mode, time, latest - earliest), clipIds: pasted.map((clip) => clip.id)};
}

// === Ripple trim to the playhead (Q and W) === //

/**
 * Q ("previous"): the clip under the playhead loses everything before the playhead.
 * W ("next"): the clip under the playhead loses everything after the playhead.
 * The clips after it slide to close the gap.
 */
export function rippleTrimToTime(sequence: Sequence, time: number, direction: 'previous' | 'next'): Sequence {
    const target = sequence.clips.find((clip) => canSplit(clip, time) && !findTrack(sequence, clip.trackId)?.locked);

    if (!target) {
        return sequence;
    }

    return trimClip(sequence, target.id, direction === 'previous' ? 'start' : 'end', time, true, true);
}

// === Edit points and snapping === //

export function editPoints(sequence: Sequence, excludeIds: Set<string> = new Set()): number[] {
    const points = new Set<number>([0]);

    for (const clip of sequence.clips) {
        if (!excludeIds.has(clip.id)) {
            points.add(clip.start);
            points.add(clipEnd(clip));
        }
    }

    return [...points].sort((a, b) => a - b);
}

export function snapPoints(sequence: Sequence, playhead: number, excludeIds: Set<string>): number[] {
    const points = editPoints(sequence, excludeIds);

    points.push(playhead);

    for (const marker of sequence.markers) {
        points.push(marker.time);
    }

    if (sequence.inPoint !== null) {
        points.push(sequence.inPoint);
    }

    if (sequence.outPoint !== null) {
        points.push(sequence.outPoint);
    }

    return points;
}

/** Finds the closest point within a distance. Returns the snapped time, or null if nothing is close. */
export function snapToPoints(time: number, points: number[], maxDistance: number): number | null {
    let best: number | null = null;
    let bestDistance = maxDistance;

    for (const point of points) {
        const distance = Math.abs(point - time);

        if (distance <= bestDistance) {
            best = point;
            bestDistance = distance;
        }
    }

    return best;
}

export function previousEditPoint(sequence: Sequence, time: number): number {
    const before = editPoints(sequence).filter((point) => point < time - EPSILON);

    return before.length > 0 ? before[before.length - 1] : 0;
}

export function nextEditPoint(sequence: Sequence, time: number): number {
    const after = editPoints(sequence).filter((point) => point > time + EPSILON);

    return after.length > 0 ? after[0] : sequenceDuration(sequence);
}

// === Tracks === //

export function addTrack(sequence: Sequence, type: Track['type']): Sequence {
    const count = tracksOfType(sequence, type).length + 1;
    const prefix = type === 'video' ? 'V' : 'A';
    const track: Track = {id: createId(type === 'video' ? 'v' : 'a'), type, name: `${prefix}${count}`, muted: false, locked: false, solo: false, volumeDb: 0, pan: 0};
    const videoTracks = tracksOfType(sequence, 'video');
    const audioTracks = tracksOfType(sequence, 'audio');

    return {...sequence, tracks: type === 'video' ? [...videoTracks, track, ...audioTracks] : [...videoTracks, ...audioTracks, track]};
}

export function removeTrack(sequence: Sequence, trackId: string): Sequence {
    const track = findTrack(sequence, trackId);

    if (!track || tracksOfType(sequence, track.type).length <= 1) {
        return sequence;
    }

    const tracks = sequence.tracks.filter((item) => item.id !== trackId);
    const renamed = tracks.map((item) => {
        const sameType = tracks.filter((other) => other.type === item.type);

        return {...item, name: `${item.type === 'video' ? 'V' : 'A'}${sameType.indexOf(item) + 1}`};
    });

    return {...sequence, tracks: renamed, clips: sequence.clips.filter((clip) => clip.trackId !== trackId)};
}

export function updateTrack(sequence: Sequence, trackId: string, changes: Partial<Track>): Sequence {
    return {...sequence, tracks: sequence.tracks.map((track) => (track.id === trackId ? {...track, ...changes} : track))};
}

export function updateClips(sequence: Sequence, ids: string[], change: (clip: Clip) => Clip): Sequence {
    const target = new Set(ids);

    return replaceClips(sequence, sequence.clips.map((clip) => (target.has(clip.id) ? change(clip) : clip)));
}

/** Links clips so they move together. */
export function linkClips(sequence: Sequence, ids: string[]): Sequence {
    const linkId = createId('link');

    return updateClips(sequence, ids, (clip) => ({...clip, linkId}));
}

export function unlinkClips(sequence: Sequence, ids: string[]): Sequence {
    return updateClips(sequence, withLinkedClips(sequence, ids), (clip) => ({...clip, linkId: null}));
}

/** Clips that touch a time range, for the marquee selection. */
export function clipsInRegion(sequence: Sequence, startTime: number, endTime: number, trackIds: Set<string>): string[] {
    return sequence.clips
        .filter((clip) => trackIds.has(clip.trackId) && clip.start < endTime && clipEnd(clip) > startTime)
        .map((clip) => clip.id);
}
