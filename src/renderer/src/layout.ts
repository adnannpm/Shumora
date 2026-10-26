export interface TabGroup { ids: string[]; active: string }
export interface Layout { groups: TabGroup[]; focused: number; orientation: 'right' | 'down' }
export const initialLayout: Layout = { groups: [{ ids: [], active: '' }], focused: 0, orientation: 'right' }
export type LayoutAction =
  | { type: 'init'; ids: string[] }
  | { type: 'select'; group: number; id: string }
  | { type: 'focus'; group: number }
  | { type: 'add'; group: number; id: string }
  | { type: 'remove'; id: string }
  | { type: 'split'; orientation: Layout['orientation']; newId?: string }
  | { type: 'move'; group: number }
  | { type: 'drop'; id: string; group: number; before?: string }
  | { type: 'merge' }
function without(group: TabGroup, id: string): TabGroup {
  const ids = group.ids.filter(i => i !== id)
  return { ids, active: group.active === id ? ids[Math.min(group.ids.indexOf(id), ids.length - 1)] || '' : group.active }
}
function collapse(state: Layout): Layout {
  const focused = state.groups[state.focused]
  const groups = state.groups.filter(g => g.ids.length)
  return { ...state, groups: groups.length ? groups : [{ ids: [], active: '' }], focused: Math.max(0, groups.indexOf(focused)) }
}
export function layoutReducer(state: Layout, action: LayoutAction): Layout {
  switch (action.type) {
    case 'init': return { ...initialLayout, groups: [{ ids: action.ids, active: action.ids[0] || '' }] }
    case 'focus': return state.groups[action.group] ? { ...state, focused: action.group } : state
    case 'select': return { ...state, focused: action.group, groups: state.groups.map((g, i) => i === action.group && g.ids.includes(action.id) ? { ...g, active: action.id } : g) }
    case 'add': {
      if (state.groups.some(g => g.ids.includes(action.id))) return state
      const index = Math.min(action.group, state.groups.length - 1)
      return { ...state, focused: index, groups: state.groups.map((g, i) => i === index ? { ids: [...g.ids, action.id], active: action.id } : g) }
    }
    case 'remove': return collapse({ ...state, groups: state.groups.map(g => without(g, action.id)) })
    case 'split': {
      if (state.groups.length === 2) return { ...state, orientation: action.orientation }
      const group = state.groups[0]
      if (!group.active || (group.ids.length < 2 && !action.newId)) return state
      const id = action.newId || group.active
      return { groups: [action.newId ? group : without(group, id), { ids: [id], active: id }], focused: 1, orientation: action.orientation }
    }
    case 'drop': {
      if (!state.groups[action.group] || !state.groups.some(g => g.ids.includes(action.id)) || action.before === action.id) return state
      const groups = state.groups.map(g => without(g, action.id))
      const target = groups[action.group]
      const index = action.before ? target.ids.indexOf(action.before) : target.ids.length
      if (index < 0) return state
      target.ids.splice(index, 0, action.id)
      target.active = action.id
      return collapse({ ...state, focused: action.group, groups })
    }
    case 'move': {
      if (state.groups.length !== 2) return state
      const id = state.groups[action.group].active
      const target = 1 - action.group
      return collapse({ ...state, focused: target, groups: state.groups.map((g, i) => i === target ? { ids: [...g.ids, id], active: id } : without(g, id)) })
    }
    case 'merge': return { ...state, focused: 0, groups: [{ ids: state.groups.flatMap(g => g.ids), active: state.groups[state.focused].active }] }
  }
}
