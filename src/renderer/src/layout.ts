export interface TabGroup { ids: string[]; active: string }
export type SplitTree = number | { orientation: 'right' | 'down'; ratio: number; first: SplitTree; second: SplitTree }
export interface Layout { groups: TabGroup[]; focused: number; orientation: 'right' | 'down'; tree: SplitTree }
export const initialLayout: Layout = { groups: [{ ids: [], active: '' }], focused: 0, orientation: 'right', tree: 0 }
export type LayoutAction =
  | { type: 'init'; ids: string[]; saved?: unknown }
  | { type: 'select'; group: number; id: string }
  | { type: 'focus'; group: number }
  | { type: 'add'; group: number; id: string }
  | { type: 'remove'; id: string }
  | { type: 'split'; orientation: Layout['orientation']; newId?: string; group?: number }
  | { type: 'resize'; path: string; ratio: number }
  | { type: 'move'; group: number }
  | { type: 'drop'; id: string; group: number; before?: string }
  | { type: 'merge' }
export function restoreLayout(saved: unknown, ids: string[]): Layout {
  const fallback = { ...initialLayout, groups: [{ ids, active: ids[0] || '' }] }
  if (!ids.length || !saved || typeof saved !== 'object') return fallback
  const value = saved as Layout
  if (!Array.isArray(value.groups) || !value.groups.length || value.groups.length > 4 || !Number.isInteger(value.focused) || value.focused < 0 || value.focused >= value.groups.length || !['right', 'down'].includes(value.orientation)) return fallback
  const leaves = new Set<number>()
  function validTree(tree: SplitTree, depth = 0): boolean {
    if (typeof tree === 'number') {
      if (!Number.isInteger(tree) || tree < 0 || tree >= value.groups.length || leaves.has(tree)) return false
      leaves.add(tree); return true
    }
    return !!tree && depth < 3 && ['right', 'down'].includes(tree.orientation) && Number.isFinite(tree.ratio) && tree.ratio >= 25 && tree.ratio <= 75 && validTree(tree.first, depth + 1) && validTree(tree.second, depth + 1)
  }
  if (!validTree(value.tree) || leaves.size !== value.groups.length) return fallback
  const seen = new Set<string>()
  const groups: TabGroup[] = []
  for (const group of value.groups) {
    if (!group || !Array.isArray(group.ids) || group.ids.some(id => typeof id !== 'string')) return fallback
    const kept = group.ids.filter(id => { if (!ids.includes(id) || seen.has(id)) return false; seen.add(id); return true })
    groups.push({ ids: kept, active: kept.includes(group.active) ? group.active : kept[0] || '' })
  }
  groups[0].ids.push(...ids.filter(id => !seen.has(id)))
  if (!groups[0].active) groups[0].active = groups[0].ids[0] || ''
  return collapse({ groups, focused: value.focused, orientation: value.orientation, tree: value.tree })
}
function without(group: TabGroup, id: string): TabGroup {
  const ids = group.ids.filter(i => i !== id)
  return { ids, active: group.active === id ? ids[Math.min(group.ids.indexOf(id), ids.length - 1)] || '' : group.active }
}
function collapse(state: Layout): Layout {
  const focused = state.groups[state.focused]
  const groups = state.groups.filter(g => g.ids.length)
  function prune(tree: SplitTree): SplitTree | null {
    if (typeof tree === 'number') { const index = groups.indexOf(state.groups[tree]); return index < 0 ? null : index }
    const first = prune(tree.first), second = prune(tree.second)
    return first === null ? second : second === null ? first : { ...tree, first, second }
  }
  return { ...state, tree: prune(state.tree) ?? 0, groups: groups.length ? groups : [{ ids: [], active: '' }], focused: Math.max(0, groups.indexOf(focused)) }
}
export function layoutReducer(state: Layout, action: LayoutAction): Layout {
  switch (action.type) {
    case 'init': return restoreLayout(action.saved, action.ids)
    case 'focus': return state.groups[action.group] ? { ...state, focused: action.group } : state
    case 'select': return state.groups[action.group]?.ids.includes(action.id) ? { ...state, focused: action.group, groups: state.groups.map((g, i) => i === action.group ? { ...g, active: action.id } : g) } : state
    case 'add': {
      if (state.groups.some(g => g.ids.includes(action.id))) return state
      const index = Math.max(0, Math.min(action.group, state.groups.length - 1))
      return { ...state, focused: index, groups: state.groups.map((g, i) => i === index ? { ids: [...g.ids, action.id], active: action.id } : g) }
    }
    case 'remove': return collapse({ ...state, groups: state.groups.map(g => without(g, action.id)) })
    case 'split': {
      if (state.groups.length >= 4) return state
      const index = action.group ?? state.focused, group = state.groups[index]
      if (!group?.active || (group.ids.length < 2 && !action.newId) || (action.newId && state.groups.some(g => g.ids.includes(action.newId!)))) return state
      const id = action.newId || group.active, next = state.groups.length, orientation = action.orientation
      function insert(tree: SplitTree): SplitTree {
        if (typeof tree === 'number') return tree === index ? { orientation, ratio: 50, first: index, second: next } : tree
        return { ...tree, first: insert(tree.first), second: insert(tree.second) }
      }
      return { groups: [...state.groups.map((g, i) => i === index && !action.newId ? without(g, id) : g), { ids: [id], active: id }], focused: next, orientation: action.orientation, tree: insert(state.tree) }
    }
    case 'resize': {
      const ratio = Math.max(25, Math.min(75, action.ratio))
      function resize(tree: SplitTree, path: string): SplitTree {
        if (typeof tree === 'number') return tree
        if (!path) return { ...tree, ratio }
        const [side, ...rest] = path.split('.')
        return side === 'first' || side === 'second' ? { ...tree, [side]: resize(tree[side], rest.join('.')) } : tree
      }
      return { ...state, tree: resize(state.tree, action.path) }
    }
    case 'drop': {
      if (!state.groups[action.group] || !state.groups.some(g => g.ids.includes(action.id)) || action.before === action.id) return state
      const groups = state.groups.map(g => without(g, action.id)), target = groups[action.group]
      const index = action.before ? target.ids.indexOf(action.before) : target.ids.length
      if (index < 0) return state
      target.ids.splice(index, 0, action.id); target.active = action.id
      return collapse({ ...state, focused: action.group, groups })
    }
    case 'move': {
      if (state.groups.length < 2 || !state.groups[action.group]) return state
      const id = state.groups[action.group].active, target = (action.group + 1) % state.groups.length
      return collapse({ ...state, focused: target, groups: state.groups.map((g, i) => i === target ? { ids: [...g.ids, id], active: id } : without(g, id)) })
    }
    case 'merge': return { ...state, tree: 0, focused: 0, groups: [{ ids: state.groups.flatMap(g => g.ids), active: state.groups[state.focused].active }] }
  }
}

