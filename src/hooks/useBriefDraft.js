// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Drives the brief-to-draft review surface: streaming state + the editable plan.
// The reducer only ever APPENDS streamed items (milestone shells, then tasks)
// and mutates existing rows BY cid — so a professor editing an item that has
// already streamed in is never clobbered by later arrivals. Discarding cancels
// pending emissions. Nothing here is persisted; confirm happens in the caller.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { parseDraft, streamDraft, nextCid } from '../lib/aiDraft.js';

const emptyMilestone = () => ({ cid: nextCid('m'), name: '', dueAt: null, tasks: [] });
const emptyTask = () => ({ cid: nextCid('t'), name: '', description: '' });

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { milestones: [] };
    case 'APPEND_MILESTONE':
      return { milestones: [...state.milestones, action.milestone] };
    case 'APPEND_TASK':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.mCid ? { ...m, tasks: [...m.tasks, action.task] } : m),
      };
    case 'RENAME_MILESTONE':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.cid ? { ...m, name: action.name } : m),
      };
    case 'SET_MDATE':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.cid ? { ...m, dueAt: action.dueAt || null } : m),
      };
    case 'ADD_MILESTONE':
      return { milestones: [...state.milestones, emptyMilestone()] };
    case 'REMOVE_MILESTONE':
      return { milestones: state.milestones.filter((m) => m.cid !== action.cid) };
    case 'MOVE_MILESTONE': {
      const i = state.milestones.findIndex((m) => m.cid === action.cid);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= state.milestones.length) return state;
      const next = state.milestones.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return { milestones: next };
    }
    case 'ADD_TASK':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.mCid ? { ...m, tasks: [...m.tasks, emptyTask()] } : m),
      };
    case 'REMOVE_TASK':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.mCid ? { ...m, tasks: m.tasks.filter((t) => t.cid !== action.tCid) } : m),
      };
    case 'RENAME_TASK':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.mCid
            ? { ...m, tasks: m.tasks.map((t) => (t.cid === action.tCid ? { ...t, name: action.name } : t)) }
            : m),
      };
    case 'SET_TDESC':
      return {
        milestones: state.milestones.map((m) =>
          m.cid === action.mCid
            ? { ...m, tasks: m.tasks.map((t) => (t.cid === action.tCid ? { ...t, description: action.desc } : t)) }
            : m),
      };
    default:
      return state;
  }
}

// status: 'idle' → 'drafting' → 'ready'. `source` is any function returning a
// Promise of the raw draft blob (the fixture today, a fetch tomorrow).
export function useBriefDraft() {
  const [state, dispatch] = useReducer(reducer, { milestones: [] });
  const statusRef = useRef('idle');
  const [, force] = useReducer((n) => n + 1, 0);
  const setStatus = (s) => { statusRef.current = s; force(); };
  const cancelRef = useRef(null);
  const errRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    if (cancelRef.current) cancelRef.current();
  }, []);

  const discard = useCallback(() => {
    if (cancelRef.current) { cancelRef.current(); cancelRef.current = null; }
    errRef.current = null;
    dispatch({ type: 'RESET' });
    setStatus('idle');
  }, []);

  const startDraft = useCallback(async (source, { onDescription } = {}) => {
    if (cancelRef.current) cancelRef.current();
    errRef.current = null;
    dispatch({ type: 'RESET' });
    setStatus('drafting');
    let plan;
    try {
      const raw = await source();
      plan = parseDraft(raw); // defensive: never throws on shape
    } catch (e) {
      if (!mounted.current) return;
      errRef.current = e?.message || 'Could not draft from the brief.';
      setStatus('idle');
      return;
    }
    if (!mounted.current) return;
    if (plan.milestones.length === 0) {
      // Nothing usable came back — fall back to manual entry, non-blocking.
      errRef.current = 'The draft came back empty. Fill in the plan manually.';
      setStatus('idle');
      return;
    }
    cancelRef.current = streamDraft(plan, {
      onDescription: (d) => { if (mounted.current && onDescription) onDescription(d); },
      onMilestone: (m) => { if (mounted.current) dispatch({ type: 'APPEND_MILESTONE', milestone: m }); },
      onTask: (mCid, t) => { if (mounted.current) dispatch({ type: 'APPEND_TASK', mCid, task: t }); },
      onDone: () => { if (mounted.current) { cancelRef.current = null; setStatus('ready'); } },
    });
  }, []);

  const actions = {
    renameMilestone: (cid, name) => dispatch({ type: 'RENAME_MILESTONE', cid, name }),
    setMilestoneDate: (cid, dueAt) => dispatch({ type: 'SET_MDATE', cid, dueAt }),
    addMilestone: () => dispatch({ type: 'ADD_MILESTONE' }),
    removeMilestone: (cid) => dispatch({ type: 'REMOVE_MILESTONE', cid }),
    moveMilestone: (cid, dir) => dispatch({ type: 'MOVE_MILESTONE', cid, dir }),
    addTask: (mCid) => dispatch({ type: 'ADD_TASK', mCid }),
    removeTask: (mCid, tCid) => dispatch({ type: 'REMOVE_TASK', mCid, tCid }),
    renameTask: (mCid, tCid, name) => dispatch({ type: 'RENAME_TASK', mCid, tCid, name }),
    setTaskDesc: (mCid, tCid, desc) => dispatch({ type: 'SET_TDESC', mCid, tCid, desc }),
  };

  return {
    status: statusRef.current,
    error: errRef.current,
    milestones: state.milestones,
    hasPlan: state.milestones.length > 0,
    startDraft,
    discard,
    actions,
  };
}