// Flat rectangles keep terminal components mounted while their split ancestry changes.
export interface PaneRect { left: number; top: number; width: number; height: number }
export function layoutRects(tree: SplitTree) {
  const panes: Record<number, PaneRect> = {}
  const separators: (PaneRect & { path: string; orientation: 'right' | 'down'; ratio: number; bounds: PaneRect })[] = []
  function visit(node: SplitTree, bounds: PaneRect, path: string) {
    if (typeof node === 'number') { panes[node] = bounds; return }
    const { left, top, width, height } = bounds, fraction = node.ratio / 100
    const right = node.orientation === 'right'
    separators.push({ ...bounds, left: right ? left + width * fraction : left, top: right ? top : top + height * fraction, width: right ? 0 : width, height: right ? height : 0, path, orientation: node.orientation, ratio: node.ratio, bounds })
    visit(node.first, { left, top, width: right ? width * fraction : width, height: right ? height : height * fraction }, path ? `${path}.first` : 'first')
    visit(node.second, { left: right ? left + width * fraction : left, top: right ? top : top + height * fraction, width: right ? width * (1 - fraction) : width, height: right ? height : height * (1 - fraction) }, path ? `${path}.second` : 'second')
  }
  visit(tree, { left: 0, top: 0, width: 100, height: 100 }, '')
  return { panes, separators }
}
